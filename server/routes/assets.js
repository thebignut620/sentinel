import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// List assets
router.get('/', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const { status, type, user_id } = req.query;
  let query = `
    SELECT a.*, u.name as assigned_user_name, u.email as assigned_user_email
    FROM assets a
    LEFT JOIN users u ON a.assigned_user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  if (status)  { query += ' AND a.status = ?';    params.push(status); }
  if (type)    { query += ' AND a.asset_type = ?'; params.push(type); }
  if (user_id) { query += ' AND a.assigned_user_id = ?'; params.push(user_id); }
  query += ' ORDER BY a.name';
  res.json(await db.all(query, ...params));
});

// Get single asset with maintenance history
router.get('/:id', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const asset = await db.get(`
    SELECT a.*, u.name as assigned_user_name, u.email as assigned_user_email
    FROM assets a LEFT JOIN users u ON a.assigned_user_id = u.id
    WHERE a.id = ?
  `, req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const maintenance = await db.all(`
    SELECT am.*, u.name as performed_by_name
    FROM asset_maintenance am LEFT JOIN users u ON am.performed_by = u.id
    WHERE am.asset_id = ? ORDER BY am.performed_at DESC
  `, req.params.id);

  const tickets = await db.all(`
    SELECT t.id, t.title, t.status, t.created_at
    FROM ticket_assets ta JOIN tickets t ON ta.ticket_id = t.id
    WHERE ta.asset_id = ? ORDER BY t.created_at DESC LIMIT 10
  `, req.params.id);

  res.json({ ...asset, maintenance, tickets });
});

// Create asset
router.post('/', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const { name, asset_type, serial_number, manufacturer, model, purchase_date,
          warranty_expiry, assigned_user_id, status, notes } = req.body;
  if (!name?.trim() || !asset_type) return res.status(400).json({ error: 'name and asset_type required' });
  try {
    const r = await db.run(
      `INSERT INTO assets (name, asset_type, serial_number, manufacturer, model, purchase_date,
        warranty_expiry, assigned_user_id, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      name.trim(), asset_type, serial_number || null, manufacturer || null, model || null,
      purchase_date || null, warranty_expiry || null, assigned_user_id || null,
      status || 'active', notes || null
    );
    res.status(201).json({ id: r.lastID });
  } catch {
    res.status(409).json({ error: 'Serial number already exists' });
  }
});

// Update asset
router.patch('/:id', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const asset = await db.get('SELECT * FROM assets WHERE id = ?', req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const fields = ['name','asset_type','serial_number','manufacturer','model','purchase_date',
                  'warranty_expiry','assigned_user_id','status','notes'];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f] || null);
    }
  }
  if (!updates.length) return res.json({ ok: true });
  updates.push('updated_at = NOW()');
  params.push(req.params.id);
  await db.run(`UPDATE assets SET ${updates.join(', ')} WHERE id = ?`, ...params);
  res.json({ ok: true });
});

// Delete asset
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  await db.run('DELETE FROM assets WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

// Add maintenance record
router.post('/:id/maintenance', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const { description, cost, performed_at } = req.body;
  if (!description?.trim()) return res.status(400).json({ error: 'description required' });
  await db.run(
    'INSERT INTO asset_maintenance (asset_id, performed_by, description, cost, performed_at) VALUES (?, ?, ?, ?, ?)',
    req.params.id, req.user.id, description.trim(), cost || null,
    performed_at || new Date().toISOString()
  );
  res.status(201).json({ ok: true });
});

export default router;
