import express from 'express';
import db from '../db/connection.js';
import { validateApiKey } from './api-keys.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

// Per-key hourly rate limiting (1000 req/hr) + per-minute enforcement
const HOURLY_LIMIT = 1000;
const SUSPICIOUS_MULTIPLIER = 5; // auto-disable if 5x the hourly limit

async function rateLimitMiddleware(req, res, next) {
  const keyId = req.apiKey.id;
  const perMinuteLimit = req.apiKey.rate_limit || 100;

  // Per-minute window
  const minuteWindow = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  // Per-hour window
  const hourWindow = new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString();

  try {
    // Upsert per-minute counter
    await db.run(`
      INSERT INTO api_rate_limits (key_id, window_start, request_count)
      VALUES (?, ?, 1)
      ON CONFLICT (key_id, window_start)
      DO UPDATE SET request_count = api_rate_limits.request_count + 1
    `, keyId, minuteWindow);

    // Upsert per-hour counter (use a composite key by appending 'h' to hour window)
    const hourKey = `${keyId}_h`;
    await db.run(`
      INSERT INTO api_rate_limits (key_id, window_start, request_count)
      VALUES (?, ?, 1)
      ON CONFLICT (key_id, window_start)
      DO UPDATE SET request_count = api_rate_limits.request_count + 1
    `, hourKey, hourWindow);

    const [minuteRow, hourRow] = await Promise.all([
      db.get('SELECT request_count FROM api_rate_limits WHERE key_id = ? AND window_start = ?', keyId, minuteWindow),
      db.get('SELECT request_count FROM api_rate_limits WHERE key_id = ? AND window_start = ?', hourKey, hourWindow),
    ]);

    const minuteCount = minuteRow?.request_count || 1;
    const hourCount   = hourRow?.request_count || 1;

    // Auto-disable suspicious key (5× hourly limit)
    if (hourCount > HOURLY_LIMIT * SUSPICIOUS_MULTIPLIER) {
      await db.run('UPDATE api_keys SET is_active = 0 WHERE id = ?', keyId);
      await logAudit(req, {
        action: 'api_key.auto_disabled',
        entityType: 'api_key',
        entityId: keyId,
        details: { reason: 'suspicious_usage', hourly_requests: hourCount },
      });
      return res.status(429).json({ error: 'API key disabled due to suspicious usage patterns.' });
    }

    // Hourly limit check
    if (hourCount > HOURLY_LIMIT) {
      const retryAfter = 3600 - Math.floor((Date.now() % 3600000) / 1000);
      res.set('Retry-After', String(retryAfter));
      res.set('X-RateLimit-Limit', String(HOURLY_LIMIT));
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', String(Math.ceil(Date.now() / 3600000) * 3600));
      await logAudit(req, {
        action: 'api_key.rate_limited',
        entityType: 'api_key',
        entityId: keyId,
        details: { window: 'hour', count: hourCount },
      });
      return res.status(429).json({
        error: 'Hourly rate limit exceeded. Maximum 1000 requests per hour.',
        retry_after: retryAfter,
      });
    }

    // Per-minute limit check
    if (minuteCount > perMinuteLimit) {
      const retryAfter = 60 - Math.floor((Date.now() % 60000) / 1000);
      res.set('Retry-After', String(retryAfter));
      res.set('X-RateLimit-Limit', String(perMinuteLimit));
      res.set('X-RateLimit-Remaining', '0');
      return res.status(429).json({
        error: 'Rate limit exceeded. Please slow down.',
        retry_after: retryAfter,
      });
    }

    res.set('X-RateLimit-Limit', String(HOURLY_LIMIT));
    res.set('X-RateLimit-Remaining', String(Math.max(0, HOURLY_LIMIT - hourCount)));
    next();
  } catch {
    // Don't block the request if rate limit check fails
    next();
  }
}

// Auth middleware for public API
async function apiKeyAuth(req, res, next) {
  const rawKey = req.headers['x-api-key'];
  if (!rawKey) return res.status(401).json({ error: 'X-API-Key header required' });

  // Reject obviously malformed keys early
  if (typeof rawKey !== 'string' || rawKey.length > 200) {
    return res.status(401).json({ error: 'Invalid or inactive API key' });
  }

  const apiKey = await validateApiKey(rawKey);
  if (!apiKey) return res.status(401).json({ error: 'Invalid or inactive API key' });

  req.apiKey = apiKey;
  // Log API key usage to audit log (non-blocking)
  logAudit(req, {
    action: 'api_key.used',
    entityType: 'api_key',
    entityId: apiKey.id,
    details: { method: req.method, path: req.path },
  }).catch(() => {});
  next();
}

// GET /v1/health — health check (no auth required)
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'sentinel-api', timestamp: new Date().toISOString() });
});

// Apply auth + rate limit to all other routes
router.use(apiKeyAuth, rateLimitMiddleware);

