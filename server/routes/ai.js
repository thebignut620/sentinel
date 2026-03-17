import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import db from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert IT support specialist for a company helpdesk system called Sentinel.
Your job is to help employees resolve their IT issues with clear, concise, step-by-step instructions.
Format your response with numbered steps when applicable.
Be practical and focus on solutions that a non-technical employee can follow.
If the issue requires physical access, special admin privileges, or is unclear, say so and recommend submitting a support ticket.`;

router.post('/assist', authenticate, async (req, res) => {
  const { problem } = req.body;
  if (!problem?.trim()) {
    return res.status(400).json({ error: 'Problem description is required' });
  }

  // Check if AI is enabled in settings
  const aiEnabled = await db.get("SELECT value FROM settings WHERE key = 'ai_enabled'");
  if (aiEnabled?.value !== 'true') {
    return res.json({ resolved: false, suggestion: null, aiDisabled: true });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `I have an IT issue and need help.\n\nProblem: ${problem}\n\nPlease provide step-by-step instructions to resolve this issue.`
        }
      ]
    });

    const suggestion = response.content.find(b => b.type === 'text')?.text || '';

    // Heuristic: determine if the AI provided a usable resolution
    const unresolvableSignals = [
      'submit a ticket', 'contact it', 'contact your it', 'reach out to',
      'i cannot', "i can't", 'unable to', 'not possible remotely',
      'requires physical', 'needs administrator', 'i don\'t have enough information'
    ];
    const lowerSuggestion = suggestion.toLowerCase();
    const resolved = !unresolvableSignals.some(sig => lowerSuggestion.includes(sig))
      && suggestion.length > 120;

    res.json({ resolved, suggestion });
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.json({ resolved: false, suggestion: null, error: 'AI service temporarily unavailable' });
  }
});

export default router;
