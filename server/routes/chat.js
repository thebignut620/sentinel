import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import Anthropic from '@anthropic-ai/sdk';

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Get all active chat sessions (IT staff/admin only)
router.get('/sessions', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const sessions = await db.all(`
    SELECT cs.*, u.name as employee_name, u.email as employee_email
    FROM chat_sessions cs
    JOIN users u ON cs.user_id = u.id
    WHERE cs.company_id = ? AND cs.status = 'active'
    ORDER BY cs.updated_at DESC
  `, companyId);
  res.json(sessions);
});

// Get or create session for current user
router.get('/session', authenticate, async (req, res) => {
  const companyId = req.user.company_id || 1;
  let session = await db.get(
    `SELECT * FROM chat_sessions WHERE user_id = ? AND company_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    req.user.id, companyId
  );
  if (!session) {
    const r = await db.run(
      `INSERT INTO chat_sessions (user_id, company_id, status) VALUES (?, ?, 'active')`,
      req.user.id, companyId
    );
    session = await db.get('SELECT * FROM chat_sessions WHERE id = ?', r.lastInsertRowid);
  }
  const messages = await db.all('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC', session.id);
  res.json({ session, messages });
});

// Get session messages (for IT staff viewing a session)
router.get('/sessions/:sessionId/messages', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const session = await db.get('SELECT * FROM chat_sessions WHERE id = ? AND company_id = ?', req.params.sessionId, companyId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const messages = await db.all('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC', req.params.sessionId);
  res.json({ session, messages });
});

// Send message + get ATLAS response
router.post('/session/message', authenticate, async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });
  const companyId = req.user.company_id || 1;

  // Get or create session
  let session = await db.get(
    `SELECT * FROM chat_sessions WHERE user_id = ? AND company_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    req.user.id, companyId
  );
  if (!session) {
    const r = await db.run(`INSERT INTO chat_sessions (user_id, company_id, status) VALUES (?, ?, 'active')`, req.user.id, companyId);
    session = await db.get('SELECT * FROM chat_sessions WHERE id = ?', r.lastInsertRowid);
  }

  // Save user message
  await db.run(`INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'user', ?)`, session.id, message.trim());
  await db.run('UPDATE chat_sessions SET updated_at = NOW() WHERE id = ?', session.id);

  // Get conversation history
  const history = await db.all('SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 20', session.id);

  // Get company profile for context
  const profile = await db.get('SELECT * FROM company_profile WHERE company_id = ?', companyId);

  try {
    const systemPrompt = `You are ATLAS, an intelligent IT support assistant for ${profile?.company_name || 'this company'}.
You help employees resolve IT issues quickly. Be conversational, friendly, and concise.
Give short, clear responses - 1-3 sentences per message. Ask clarifying questions when needed.
If you cannot resolve the issue after 2-3 exchanges, suggest converting to a support ticket.
Do NOT use markdown in responses - plain text only.
Company context: ${profile ? `Industry: ${profile.industry}, OS: ${profile.os_types}, Software: ${profile.primary_software}` : 'General IT environment'}`;

    const msgs = history.map(h => ({ role: h.role, content: h.content }));

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: systemPrompt,
      messages: msgs,
    });

    const atlasReply = response.content[0].text;
    await db.run(`INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'assistant', ?)`, session.id, atlasReply);
    await db.run('UPDATE chat_sessions SET updated_at = NOW(), message_count = message_count + 1 WHERE id = ?', session.id);

    res.json({ reply: atlasReply, session_id: session.id });
  } catch (e) {
    console.error('[chat] ATLAS error:', e.message);
    const fallback = "I'm having trouble connecting right now. Please try again or create a support ticket for immediate help.";
    await db.run(`INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'assistant', ?)`, session.id, fallback);
    res.json({ reply: fallback, session_id: session.id });
  }
});

// Rate chat session
router.post('/session/rate', authenticate, async (req, res) => {
  const { rating } = req.body; // 'up' or 'down'
  const companyId = req.user.company_id || 1;
  const session = await db.get(
    `SELECT * FROM chat_sessions WHERE user_id = ? AND company_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    req.user.id, companyId
  );
  if (!session) return res.status(404).json({ error: 'No active session' });
  await db.run('UPDATE chat_sessions SET rating = ?, status = ? WHERE id = ?', rating, 'closed', session.id);
  res.json({ ok: true });
});

// Convert chat to ticket
router.post('/session/convert-ticket', authenticate, async (req, res) => {
  const { title } = req.body;
  const companyId = req.user.company_id || 1;
  const session = await db.get(
    `SELECT * FROM chat_sessions WHERE user_id = ? AND company_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    req.user.id, companyId
  );
  if (!session) return res.status(404).json({ error: 'No active session' });

  const messages = await db.all('SELECT role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC', session.id);
  const chatHistory = messages.map(m => `[${m.role === 'user' ? req.user.name : 'ATLAS'}]: ${m.content}`).join('\n');

  const ticketTitle = title?.trim() || messages.find(m => m.role === 'user')?.content?.slice(0, 100) || 'IT Support Request from Chat';

  const r = await db.run(`
    INSERT INTO tickets (title, description, priority, category, submitter_id, company_id, ai_attempted, status)
    VALUES (?, ?, 'medium', 'software', ?, ?, 1, 'open')
  `, ticketTitle, `Chat conversation:\n\n${chatHistory}`, req.user.id, companyId);

  await db.run('UPDATE chat_sessions SET ticket_id = ?, status = ? WHERE id = ?', r.lastInsertRowid, 'converted', session.id);

  res.json({ ticket_id: r.lastInsertRowid });
});

// IT staff takeover
router.post('/sessions/:sessionId/takeover', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const session = await db.get('SELECT * FROM chat_sessions WHERE id = ? AND company_id = ?', req.params.sessionId, companyId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  await db.run('UPDATE chat_sessions SET taken_over_by = ?, taken_over_at = NOW() WHERE id = ?', req.user.id, req.params.sessionId);
  await db.run(`INSERT INTO chat_messages (session_id, role, content) VALUES (?, 'system', ?)`, req.params.sessionId, `${req.user.name} from IT has joined the conversation.`);
  res.json({ ok: true });
});

// Close session
router.post('/session/close', authenticate, async (req, res) => {
  const companyId = req.user.company_id || 1;
  await db.run(
    `UPDATE chat_sessions SET status = 'closed' WHERE user_id = ? AND company_id = ? AND status = 'active'`,
    req.user.id, companyId
  );
  res.json({ ok: true });
});

export default router;
