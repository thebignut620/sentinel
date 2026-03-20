/**
 * ATLAS — Advanced Technical Logistics and Automation System
 * The AI backbone of the Sentinel IT Helpdesk platform.
 */

import Anthropic from '@anthropic-ai/sdk';
import db from '../db/connection.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ATLAS_IDENTITY = `You are ATLAS — Advanced Technical Logistics and Automation System — the analytical engine of the Sentinel IT Helpdesk platform. You are a senior IT engineer with 10 years of enterprise support experience across Windows, macOS, Linux, networking, Active Directory, and cloud services.

Your role here is structured data extraction and analysis. You receive IT ticket data and return precise JSON output. No conversational text — just valid JSON.

Analysis standards:
- Category: hardware = physical devices; software = apps, OS, drivers, crashes; network = connectivity, VPN, WiFi, DNS; access = permissions, locked out, unauthorized; account = passwords, MFA, SSO, user management.
- Priority = business impact. critical: work completely stopped or security/data at risk. high: person or team cannot do their job. medium: degraded but workarounds exist. low: minor inconvenience.
- Sentiment = emotional tone from writing. frustrated: angry language, "again", "always", "terrible". urgent: time pressure, "asap", "deadline", "right now". calm: neutral and factual.
- Similar tickets: match on shared root cause, not keywords. A VPN timeout and "can't reach network drives" may share the same DNS or auth failure.
- Resolution reports: explain what technically happened and how it was fixed. Permanent record — engineers and managers will read it. Don't restate the ticket description.
- KB articles: written for a non-technical employee who may be panicking. Steps must be specific enough that someone with zero IT knowledge can follow them.

Always return valid JSON. Never include any text outside the JSON structure.`;

async function isAIEnabled() {
  const s = await db.get("SELECT value FROM settings WHERE key = 'ai_enabled'");
  return s?.value === 'true';
}

function extractJSON(text, fallback) {
  try {
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (fallback === '[]' && arrayMatch) return JSON.parse(arrayMatch[0]);
    if (fallback === '{}' && objectMatch) return JSON.parse(objectMatch[0]);
    if (arrayMatch) return JSON.parse(arrayMatch[0]);
    if (objectMatch) return JSON.parse(objectMatch[0]);
  } catch {}
  return JSON.parse(fallback);
}

// ── Feature 1 + 2 + 3: Analyze ticket — category, priority, sentiment ─────────
export async function analyzeTicket(title, description) {
  if (!await isAIEnabled()) return null;
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 256,
      system: ATLAS_IDENTITY,
      messages: [{
        role: 'user',
        content: `Analyze this IT support ticket. Return ONLY a valid JSON object with exactly these fields:

{
  "category": <one of: hardware, software, network, access, account>,
  "priority": <one of: low, medium, high, critical>,
  "sentiment": <one of: calm, urgent, frustrated>
}

CATEGORY rules:
- hardware: physical devices, monitors, printers, keyboards, computers
- software: applications, OS, programs, drivers, crashes
- network: connectivity, VPN, WiFi, internet, speed
- access: permissions, locked out, unauthorized errors
- account: passwords, MFA, SSO, user account management

PRIORITY rules:
- critical: system down, data loss, security breach, cannot work at all
- high: blocking productivity for user or team, deadline impact
- medium: affecting work but workarounds exist
- low: minor inconvenience, cosmetic, future-dated

SENTIMENT rules:
- frustrated: angry, exasperated, or repeated-problem language ("again", "always", "terrible")
- urgent: time-pressure language ("asap", "urgent", "deadline", "right now")
- calm: neutral, factual, descriptive

Ticket Title: ${title}
Ticket Description: ${description}

Return ONLY the JSON object. No explanation.`,
      }],
    });

    const text = response.content.find(b => b.type === 'text')?.text || '{}';
    const result = extractJSON(text, '{}');

    const cats = ['hardware', 'software', 'network', 'access', 'account'];
    const pris = ['low', 'medium', 'high', 'critical'];
    const sents = ['calm', 'urgent', 'frustrated'];

    return {
      category:  cats.includes(result.category)  ? result.category  : null,
      priority:  pris.includes(result.priority)   ? result.priority  : null,
      sentiment: sents.includes(result.sentiment) ? result.sentiment : null,
    };
  } catch (e) {
    console.error('[ATLAS] analyzeTicket error:', e.message);
    return null;
  }
}

// ── Feature 4: Find similar past resolved tickets ──────────────────────────────
export async function findSimilarTickets(ticketId, title, description) {
  if (!await isAIEnabled()) return [];
  try {
    const resolved = await db.all(`
      SELECT id, title, SUBSTR(description, 1, 150) as description, category
      FROM tickets
      WHERE status IN ('resolved', 'closed') AND id != ?
      ORDER BY resolved_at DESC
      LIMIT 50
    `, ticketId);

    if (resolved.length === 0) return [];

    const ticketList = resolved
      .map(t => `ID:${t.id} [${t.category}] "${t.title}" — ${t.description}`)
      .join('\n');

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 400,
      system: ATLAS_IDENTITY,
      messages: [{
        role: 'user',
        content: `Identify past resolved IT tickets that are similar to this new ticket.

