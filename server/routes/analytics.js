/**
 * Phase 5 — Analytics Routes
 * Real-time stats, staff performance, resolution time, peak hours,
 * volume, common issues, cost savings, satisfaction, custom reports.
 */

import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// ─── REAL-TIME STATS ─────────────────────────────────────────────────────────
router.get('/realtime', authenticate, async (req, res) => {
  const companyId = req.user.company_id || 1;
  const { session_start } = req.query;
  const sc = session_start ? 'AND created_at >= ?' : '';
  const sp = session_start ? [session_start] : [];
  try {
    const [open, inProgress, resolvedToday, avgRes, total, atlasHandled, ticketsThisHour] =
      await Promise.all([
        db.get(`SELECT COUNT(*) as count FROM tickets WHERE status = 'open' AND company_id = ? ${sc}`, companyId, ...sp),
        db.get(`SELECT COUNT(*) as count FROM tickets WHERE status = 'in_progress' AND company_id = ? ${sc}`, companyId, ...sp),
        db.get(`SELECT COUNT(*) as count FROM tickets WHERE resolved_at::date = CURRENT_DATE AND company_id = ? ${sc}`, companyId, ...sp),
        db.get(
          `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours
           FROM tickets WHERE resolved_at IS NOT NULL AND company_id = ? ${sc}`,
          companyId, ...sp
        ),
        db.get(`SELECT COUNT(*) as count FROM tickets WHERE company_id = ? ${sc}`, companyId, ...sp),
        db.get(
          `SELECT COUNT(*) as count FROM tickets WHERE (ai_auto_assigned = 1 OR ai_attempted = 1) AND company_id = ? ${sc}`,
          companyId, ...sp
        ),
        // ticketsThisHour is always last 60 min — not session-scoped
        db.get(
          `SELECT COUNT(*) as count FROM tickets
           WHERE created_at >= NOW() - INTERVAL '1 hour' AND company_id = ?`,
          companyId
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
  const companyId = req.user.company_id || 1;
  const { session_start } = req.query;
  const sc = session_start ? 'AND t.created_at >= ?' : '';
  const sp = session_start ? [session_start] : [];
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
      LEFT JOIN tickets t ON t.assignee_id = u.id AND t.company_id = ? ${sc}
      WHERE u.role IN ('it_staff', 'admin') AND u.is_active = 1 AND u.company_id = ?
      GROUP BY u.id, u.name
      ORDER BY resolved_count DESC
    `, companyId, ...sp, companyId);

    const satisfaction = await db.all(`
      SELECT t.assignee_id,
        COUNT(*) as total_rated,
        COUNT(*) FILTER (WHERE sr.rating = 'up') as thumbs_up
      FROM satisfaction_ratings sr
      JOIN tickets t ON sr.ticket_id = t.id
      WHERE sr.rating IS NOT NULL AND t.assignee_id IS NOT NULL AND t.company_id = ? ${sc}
      GROUP BY t.assignee_id
    `, companyId, ...sp);

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
  const companyId = req.user.company_id || 1;
  const { session_start } = req.query;
  const sc = session_start ? 'AND created_at >= ?' : '';
  const tsc = session_start ? 'AND t.created_at >= ?' : '';
  const sp = session_start ? [session_start] : [];
  try {
    const [byCategory, byPriority, byStaff] = await Promise.all([
      db.all(`
        SELECT category,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours,
          MIN(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as min_hours,
          MAX(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as max_hours
        FROM tickets WHERE resolved_at IS NOT NULL AND company_id = ? ${sc}
        GROUP BY category ORDER BY avg_hours DESC
      `, companyId, ...sp),
      db.all(`
        SELECT priority,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours
        FROM tickets WHERE resolved_at IS NOT NULL AND company_id = ? ${sc}
        GROUP BY priority
        ORDER BY CASE priority
          WHEN 'critical' THEN 1 WHEN 'high' THEN 2
          WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END
      `, companyId, ...sp),
      db.all(`
        SELECT u.name as staff_name,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600) as avg_hours
        FROM tickets t
        JOIN users u ON t.assignee_id = u.id
        WHERE t.resolved_at IS NOT NULL AND u.role IN ('it_staff', 'admin') AND t.company_id = ? ${tsc}
        GROUP BY u.id, u.name
        ORDER BY avg_hours ASC
        LIMIT 10
      `, companyId, ...sp),
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
  const companyId = req.user.company_id || 1;
  const { session_start } = req.query;
  const sc = session_start ? 'AND created_at >= ?' : '';
  const sp = session_start ? [session_start] : [];
  try {
    const rows = await db.all(`
      SELECT
        EXTRACT(DOW FROM created_at)::integer as dow,
        EXTRACT(HOUR FROM created_at)::integer as hour,
        COUNT(*) as count
      FROM tickets
      WHERE company_id = ? ${sc}
      GROUP BY dow, hour
    `, companyId, ...sp);

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
  const companyId = req.user.company_id || 1;
  try {
    const { period = 'day', session_start } = req.query;
    // When session_start is provided it replaces the fixed look-back interval
    const sinceClause = session_start
      ? 'AND created_at >= ?'
      : period === 'month' ? "AND created_at >= NOW() - INTERVAL '12 months'"
        : period === 'week'  ? "AND created_at >= NOW() - INTERVAL '12 weeks'"
        :                      "AND created_at >= CURRENT_DATE - INTERVAL '29 days'";
    const sinceParam = session_start ? [session_start] : [];

    let query;
    if (period === 'month') {
      query = `
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as label,
               DATE_TRUNC('month', created_at) as sort_key,
               COUNT(*) as count
        FROM tickets
        WHERE company_id = ? ${sinceClause}
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY sort_key ASC
      `;
    } else if (period === 'week') {
      query = `
        SELECT 'Wk ' || TO_CHAR(DATE_TRUNC('week', created_at), 'MM/DD') as label,
               DATE_TRUNC('week', created_at) as sort_key,
               COUNT(*) as count
        FROM tickets
        WHERE company_id = ? ${sinceClause}
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY sort_key ASC
      `;
    } else {
      query = `
        SELECT TO_CHAR(DATE(created_at), 'Mon DD') as label,
               DATE(created_at) as sort_key,
               COUNT(*) as count
        FROM tickets
        WHERE company_id = ? ${sinceClause}
        GROUP BY DATE(created_at)
        ORDER BY sort_key ASC
      `;
    }

    const rows = await db.all(query, companyId, ...sinceParam);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── COMMON ISSUES (top categories + keywords) ───────────────────────────────
router.get('/common-issues', authenticate, async (req, res) => {
  const companyId = req.user.company_id || 1;
  const { session_start } = req.query;
  const sc = session_start ? 'AND created_at >= ?' : '';
  const sp = session_start ? [session_start] : [];
  try {
    const byCategory = await db.all(`
      SELECT
        category,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE ai_attempted = 1 AND status IN ('resolved','closed')) as atlas_resolved,
        COUNT(*) FILTER (WHERE status IN ('resolved','closed')) as resolved
      FROM tickets
      WHERE company_id = ? ${sc}
      GROUP BY category
      ORDER BY total DESC
    `, companyId, ...sp);

    const titles = await db.all(
      `SELECT title FROM tickets WHERE company_id = ? ${sc} ORDER BY created_at DESC LIMIT 500`,
      companyId, ...sp
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
  const companyId = req.user.company_id || 1;
  try {
    const {
      costPerTicket = 25,
      atlasHandledCost = 3,
      minutesPerTicket = 30,
      session_start,
    } = req.query;

    const sinceClause = session_start ? 'AND created_at >= ?' : '';
    const sinceParam  = session_start ? [session_start] : [];
    const monthlySince = session_start
      ? 'AND created_at >= ?'
      : "AND created_at >= NOW() - INTERVAL '6 months'";

    const [totals, monthly] = await Promise.all([
      db.get(`
        SELECT
          COUNT(*) as total_tickets,
          COUNT(*) FILTER (WHERE ai_auto_assigned = 1 OR ai_attempted = 1) as atlas_handled,
          COUNT(*) FILTER (WHERE ai_auto_assigned = 1) as fully_automated
        FROM tickets
        WHERE company_id = ? ${sinceClause}
      `, companyId, ...sinceParam),
      db.all(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month,
          DATE_TRUNC('month', created_at) as sort_key,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE ai_auto_assigned = 1 OR ai_attempted = 1) as atlas_handled
        FROM tickets
        WHERE company_id = ? ${monthlySince}
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY sort_key ASC
      `, companyId, ...sinceParam),
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
  const companyId = req.user.company_id || 1;
  const { session_start } = req.query;
  const sinceClause = session_start ? ' AND t.created_at >= ?' : '';
  const sinceParam  = session_start ? [session_start] : [];
  try {
    const [overview, byStaff, recent] = await Promise.all([
      db.get(`
        SELECT
          COUNT(*) as total_sent,
          COUNT(*) FILTER (WHERE rating IS NOT NULL) as total_rated,
          COUNT(*) FILTER (WHERE rating = 'up') as thumbs_up,
          COUNT(*) FILTER (WHERE rating = 'down') as thumbs_down
        FROM satisfaction_ratings sr
        JOIN tickets t ON sr.ticket_id = t.id
        WHERE t.company_id = ?${sinceClause}
      `, companyId, ...sinceParam),
      db.all(`
        SELECT u.name as staff_name,
          COUNT(sr.id) as total_rated,
          COUNT(sr.id) FILTER (WHERE sr.rating = 'up') as thumbs_up
        FROM satisfaction_ratings sr
        JOIN tickets t ON sr.ticket_id = t.id
        JOIN users u ON t.assignee_id = u.id
        WHERE sr.rating IS NOT NULL AND t.company_id = ?${sinceClause}
        GROUP BY u.id, u.name
        ORDER BY thumbs_up DESC
        LIMIT 10
      `, companyId, ...sinceParam),
      db.all(`
        SELECT sr.rating, sr.comment, sr.submitted_at,
               t.title as ticket_title, u.name as staff_name
        FROM satisfaction_ratings sr
        JOIN tickets t ON sr.ticket_id = t.id
        LEFT JOIN users u ON t.assignee_id = u.id
        WHERE sr.rating IS NOT NULL AND t.company_id = ?${sinceClause}
        ORDER BY sr.submitted_at DESC
        LIMIT 20
      `, companyId, ...sinceParam),
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
    const { rating, comment, star_rating, speed_rating, quality_rating, communication_rating, atlas_rating, nps_score } = req.body;

    const row = await db.get('SELECT * FROM satisfaction_ratings WHERE token = ?', req.params.token);
    if (!row) return res.status(404).json({ error: 'Invalid or expired survey link' });
    if (row.rating || row.star_rating) return res.status(409).json({ error: 'Survey already completed' });

    // Derive up/down from star rating if provided
    const derivedRating = star_rating ? (star_rating >= 4 ? 'up' : 'down') : rating;

    if (!derivedRating && !star_rating) return res.status(400).json({ error: 'Rating required' });

    await db.run(`
      UPDATE satisfaction_ratings SET
        rating = ?, comment = ?, submitted_at = NOW(),
        star_rating = ?, speed_rating = ?, quality_rating = ?,
        communication_rating = ?, atlas_rating = ?, nps_score = ?
      WHERE token = ?
    `, derivedRating || null, comment || null,
       star_rating || null, speed_rating || null, quality_rating || null,
       communication_rating || null, atlas_rating || null, nps_score || null,
       req.params.token);

    // If 3 stars or below, add follow-up task
    if (star_rating && star_rating <= 3) {
      const ratingRow = await db.get(`
        SELECT sr.ticket_id, t.company_id, t.assignee_id
        FROM satisfaction_ratings sr JOIN tickets t ON sr.ticket_id = t.id
        WHERE sr.token = ?
      `, req.params.token);
      if (ratingRow) {
        await db.run(`
          INSERT INTO ticket_notes (ticket_id, user_id, body)
          VALUES (?, ?, ?)
        `, ratingRow.ticket_id, ratingRow.assignee_id || 1,
           `Low satisfaction rating received (${star_rating}/5). Follow up with employee required.`
        ).catch(() => {});
      }
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── CUSTOM REPORT EXPORT (CSV or PDF) ───────────────────────────────────────
router.post('/reports/export', authenticate, async (req, res) => {
  const companyId = req.user.company_id || 1;
  try {
    const { format = 'csv', dateFrom, dateTo } = req.body;

    const whereClauses = ['t.company_id = ?'];
    const params = [companyId];
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
  const companyId = req.user.company_id || 1;
  try {
    const reports = await db.all(
      'SELECT id, report_month, stats, generated_at FROM monthly_reports WHERE company_id = ? ORDER BY generated_at DESC LIMIT 24',
      companyId
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
  const companyId = req.user.company_id || 1;
  try {
    const report = await db.get(
      'SELECT * FROM monthly_reports WHERE id = ? AND company_id = ?',
      req.params.id, companyId
    );
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ ...report, stats: report.stats ? JSON.parse(report.stats) : null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DOWNLOAD MONTHLY REPORT PDF ─────────────────────────────────────────────
router.get('/reports/monthly/:id/pdf', authenticate, async (req, res) => {
  const companyId = req.user.company_id || 1;
  try {
    const report = await db.get(
      'SELECT * FROM monthly_reports WHERE id = ? AND company_id = ?',
      req.params.id, companyId
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

// GET /api/analytics/health-score — Sentinel Health Score (0-100)
router.get('/health-score', authenticate, async (req, res) => {
  const companyId = req.user.company_id || 1;
  const { session_start } = req.query;
  try {
    const now = new Date();
    const fromDate = session_start
      ? new Date(session_start)
      : new Date(now - 30 * 24 * 60 * 60 * 1000);

    // Minimum window of 1 day — avoids zero-window issues on brand-new sessions
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const windowMs = Math.max(now.getTime() - fromDate.getTime(), ONE_DAY_MS);
    const windowDays = Math.round(windowMs / 86400000);

    console.log(`[health-score] company=${companyId} session_start=${session_start || 'none'} fromDate=${fromDate.toISOString()} windowDays=${windowDays}`);

    // Total tickets in current window
    const totalRow = await db.get(
      `SELECT COUNT(*) as cnt FROM tickets WHERE created_at >= ? AND company_id = ?`, fromDate, companyId
    );
    const total = parseInt(totalRow.cnt) || 0;

    // FRESH SESSION: zero tickets = perfect score (no problems reported yet)
    if (total === 0 && session_start) {
      console.log(`[health-score] FRESH SESSION — zero tickets, returning 100`);
      return res.json({
        score: 100,
        grade: 'A',
        fresh: true,
        message: 'No tickets yet — systems running clean.',
        breakdown: {
          resolution:       { score: 25, max: 25, rate: 100 },
          avgResolutionTime:{ score: 20, max: 20, hours: null },
          satisfaction:     { score: 20, max: 20, rate: null },
          atlasAutonomy:    { score: 15, max: 15, rate: 0 },
          volumeTrend:      { score: 10, max: 10, ratio: null, hasPrevious: false },
          recurringIssues:  { score: 10, max: 10, maxCategoryPct: 0 },
        },
      });
    }

    // Resolution rate (25 pts)
    const resolvedRow = await db.get(
      `SELECT COUNT(*) as cnt FROM tickets WHERE created_at >= ? AND status IN ('resolved','closed') AND company_id = ?`,
      fromDate, companyId
    );
    const resolved = parseInt(resolvedRow.cnt) || 0;
    const resolutionRate = total > 0 ? resolved / total : 1;
    const resolutionScore = Math.round(resolutionRate * 25);

    // Avg resolution time (20 pts)
    const avgTimeRow = await db.get(
      `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_hours
       FROM tickets WHERE resolved_at IS NOT NULL AND created_at >= ? AND company_id = ?`,
      fromDate, companyId
    );
    const avgHours = parseFloat(avgTimeRow?.avg_hours) || 48;
    let timeScore = 0;
    if (avgHours <= 4)  timeScore = 20;
    else if (avgHours <= 8)  timeScore = 16;
    else if (avgHours <= 24) timeScore = 12;
    else if (avgHours <= 48) timeScore = 8;
    else if (avgHours <= 72) timeScore = 4;

    // Satisfaction (20 pts)
    const satRow = await db.get(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN rating='up' THEN 1 ELSE 0 END) as positive
       FROM satisfaction_ratings sr
       JOIN tickets t ON sr.ticket_id = t.id
       WHERE sr.submitted_at IS NOT NULL AND sr.sent_at >= ? AND t.company_id = ?`,
      fromDate, companyId
    );
    const satTotal = parseInt(satRow?.total) || 0;
    const satPositive = parseInt(satRow?.positive) || 0;
    const satRate = satTotal > 0 ? satPositive / satTotal : 0.8;
    const satScore = Math.round(satRate * 20);

    // ATLAS autonomous rate (15 pts)
    const atlasRow = await db.get(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN ai_attempted=1 AND assignee_id IS NULL THEN 1 ELSE 0 END) as autonomous
       FROM tickets WHERE created_at >= ? AND company_id = ?`,
      fromDate, companyId
    );
    const atlasTotal = parseInt(atlasRow?.total) || 0;
    const atlasAuto  = parseInt(atlasRow?.autonomous) || 0;
    const atlasRate  = atlasTotal > 0 ? atlasAuto / atlasTotal : 0;
    const atlasScore = Math.round(atlasRate * 15);

    // Volume trend (10 pts)
    // For a session: compare against the previous session's ticket count.
    // Without a session: compare against equal-length window before fromDate.
    let trendScore = 10;
    let trendRatio = 1;
    let hasPrevious = false;

    if (session_start) {
      // Look up the session that started just before the current one
      const prevSession = await db.get(
        `SELECT started_at FROM sessions WHERE company_id = ? AND started_at < ? ORDER BY started_at DESC LIMIT 1`,
        companyId, fromDate
      );
      if (prevSession) {
        hasPrevious = true;
        const prevStart = new Date(prevSession.started_at);
        const prevRow = await db.get(
          `SELECT COUNT(*) as cnt FROM tickets WHERE created_at >= ? AND created_at < ? AND company_id = ?`,
          prevStart, fromDate, companyId
        );
        const prevTotal = parseInt(prevRow?.cnt) || total;
        trendRatio = prevTotal > 0 ? total / prevTotal : 1;
        if (trendRatio > 1.3) trendScore = 4;
        else if (trendRatio > 1.1) trendScore = 7;
        console.log(`[health-score] trend: prevSession=${prevSession.started_at} prevTotal=${prevTotal} currTotal=${total} ratio=${trendRatio.toFixed(2)}`);
      } else {
        // No previous session — neutral trend, full points
        hasPrevious = false;
        console.log(`[health-score] trend: no previous session — awarding full trend points`);
      }
    } else {
      // Default 30-day window: compare against equal-length window before fromDate
      hasPrevious = true;
      const prevFromDate = new Date(fromDate.getTime() - windowMs);
      const prevRow = await db.get(
        `SELECT COUNT(*) as cnt FROM tickets WHERE created_at >= ? AND created_at < ? AND company_id = ?`,
        prevFromDate, fromDate, companyId
      );
      const prevTotal = parseInt(prevRow?.cnt) || total;
      trendRatio = prevTotal > 0 ? total / prevTotal : 1;
      if (trendRatio > 1.3) trendScore = 4;
      else if (trendRatio > 1.1) trendScore = 7;
    }

    // Recurring issues (10 pts)
    const catRows = await db.all(
      `SELECT category, COUNT(*) as cnt FROM tickets WHERE created_at >= ? AND company_id = ? GROUP BY category`,
      fromDate, companyId
    );
    const maxCatPct = total > 0
      ? Math.max(...catRows.map(r => parseInt(r.cnt) / total))
      : 0;
    let recurringScore = 10;
    if (maxCatPct > 0.5)       recurringScore = 2;
    else if (maxCatPct > 0.35) recurringScore = 5;
    else if (maxCatPct > 0.25) recurringScore = 8;

    const score = resolutionScore + timeScore + satScore + atlasScore + trendScore + recurringScore;
    let grade = 'A';
    if (score < 40) grade = 'F';
    else if (score < 55) grade = 'D';
    else if (score < 70) grade = 'C';
    else if (score < 85) grade = 'B';

    console.log(`[health-score] score=${score} grade=${grade} (res=${resolutionScore} time=${timeScore} sat=${satScore} atlas=${atlasScore} trend=${trendScore} recurring=${recurringScore})`);

    res.json({
      score,
      grade,
      breakdown: {
        resolution:        { score: resolutionScore, max: 25, rate: Math.round(resolutionRate * 100) },
        avgResolutionTime: { score: timeScore,        max: 20, hours: Math.round(avgHours * 10) / 10 },
        satisfaction:      { score: satScore,         max: 20, rate: Math.round(satRate * 100) },
        atlasAutonomy:     { score: atlasScore,       max: 15, rate: Math.round(atlasRate * 100) },
        volumeTrend:       { score: trendScore,       max: 10, ratio: hasPrevious ? Math.round(trendRatio * 100) / 100 : null, hasPrevious },
        recurringIssues:   { score: recurringScore,   max: 10, maxCategoryPct: Math.round(maxCatPct * 100) },
      },
    });
  } catch (e) {
    console.error('[health-score] error:', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
