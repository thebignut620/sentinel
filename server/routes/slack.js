import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

async function getSlackSettings() {
  const rows = await db.all("SELECT key, value FROM settings WHERE key LIKE 'slack_%'");
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// GET /api/slack — get current settings
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  const settings = await getSlackSettings();
  // Redact the webhook URL partially for display
  const url = settings.slack_webhook_url || '';
  res.json({
    slack_enabled: settings.slack_enabled === 'true',
    slack_webhook_url: url,
    slack_channel: settings.slack_channel || '',
    configured: !!url,
  });
});

// PATCH /api/slack — save webhook URL + channel
router.patch('/', authenticate, requireRole('admin'), async (req, res) => {
  const { slack_webhook_url, slack_channel, slack_enabled } = req.body;

  if (slack_webhook_url !== undefined) {
    await db.run(
      "INSERT INTO settings (key, value) VALUES ('slack_webhook_url', ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      slack_webhook_url || ''
    );
  }
  if (slack_channel !== undefined) {
    await db.run(
      "INSERT INTO settings (key, value) VALUES ('slack_channel', ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      slack_channel || ''
    );
  }
  if (slack_enabled !== undefined) {
    await db.run(
      "INSERT INTO settings (key, value) VALUES ('slack_enabled', ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      slack_enabled ? 'true' : 'false'
    );
  }

  await logAudit(req, { action: 'slack.config_updated', entityType: 'settings', details: { slack_channel } });
  res.json({ ok: true });
});

// GET /api/slack/test — send a test notification
router.get('/test', authenticate, requireRole('admin'), async (req, res) => {
  const settings = await getSlackSettings();
  if (!settings.slack_webhook_url) {
    return res.status(400).json({ error: 'Slack webhook URL not configured' });
  }

  try {
    const response = await fetch(settings.slack_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '✅ *Sentinel IT* — Slack integration is working correctly! You will receive ticket notifications here.',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(400).json({ error: `Slack returned ${response.status}: ${text}` });
    }

    res.json({ ok: true, message: 'Test notification sent' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
