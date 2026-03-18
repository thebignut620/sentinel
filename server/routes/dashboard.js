import express from 'express';
import db from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const isEmployee = req.user.role === 'employee';
  const whereUser = isEmployee ? 'WHERE t.submitter_id = ?' : 'WHERE 1=1';
  const params = isEmployee ? [req.user.id] : [];

  const [
    statusCounts,
    criticalCount,
    resolvedToday,
    last7Days,
    categoryDist,
    recentActivity,
    avgResolutionRow,
  ] = await Promise.all([
    db.all(
      `SELECT status, COUNT(*) as count FROM tickets t ${whereUser} GROUP BY status`,
      ...params
    ),
    db.get(
      `SELECT COUNT(*) as count FROM tickets t ${whereUser} ${isEmployee ? 'AND' : 'AND'} t.priority = 'critical' AND t.status NOT IN ('resolved','closed')`,
      ...params
    ),
    db.get(
      `SELECT COUNT(*) as count FROM tickets t ${whereUser} ${isEmployee ? 'AND' : 'AND'} date(t.resolved_at) = date('now')`,
      ...params
    ),
    db.all(
      `SELECT date(t.created_at) as day, COUNT(*) as count
       FROM tickets t ${whereUser} ${isEmployee ? 'AND' : 'AND'} t.created_at >= date('now', '-6 days')
       GROUP BY day ORDER BY day ASC`,
      ...params
    ),
    db.all(
      `SELECT t.category, COUNT(*) as count FROM tickets t ${whereUser} GROUP BY t.category ORDER BY count DESC`,
      ...params
    ),
    db.all(
      `SELECT t.id, t.title, t.status, t.priority, t.updated_at, u.name as updated_by
       FROM tickets t JOIN users u ON t.submitter_id = u.id
       ${whereUser} ORDER BY t.updated_at DESC LIMIT 8`,
      ...params
    ),
    db.get(
      `SELECT AVG((julianday(t.resolved_at) - julianday(t.created_at)) * 24) as avg_hours
       FROM tickets t ${whereUser} ${isEmployee ? 'AND' : 'AND'} t.resolved_at IS NOT NULL`,
      ...params
    ),
  ]);

  const stats = Object.fromEntries(statusCounts.map(r => [r.status, r.count]));

  res.json({
    open: stats.open || 0,
    in_progress: stats.in_progress || 0,
    resolved: stats.resolved || 0,
    closed: stats.closed || 0,
    total: Object.values(stats).reduce((a, b) => a + b, 0),
    critical: criticalCount?.count || 0,
    resolvedToday: resolvedToday?.count || 0,
    avgResolutionHours: avgResolutionRow?.avg_hours ? Math.round(avgResolutionRow.avg_hours * 10) / 10 : null,
    last7Days,
    categoryDist,
    recentActivity,
  });
});

export default router;
