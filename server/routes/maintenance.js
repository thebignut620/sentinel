import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// List maintenance windows
router.get('/', authenticate, async (req, res) => {
  const companyId = req.user.company_id || 1;
  const rows = await db.all(`
    SELECT mw.*, u.name as created_by_name
    FROM maintenance_windows mw
    LEFT JOIN users u ON mw.created_by = u.id
    WHERE mw.company_id = ?
    ORDER BY mw.starts_at DESC
    LIMIT 50
  `, companyId);
  res.json(rows);
});

// Get active window (for banner) — public endpoint, no company_id filter needed
// (banner is shown before auth context; use a query param or skip filtering for safety)
router.get('/active', async (req, res) => {
  const now = new Date().toISOString();
  const row = await db.get(
    "SELECT * FROM maintenance_windows WHERE starts_at <= ? AND ends_at >= ? ORDER BY starts_at ASC LIMIT 1",
    now, now
  );
  res.json(row || null);
});

// Create window
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  const { title, description, starts_at, ends_at, notify_users } = req.body;
  if (!title?.trim() || !starts_at || !ends_at) {
    return res.status(400).json({ error: 'title, starts_at and ends_at required' });
  }
  const companyId = req.user.company_id || 1;
  const r = await db.run(
    `INSERT INTO maintenance_windows (title, description, starts_at, ends_at, notify_users, created_by, company_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    title.trim(), description || null, starts_at, ends_at,
    notify_users !== false ? 1 : 0, req.user.id, companyId
  );
  res.status(201).json({ id: r.lastID });
});

// Update window
router.patch('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const { title, description, starts_at, ends_at, notify_users } = req.body;
  const companyId = req.user.company_id || 1;
  await db.run(
    `UPDATE maintenance_windows SET title = ?, description = ?, starts_at = ?, ends_at = ?, notify_users = ?
     WHERE id = ? AND company_id = ?`,
    title, description || null, starts_at, ends_at,
    notify_users !== false ? 1 : 0, req.params.id, companyId
  );
  res.json({ ok: true });
});

// Delete window
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  await db.run('DELETE FROM maintenance_windows WHERE id = ? AND company_id = ?', req.params.id, companyId);
  res.json({ ok: true });
});

export default router;
