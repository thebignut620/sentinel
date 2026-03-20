import express from 'express';
import crypto from 'crypto';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

// Exported helper for other routes to validate API keys
export async function validateApiKey(rawKey) {
  if (!rawKey || !rawKey.startsWith('sk_live_')) return null;
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const key = await db.get(
    'SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1',
    hash
  );
  if (!key) return null;

  // Update usage stats (fire and forget)
  db.run(
    'UPDATE api_keys SET last_used_at = NOW(), requests_count = requests_count + 1 WHERE id = ?',
    key.id
  ).catch(() => {});

  return key;
}

// GET /api/api-keys — list all keys (admin only)
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  const keys = await db.all(`
    SELECT ak.id, ak.name, ak.key_prefix, ak.requests_count, ak.rate_limit,
           ak.is_active, ak.last_used_at, ak.created_at, u.name as created_by_name
    FROM api_keys ak
    LEFT JOIN users u ON ak.created_by = u.id
    ORDER BY ak.created_at DESC
  `);
  res.json(keys);
});

// POST /api/api-keys — generate new key (admin only)
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  const { name, rate_limit = 100 } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  const rawKey = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
  const prefix = rawKey.slice(0, 14); // "sk_live_xxxxxxxx"
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const result = await db.run(
    `INSERT INTO api_keys (name, key_prefix, key_hash, created_by, rate_limit)
     VALUES (?, ?, ?, ?, ?)`,
    name.trim(), prefix, hash, req.user.id, parseInt(rate_limit) || 100
  );

  const keyId = result.lastID ?? result.lastInsertRowid;
  await logAudit(req, { action: 'api_key.created', entityType: 'api_key', entityId: keyId, details: { name } });

  res.status(201).json({
    id: keyId,
    name: name.trim(),
    key_prefix: prefix,
    rate_limit: parseInt(rate_limit) || 100,
    // Return the raw key ONCE — it cannot be recovered after this
    key: rawKey,
  });
});

// PATCH /api/api-keys/:id — update key (name, rate_limit, is_active)
router.patch('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const key = await db.get('SELECT * FROM api_keys WHERE id = ?', req.params.id);
  if (!key) return res.status(404).json({ error: 'API key not found' });

  const { name, rate_limit, is_active } = req.body;
  const fields = [];
  const values = [];

  if (name !== undefined)       { fields.push('name = ?');       values.push(name.trim()); }
  if (rate_limit !== undefined) { fields.push('rate_limit = ?'); values.push(parseInt(rate_limit) || 100); }
  if (is_active !== undefined)  { fields.push('is_active = ?');  values.push(is_active ? 1 : 0); }

  if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  await db.run(`UPDATE api_keys SET ${fields.join(', ')} WHERE id = ?`, ...values, req.params.id);
  const updated = await db.get(
    'SELECT id, name, key_prefix, rate_limit, is_active, last_used_at, created_at FROM api_keys WHERE id = ?',
    req.params.id
  );
  await logAudit(req, { action: 'api_key.updated', entityType: 'api_key', entityId: key.id });
  res.json(updated);
});

// DELETE /api/api-keys/:id — revoke key
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const key = await db.get('SELECT * FROM api_keys WHERE id = ?', req.params.id);
  if (!key) return res.status(404).json({ error: 'API key not found' });

  await db.run('DELETE FROM api_keys WHERE id = ?', req.params.id);
  await logAudit(req, { action: 'api_key.revoked', entityType: 'api_key', entityId: key.id, details: { name: key.name } });
  res.json({ ok: true });
});

export default router;
