import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// GET /api/status — public endpoint, no auth required
router.get('/', async (req, res) => {
  try {
    // Check DB connectivity
    let dbOk = true;
    try {
      await db.get('SELECT 1 AS ok');
    } catch {
      dbOk = false;
    }

    // Count recent incidents in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    let incidents = [];
    try {
      incidents = await db.all(
        `SELECT id, title, description, severity, status, created_at
         FROM incidents
         WHERE created_at >= ?
         ORDER BY created_at DESC
         LIMIT 10`,
        thirtyDaysAgo
      );
    } catch {
      // incidents table may not exist in all deploys
    }

    // Build uptime data: 90 days of synthetic 100% uptime
    // (In production this would pull from real monitoring data)
    const days = Array.from({ length: 90 }, (_, i) => {
      const date = new Date(Date.now() - (89 - i) * 24 * 60 * 60 * 1000);
      return {
        date: date.toISOString().slice(0, 10),
        uptime: 100,
      };
    });

    // Mark days with incidents as lower uptime
    for (const inc of incidents) {
      const incDay = inc.created_at?.slice(0, 10);
      const day = days.find(d => d.date === incDay);
      if (day) {
        const reduction = inc.severity === 'critical' ? 20 : inc.severity === 'high' ? 10 : 2;
        day.uptime = Math.max(0, day.uptime - reduction);
      }
    }

    const avgUptime = days.reduce((acc, d) => acc + d.uptime, 0) / days.length;

    const components = [
      { name: 'API',                status: dbOk ? 'operational' : 'major_outage' },
      { name: 'Web Application',    status: 'operational' },
      { name: 'Database',           status: dbOk ? 'operational' : 'major_outage' },
      { name: 'AI / ATLAS Engine',  status: 'operational' },
      { name: 'Email Delivery',     status: 'operational' },
      { name: 'Authentication',     status: 'operational' },
    ];

    const hasOutage = components.some(c => c.status === 'major_outage');
    const hasPartial = components.some(c => c.status === 'partial_outage' || c.status === 'degraded');
    const overall = hasOutage ? 'major_outage' : hasPartial ? 'degraded' : 'operational';

    res.json({
      overall,
      components,
      incidents,
      uptime: {
        percent: avgUptime,
        days,
      },
    });
  } catch (err) {
    console.error('[status] error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
