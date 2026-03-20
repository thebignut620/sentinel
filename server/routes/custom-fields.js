import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get custom fields (optionally filtered by category)
router.get('/', authenticate, async (req, res) => {
  const { category } = req.query;
  let query = 'SELECT * FROM custom_fields';
  const params = [];
  if (category) { query += ' WHERE category = ?'; params.push(category); }
  query += ' ORDER BY category, sort_order, id';
  res.json(await db.all(query, ...params));
});

router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  const { category, field_name, field_label, field_type, options, required, sort_order } = req.body;
  if (!category || !field_name?.trim() || !field_label?.trim()) {
    return res.status(400).json({ error: 'category, field_name and field_label required' });
  }
  const r = await db.run(
    `INSERT INTO custom_fields (category, field_name, field_label, field_type, options, required, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    category, field_name.trim(), field_label.trim(), field_type || 'text',
    options ? JSON.stringify(options) : null, required ? 1 : 0, sort_order || 0
  );
  res.status(201).json({ id: r.lastID });
});

router.patch('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const { field_label, field_type, options, required, sort_order } = req.body;
  await db.run(
    `UPDATE custom_fields SET field_label = ?, field_type = ?, options = ?, required = ?, sort_order = ?
     WHERE id = ?`,
    field_label, field_type, options ? JSON.stringify(options) : null,
    required ? 1 : 0, sort_order || 0, req.params.id
  );
  res.json({ ok: true });
});

router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  await db.run('DELETE FROM custom_fields WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

export default router;
