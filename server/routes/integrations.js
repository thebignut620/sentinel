import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as gws from '../services/googleWorkspace.js';
import { sendGoogleTempPassword } from '../services/email.js';

const router = express.Router();
const CLIENT_URL = process.env.CLIENT_URL || 'https://sentinel-eta-woad.vercel.app';

// ─── OAUTH FLOW ───────────────────────────────────────────────────────────────

// Return the Google OAuth URL (requires auth so the redirect URL is token-protected)
router.get('/google/connect-url', authenticate, requireRole('admin'), (req, res) => {
  res.json({ url: gws.getAuthUrl() });
});

// Google OAuth callback — no auth header (browser redirect from Google)
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect(`${CLIENT_URL}/admin/integrations?error=oauth_denied`);
  }
  try {
    const tokens = await gws.exchangeCode(String(code));
    await db.run("UPDATE integrations SET is_active = 0 WHERE provider = 'google'");
    await db.run(
      `INSERT INTO integrations (provider, access_token, refresh_token, token_expiry, is_active)
       VALUES ('google', ?, ?, ?, 1)`,
      tokens.access_token,
      tokens.refresh_token ?? null,
      tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    );
    res.redirect(`${CLIENT_URL}/admin/integrations?connected=1`);
  } catch (err) {
    console.error('[integrations] OAuth callback error:', err.message);
    res.redirect(`${CLIENT_URL}/admin/integrations?error=oauth_failed`);
  }
});

// ─── STATUS ───────────────────────────────────────────────────────────────────

router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  const integration = await gws.getIntegration();
  if (!integration) return res.json({ connected: false });
  res.json({
    connected: true,
    connected_at: integration.connected_at,
    last_sync_at: integration.last_sync_at,
    actions_enabled: ['password_reset', 'account_unlock', 'access_grant'],
  });
});

router.delete('/google', authenticate, requireRole('admin'), async (req, res) => {
  await db.run("UPDATE integrations SET is_active = 0 WHERE provider = 'google'");
  res.json({ ok: true });
});

// ─── USER CONTEXT ─────────────────────────────────────────────────────────────

router.get('/user-context', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email required' });
  const context = await gws.lookupUser(email);
  res.json(context || { found: false });
});

// ─── ATLAS ACTIONS ────────────────────────────────────────────────────────────

router.get('/actions', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const { ticket_id, status } = req.query;
  let query = `
    SELECT aa.*, t.title as ticket_title, u.name as approver_name
    FROM atlas_actions aa
    JOIN tickets t ON aa.ticket_id = t.id
    LEFT JOIN users u ON aa.approved_by = u.id
    WHERE 1=1
  `;
  const params = [];
  if (ticket_id) { query += ' AND aa.ticket_id = ?'; params.push(ticket_id); }
  if (status)    { query += ' AND aa.status = ?';    params.push(status); }
  query += ' ORDER BY aa.requested_at DESC LIMIT 50';
  res.json(await db.all(query, ...params));
});

// Update details on a pending action (e.g. drive_id for access_grant)
router.patch('/actions/:id', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const action = await db.get('SELECT * FROM atlas_actions WHERE id = ?', req.params.id);
  if (!action)                    return res.status(404).json({ error: 'Action not found' });
  if (action.status !== 'pending') return res.status(409).json({ error: 'Action already handled' });

  const { drive_id, role } = req.body;
  const details = JSON.parse(action.details || '{}');
  if (drive_id !== undefined) details.drive_id = drive_id;
  if (role      !== undefined) details.role = role;

  await db.run('UPDATE atlas_actions SET details = ? WHERE id = ?', JSON.stringify(details), action.id);
  res.json({ ok: true });
});