New Ticket:
Title: ${title}
Description: ${description}

Past Resolved Tickets:
${ticketList}

Return ONLY a JSON array of up to 3 most similar tickets. If similarity is low, return fewer or none.

Format:
[{"id": <number>, "title": "<string>", "reason": "<one sentence why it's relevant>"}]

If no tickets are sufficiently similar, return [].
Return ONLY the JSON array.`,
      }],
    });

    const text = response.content.find(b => b.type === 'text')?.text || '[]';
    const result = extractJSON(text, '[]');
    return Array.isArray(result) ? result.slice(0, 3) : [];
  } catch (e) {
    console.error('[ATLAS] findSimilarTickets error:', e.message);
    return [];
  }
}

// ── Feature 6: Auto-assign to least-loaded staff member ───────────────────────
export async function autoAssign(submitterId) {
  try {
    const candidates = await db.all(`
      SELECT u.id, u.name, COUNT(t.id) as open_count
      FROM users u
      LEFT JOIN tickets t
        ON t.assignee_id = u.id AND t.status IN ('open', 'in_progress')
      WHERE u.role IN ('it_staff', 'admin')
        AND u.is_active = 1
        AND u.id != ?
      GROUP BY u.id
      ORDER BY open_count ASC
      LIMIT 1
    `, submitterId);
    return candidates[0]?.id ?? null;
  } catch (e) {
    console.error('[ATLAS] autoAssign error:', e.message);
    return null;
  }
}

// ── Feature 5: Generate resolution report when ticket is closed ────────────────
export async function generateResolutionReport(ticket, comments, notes) {
  if (!await isAIEnabled()) return null;
  try {
    const commentBlock = comments.length
      ? comments.map(c => `[${c.author_name}]: ${c.body}`).join('\n')
      : 'No comments.';
    const noteBlock = notes.length
      ? notes.map(n => `[${n.author_name}]: ${n.body}`).join('\n')
      : 'No internal notes.';
    const handleHours = ticket.resolved_at
      ? Math.round((new Date(ticket.resolved_at) - new Date(ticket.created_at)) / 3_600_000)
      : null;

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 900,
      system: ATLAS_IDENTITY,
      messages: [{
        role: 'user',
        content: `Generate a technical IT resolution report for this closed support ticket.

Ticket: "${ticket.title}"
Category: ${ticket.category} | Priority: ${ticket.priority}
Submitter: ${ticket.submitter_name}
Assignee: ${ticket.assignee_name || 'Unassigned'}
${handleHours !== null ? `Total Handle Time: ${handleHours} hours` : ''}

Problem Description:
${ticket.description}

Staff Communication:
${commentBlock}

Internal Notes:
${noteBlock}

Write a structured report using exactly these section headers:
**Problem:** What the issue was (1-2 sentences).
**Root Cause:** What caused it, if determinable.
**Solution Applied:** The steps or actions that resolved it.
**Handle Time:** ${handleHours !== null ? `${handleHours} hours` : 'Not recorded'}
**Prevention:** What to do if this happens again.

Be technical and direct. 150-220 words total. No filler.`,
      }],
    });

    return response.content.find(b => b.type === 'text')?.text?.trim() || null;
  } catch (e) {
    console.error('[ATLAS] generateResolutionReport error:', e.message);
    return null;
  }
}

// ── Feature 7: Generate knowledge base article from resolved ticket ─────────────
export async function generateKBArticle(ticket, resolutionReport) {
  if (!await isAIEnabled()) return null;
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 600,
      system: ATLAS_IDENTITY,
      messages: [{
        role: 'user',
        content: `Create a self-service knowledge base article from this resolved IT ticket. The article should help future employees diagnose and fix this issue themselves.

Original Ticket: "${ticket.title}"
Category: ${ticket.category}
Description: ${ticket.description}
Resolution: ${resolutionReport || 'See ticket history.'}

Return ONLY a JSON object:
{
  "title": "<concise article title, e.g. 'Fixing VPN Disconnections on Windows'>",
  "problem": "<2-3 sentences describing the problem and symptoms employees would notice>",
  "solution": "<2-3 sentences summarizing the fix clearly>",
  "steps": ["<step 1>", "<step 2>", "<step 3>"]
}

Steps: 3-6 actionable numbered steps. Be specific and technical.
Return ONLY the JSON object.`,
      }],
    });

    const text = response.content.find(b => b.type === 'text')?.text || '{}';
    const result = extractJSON(text, '{}');
    if (!result.title || !result.problem || !result.solution) return null;
    return result;
  } catch (e) {
    console.error('[ATLAS] generateKBArticle error:', e.message);
    return null;
  }
}
