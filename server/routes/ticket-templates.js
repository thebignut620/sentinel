import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import Anthropic from '@anthropic-ai/sdk';

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET /api/ticket-templates — list all templates
router.get('/', authenticate, async (req, res) => {
  try {
    const templates = await db.all(
      `SELECT t.*, u.name as created_by_name
       FROM ticket_templates t
       LEFT JOIN users u ON u.id = t.created_by
       ORDER BY t.usage_count DESC, t.created_at DESC`
    );
    res.json(templates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /api/ticket-templates — create template (it_staff+)
router.post('/', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const { name, category, body } = req.body;
  if (!name || !body) return res.status(400).json({ error: 'name and body required' });
  try {
    const result = await db.run(
      `INSERT INTO ticket_templates (name, category, body, created_by) VALUES (?, ?, ?, ?)`,
      name, category || null, body, req.user.id
    );
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /api/ticket-templates/:id — update template (it_staff+)
router.put('/:id', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const { name, category, body } = req.body;
  try {
    await db.run(
      `UPDATE ticket_templates SET name = ?, category = ?, body = ?, updated_at = NOW() WHERE id = ?`,
      name, category || null, body, req.params.id
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /api/ticket-templates/:id — delete template (it_staff+)
router.delete('/:id', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  try {
    await db.run(`DELETE FROM ticket_templates WHERE id = ?`, req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// POST /api/ticket-templates/:id/use — increment usage count
router.post('/:id/use', authenticate, async (req, res) => {
  try {
    await db.run(
      `UPDATE ticket_templates SET usage_count = usage_count + 1 WHERE id = ?`,
      req.params.id
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record template use' });
  }
});

// POST /api/ticket-templates/suggest — ATLAS suggests best template for a ticket
router.post('/suggest', authenticate, async (req, res) => {
  const { ticketTitle, ticketDescription, category } = req.body;
  try {
    const templates = await db.all(
      `SELECT id, name, category, body FROM ticket_templates ORDER BY usage_count DESC LIMIT 20`
    );
    if (templates.length === 0) return res.json({ suggestions: [] });

    const templateList = templates.map((t, i) =>
      `${i + 1}. [ID:${t.id}] "${t.name}" (${t.category || 'general'}): ${t.body.slice(0, 100)}...`
    ).join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `You are an IT helpdesk assistant. A staff member is responding to a ticket.

Ticket title: ${ticketTitle}
Category: ${category}
Description: ${ticketDescription}

Available reply templates:
${templateList}

Return the IDs of the top 3 most relevant templates for this ticket, as a JSON array like: [12, 5, 8]
Return ONLY the JSON array, no other text.`
      }]
    });

    const text = message.content[0].text.trim();
    const ids = JSON.parse(text);
    const suggestions = templates.filter(t => ids.includes(t.id));
    res.json({ suggestions });
  } catch (err) {
    console.error(err);
    res.json({ suggestions: [] });
  }
});

export default router;
