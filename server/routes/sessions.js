import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/connection.js';

const router = express.Router();

// GET /api/sessions — list sessions for the company
router.get('/', async (req, res) => {
  const companyId = req.user.company_id || 1;
  const rows = await db.all(
    `SELECT s.id, s.name, s.started_at, s.notes, u.name as started_by_name
     FROM sessions s
     JOIN users u ON s.started_by = u.id
     WHERE s.company_id = ?
     ORDER BY s.started_at DESC
     LIMIT 100`,
    companyId
  );
  res.json(rows);
});

// POST /api/sessions/start — start a new session (admin/staff only)
router.post('/start', async (req, res) => {
  if (req.user.role === 'employee') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { password, name, notes } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password is required to start a new session' });
  }

  const companyId = req.user.company_id || 1;

  // Verify password
  const user = await db.get('SELECT password FROM users WHERE id = ? AND is_active = 1', req.user.id);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const sessionName = name?.trim() || `Session ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const result = await db.run(
    `INSERT INTO sessions (company_id, name, started_by, notes) VALUES (?, ?, ?, ?)`,
    companyId, sessionName, req.user.id, notes?.trim() || null
  );

  const session = await db.get(
    `SELECT s.id, s.name, s.started_at, s.notes, u.name as started_by_name
     FROM sessions s JOIN users u ON s.started_by = u.id
     WHERE s.id = ?`,
    result.lastID ?? result.lastInsertRowid
  );

  res.status(201).json(session);
});

export default router;
