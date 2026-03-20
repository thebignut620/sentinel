import express from 'express';
import db from '../db/connection.js';
import { validateApiKey } from './api-keys.js';

const router = express.Router();

// Authenticate via X-API-Key header
async function zapierAuth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'X-API-Key header required' });

  const apiKey = await validateApiKey(key);
  if (!apiKey) return res.status(401).json({ error: 'Invalid or inactive API key' });

  req.apiKey = apiKey;
  next();
}

// GET /api/zapier — integration metadata
router.get('/', (req, res) => {
  res.json({
    name: 'Sentinel IT Helpdesk',
    description: 'IT helpdesk ticketing system with AI-powered support',
    version: '1.0.0',
    triggers: [
      { key: 'new-ticket',      label: 'New Ticket' },
      { key: 'resolved-ticket', label: 'Ticket Resolved' },
      { key: 'critical-ticket', label: 'Critical Ticket Created' },
    ],
    actions: [
      { key: 'create-ticket', label: 'Create Ticket' },
    ],
  });
});

// GET /api/zapier/triggers/new-ticket — polling trigger
router.get('/triggers/new-ticket', zapierAuth, async (req, res) => {
  const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db.all(`
    SELECT t.id, t.title, t.description, t.status, t.priority, t.category,
           t.created_at, t.updated_at, u.name as submitter_name, u.email as submitter_email,
           a.name as assignee_name
    FROM tickets t
    JOIN users u ON t.submitter_id = u.id
    LEFT JOIN users a ON t.assignee_id = a.id
    WHERE t.created_at > ?
    ORDER BY t.created_at DESC
    LIMIT 100
  `, since.toISOString());

  res.json(rows.map(formatTicket));
});

// GET /api/zapier/triggers/resolved-ticket — polling trigger
router.get('/triggers/resolved-ticket', zapierAuth, async (req, res) => {
  const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db.all(`
    SELECT t.id, t.title, t.description, t.status, t.priority, t.category,
           t.created_at, t.updated_at, t.resolved_at, u.name as submitter_name,
           u.email as submitter_email, a.name as assignee_name
    FROM tickets t
    JOIN users u ON t.submitter_id = u.id
    LEFT JOIN users a ON t.assignee_id = a.id
    WHERE t.status = 'resolved' AND t.resolved_at > ?
    ORDER BY t.resolved_at DESC
    LIMIT 100
  `, since.toISOString());

  res.json(rows.map(formatTicket));
});

// GET /api/zapier/triggers/critical-ticket — polling trigger
router.get('/triggers/critical-ticket', zapierAuth, async (req, res) => {
  const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db.all(`
    SELECT t.id, t.title, t.description, t.status, t.priority, t.category,
           t.created_at, t.updated_at, u.name as submitter_name, u.email as submitter_email
    FROM tickets t
    JOIN users u ON t.submitter_id = u.id
    WHERE t.priority = 'critical' AND t.created_at > ?
    ORDER BY t.created_at DESC
    LIMIT 100
  `, since.toISOString());

  res.json(rows.map(formatTicket));
});

// POST /api/zapier/actions/create-ticket
router.post('/actions/create-ticket', zapierAuth, async (req, res) => {
  const { title, description, priority = 'medium', category = 'software', submitter_email } = req.body;

  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: 'title and description are required' });
  }

  // Find submitter or use first admin
  let submitter = submitter_email
    ? await db.get('SELECT id FROM users WHERE email = ? AND is_active = 1', submitter_email)
    : null;
  if (!submitter) {
    submitter = await db.get("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1");
  }
  if (!submitter) return res.status(500).json({ error: 'No valid submitter found' });

  const validPriority  = ['low', 'medium', 'high', 'critical'].includes(priority) ? priority : 'medium';
  const validCategory  = ['hardware', 'software', 'network', 'access', 'account'].includes(category) ? category : 'software';

  const result = await db.run(`
    INSERT INTO tickets (title, description, priority, category, submitter_id, ai_attempted, sla_due_at)
    VALUES (?, ?, ?, ?, ?, 0, NOW())
  `, title.trim(), description.trim(), validPriority, validCategory, submitter.id);

  const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', result.lastID ?? result.lastInsertRowid);
  res.status(201).json(formatTicket(ticket));
});

function formatTicket(t) {
  return {
    id: String(t.id),
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    category: t.category,
    submitter_name: t.submitter_name || null,
    submitter_email: t.submitter_email || null,
    assignee_name: t.assignee_name || null,
    created_at: t.created_at,
    updated_at: t.updated_at,
    resolved_at: t.resolved_at || null,
  };
}

export default router;
