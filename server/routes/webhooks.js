import express from 'express';
import crypto from 'crypto';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

const VALID_EVENTS = ['ticket.created', 'ticket.updated', 'ticket.resolved', 'ticket.closed'];

// GET /api/webhooks — list all webhooks
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const hooks = await db.all(
    'SELECT id, name, url, events, is_active, created_at FROM webhooks WHERE company_id = ? ORDER BY created_at DESC',
    companyId
  );
  res.json(hooks);
});

// POST /api/webhooks — create webhook
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  const { name, url, secret, events } = req.body;
  if (!name?.trim() || !url?.trim()) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }

  // Validate URL
  try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

  // Validate events
  const eventList = Array.isArray(events) ? events : (events ? events.split(',').map(e => e.trim()) : VALID_EVENTS);
  const invalidEvents = eventList.filter(e => !VALID_EVENTS.includes(e));
  if (invalidEvents.length > 0) {
    return res.status(400).json({ error: `Invalid events: ${invalidEvents.join(', ')}` });
  }

  const companyId = req.user.company_id || 1;
  const result = await db.run(
    'INSERT INTO webhooks (name, url, secret, events, company_id) VALUES (?, ?, ?, ?, ?)',
    name.trim(), url.trim(), secret || '', eventList.join(','), companyId
  );

  const hook = await db.get('SELECT * FROM webhooks WHERE id = ?', result.lastID ?? result.lastInsertRowid);
  await logAudit(req, { action: 'webhook.created', entityType: 'webhook', entityId: hook.id, details: { name, url } });
  res.status(201).json(hook);
});

// PATCH /api/webhooks/:id — update webhook
router.patch('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const hook = await db.get('SELECT * FROM webhooks WHERE id = ? AND company_id = ?', req.params.id, companyId);
  if (!hook) return res.status(404).json({ error: 'Webhook not found' });

  const { name, url, secret, events, is_active } = req.body;
  const fields = [];
  const values = [];

  if (name !== undefined)      { fields.push('name = ?');      values.push(name.trim()); }
  if (url !== undefined)       { fields.push('url = ?');        values.push(url.trim()); }
  if (secret !== undefined)    { fields.push('secret = ?');     values.push(secret || ''); }
  if (events !== undefined) {
    const eventList = Array.isArray(events) ? events : events.split(',').map(e => e.trim());
    fields.push('events = ?');
    values.push(eventList.join(','));
  }
  if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }

  if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  await db.run(`UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`, ...values, req.params.id);
  const updated = await db.get('SELECT * FROM webhooks WHERE id = ?', req.params.id);
  await logAudit(req, { action: 'webhook.updated', entityType: 'webhook', entityId: hook.id });
  res.json(updated);
});

// DELETE /api/webhooks/:id — delete webhook
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const hook = await db.get('SELECT id FROM webhooks WHERE id = ? AND company_id = ?', req.params.id, companyId);
  if (!hook) return res.status(404).json({ error: 'Webhook not found' });

  await db.run('DELETE FROM webhooks WHERE id = ?', req.params.id);
  await logAudit(req, { action: 'webhook.deleted', entityType: 'webhook', entityId: hook.id });
  res.json({ ok: true });
});

// POST /api/webhooks/:id/test — send test payload
router.post('/:id/test', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const hook = await db.get('SELECT * FROM webhooks WHERE id = ? AND company_id = ?', req.params.id, companyId);
  if (!hook) return res.status(404).json({ error: 'Webhook not found' });

  const payload = {
    event: 'ticket.created',
    timestamp: new Date().toISOString(),
    data: {
      id: 0,
      title: 'Test Ticket',
      priority: 'medium',
      category: 'software',
      status: 'open',
    },
  };

  const body = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', hook.secret || '').update(body).digest('hex');

  try {
    const response = await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentinel-Signature': `sha256=${sig}`,
        'X-Sentinel-Event': 'ticket.created',
      },
      body,
    });
    res.json({ ok: response.ok, status: response.status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
