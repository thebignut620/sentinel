import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/incidents — list active incidents (all authenticated users see these)
router.get('/', authenticate, async (req, res) => {
  try {
    const incidents = await db.all(
      `SELECT i.*, u.name as resolved_by_name
       FROM incidents i
       LEFT JOIN users u ON u.id = i.resolved_by
       ORDER BY i.created_at DESC
       LIMIT 50`
    );
    res.json(incidents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// GET /api/incidents/active — just active incidents for the banner
router.get('/active', authenticate, async (req, res) => {
  try {
    const incidents = await db.all(
      `SELECT * FROM incidents WHERE status = 'active' ORDER BY created_at DESC`
    );
    res.json(incidents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch active incidents' });
  }
});

// POST /api/incidents/:id/resolve — resolve an incident (it_staff+)
router.post('/:id/resolve', authenticate, requireRole(['it_staff', 'admin']), async (req, res) => {
  const { id } = req.params;
  try {
    const incident = await db.get('SELECT * FROM incidents WHERE id = ?', id);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    await db.run(
      `UPDATE incidents SET status = 'resolved', resolved_by = ?, resolved_at = NOW() WHERE id = ?`,
      req.user.id, id
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to resolve incident' });
  }
});

// POST /api/incidents — manually create an incident (it_staff+)
router.post('/', authenticate, requireRole(['it_staff', 'admin']), async (req, res) => {
  const { title, description, category } = req.body;
  if (!title || !description || !category) {
    return res.status(400).json({ error: 'title, description, and category required' });
  }
  try {
    const result = await db.run(
      `INSERT INTO incidents (title, description, category) VALUES (?, ?, ?)`,
      title, description, category
    );
    res.status(201).json({ id: result.lastID || result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

export default router;
