import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as gws from '../services/googleWorkspace.js';
import * as mgs from '../services/microsoftGraph.js';
import { sendGoogleTempPassword, sendMicrosoftTempPassword } from '../services/email.js';

const router = express.Router();
const CLIENT_URL = process.env.CLIENT_URL || 'https://sentinel-eta-woad.vercel.app';

// ─── GOOGLE OAUTH FLOW ────────────────────────────────────────────────────────

router.get('/google/connect-url', authenticate, requireRole('admin'), (req, res) => {
  res.json({ url: gws.getAuthUrl(req.user.company_id || 1) });
});

router.get('/google/callback', async (req, res) => {
  const { code, error, state } = req.query;
  const companyId = parseInt(state) || 1;
  if (error || !code) {
    return res.redirect(`${CLIENT_URL}/admin/integrations?error=oauth_denied`);
  }
  try {
    const tokens = await gws.exchangeCode(String(code));
    await db.run("UPDATE integrations SET is_active = 0 WHERE provider = 'google' AND company_id = ?", companyId);
    await db.run(
      `INSERT INTO integrations (provider, access_token, refresh_token, token_expiry, is_active, company_id)
       VALUES ('google', ?, ?, ?, 1, ?)`,
      tokens.access_token,
      tokens.refresh_token ?? null,
      tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      companyId,
    );
    res.redirect(`${CLIENT_URL}/admin/integrations?connected=google`);
  } catch (err) {
    console.error('[integrations] Google OAuth callback error:', err.message);
    res.redirect(`${CLIENT_URL}/admin/integrations?error=oauth_failed&provider=google`);
  }
});

// ─── MICROSOFT OAUTH FLOW ─────────────────────────────────────────────────────

router.get('/microsoft/connect-url', authenticate, requireRole('admin'), (req, res) => {
  res.json({ url: mgs.getAuthUrl(req.user.company_id || 1) });
});

router.get('/microsoft/callback', async (req, res) => {
  const { code, error, state } = req.query;
  const companyId = parseInt(state) || 1;
  if (error || !code) {
    return res.redirect(`${CLIENT_URL}/admin/integrations?error=oauth_denied&provider=microsoft`);
  }
  try {
    const tokens = await mgs.exchangeCode(String(code));
    await db.run("UPDATE integrations SET is_active = 0 WHERE provider = 'microsoft' AND company_id = ?", companyId);
    await db.run(
      `INSERT INTO integrations (provider, access_token, refresh_token, token_expiry, is_active, company_id)
       VALUES ('microsoft', ?, ?, ?, 1, ?)`,
      tokens.access_token,
      tokens.refresh_token ?? null,
      tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      companyId,
    );
    res.redirect(`${CLIENT_URL}/admin/integrations?connected=microsoft`);
  } catch (err) {
    console.error('[integrations] Microsoft OAuth callback error:', err.message);
    res.redirect(`${CLIENT_URL}/admin/integrations?error=oauth_failed&provider=microsoft`);
  }
});

// ─── STATUS ───────────────────────────────────────────────────────────────────

router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const [googleInt, microsoftInt] = await Promise.all([
    gws.getIntegration(companyId),
    mgs.getIntegration(companyId),
  ]);

  const ACTIONS = ['password_reset', 'account_unlock', 'access_grant'];

  res.json({
    google: googleInt ? {
      connected:       true,
      connected_at:    googleInt.connected_at,
      last_sync_at:    googleInt.last_sync_at,
      actions_enabled: ACTIONS,
    } : { connected: false },

    microsoft: microsoftInt ? {
      connected:                true,
      connected_at:             microsoftInt.connected_at,
      last_sync_at:             microsoftInt.last_sync_at,
      actions_enabled:          ACTIONS,
      teams_webhook_configured: !!(
        microsoftInt.metadata &&
        JSON.parse(microsoftInt.metadata)?.teams_webhook_url
      ),
    } : { connected: false },
  });
});

// ─── DISCONNECT ───────────────────────────────────────────────────────────────

router.delete('/google', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  await db.run("UPDATE integrations SET is_active = 0 WHERE provider = 'google' AND company_id = ?", companyId);
  res.json({ ok: true });
});

router.delete('/microsoft', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  await db.run("UPDATE integrations SET is_active = 0 WHERE provider = 'microsoft' AND company_id = ?", companyId);
  res.json({ ok: true });
});

// ─── MICROSOFT CONFIG (Teams webhook URL etc.) ────────────────────────────────

router.patch('/microsoft', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const integration = await mgs.getIntegration(companyId);
  if (!integration) return res.status(404).json({ error: 'Microsoft 365 not connected' });

  const existing = integration.metadata ? JSON.parse(integration.metadata) : {};
  const { teams_webhook_url } = req.body;
  if (teams_webhook_url !== undefined) existing.teams_webhook_url = teams_webhook_url || null;

  await db.run(
    "UPDATE integrations SET metadata = ? WHERE provider = 'microsoft' AND is_active = 1 AND company_id = ?",
    JSON.stringify(existing), companyId,
  );
  res.json({ ok: true });
});

