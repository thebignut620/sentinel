import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get custom fields (optionally filtered by category)
router.get('/', authenticate, async (req, res) => {
  const { category } = req.query;
  const companyId = req.user.company_id || 1;
  let query = 'SELECT * FROM custom_fields WHERE company_id = ?';
  const params = [companyId];
  if (category) { query += ' AND category = ?'; params.push(category); }
  query += ' ORDER BY category, sort_order, id';
  res.json(await db.all(query, ...params));
});

router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  const { category, field_name, field_label, field_type, options, required, sort_order } = req.body;
  if (!category || !field_name?.trim() || !field_label?.trim()) {
    return res.status(400).json({ error: 'category, field_name and field_label required' });
  }
  const companyId = req.user.company_id || 1;
  const r = await db.run(
    `INSERT INTO custom_fields (category, field_name, field_label, field_type, options, required, sort_order, company_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    category, field_name.trim(), field_label.trim(), field_type || 'text',
    options ? JSON.stringify(options) : null, required ? 1 : 0, sort_order || 0, companyId
  );
  res.status(201).json({ id: r.lastID });
});

router.patch('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const { field_label, field_type, options, required, sort_order } = req.body;
  const companyId = req.user.company_id || 1;
  await db.run(
    `UPDATE custom_fields SET field_label = ?, field_type = ?, options = ?, required = ?, sort_order = ?
     WHERE id = ? AND company_id = ?`,
    field_label, field_type, options ? JSON.stringify(options) : null,
    required ? 1 : 0, sort_order || 0, req.params.id, companyId
  );
  res.json({ ok: true });
});

router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  await db.run('DELETE FROM custom_fields WHERE id = ? AND company_id = ?', req.params.id, companyId);
  res.json({ ok: true });
});

export default router;
