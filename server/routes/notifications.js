import express from 'express';
import db from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/notifications — list notifications for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await db.all(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      req.user.id
    );
    const unreadCount = notifications.filter(n => !n.is_read).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// POST /api/notifications/read-all — mark all as read
router.post('/read-all', authenticate, async (req, res) => {
  try {
    await db.run(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ?`,
      req.user.id
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// POST /api/notifications/:id/read — mark one as read
router.post('/:id/read', authenticate, async (req, res) => {
  try {
    await db.run(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      req.params.id, req.user.id
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// GET /api/notifications/preferences — get preferences for current user
router.get('/preferences', authenticate, async (req, res) => {
  try {
    let prefs = await db.get(
      `SELECT * FROM notification_preferences WHERE user_id = ?`,
      req.user.id
    );
    if (!prefs) {
      // Return defaults without inserting — POST will create
      prefs = {
        user_id: req.user.id,
        ticket_assigned: 1,
        ticket_updated: 1,
        ticket_resolved: 1,
        new_comment: 1,
        incident_alert: 1,
        weekly_briefing: 1,
        digest_enabled: 0,
        digest_hour: 8,
      };
    }
    res.json(prefs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// PUT /api/notifications/preferences — upsert preferences
router.put('/preferences', authenticate, async (req, res) => {
  const {
    ticket_assigned = 1,
    ticket_updated = 1,
    ticket_resolved = 1,
    new_comment = 1,
    incident_alert = 1,
    weekly_briefing = 1,
    digest_enabled = 0,
    digest_hour = 8,
  } = req.body;

  try {
    await db.run(
      `INSERT INTO notification_preferences
         (user_id, ticket_assigned, ticket_updated, ticket_resolved, new_comment,
          incident_alert, weekly_briefing, digest_enabled, digest_hour, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         ticket_assigned  = EXCLUDED.ticket_assigned,
         ticket_updated   = EXCLUDED.ticket_updated,
         ticket_resolved  = EXCLUDED.ticket_resolved,
         new_comment      = EXCLUDED.new_comment,
         incident_alert   = EXCLUDED.incident_alert,
         weekly_briefing  = EXCLUDED.weekly_briefing,
         digest_enabled   = EXCLUDED.digest_enabled,
         digest_hour      = EXCLUDED.digest_hour,
         updated_at       = NOW()`,
      req.user.id,
      ticket_assigned ? 1 : 0,
      ticket_updated ? 1 : 0,
      ticket_resolved ? 1 : 0,
      new_comment ? 1 : 0,
      incident_alert ? 1 : 0,
      weekly_briefing ? 1 : 0,
      digest_enabled ? 1 : 0,
      digest_hour
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

export default router;
