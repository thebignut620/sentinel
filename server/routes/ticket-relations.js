import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

// Get children of a ticket
router.get('/tickets/:id/children', authenticate, async (req, res) => {
  const companyId = req.user.company_id || 1;
  const children = await db.all(`
    SELECT t.id, t.title, t.status, t.priority, t.category, t.created_at, u.name as submitter_name
    FROM tickets t
    JOIN ticket_relations tr ON tr.child_id = t.id
    JOIN users u ON t.submitter_id = u.id
    WHERE tr.parent_id = ? AND t.company_id = ?
    ORDER BY t.created_at DESC
  `, req.params.id, companyId);
  res.json(children);
});

// Get parent of a ticket
router.get('/tickets/:id/parent', authenticate, async (req, res) => {
  const companyId = req.user.company_id || 1;
  const relation = await db.get('SELECT parent_id FROM ticket_relations WHERE child_id = ?', req.params.id);
  if (!relation) return res.json(null);
  const parent = await db.get(`
    SELECT t.id, t.title, t.status, t.priority, t.category, u.name as submitter_name
    FROM tickets t JOIN users u ON t.submitter_id = u.id
    WHERE t.id = ? AND t.company_id = ?
  `, relation.parent_id, companyId);
  res.json(parent || null);
});

// Link child to parent
router.post('/tickets/:id/link', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const { child_id } = req.body;
  if (!child_id) return res.status(400).json({ error: 'child_id required' });
  const companyId = req.user.company_id || 1;

  // Verify both tickets belong to this company
  const [parent, child] = await Promise.all([
    db.get('SELECT id FROM tickets WHERE id = ? AND company_id = ?', req.params.id, companyId),
    db.get('SELECT id FROM tickets WHERE id = ? AND company_id = ?', child_id, companyId),
  ]);
  if (!parent || !child) return res.status(404).json({ error: 'Ticket not found' });
  if (String(req.params.id) === String(child_id)) return res.status(400).json({ error: 'Cannot link ticket to itself' });

  try {
    await db.run(
      'INSERT INTO ticket_relations (parent_id, child_id, company_id, created_by) VALUES (?, ?, ?, ?)',
      req.params.id, child_id, companyId, req.user.id
    );
    res.json({ ok: true });
  } catch {
    res.status(409).json({ error: 'Already linked' });
  }
});

// Unlink
router.delete('/tickets/:id/link/:childId', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  await db.run('DELETE FROM ticket_relations WHERE parent_id = ? AND child_id = ?', req.params.id, req.params.childId);
  res.json({ ok: true });
});

// Resolve parent + all children
router.post('/tickets/:id/resolve-all', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const children = await db.all('SELECT child_id FROM ticket_relations WHERE parent_id = ?', req.params.id);
  const childIds = children.map(c => c.child_id);

  const allIds = [req.params.id, ...childIds];
  for (const id of allIds) {
    await db.run(`UPDATE tickets SET status = 'resolved', resolved_at = NOW(), updated_at = NOW() WHERE id = ? AND company_id = ?`, id, companyId);
  }

  res.json({ ok: true, resolved_count: allIds.length });
});

export default router;
