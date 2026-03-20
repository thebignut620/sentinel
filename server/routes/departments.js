import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const rows = await db.all(`
    SELECT d.*, COUNT(u.id) as member_count
    FROM departments d
    LEFT JOIN users u ON u.department_id = d.id AND u.is_active = 1
    GROUP BY d.id
    ORDER BY d.name
  `);
  res.json(rows);
});

router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  try {
    const r = await db.run(
      'INSERT INTO departments (name, description) VALUES (?, ?)',
      name.trim(), description || null
    );
    res.status(201).json({ id: r.lastID, name: name.trim(), description: description || null });
  } catch {
    res.status(409).json({ error: 'Department name already exists' });
  }
});

router.patch('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  await db.run(
    'UPDATE departments SET name = ?, description = ? WHERE id = ?',
    name.trim(), description || null, req.params.id
  );
  res.json({ ok: true });
});

router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  // Unassign users from this dept before deleting
  await db.run('UPDATE users SET department_id = NULL WHERE department_id = ?', req.params.id);
  await db.run('UPDATE tickets SET department_id = NULL WHERE department_id = ?', req.params.id);
  await db.run('DELETE FROM departments WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

export default router;
