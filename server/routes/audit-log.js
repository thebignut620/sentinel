import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Query audit log
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  const { user_id, action, entity_type, entity_id, from, to, limit = 100, offset = 0 } = req.query;
  const companyId = req.user.company_id || 1;

  let query = 'SELECT * FROM audit_log WHERE company_id = ?';
  const params = [companyId];

  if (user_id)     { query += ' AND user_id = ?';     params.push(user_id); }
  if (action)      { query += ' AND action ILIKE ?';   params.push(`%${action}%`); }
  if (entity_type) { query += ' AND entity_type = ?';  params.push(entity_type); }
  if (entity_id)   { query += ' AND entity_id = ?';    params.push(entity_id); }
  if (from)        { query += ' AND created_at >= ?';  params.push(from); }
  if (to)          { query += ' AND created_at <= ?';  params.push(to); }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  const rows = await db.all(query, ...params);
  res.json(rows);
});

export default router;
