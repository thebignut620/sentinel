import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get tickets (employees see own, staff/admin see all)
router.get('/', authenticate, async (req, res) => {
  const { status, priority } = req.query;

  let query, params;

  if (req.user.role === 'employee') {
    query = `
      SELECT t.*, u.name as submitter_name, a.name as assignee_name
      FROM tickets t
      JOIN users u ON t.submitter_id = u.id
      LEFT JOIN users a ON t.assignee_id = a.id
      WHERE t.submitter_id = ?
    `;
    params = [req.user.id];
  } else {
    query = `
      SELECT t.*, u.name as submitter_name, a.name as assignee_name
      FROM tickets t
      JOIN users u ON t.submitter_id = u.id
      LEFT JOIN users a ON t.assignee_id = a.id
      WHERE 1=1
    `;
    params = [];
  }

  if (status) { query += ' AND t.status = ?'; params.push(status); }
  if (priority) { query += ' AND t.priority = ?'; params.push(priority); }
  query += ' ORDER BY t.created_at DESC';

  res.json(await db.all(query, ...params));
});

// Get single ticket with comments
router.get('/:id', authenticate, async (req, res) => {
  const ticket = await db.get(`
    SELECT t.*, u.name as submitter_name, a.name as assignee_name
    FROM tickets t
    JOIN users u ON t.submitter_id = u.id
    LEFT JOIN users a ON t.assignee_id = a.id
    WHERE t.id = ?
  `, req.params.id);

  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  if (req.user.role === 'employee' && ticket.submitter_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const comments = await db.all(`
    SELECT tc.*, u.name as author_name, u.role as author_role
    FROM ticket_comments tc
    JOIN users u ON tc.user_id = u.id
    WHERE tc.ticket_id = ?
    ORDER BY tc.created_at ASC
  `, req.params.id);

  res.json({ ...ticket, comments });
});

// Create ticket
router.post('/', authenticate, async (req, res) => {
  const { title, description, priority = 'medium', ai_attempted = false, ai_suggestion = null } = req.body;

  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  const result = await db.run(`
    INSERT INTO tickets (title, description, priority, submitter_id, ai_attempted, ai_suggestion)
    VALUES (?, ?, ?, ?, ?, ?)
  `, title.trim(), description.trim(), priority, req.user.id, ai_attempted ? 1 : 0, ai_suggestion);

  const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', result.lastInsertRowid);
  res.status(201).json(ticket);
});

// Update ticket (staff/admin only)
router.patch('/:id', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const { status, priority, assignee_id } = req.body;
  const fields = [];
  const values = [];

  if (status !== undefined) { fields.push('status = ?'); values.push(status); }
  if (priority !== undefined) { fields.push('priority = ?'); values.push(priority); }
  if (assignee_id !== undefined) { fields.push('assignee_id = ?'); values.push(assignee_id || null); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  fields.push("updated_at = datetime('now')");
  await db.run(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`, ...values, req.params.id);

  const updated = await db.get(`
    SELECT t.*, u.name as submitter_name, a.name as assignee_name
    FROM tickets t
    JOIN users u ON t.submitter_id = u.id
    LEFT JOIN users a ON t.assignee_id = a.id
    WHERE t.id = ?
  `, req.params.id);

  res.json(updated);
});

// Add comment
router.post('/:id/comments', authenticate, async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Comment body required' });

  const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  if (req.user.role === 'employee' && ticket.submitter_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const result = await db.run(
    'INSERT INTO ticket_comments (ticket_id, user_id, body) VALUES (?, ?, ?)',
    req.params.id, req.user.id, body.trim()
  );

  await db.run("UPDATE tickets SET updated_at = datetime('now') WHERE id = ?", req.params.id);

  const comment = await db.get(`
    SELECT tc.*, u.name as author_name, u.role as author_role
    FROM ticket_comments tc
    JOIN users u ON tc.user_id = u.id
    WHERE tc.id = ?
  `, result.lastInsertRowid);

  res.status(201).json(comment);
});

export default router;
