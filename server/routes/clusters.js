import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import Anthropic from '@anthropic-ai/sdk';

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

// GET /api/clusters — list clusters with member count
router.get('/', authenticate, async (req, res) => {
  const companyId = req.user.company_id || 1;
  try {
    const clusters = await db.all(
      `SELECT c.*,
              COUNT(m.ticket_id) as ticket_count
       FROM ticket_clusters c
       LEFT JOIN ticket_cluster_members m ON m.cluster_id = c.id
       WHERE c.company_id = ?
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      companyId
    );
    res.json(clusters);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch clusters' });
  }
});

// GET /api/clusters/:id — get cluster with all member tickets
router.get('/:id', authenticate, async (req, res) => {
  const companyId = req.user.company_id || 1;
  try {
    const cluster = await db.get(`SELECT * FROM ticket_clusters WHERE id = ? AND company_id = ?`, req.params.id, companyId);
    if (!cluster) return res.status(404).json({ error: 'Cluster not found' });

    const tickets = await db.all(
      `SELECT t.id, t.title, t.status, t.priority, t.created_at,
              u.name as submitter_name
       FROM ticket_cluster_members m
       JOIN tickets t ON t.id = m.ticket_id
       LEFT JOIN users u ON u.id = t.submitter_id
       WHERE m.cluster_id = ?
       ORDER BY t.created_at DESC`,
      req.params.id
    );
    res.json({ ...cluster, tickets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch cluster' });
  }
});

// POST /api/clusters/:id/bulk-resolve — bulk resolve all tickets in a cluster (it_staff+)
router.post('/:id/bulk-resolve', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const { resolution } = req.body;
  const { id } = req.params;
  const companyId = req.user.company_id || 1;

  try {
    const cluster = await db.get(`SELECT * FROM ticket_clusters WHERE id = ? AND company_id = ?`, id, companyId);
    if (!cluster) return res.status(404).json({ error: 'Cluster not found' });

    const members = await db.all(
      `SELECT ticket_id FROM ticket_cluster_members WHERE cluster_id = ?`, id
    );

    for (const { ticket_id } of members) {
      await db.run(
        `UPDATE tickets
         SET status = 'resolved', resolved_at = NOW(), updated_at = NOW(),
             resolution_report = ?
         WHERE id = ? AND status NOT IN ('resolved', 'closed') AND company_id = ?`,
        resolution || `Resolved as part of cluster: ${cluster.title}`,
        ticket_id, companyId
      );
      // Log history
      await db.run(
        `INSERT INTO ticket_history (ticket_id, user_id, action, from_val, to_val)
         VALUES (?, ?, 'status_changed', 'open', 'resolved')`,
        ticket_id, req.user.id
      );
    }

    // Mark cluster resolved
    await db.run(
      `UPDATE ticket_clusters SET status = 'resolved', resolved_at = NOW() WHERE id = ?`, id
    );

    res.json({ success: true, resolved: members.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to bulk resolve cluster' });
  }
});

// POST /api/clusters/analyze — ATLAS groups open tickets into clusters
router.post('/analyze', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const MODEL = 'claude-sonnet-4-20250514';
  const companyId = req.user.company_id || 1;
  const keyPreview = process.env.ANTHROPIC_API_KEY
    ? process.env.ANTHROPIC_API_KEY.slice(0, 10) + '...'
    : 'NOT SET';
  console.log('[Clusters] analyze start — model:', MODEL, '| key prefix:', keyPreview, '| user:', req.user?.id, req.user?.role);

  try {
    console.log('[Clusters] step 1: querying open tickets');
    const openTickets = await db.all(
      `SELECT id, title, description, category
       FROM tickets
       WHERE status IN ('open', 'in_progress') AND company_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      companyId
    );
    console.log('[Clusters] step 1 done: found', openTickets.length, 'open tickets');

    if (openTickets.length < 2) {
      console.log('[Clusters] not enough tickets, returning early');
      return res.json({ clusters: [], message: 'Not enough open tickets to cluster.' });
    }

    const ticketList = openTickets.map(t =>
      `ID:${t.id} [${t.category || 'general'}] "${t.title}": ${(t.description || '').slice(0, 120)}`
    ).join('\n');

    console.log('[Clusters] step 2: calling Anthropic API with model:', MODEL);
    let message;
    try {
      message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are an IT helpdesk analyst. Analyze the following open tickets and group related ones into clusters.

Tickets:
${ticketList}

Return a JSON array of cluster objects. Only include groups of 2+ tickets.
Format: [{"title": "short cluster name", "description": "what they have in common", "category": "category", "ticket_ids": [1,2,3]}]
Return ONLY the JSON array, no other text.`
        }]
      });
      console.log('[Clusters] step 2 done: Anthropic responded, stop_reason:', message.stop_reason, '| content blocks:', message.content?.length);
    } catch (apiErr) {
      console.error('[Clusters] Anthropic API error — status:', apiErr.status, '| message:', apiErr.message);
      console.error('[Clusters] Anthropic error body:', JSON.stringify(apiErr.error || apiErr.body || {}));
      return res.status(500).json({ error: `Anthropic API error: ${apiErr.message}` });
    }

    const rawText = message.content.find(b => b.type === 'text')?.text || '[]';
    console.log('[Clusters] step 3: raw response preview:', rawText.slice(0, 300));

    const proposed = extractJSON(rawText, '[]');
    console.log('[Clusters] step 3 done: parsed', Array.isArray(proposed) ? proposed.length : 'non-array', 'clusters');

    if (!Array.isArray(proposed)) {
      return res.json({ clusters: [], message: 'ATLAS returned unexpected format.' });
    }
    if (proposed.length === 0) {
      return res.json({ clusters: [], message: 'No related clusters found in the open tickets.' });
    }

    console.log('[Clusters] step 4: persisting clusters to db');
    const created = [];
    for (const c of proposed) {
      const result = await db.run(
        `INSERT INTO ticket_clusters (title, description, category, company_id) VALUES (?, ?, ?, ?)`,
        c.title, c.description, c.category, companyId
      );
      const clusterId = result.lastInsertRowid;
      console.log('[Clusters] inserted cluster id:', clusterId, 'title:', c.title, 'tickets:', c.ticket_ids);

      for (const ticketId of c.ticket_ids) {
        await db.run(
          `INSERT INTO ticket_cluster_members (cluster_id, ticket_id) VALUES (?, ?)
           ON CONFLICT DO NOTHING`,
          clusterId, ticketId
        );
      }
      created.push({ ...c, id: clusterId });
    }

    console.log('[Clusters] step 4 done: created', created.length, 'clusters, sending response');
    res.json({ clusters: created });
  } catch (err) {
    console.error('[Clusters] unhandled error:', err.message);
    console.error('[Clusters] stack:', err.stack);
    res.status(500).json({ error: err.message || 'Failed to analyze clusters' });
  }
});

export default router;