// ─── USER CONTEXT ─────────────────────────────────────────────────────────────

router.get('/user-context', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const { email } = req.query;
  const companyId = req.user.company_id || 1;
  if (!email) return res.status(400).json({ error: 'email required' });

  const [googleRes, microsoftRes] = await Promise.allSettled([
    gws.lookupUser(email, companyId),
    mgs.lookupUser(email, companyId),
  ]);

  res.json({
    google:    googleRes.status    === 'fulfilled' ? googleRes.value    : null,
    microsoft: microsoftRes.status === 'fulfilled' ? microsoftRes.value : null,
  });
});

// ─── ATLAS ACTIONS ────────────────────────────────────────────────────────────

router.get('/actions', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const { ticket_id, status } = req.query;
  const companyId = req.user.company_id || 1;
  let query = `
    SELECT aa.*, t.title as ticket_title, u.name as approver_name
    FROM atlas_actions aa
    JOIN tickets t ON aa.ticket_id = t.id
    LEFT JOIN users u ON aa.approved_by = u.id
    WHERE t.company_id = ?
  `;
  const params = [companyId];
  if (ticket_id) { query += ' AND aa.ticket_id = ?'; params.push(ticket_id); }
  if (status)    { query += ' AND aa.status = ?';    params.push(status); }
  query += ' ORDER BY aa.requested_at DESC LIMIT 50';
  res.json(await db.all(query, ...params));
});

// Update details on a pending action (drive_id / site_id / role)
router.patch('/actions/:id', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const action = await db.get(
    'SELECT aa.* FROM atlas_actions aa JOIN tickets t ON aa.ticket_id = t.id WHERE aa.id = ? AND t.company_id = ?',
    req.params.id, companyId
  );
  if (!action)                    return res.status(404).json({ error: 'Action not found' });
  if (action.status !== 'pending') return res.status(409).json({ error: 'Action already handled' });

  const { drive_id, site_id, role } = req.body;
  const details = JSON.parse(action.details || '{}');
  if (drive_id !== undefined) details.drive_id = drive_id;
  if (site_id  !== undefined) details.site_id  = site_id;
  if (role     !== undefined) details.role      = role;

  await db.run('UPDATE atlas_actions SET details = ? WHERE id = ?', JSON.stringify(details), action.id);
  res.json({ ok: true });
});

