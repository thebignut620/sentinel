import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// List assets
router.get('/', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const { status, type, user_id } = req.query;
  const companyId = req.user.company_id || 1;
  let query = `
    SELECT a.*, u.name as assigned_user_name, u.email as assigned_user_email
    FROM assets a
    LEFT JOIN users u ON a.assigned_user_id = u.id
    WHERE a.company_id = ?
  `;
  const params = [companyId];
  if (status)  { query += ' AND a.status = ?';    params.push(status); }
  if (type)    { query += ' AND a.asset_type = ?'; params.push(type); }
  if (user_id) { query += ' AND a.assigned_user_id = ?'; params.push(user_id); }
  query += ' ORDER BY a.name';
  res.json(await db.all(query, ...params));
});

// Get single asset with maintenance history
router.get('/:id', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const asset = await db.get(`
    SELECT a.*, u.name as assigned_user_name, u.email as assigned_user_email
    FROM assets a LEFT JOIN users u ON a.assigned_user_id = u.id
    WHERE a.id = ? AND a.company_id = ?
  `, req.params.id, companyId);
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
  const companyId = req.user.company_id || 1;
  try {
    const r = await db.run(
      `INSERT INTO assets (name, asset_type, serial_number, manufacturer, model, purchase_date,
        warranty_expiry, assigned_user_id, status, notes, company_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      name.trim(), asset_type, serial_number || null, manufacturer || null, model || null,
      purchase_date || null, warranty_expiry || null, assigned_user_id || null,
      status || 'active', notes || null, companyId
    );
    res.status(201).json({ id: r.lastID });
  } catch {
    res.status(409).json({ error: 'Serial number already exists' });
  }
});

// Update asset
router.patch('/:id', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const asset = await db.get('SELECT * FROM assets WHERE id = ? AND company_id = ?', req.params.id, companyId);
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
  const companyId = req.user.company_id || 1;
  await db.run('DELETE FROM assets WHERE id = ? AND company_id = ?', req.params.id, companyId);
  res.json({ ok: true });
});

// Add maintenance record
router.post('/:id/maintenance', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const { description, cost, performed_at } = req.body;
  if (!description?.trim()) return res.status(400).json({ error: 'description required' });
  const companyId = req.user.company_id || 1;
  const asset = await db.get('SELECT id FROM assets WHERE id = ? AND company_id = ?', req.params.id, companyId);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  await db.run(
    'INSERT INTO asset_maintenance (asset_id, performed_by, description, cost, performed_at) VALUES (?, ?, ?, ?, ?)',
    req.params.id, req.user.id, description.trim(), cost || null,
    performed_at || new Date().toISOString()
  );
  res.status(201).json({ ok: true });
});

// Get assets with warranty expiring soon
router.get('/warranty-alerts', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sixtyDays = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const expiringSoon = await db.all(`
    SELECT a.*, u.name as assigned_user_name,
      CASE WHEN warranty_expiry <= $1 THEN '30days'
           WHEN warranty_expiry <= $2 THEN '60days' END as alert_level,
      (warranty_expiry::date - CURRENT_DATE) as days_remaining
    FROM assets a
    LEFT JOIN users u ON a.assigned_user_id = u.id
    WHERE a.company_id = $3 AND a.warranty_expiry IS NOT NULL
      AND a.warranty_expiry >= $4 AND a.warranty_expiry <= $5
      AND a.status = 'active'
    ORDER BY warranty_expiry ASC
  `, thirtyDays, sixtyDays, companyId, today, sixtyDays);

  res.json(expiringSoon);
});

// Asset relations
router.get('/:id/relations', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const relations = await db.all(`
    SELECT ar.*,
      a1.name as from_name, a1.asset_type as from_type,
      a2.name as to_name, a2.asset_type as to_type
    FROM asset_relations ar
    JOIN assets a1 ON ar.from_asset_id = a1.id
    JOIN assets a2 ON ar.to_asset_id = a2.id
    WHERE ar.company_id = ? AND (ar.from_asset_id = ? OR ar.to_asset_id = ?)
  `, companyId, req.params.id, req.params.id);
  res.json(relations);
});

router.post('/:id/relations', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const { to_asset_id, relation_type } = req.body;
  const companyId = req.user.company_id || 1;
  try {
    await db.run('INSERT INTO asset_relations (from_asset_id, to_asset_id, relation_type, company_id) VALUES (?, ?, ?, ?)',
      req.params.id, to_asset_id, relation_type || 'connected_to', companyId);
    res.status(201).json({ ok: true });
  } catch { res.status(409).json({ error: 'Relation already exists' }); }
});

router.delete('/:id/relations/:relId', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  await db.run('DELETE FROM asset_relations WHERE id = ? AND company_id = ?', req.params.relId, companyId);
  res.json({ ok: true });
});

// Software licenses
router.get('/licenses', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  res.json(await db.all('SELECT * FROM software_licenses WHERE company_id = ? ORDER BY software_name', companyId));
});

router.post('/licenses', authenticate, requireRole('admin'), async (req, res) => {
  const { software_name, vendor, license_type, seats_purchased, seats_used, cost_per_seat, renewal_date, notes } = req.body;
  const companyId = req.user.company_id || 1;
  const r = await db.run(`
    INSERT INTO software_licenses (company_id, software_name, vendor, license_type, seats_purchased, seats_used, cost_per_seat, renewal_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, companyId, software_name, vendor || null, license_type || null, seats_purchased || 1, seats_used || 0, cost_per_seat || null, renewal_date || null, notes || null);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.patch('/licenses/:id', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const fields = ['software_name','vendor','license_type','seats_purchased','seats_used','cost_per_seat','renewal_date','notes'];
  const updates = ['updated_at = NOW()'];
  const vals = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); vals.push(req.body[f]); }
  }
  vals.push(req.params.id, companyId);
  await db.run(`UPDATE software_licenses SET ${updates.join(', ')} WHERE id = ? AND company_id = ?`, ...vals);
  res.json({ ok: true });
});

router.delete('/licenses/:id', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  await db.run('DELETE FROM software_licenses WHERE id = ? AND company_id = ?', req.params.id, companyId);
  res.json({ ok: true });
});

// CSV import
router.post('/import-csv', authenticate, requireRole('admin'), async (req, res) => {
  const { rows } = req.body; // Array of asset objects
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'rows array required' });
  const companyId = req.user.company_id || 1;
  let imported = 0;
  const errors = [];
  for (const row of rows) {
    try {
      await db.run(`
        INSERT INTO assets (name, asset_type, serial_number, manufacturer, model, purchase_date, warranty_expiry, status, notes, company_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, row.name, row.asset_type || 'other', row.serial_number || null, row.manufacturer || null, row.model || null,
         row.purchase_date || null, row.warranty_expiry || null, row.status || 'active', row.notes || null, companyId);
      imported++;
    } catch (e) {
      errors.push(`Row ${imported + errors.length + 1}: ${e.message}`);
    }
  }
  res.json({ imported, errors });
});

export default router;
