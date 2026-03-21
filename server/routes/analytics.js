/**
 * Phase 5 — Analytics Routes
 * Real-time stats, staff performance, resolution time, peak hours,
 * volume, common issues, cost savings, satisfaction, custom reports.
 */

import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// ─── REAL-TIME STATS (no auth — polled every 30s from dashboard) ─────────────
router.get('/realtime', authenticate, async (req, res) => {
  try {
    const [open, inProgress, resolvedToday, avgRes, total, atlasHandled, ticketsThisHour] =
      await Promise.all([
        db.get(`SELECT COUNT(*) as count FROM tickets WHERE status = 'open'`),
        db.get(`SELECT COUNT(*) as count FROM tickets WHERE status = 'in_progress'`),
        db.get(`SELECT COUNT(*) as count FROM tickets WHERE resolved_at::date = CURRENT_DATE`),
        db.get(
          `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours
           FROM tickets WHERE resolved_at IS NOT NULL`
        ),
        db.get(`SELECT COUNT(*) as count FROM tickets`),
        db.get(
          `SELECT COUNT(*) as count FROM tickets WHERE ai_auto_assigned = 1 OR ai_attempted = 1`
        ),
        db.get(
          `SELECT COUNT(*) as count FROM tickets
           WHERE created_at >= NOW() - INTERVAL '1 hour'`
        ),
      ]);

    res.json({
      open: open.count,
      inProgress: inProgress.count,
      resolvedToday: resolvedToday.count,
      avgResolutionHours: avgRes.avg_hours
        ? Math.round(avgRes.avg_hours * 10) / 10
        : null,
      total: total.count,
      atlasHandled: atlasHandled.count,
      ticketsThisHour: ticketsThisHour.count,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── STAFF PERFORMANCE LEADERBOARD ──────────────────────────────────────────
router.get('/staff-performance', authenticate, async (req, res) => {
  try {
    const staff = await db.all(`
      SELECT
        u.id, u.name,
        COUNT(t.id) FILTER (WHERE t.status IN ('resolved','closed')) as resolved_count,
        AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600)
          FILTER (WHERE t.resolved_at IS NOT NULL) as avg_resolution_hours,
        COUNT(t.id) FILTER (WHERE t.ai_attempted = 0 AND t.status IN ('resolved','closed'))
          as first_contact_resolved,
        COUNT(t.id) FILTER (WHERE t.status IN ('resolved','closed')) as total_closed,
        COUNT(t.id) as total_assigned
      FROM users u
      LEFT JOIN tickets t ON t.assignee_id = u.id
      WHERE u.role IN ('it_staff', 'admin') AND u.is_active = 1
      GROUP BY u.id, u.name
      ORDER BY resolved_count DESC
    `);

    const satisfaction = await db.all(`
      SELECT t.assignee_id,
        COUNT(*) as total_rated,
        COUNT(*) FILTER (WHERE sr.rating = 'up') as thumbs_up
      FROM satisfaction_ratings sr
      JOIN tickets t ON sr.ticket_id = t.id
      WHERE sr.rating IS NOT NULL AND t.assignee_id IS NOT NULL
      GROUP BY t.assignee_id
    `);

    const satMap = Object.fromEntries(satisfaction.map(s => [s.assignee_id, s]));

    const result = staff.map((s, idx) => {
      const sat = satMap[s.id];
      const fcr_rate =
        s.total_closed > 0
          ? Math.round((s.first_contact_resolved / s.total_closed) * 100)
          : 0;
      const sat_score =
        sat?.total_rated > 0
          ? Math.round((sat.thumbs_up / sat.total_rated) * 100)
          : null;
      return {
        rank: idx + 1,
        id: s.id,
        name: s.name,
        resolved_count: s.resolved_count || 0,
        avg_resolution_hours: s.avg_resolution_hours
          ? Math.round(s.avg_resolution_hours * 10) / 10
          : null,
        fcr_rate,
        sat_score,
        sat_total: sat?.total_rated || 0,
        total_assigned: s.total_assigned || 0,
      };
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── RESOLUTION TIME BREAKDOWN ───────────────────────────────────────────────
router.get('/resolution-time', authenticate, async (req, res) => {
  try {
    const [byCategory, byPriority, byStaff] = await Promise.all([
      db.all(`
        SELECT category,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours,
          MIN(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as min_hours,
          MAX(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as max_hours
        FROM tickets WHERE resolved_at IS NOT NULL
        GROUP BY category ORDER BY avg_hours DESC
      `),
      db.all(`
        SELECT priority,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours
        FROM tickets WHERE resolved_at IS NOT NULL
        GROUP BY priority
        ORDER BY CASE priority
          WHEN 'critical' THEN 1 WHEN 'high' THEN 2
          WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END
      `),
      db.all(`
        SELECT u.name as staff_name,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600) as avg_hours
        FROM tickets t
        JOIN users u ON t.assignee_id = u.id
        WHERE t.resolved_at IS NOT NULL AND u.role IN ('it_staff', 'admin')
        GROUP BY u.id, u.name
        ORDER BY avg_hours ASC
        LIMIT 10
      `),
    ]);

    const fmt = rows =>
      rows.map(r => ({
        ...r,
        avg_hours: r.avg_hours ? Math.round(r.avg_hours * 10) / 10 : null,
        min_hours: r.min_hours ? Math.round(r.min_hours * 10) / 10 : null,
        max_hours: r.max_hours ? Math.round(r.max_hours * 10) / 10 : null,
      }));

    res.json({
      byCategory: fmt(byCategory),
      byPriority: fmt(byPriority),
      byStaff: fmt(byStaff),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PEAK HOURS HEATMAP ──────────────────────────────────────────────────────
router.get('/peak-hours', authenticate, async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT
        EXTRACT(DOW FROM created_at)::integer as dow,
        EXTRACT(HOUR FROM created_at)::integer as hour,
        COUNT(*) as count
      FROM tickets
      GROUP BY dow, hour
    `);

    // Build 7x24 matrix (dow 0=Sun..6=Sat, hour 0..23)
    const matrix = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let maxCount = 0;
    for (const row of rows) {
      matrix[row.dow][row.hour] = Number(row.count);
      if (row.count > maxCount) maxCount = Number(row.count);
    }

    res.json({
      matrix,
      maxCount,
      days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── TICKET VOLUME ───────────────────────────────────────────────────────────
router.get('/volume', authenticate, async (req, res) => {
  try {
    const { period = 'day' } = req.query;
    let query;

    if (period === 'month') {
      query = `
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as label,
               DATE_TRUNC('month', created_at) as sort_key,
               COUNT(*) as count
        FROM tickets
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY sort_key ASC
      `;
    } else if (period === 'week') {
      query = `
        SELECT 'Wk ' || TO_CHAR(DATE_TRUNC('week', created_at), 'MM/DD') as label,
               DATE_TRUNC('week', created_at) as sort_key,
               COUNT(*) as count
        FROM tickets
        WHERE created_at >= NOW() - INTERVAL '12 weeks'
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY sort_key ASC
      `;
    } else {
      query = `
        SELECT TO_CHAR(DATE(created_at), 'Mon DD') as label,
               DATE(created_at) as sort_key,
               COUNT(*) as count
        FROM tickets
        WHERE created_at >= CURRENT_DATE - INTERVAL '29 days'
        GROUP BY DATE(created_at)
        ORDER BY sort_key ASC
      `;
    }

    const rows = await db.all(query);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── COMMON ISSUES (top categories + keywords) ───────────────────────────────
router.get('/common-issues', authenticate, async (req, res) => {
  try {
    const byCategory = await db.all(`
      SELECT
        category,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE ai_attempted = 1 AND status IN ('resolved','closed')) as atlas_resolved,
        COUNT(*) FILTER (WHERE status IN ('resolved','closed')) as resolved
      FROM tickets
      GROUP BY category
      ORDER BY total DESC
    `);

    const titles = await db.all(
      `SELECT title FROM tickets ORDER BY created_at DESC LIMIT 500`
    );

    const stopWords = new Set([
      'the','a','an','is','in','on','at','to','for','of','and','or','with',
      'my','can','not','i','it','how','do','been','was','has','have','are',
      'this','that','we','you','from','be','when','need','help','issue',
      'problem','error','unable','cannot','access','please','im','ive','get',
      'getting','keep','keeps','keeps','after','just','still','already',
    ]);

    const wordFreq = {};
    for (const { title } of titles) {
      const words = title
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, '')
        .split(/\s+/);
      for (const w of words) {
        if (w.length > 3 && !stopWords.has(w)) {
          wordFreq[w] = (wordFreq[w] || 0) + 1;
        }
      }
    }

    const topKeywords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word, count]) => ({ word, count }));

    const result = byCategory.map(c => ({
      ...c,
      atlas_rate:
        c.resolved > 0 ? Math.round((c.atlas_resolved / c.resolved) * 100) : 0,
    }));

    res.json({ byCategory: result, topKeywords });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── COST SAVINGS CALCULATOR ─────────────────────────────────────────────────
router.get('/cost-savings', authenticate, async (req, res) => {
  try {
    const {
      costPerTicket = 25,
      atlasHandledCost = 3,
      minutesPerTicket = 30,
    } = req.query;

    const [totals, monthly] = await Promise.all([
      db.get(`
        SELECT
          COUNT(*) as total_tickets,
          COUNT(*) FILTER (WHERE ai_auto_assigned = 1 OR ai_attempted = 1) as atlas_handled,
          COUNT(*) FILTER (WHERE ai_auto_assigned = 1) as fully_automated
        FROM tickets
      `),
      db.all(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month,
          DATE_TRUNC('month', created_at) as sort_key,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE ai_auto_assigned = 1 OR ai_attempted = 1) as atlas_handled
        FROM tickets
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY sort_key ASC
      `),
    ]);

    const savings =
      totals.atlas_handled *
      (parseFloat(costPerTicket) - parseFloat(atlasHandledCost));
    const hoursSaved =
      (totals.atlas_handled * parseFloat(minutesPerTicket)) / 60;

    res.json({
      totalTickets: totals.total_tickets,
      atlasHandled: totals.atlas_handled,
      fullyAutomated: totals.fully_automated,
      manualTickets: totals.total_tickets - totals.atlas_handled,
      costPerTicket: parseFloat(costPerTicket),
      atlasHandledCost: parseFloat(atlasHandledCost),
      totalSavings: Math.round(savings),
      hoursSaved: Math.round(hoursSaved * 10) / 10,
      savingsRate:
        totals.total_tickets > 0
          ? Math.round((totals.atlas_handled / totals.total_tickets) * 100)
          : 0,
      monthly,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SATISFACTION OVERVIEW ────────────────────────────────────────────────────
router.get('/satisfaction', authenticate, async (req, res) => {
  try {
    const [overview, byStaff, recent] = await Promise.all([
      db.get(`
        SELECT
          COUNT(*) as total_sent,
          COUNT(*) FILTER (WHERE rating IS NOT NULL) as total_rated,
          COUNT(*) FILTER (WHERE rating = 'up') as thumbs_up,
          COUNT(*) FILTER (WHERE rating = 'down') as thumbs_down
        FROM satisfaction_ratings
      `),
      db.all(`
        SELECT u.name as staff_name,
          COUNT(sr.id) as total_rated,
          COUNT(sr.id) FILTER (WHERE sr.rating = 'up') as thumbs_up
        FROM satisfaction_ratings sr
        JOIN tickets t ON sr.ticket_id = t.id
        JOIN users u ON t.assignee_id = u.id
        WHERE sr.rating IS NOT NULL
        GROUP BY u.id, u.name
        ORDER BY thumbs_up DESC
        LIMIT 10
      `),
      db.all(`
        SELECT sr.rating, sr.comment, sr.submitted_at,
               t.title as ticket_title, u.name as staff_name
        FROM satisfaction_ratings sr
        JOIN tickets t ON sr.ticket_id = t.id
        LEFT JOIN users u ON t.assignee_id = u.id
        WHERE sr.rating IS NOT NULL
        ORDER BY sr.submitted_at DESC
        LIMIT 20
      `),
    ]);

    res.json({
      ...overview,
      satisfaction_rate:
        overview.total_rated > 0
          ? Math.round((overview.thumbs_up / overview.total_rated) * 100)
          : null,
      byStaff: byStaff.map(s => ({
        ...s,
        rate:
          s.total_rated > 0
            ? Math.round((s.thumbs_up / s.total_rated) * 100)
            : 0,
      })),
      recent,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET SURVEY INFO (public — by token) ─────────────────────────────────────
router.get('/satisfaction/:token', async (req, res) => {
  try {
    const row = await db.get(
      `SELECT sr.token, sr.rating, t.title as ticket_title, t.id as ticket_id
       FROM satisfaction_ratings sr
       JOIN tickets t ON sr.ticket_id = t.id
       WHERE sr.token = ?`,
      req.params.token
    );
    if (!row) return res.status(404).json({ error: 'Invalid survey link' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── SUBMIT SATISFACTION (public — by token) ─────────────────────────────────
router.post('/satisfaction/:token', async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!['up', 'down'].includes(rating)) {
      return res.status(400).json({ error: 'Rating must be "up" or "down"' });
    }

    const row = await db.get(
      'SELECT * FROM satisfaction_ratings WHERE token = ?',
      req.params.token
    );
    if (!row) return res.status(404).json({ error: 'Invalid or expired survey link' });
    if (row.rating) return res.status(409).json({ error: 'Survey already completed' });

    await db.run(
      'UPDATE satisfaction_ratings SET rating = ?, comment = ?, submitted_at = NOW() WHERE token = ?',
      rating,
      comment || null,
      req.params.token
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── CUSTOM REPORT EXPORT (CSV or PDF) ───────────────────────────────────────
router.post('/reports/export', authenticate, async (req, res) => {
  try {
    const { format = 'csv', dateFrom, dateTo } = req.body;

    const whereClauses = ['1=1'];
    const params = [];
    if (dateFrom) {
      whereClauses.push('t.created_at >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClauses.push('t.created_at <= ?');
      params.push(dateTo + 'T23:59:59Z');
    }
    const where = whereClauses.join(' AND ');

    const tickets = await db.all(
      `SELECT t.id, t.title, t.status, t.priority, t.category,
              t.created_at, t.resolved_at,
              u.name as submitter, a.name as assignee,
              EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600 as resolution_hours
       FROM tickets t
       JOIN users u ON t.submitter_id = u.id
       LEFT JOIN users a ON t.assignee_id = a.id
       WHERE ${where}
       ORDER BY t.created_at DESC`,
      ...params
    );

    if (format === 'csv') {
      const headers = [
        'ID','Title','Status','Priority','Category',
        'Submitter','Assignee','Created','Resolved','Resolution Hours',
      ];
      const rows = tickets.map(t => [
        t.id,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        t.status,
        t.priority,
        t.category,
        `"${t.submitter}"`,
        `"${t.assignee || ''}"`,
        t.created_at ? new Date(t.created_at).toISOString() : '',
        t.resolved_at ? new Date(t.resolved_at).toISOString() : '',
        t.resolution_hours ? Math.round(t.resolution_hours * 10) / 10 : '',
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const filename = `sentinel-report-${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    }

    if (format === 'pdf') {
      const { generateCustomReportPdf } = await import('../services/analyticsReport.js');
      const pdfBuf = await generateCustomReportPdf({ tickets, dateFrom, dateTo });
      const filename = `sentinel-report-${new Date().toISOString().split('T')[0]}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(pdfBuf);
    }

    res.status(400).json({ error: 'Invalid format. Use csv or pdf.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── LIST MONTHLY REPORTS ────────────────────────────────────────────────────
router.get('/reports/monthly', authenticate, async (req, res) => {
  try {
    const reports = await db.all(
      'SELECT id, report_month, stats, generated_at FROM monthly_reports ORDER BY generated_at DESC LIMIT 24'
    );
    res.json(
      reports.map(r => ({ ...r, stats: r.stats ? JSON.parse(r.stats) : null }))
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET SINGLE MONTHLY REPORT ───────────────────────────────────────────────
router.get('/reports/monthly/:id', authenticate, async (req, res) => {
  try {
    const report = await db.get(
      'SELECT * FROM monthly_reports WHERE id = ?',
      req.params.id
    );
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ ...report, stats: report.stats ? JSON.parse(report.stats) : null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DOWNLOAD MONTHLY REPORT PDF ─────────────────────────────────────────────
router.get('/reports/monthly/:id/pdf', authenticate, async (req, res) => {
  try {
    const report = await db.get(
      'SELECT * FROM monthly_reports WHERE id = ?',
      req.params.id
    );
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const stats = report.stats ? JSON.parse(report.stats) : {};
    const { generateMonthlyPdf } = await import('../services/analyticsReport.js');
    const pdfBuf = await generateMonthlyPdf(report.report_text, stats);
    const filename = `sentinel-monthly-${report.report_month}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