// Approve + execute
router.post('/actions/:id/approve', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const action = await db.get('SELECT * FROM atlas_actions WHERE id = ?', req.params.id);
  if (!action)                    return res.status(404).json({ error: 'Action not found' });
  if (action.status !== 'pending') return res.status(409).json({ error: 'Action already handled' });

  await db.run(
    'UPDATE atlas_actions SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?',
    'approved', req.user.id, action.id,
  );

  try {
    let result = '';
    const { action_type, target_email, ticket_id } = action;
    const details = JSON.parse(action.details || '{}');

    if (action_type === 'password_reset') {
      const { tempPassword } = await gws.resetPassword(target_email);
      const submitter = await db.get(
        'SELECT name, email FROM users WHERE id = (SELECT submitter_id FROM tickets WHERE id = ?)',
        ticket_id,
      );
      if (submitter) {
        await sendGoogleTempPassword({
          to: submitter.email,
          name: submitter.name,
          tempPassword,
          ticketId: ticket_id,
        });
      }
      result = `Password reset. Temporary password sent to ${target_email}. User must change on next login.`;
      await db.run(
        "UPDATE tickets SET status = 'resolved', resolved_at = NOW(), updated_at = NOW() WHERE id = ?",
        ticket_id,
      );
      await db.run(
        'INSERT INTO ticket_comments (ticket_id, user_id, body) VALUES (?, ?, ?)',
        ticket_id, req.user.id,
        `✅ ATLAS executed password reset via Google Workspace. Temporary password emailed to ${target_email}. Ticket resolved.`,
      );

    } else if (action_type === 'account_unlock') {
      await gws.unlockAccount(target_email);
      result = `Account unsuspended for ${target_email}.`;
      await db.run(
        "UPDATE tickets SET status = 'resolved', resolved_at = NOW(), updated_at = NOW() WHERE id = ?",
        ticket_id,
      );
      await db.run(
        'INSERT INTO ticket_comments (ticket_id, user_id, body) VALUES (?, ?, ?)',
        ticket_id, req.user.id,
        `✅ ATLAS unlocked Google Workspace account for ${target_email}. Ticket resolved.`,
      );

    } else if (action_type === 'access_grant') {
      if (!details.drive_id) {
        return res.status(400).json({ error: 'Drive folder ID is required before approving an access grant' });
      }
      await gws.grantDriveAccess(details.drive_id, target_email, details.role || 'reader');
      const roleLabel = details.role || 'reader';
      result = `Drive access granted: ${target_email} → ${details.drive_id} (${roleLabel}).`;
      await db.run(
        "UPDATE tickets SET status = 'resolved', resolved_at = NOW(), updated_at = NOW() WHERE id = ?",
        ticket_id,
      );
      await db.run(
        'INSERT INTO ticket_comments (ticket_id, user_id, body) VALUES (?, ?, ?)',
        ticket_id, req.user.id,
        `✅ ATLAS granted Google Drive access (${roleLabel}) to ${target_email}. Ticket resolved.`,
      );
    }

    await db.run(
      'UPDATE atlas_actions SET status = ?, executed_at = NOW(), result = ? WHERE id = ?',
      'executed', result, action.id,
    );
    res.json({ ok: true, result });

  } catch (err) {
    await db.run(
      'UPDATE atlas_actions SET status = ?, error_message = ? WHERE id = ?',
      'failed', err.message, action.id,
    );
    res.status(500).json({ error: err.message });
  }
});

// Deny
router.post('/actions/:id/deny', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const action = await db.get('SELECT * FROM atlas_actions WHERE id = ?', req.params.id);
  if (!action)                    return res.status(404).json({ error: 'Action not found' });
  if (action.status !== 'pending') return res.status(409).json({ error: 'Action already handled' });

  await db.run(
    'UPDATE atlas_actions SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?',
    'denied', req.user.id, action.id,
  );

  const MANUAL_STEPS = {
    password_reset: 'Go to Google Admin Console → Users → select user → Reset password.',
    account_unlock: 'Go to Google Admin Console → Users → select user → More options → Unsuspend.',
    access_grant:   'Go to Google Drive → right-click the folder → Share → add user with appropriate role.',
  };
  await db.run(
    'INSERT INTO ticket_notes (ticket_id, user_id, body) VALUES (?, ?, ?)',
    action.ticket_id, req.user.id,
    `ATLAS action denied. Manual steps: ${MANUAL_STEPS[action.action_type] || 'Please handle manually.'}`,
  );

  res.json({ ok: true });
});

export default router;
