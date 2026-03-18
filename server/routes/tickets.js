import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { sendTicketStatusEmail } from '../services/email.js';

const router = express.Router();

async function logHistory(ticketId, userId, action, fromVal, toVal) {
  await db.run(
    'INSERT INTO ticket_history (ticket_id, user_id, action, from_val, to_val) VALUES (?, ?, ?, ?, ?)',
    ticketId, userId, action, fromVal ?? null, toVal
  );
}

// List tickets
router.get('/', authenticate, async (req, res) => {
  const { status, priority, category, search, assignee } = req.query;
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

  if (status)   { query += ' AND t.status = ?';   params.push(status); }
  if (priority) { query += ' AND t.priority = ?'; params.push(priority); }
  if (category) { query += ' AND t.category = ?'; params.push(category); }
  if (assignee === 'me') { query += ' AND t.assignee_id = ?'; params.push(req.user.id); }
  if (search) {
    query += ' AND (t.title LIKE ? OR u.name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY t.created_at DESC';

  res.json(await db.all(query, ...params));
});

// Get ticket history
router.get('/:id/history', authenticate, async (req, res) => {
  const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (req.user.role === 'employee' && ticket.submitter_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const history = await db.all(`
    SELECT th.*, u.name as actor_name, u.role as actor_role
    FROM ticket_history th
    JOIN users u ON th.user_id = u.id
    WHERE th.ticket_id = ?
    ORDER BY th.created_at ASC
  `, req.params.id);

  res.json(history);
});

// Get related tickets (same category, different id)
router.get('/:id/related', authenticate, async (req, res) => {
  const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const related = await db.all(`
    SELECT t.id, t.title, t.status, t.priority, t.category, t.created_at, u.name as submitter_name
    FROM tickets t
    JOIN users u ON t.submitter_id = u.id
    WHERE t.category = ? AND t.id != ?
    ORDER BY t.created_at DESC
    LIMIT 4
  `, ticket.category, ticket.id);

  res.json(related);
});

// Get single ticket with comments, notes, attachments
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

  let notes = [];
  if (req.user.role !== 'employee') {
    notes = await db.all(`
      SELECT tn.*, u.name as author_name
      FROM ticket_notes tn
      JOIN users u ON tn.user_id = u.id
      WHERE tn.ticket_id = ?
      ORDER BY tn.created_at ASC
    `, req.params.id);
  }

  const attachments = await db.all(
    'SELECT id, filename, original, size, mimetype, created_at FROM ticket_attachments WHERE ticket_id = ? ORDER BY created_at ASC',
    req.params.id
  );

  res.json({ ...ticket, comments, notes, attachments });
});

// Create ticket
router.post('/', authenticate, async (req, res) => {
  const {
    title, description,
    priority = 'medium',
    category = 'software',
    ai_attempted = false,
    ai_suggestion = null,
  } = req.body;

  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: 'Title and description are required' });
  }

  const result = await db.run(`
    INSERT INTO tickets (title, description, priority, category, submitter_id, ai_attempted, ai_suggestion)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, title.trim(), description.trim(), priority, category, req.user.id, ai_attempted ? 1 : 0, ai_suggestion);

  const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', result.lastInsertRowid);

  // Log creation
  await logHistory(ticket.id, req.user.id, 'created', null, 'open');

  res.status(201).json(ticket);
});

// Bulk update tickets (staff/admin only)
router.patch('/bulk', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const { ids, status, assignee_id } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }
  if (!status && assignee_id === undefined) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  for (const id of ids) {
    const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', id);
    if (!ticket) continue;

    const fields = ["updated_at = datetime('now')"];
    const values = [];

    if (status) {
      fields.push('status = ?'); values.push(status);
      if (status === 'resolved' && ticket.status !== 'resolved') {
        fields.push("resolved_at = datetime('now')");
      } else if (status !== 'resolved') {
        fields.push('resolved_at = NULL');
      }
      if (status !== ticket.status) {
        await logHistory(id, req.user.id, 'status', ticket.status, status);
      }
    }
    if (assignee_id !== undefined) {
      fields.push('assignee_id = ?'); values.push(assignee_id || null);
    }

    await db.run(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`, ...values, id);
  }

  res.json({ ok: true, updated: ids.length });
});

// Update ticket (staff/admin only)
router.patch('/:id', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const { status, priority, category, assignee_id } = req.body;
  const fields = [];
  const values = [];

  if (status !== undefined)      { fields.push('status = ?');      values.push(status); }
  if (priority !== undefined)    { fields.push('priority = ?');    values.push(priority); }
  if (category !== undefined)    { fields.push('category = ?');    values.push(category); }
  if (assignee_id !== undefined) { fields.push('assignee_id = ?'); values.push(assignee_id || null); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  fields.push("updated_at = datetime('now')");

  if (status === 'resolved' && ticket.status !== 'resolved') {
    fields.push("resolved_at = datetime('now')");
  } else if (status && status !== 'resolved') {
    fields.push('resolved_at = NULL');
  }

  await db.run(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`, ...values, req.params.id);

  // Log changes to history
  if (status && status !== ticket.status) {
    await logHistory(req.params.id, req.user.id, 'status', ticket.status, status);
  }
  if (priority && priority !== ticket.priority) {
    await logHistory(req.params.id, req.user.id, 'priority', ticket.priority, priority);
  }
  if (assignee_id !== undefined) {
    const newAssignee = assignee_id || null;
    if (newAssignee !== ticket.assignee_id) {
      const assigneeName = newAssignee
        ? (await db.get('SELECT name FROM users WHERE id = ?', newAssignee))?.name
        : null;
      await logHistory(req.params.id, req.user.id, 'assigned', ticket.assignee_id?.toString() ?? null, assigneeName ?? 'Unassigned');
    }
  }

  const updated = await db.get(`
    SELECT t.*, u.name as submitter_name, a.name as assignee_name
    FROM tickets t
    JOIN users u ON t.submitter_id = u.id
    LEFT JOIN users a ON t.assignee_id = a.id
    WHERE t.id = ?
  `, req.params.id);

  if (status && status !== ticket.status) {
    const submitter = await db.get('SELECT name, email FROM users WHERE id = ?', ticket.submitter_id);
    if (submitter) {
      sendTicketStatusEmail({ to: submitter.email, name: submitter.name, ticketId: ticket.id, title: ticket.title, newStatus: status });
    }
  }

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

// Add internal note (IT staff/admin only)
router.post('/:id/notes', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Note body required' });

  const ticket = await db.get('SELECT id FROM tickets WHERE id = ?', req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const result = await db.run(
    'INSERT INTO ticket_notes (ticket_id, user_id, body) VALUES (?, ?, ?)',
    req.params.id, req.user.id, body.trim()
  );

  const note = await db.get(`
    SELECT tn.*, u.name as author_name
    FROM ticket_notes tn
    JOIN users u ON tn.user_id = u.id
    WHERE tn.id = ?
  `, result.lastInsertRowid);

  res.status(201).json(note);
});

export default router;
