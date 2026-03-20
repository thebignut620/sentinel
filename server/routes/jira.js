import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { pushTicketToJira, syncJiraStatus, getJiraSyncStatus } from '../services/jira.js';

const router = express.Router();

// GET /api/jira/settings — get current Jira settings
router.get('/settings', authenticate, requireRole('admin'), async (req, res) => {
  const rows = await db.all("SELECT key, value FROM settings WHERE key LIKE 'jira_%'");
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({
    jira_enabled: settings.jira_enabled === 'true',
    jira_host: settings.jira_host || '',
    jira_email: settings.jira_email || '',
    jira_project: settings.jira_project || '',
    jira_token_configured: !!(settings.jira_token),
  });
});

// PATCH /api/jira/settings — save Jira settings
router.patch('/settings', authenticate, requireRole('admin'), async (req, res) => {
  const { jira_host, jira_email, jira_token, jira_project, jira_enabled } = req.body;
  const updates = { jira_host, jira_email, jira_token, jira_project };

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      await db.run(
        `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        key, value || ''
      );
    }
  }
  if (jira_enabled !== undefined) {
    await db.run(
      `INSERT INTO settings (key, value) VALUES ('jira_enabled', ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      jira_enabled ? 'true' : 'false'
    );
  }

  await logAudit(req, { action: 'jira.config_updated', entityType: 'settings', details: { jira_host, jira_email } });
  res.json({ ok: true });
});

// POST /api/jira/push/:ticketId — push ticket to Jira
router.post('/push/:ticketId', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const ticket = await db.get(`
    SELECT t.*, u.name as submitter_name
    FROM tickets t
    JOIN users u ON t.submitter_id = u.id
    WHERE t.id = ?
  `, req.params.ticketId);

  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  try {
    const result = await pushTicketToJira(ticket);
    await logAudit(req, {
      action: 'jira.ticket_pushed',
      entityType: 'ticket',
      entityId: ticket.id,
      details: { jira_key: result.key },
    });
    res.json({ ok: true, jira_issue_key: result.key, jira_url: `https://${(await db.get("SELECT value FROM settings WHERE key = 'jira_host'"))?.value}/browse/${result.key}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/jira/sync/:ticketId — sync status from Jira back to Sentinel
router.post('/sync/:ticketId', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  try {
    const result = await syncJiraStatus(req.params.ticketId);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/jira/status/:ticketId — get Jira sync status for a ticket
router.get('/status/:ticketId', authenticate, async (req, res) => {
  const sync = await getJiraSyncStatus(req.params.ticketId);
  if (!sync) return res.json({ synced: false });

  const hostRow = await db.get("SELECT value FROM settings WHERE key = 'jira_host'");
  const jiraHost = hostRow?.value || '';
  res.json({
    synced: true,
    jira_issue_key: sync.jira_issue_key,
    jira_project: sync.jira_project,
    jira_url: jiraHost ? `https://${jiraHost}/browse/${sync.jira_issue_key}` : null,
    pushed_at: sync.pushed_at,
    last_sync_at: sync.last_sync_at,
  });
});

export default router;
