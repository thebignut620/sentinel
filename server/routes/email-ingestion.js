import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

const IMAP_KEYS = ['email_ingestion_enabled', 'imap_host', 'imap_user', 'imap_pass', 'imap_port'];

async function getImapSettings() {
  const rows = await db.all(
    `SELECT key, value FROM settings WHERE key = ANY(ARRAY[${IMAP_KEYS.map(() => '?').join(',')}])`,
    ...IMAP_KEYS
  );
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// GET /api/email-ingestion/status
router.get('/status', authenticate, requireRole('admin'), async (req, res) => {
  const settings = await getImapSettings();
  // Count tickets created from email (those with "source: email" in description)
  const countRow = await db.get(
    "SELECT COUNT(*) as count FROM tickets WHERE description LIKE '%source: email%'"
  );

  res.json({
    enabled: settings.email_ingestion_enabled === 'true',
    imap_host: settings.imap_host || '',
    imap_user: settings.imap_user || '',
    imap_port: settings.imap_port || '993',
    configured: !!(settings.imap_host && settings.imap_user && settings.imap_pass),
    tickets_ingested: parseInt(countRow?.count || '0'),
  });
});

// PATCH /api/email-ingestion — save IMAP config
router.patch('/', authenticate, requireRole('admin'), async (req, res) => {
  const { email_ingestion_enabled, imap_host, imap_user, imap_pass, imap_port } = req.body;

  const updates = { email_ingestion_enabled, imap_host, imap_user, imap_pass, imap_port };

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      const val = key === 'email_ingestion_enabled' ? (value ? 'true' : 'false') : String(value || '');
      await db.run(
        `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        key, val
      );
    }
  }

  await logAudit(req, {
    action: 'email_ingestion.config_updated',
    entityType: 'settings',
    details: { imap_host, imap_user, enabled: email_ingestion_enabled },
  });

  res.json({ ok: true });
});

export default router;
