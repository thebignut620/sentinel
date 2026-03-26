import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

// Get time entries for a ticket
router.get('/tickets/:ticketId/time', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const entries = await db.all(`
    SELECT te.*, u.name as user_name
    FROM time_entries te
    JOIN users u ON te.user_id = u.id
    WHERE te.ticket_id = ? AND te.company_id = ?
    ORDER BY te.created_at DESC
  `, req.params.ticketId, companyId);
  const total = entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  res.json({ entries, total_minutes: total });
});

// Start timer
router.post('/tickets/:ticketId/time/start', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  // Stop any existing running timers for this user
  await db.run(`
    UPDATE time_entries SET is_running = 0, ended_at = NOW(),
    duration_minutes = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60))
    WHERE user_id = ? AND company_id = ? AND is_running = 1
  `, req.user.id, companyId);

  const r = await db.run(`
    INSERT INTO time_entries (ticket_id, user_id, company_id, is_running, started_at)
    VALUES (?, ?, ?, 1, NOW())
  `, req.params.ticketId, req.user.id, companyId);
  res.status(201).json({ id: r.lastInsertRowid });
});

// Stop timer
router.post('/tickets/:ticketId/time/stop', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const { description } = req.body;
  await db.run(`
    UPDATE time_entries SET is_running = 0, ended_at = NOW(),
    duration_minutes = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60)),
    description = COALESCE(?, description)
    WHERE ticket_id = ? AND user_id = ? AND company_id = ? AND is_running = 1
  `, description || null, req.params.ticketId, req.user.id, companyId);
  res.json({ ok: true });
});

// Manual log
router.post('/tickets/:ticketId/time', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const { duration_minutes, description } = req.body;
  if (!duration_minutes || duration_minutes < 1) return res.status(400).json({ error: 'duration_minutes required' });
  const companyId = req.user.company_id || 1;
  await db.run(`
    INSERT INTO time_entries (ticket_id, user_id, company_id, duration_minutes, description)
    VALUES (?, ?, ?, ?, ?)
  `, req.params.ticketId, req.user.id, companyId, duration_minutes, description || null);
  res.status(201).json({ ok: true });
});

// Delete entry
router.delete('/tickets/:ticketId/time/:entryId', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  await db.run('DELETE FROM time_entries WHERE id = ? AND ticket_id = ? AND company_id = ?', req.params.entryId, req.params.ticketId, companyId);
  res.json({ ok: true });
});

// Analytics: time per category, per staff, per priority
router.get('/analytics/time', authenticate, requireRole('admin', 'it_staff'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const { hourlyRate = 50 } = req.query;

  const [byCategory, byStaff, byPriority] = await Promise.all([
    db.all(`
      SELECT t.category, SUM(te.duration_minutes) as total_minutes, COUNT(DISTINCT te.ticket_id) as ticket_count
      FROM time_entries te JOIN tickets t ON te.ticket_id = t.id
      WHERE te.company_id = ?
      GROUP BY t.category ORDER BY total_minutes DESC
    `, companyId),
    db.all(`
      SELECT u.name, SUM(te.duration_minutes) as total_minutes, COUNT(DISTINCT te.ticket_id) as ticket_count
      FROM time_entries te JOIN users u ON te.user_id = u.id
      WHERE te.company_id = ?
      GROUP BY u.id, u.name ORDER BY total_minutes DESC
    `, companyId),
    db.all(`
      SELECT t.priority, SUM(te.duration_minutes) as total_minutes, COUNT(DISTINCT te.ticket_id) as ticket_count
      FROM time_entries te JOIN tickets t ON te.ticket_id = t.id
      WHERE te.company_id = ?
      GROUP BY t.priority ORDER BY total_minutes DESC
    `, companyId),
  ]);

  const rate = parseFloat(hourlyRate);
  const addCost = rows => rows.map(r => ({ ...r, cost: Math.round((r.total_minutes / 60) * rate) }));

  res.json({
    byCategory: addCost(byCategory),
    byStaff: addCost(byStaff),
    byPriority: addCost(byPriority),
    hourlyRate: rate,
  });
});

export default router;