// GET /v1/tickets — list tickets
router.get('/tickets', async (req, res) => {
  const { status, priority, category, limit = 50, offset = 0 } = req.query;

  let query = `
    SELECT t.id, t.title, t.description, t.status, t.priority, t.category,
           t.created_at, t.updated_at, t.resolved_at, t.sla_due_at,
           u.name as submitter_name, u.email as submitter_email,
           a.name as assignee_name
    FROM tickets t
    JOIN users u ON t.submitter_id = u.id
    LEFT JOIN users a ON t.assignee_id = a.id
    WHERE 1=1
  `;
  const params = [];

  if (status)   { query += ' AND t.status = ?';   params.push(status); }
  if (priority) { query += ' AND t.priority = ?'; params.push(priority); }
  if (category) { query += ' AND t.category = ?'; params.push(category); }

  query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
  params.push(Math.min(parseInt(limit) || 50, 200), parseInt(offset) || 0);

  const rows = await db.all(query, ...params);
  const total = await db.get('SELECT COUNT(*) as count FROM tickets WHERE 1=1' +
    (status ? ' AND status = ?' : '') +
    (priority ? ' AND priority = ?' : '') +
    (category ? ' AND category = ?' : ''),
    ...[status, priority, category].filter(Boolean)
  );

  res.json({
    data: rows,
    meta: {
      total: parseInt(total?.count || 0),
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    },
  });
});

// GET /v1/tickets/:id — get single ticket
router.get('/tickets/:id', async (req, res) => {
  const ticket = await db.get(`
    SELECT t.*, u.name as submitter_name, u.email as submitter_email, a.name as assignee_name
    FROM tickets t
    JOIN users u ON t.submitter_id = u.id
    LEFT JOIN users a ON t.assignee_id = a.id
    WHERE t.id = ?
  `, req.params.id);

  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const comments = await db.all(`
    SELECT tc.id, tc.body, tc.created_at, u.name as author_name
    FROM ticket_comments tc
    JOIN users u ON tc.user_id = u.id
    WHERE tc.ticket_id = ?
    ORDER BY tc.created_at ASC
  `, req.params.id);

  res.json({ ...ticket, comments });
});

// POST /v1/tickets — create ticket
router.post('/tickets', async (req, res) => {
  const { title, description, priority = 'medium', category = 'software', submitter_email } = req.body;

  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: 'title and description are required' });
  }

  const validPriority = ['low', 'medium', 'high', 'critical'].includes(priority) ? priority : 'medium';
  const validCategory = ['hardware', 'software', 'network', 'access', 'account'].includes(category) ? category : 'software';

  let submitterId;
  if (submitter_email) {
    const user = await db.get('SELECT id FROM users WHERE email = ? AND is_active = 1', submitter_email);
    submitterId = user?.id;
  }
  if (!submitterId) {
    const admin = await db.get("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1");
    submitterId = admin?.id;
  }
  if (!submitterId) return res.status(500).json({ error: 'No valid submitter found' });

  const SLA_HOURS = { critical: 1, high: 4, medium: 24, low: 72 };
  const slaDueAt = new Date(Date.now() + (SLA_HOURS[validPriority] ?? 24) * 3_600_000).toISOString();

  const result = await db.run(`
    INSERT INTO tickets (title, description, priority, category, submitter_id, ai_attempted, sla_due_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `, title.trim(), description.trim(), validPriority, validCategory, submitterId, slaDueAt);

  const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', result.lastID ?? result.lastInsertRowid);
  res.status(201).json(ticket);
});

// PATCH /v1/tickets/:id — update ticket status/priority/assignee
router.patch('/tickets/:id', async (req, res) => {
  const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const { status, priority, assignee_email } = req.body;
  const fields = [];
  const values = [];

  const validStatuses   = ['open', 'in_progress', 'resolved', 'closed'];
  const validPriorities = ['low', 'medium', 'high', 'critical'];

  if (status !== undefined) {
    if (!validStatuses.includes(status)) return res.status(400).json({ error: `Invalid status. Must be: ${validStatuses.join(', ')}` });
    fields.push('status = ?'); values.push(status);
    if (status === 'resolved') { fields.push('resolved_at = NOW()'); }
  }
  if (priority !== undefined) {
    if (!validPriorities.includes(priority)) return res.status(400).json({ error: `Invalid priority. Must be: ${validPriorities.join(', ')}` });
    fields.push('priority = ?'); values.push(priority);
  }
  if (assignee_email !== undefined) {
    if (assignee_email) {
      const assignee = await db.get('SELECT id FROM users WHERE email = ? AND is_active = 1', assignee_email);
      if (!assignee) return res.status(400).json({ error: 'Assignee not found' });
      fields.push('assignee_id = ?'); values.push(assignee.id);
    } else {
      fields.push('assignee_id = ?'); values.push(null);
    }
  }

  if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update. Provide status, priority, or assignee_email.' });

  fields.push('updated_at = NOW()');
  await db.run(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`, ...values, req.params.id);

  const updated = await db.get('SELECT * FROM tickets WHERE id = ?', req.params.id);
  res.json(updated);
});

export default router;
