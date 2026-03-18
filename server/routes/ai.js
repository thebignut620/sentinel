import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import db from '../db/connection.js';

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Feature 8: ATLAS custom AI personality ─────────────────────────────────────
const ATLAS_SYSTEM = `You are ATLAS — Advanced Technical Logistics and Automation System — the AI core of the Sentinel IT Helpdesk platform.

Your personality:
- Precise and tactical. You diagnose before you prescribe.
- Professional and confident, like a senior systems engineer, not a generic chatbot.
- Structured: use numbered steps, clear sections, no fluff.
- Direct: get to the solution fast. Skip pleasantries.
- Honest: if something requires physical access, admin rights, or escalation — say so clearly and immediately.

Your job: Help employees resolve IT issues with clear, actionable step-by-step instructions.
Format responses with numbered steps. Bold key actions. If the issue can't be solved remotely, say so and recommend submitting a ticket.`;

// POST /ai/assist — ATLAS interactive help
router.post('/assist', async (req, res) => {
  const { problem } = req.body;
  if (!problem?.trim()) {
    return res.status(400).json({ error: 'Problem description is required' });
  }

  const aiEnabled = await db.get("SELECT value FROM settings WHERE key = 'ai_enabled'");
  if (aiEnabled?.value !== 'true') {
    return res.json({ resolved: false, suggestion: null, aiDisabled: true });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      system: ATLAS_SYSTEM,
      messages: [{
        role: 'user',
        content: `IT Issue: ${problem}\n\nDiagnose and provide step-by-step resolution instructions.`,
      }],
    });

    const suggestion = response.content.find(b => b.type === 'text')?.text || '';

    const escalationSignals = [
      'submit a ticket', 'contact it', 'contact your it', 'reach out to',
      'i cannot', "i can't", 'unable to', 'not possible remotely',
      'requires physical', 'needs administrator', 'recommend escalat',
      "i don't have enough information",
    ];
    const resolved = !escalationSignals.some(s => suggestion.toLowerCase().includes(s))
      && suggestion.length > 120;

    res.json({ resolved, suggestion });
  } catch (err) {
    console.error('[ATLAS] assist error:', err.message);
    res.json({ resolved: false, suggestion: null, error: 'ATLAS is temporarily offline.' });
  }
});

// GET /ai/suggestions/:ticketId — return atlas_suggestions for a ticket
router.get('/suggestions/:ticketId', async (req, res) => {
  const ticket = await db.get(
    'SELECT atlas_suggestions FROM tickets WHERE id = ?',
    req.params.ticketId
  );
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const suggestions = ticket.atlas_suggestions
    ? JSON.parse(ticket.atlas_suggestions)
    : [];

  // Enrich with full ticket data
  const enriched = await Promise.all(
    suggestions.map(async s => {
      const t = await db.get(
        'SELECT id, title, status, category, resolution_report FROM tickets WHERE id = ?',
        s.id
      );
      return t ? { ...s, status: t.status, category: t.category, resolution_report: t.resolution_report } : null;
    })
  );

  res.json(enriched.filter(Boolean));
});

export default router;