// Approve + execute
router.post('/actions/:id/approve', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  console.log('[approve] ▶ handler reached — user:', req.user?.id, 'role:', req.user?.role, 'action id:', req.params.id);
  const companyId = req.user.company_id || 1;
  let action = null;
  try {
    action = await db.get(
      'SELECT aa.* FROM atlas_actions aa JOIN tickets t ON aa.ticket_id = t.id WHERE aa.id = ? AND t.company_id = ?',
      req.params.id, companyId
    );
    console.log('[approve] action fetched:', action ? `type=${action.action_type} status=${action.status} provider=${action.provider}` : 'NOT FOUND');

    if (!action)                     return res.status(404).json({ error: 'Action not found' });
    if (action.status !== 'pending') return res.status(409).json({ error: 'Action already handled' });

    await db.run(
      'UPDATE atlas_actions SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?',
      'approved', req.user.id, action.id,
    );
    console.log('[approve] marked approved, executing action_type:', action.action_type, 'provider:', action.provider);

    let result = '';
    const { action_type, target_email, ticket_id } = action;
    const details  = JSON.parse(action.details || '{}');
    const provider = action.provider || 'google';
    const isMs     = provider === 'microsoft';

    const platformLabel = isMs ? 'Microsoft 365' : 'Google Workspace';

    if (action_type === 'password_reset') {
      console.log('[approve] calling resetPassword for:', target_email, 'via', provider);
      const { tempPassword } = isMs
        ? await mgs.resetPassword(target_email, companyId)
        : await gws.resetPassword(target_email, companyId);

      const submitter = await db.get(
        'SELECT name, email FROM users WHERE id = (SELECT submitter_id FROM tickets WHERE id = ?)',
        ticket_id,
      );
      if (submitter) {
        isMs
          ? await sendMicrosoftTempPassword({ to: submitter.email, name: submitter.name, tempPassword, ticketId: ticket_id })
          : await sendGoogleTempPassword({ to: submitter.email, name: submitter.name, tempPassword, ticketId: ticket_id });
      }

      result = `Password reset via ${platformLabel}. Temporary password sent to ${target_email}. User must change on next login.`;
      await db.run(
        "UPDATE tickets SET status = 'resolved', resolved_at = NOW(), updated_at = NOW() WHERE id = ?",
        ticket_id,
      );
      await db.run(
        'INSERT INTO ticket_comments (ticket_id, user_id, body) VALUES (?, ?, ?)',
        ticket_id, req.user.id,
        `✅ ATLAS executed password reset via ${platformLabel}. Temporary password emailed to ${target_email}. Ticket resolved.`,
      );

    } else if (action_type === 'account_unlock') {
      console.log('[approve] calling unlockAccount for:', target_email, 'via', provider);
      isMs ? await mgs.unlockAccount(target_email, companyId) : await gws.unlockAccount(target_email, companyId);

      result = `Account enabled for ${target_email} via ${platformLabel}.`;
      await db.run(
        "UPDATE tickets SET status = 'resolved', resolved_at = NOW(), updated_at = NOW() WHERE id = ?",
        ticket_id,
      );
      await db.run(
        'INSERT INTO ticket_comments (ticket_id, user_id, body) VALUES (?, ?, ?)',
        ticket_id, req.user.id,
        `✅ ATLAS unlocked ${platformLabel} account for ${target_email}. Ticket resolved.`,
      );

    } else if (action_type === 'access_grant') {
      if (isMs) {
        if (!details.site_id) {
          return res.status(400).json({ error: 'SharePoint site ID is required before approving an access grant' });
        }
        console.log('[approve] calling grantSharePointAccess:', details.site_id, target_email);
        await mgs.grantSharePointAccess(details.site_id, target_email, details.role || 'read', companyId);
        const roleLabel = details.role || 'read';
        result = `SharePoint access granted: ${target_email} → ${details.site_id} (${roleLabel}).`;
        await db.run(
          "UPDATE tickets SET status = 'resolved', resolved_at = NOW(), updated_at = NOW() WHERE id = ?",
          ticket_id,
        );
        await db.run(
          'INSERT INTO ticket_comments (ticket_id, user_id, body) VALUES (?, ?, ?)',
          ticket_id, req.user.id,
          `✅ ATLAS granted SharePoint access (${roleLabel}) to ${target_email}. Ticket resolved.`,
        );
      } else {
        if (!details.drive_id) {
          return res.status(400).json({ error: 'Drive folder ID is required before approving an access grant' });
        }
        console.log('[approve] calling grantDriveAccess:', details.drive_id, target_email);
        await gws.grantDriveAccess(details.drive_id, target_email, details.role || 'reader', companyId);
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
    }

    await db.run(
      'UPDATE atlas_actions SET status = ?, executed_at = NOW(), result = ? WHERE id = ?',
      'executed', result, action.id,
    );
    console.log('[approve] ✓ complete — result:', result);

    // Teams notification (fire-and-forget)
    mgs.sendTeamsNotification(
      `${action_type.replace('_', ' ')} executed for ${target_email} (Ticket #${ticket_id}). ${result}`,
      '✅ ATLAS Action Approved',
      companyId,
    ).catch(() => {});

    res.json({ ok: true, result });

  } catch (err) {
    console.error('[approve] ✗ ERROR:', err.message);
    console.error('[approve] stack:', err.stack);
    if (action?.id) {
      await db.run(
        'UPDATE atlas_actions SET status = ?, error_message = ? WHERE id = ?',
        'failed', err.message, action.id,
      ).catch(() => {});
    }
    res.status(500).json({ error: err.message });
  }
});

// Deny
router.post('/actions/:id/deny', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const action = await db.get(
    'SELECT aa.* FROM atlas_actions aa JOIN tickets t ON aa.ticket_id = t.id WHERE aa.id = ? AND t.company_id = ?',
    req.params.id, companyId
  );
  if (!action)                    return res.status(404).json({ error: 'Action not found' });
  if (action.status !== 'pending') return res.status(409).json({ error: 'Action already handled' });

  await db.run(
    'UPDATE atlas_actions SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?',
    'denied', req.user.id, action.id,
  );

  const isMs = (action.provider || 'google') === 'microsoft';
  const MANUAL_STEPS = {
    password_reset: isMs
      ? 'Go to Microsoft 365 Admin Center → Users → Active users → select user → Reset password.'
      : 'Go to Google Admin Console → Users → select user → Reset password.',
    account_unlock: isMs
      ? 'Go to Microsoft 365 Admin Center → Users → Active users → select user → Unblock sign-in.'
      : 'Go to Google Admin Console → Users → select user → More options → Unsuspend.',
    access_grant: isMs
      ? 'Go to the SharePoint site → Settings → Site permissions → Grant access.'
      : 'Go to Google Drive → right-click the folder → Share → add user with appropriate role.',
  };
  await db.run(
    'INSERT INTO ticket_notes (ticket_id, user_id, body) VALUES (?, ?, ?)',
    action.ticket_id, req.user.id,
    `ATLAS action denied. Manual steps: ${MANUAL_STEPS[action.action_type] || 'Please handle manually.'}`,
  );

  res.json({ ok: true });
});

export default router;
