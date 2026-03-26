import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const companyId = req.user.company_id || 1;
  const rows = await db.all(`
    SELECT d.*, COUNT(u.id) as member_count
    FROM departments d
    LEFT JOIN users u ON u.department_id = d.id AND u.is_active = 1 AND u.company_id = ?
    WHERE d.company_id = ?
    GROUP BY d.id
    ORDER BY d.name
  `, companyId, companyId);
  res.json(rows);
});

router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const companyId = req.user.company_id || 1;
  try {
    const r = await db.run(
      'INSERT INTO departments (name, description, company_id) VALUES (?, ?, ?)',
      name.trim(), description || null, companyId
    );
    res.status(201).json({ id: r.lastID, name: name.trim(), description: description || null });
  } catch {
    res.status(409).json({ error: 'Department name already exists' });
  }
});

router.patch('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const companyId = req.user.company_id || 1;
  await db.run(
    'UPDATE departments SET name = ?, description = ? WHERE id = ? AND company_id = ?',
    name.trim(), description || null, req.params.id, companyId
  );
  res.json({ ok: true });
});

router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  // Unassign users from this dept before deleting
  await db.run('UPDATE users SET department_id = NULL WHERE department_id = ? AND company_id = ?', req.params.id, companyId);
  await db.run('UPDATE tickets SET department_id = NULL WHERE department_id = ? AND company_id = ?', req.params.id, companyId);
  await db.run('DELETE FROM departments WHERE id = ? AND company_id = ?', req.params.id, companyId);
  res.json({ ok: true });
});

export default router;
