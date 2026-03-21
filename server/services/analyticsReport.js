/**
 * Analytics Report Service
 * - PDF generation (custom reports + monthly)
 * - Monthly report data gathering + ATLAS narration
 */

import PDFDocument from 'pdfkit';
import db from '../db/connection.js';
import Anthropic from '@anthropic-ai/sdk';

// ─── CUSTOM REPORT PDF ────────────────────────────────────────────────────────
export function generateCustomReportPdf({ tickets, dateFrom, dateTo }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const GREEN = '#2d6a2d';
    const DARK  = '#1a1a1a';
    const GRAY  = '#555555';

    // ── Header ──
    doc.rect(0, 0, doc.page.width, 70).fill(GREEN);
    doc.fontSize(22).fillColor('#ffffff').text('Sentinel IT — Ticket Report', 50, 20, {
      align: 'center',
    });
    doc.fontSize(11).fillColor('#ccffcc').text(
      dateFrom || dateTo
        ? `${dateFrom || 'All time'} → ${dateTo || 'Present'}`
        : 'All time',
      50,
      46,
      { align: 'center' }
    );
    doc.moveDown(3);

    // ── Summary stats ──
    const resolved = tickets.filter(
      t => t.status === 'resolved' || t.status === 'closed'
    ).length;
    const withTime = tickets.filter(t => t.resolution_hours);
    const avgHours =
      withTime.length > 0
        ? withTime.reduce((s, t) => s + t.resolution_hours, 0) / withTime.length
        : 0;

    const statY = doc.y;
    const statBoxW = 110;
    const stats = [
      { label: 'Total Tickets', value: String(tickets.length) },
      { label: 'Resolved', value: String(resolved) },
      {
        label: 'Avg Resolution',
        value: avgHours ? `${Math.round(avgHours * 10) / 10}h` : 'N/A',
      },
      {
        label: 'Resolution Rate',
        value:
          tickets.length > 0
            ? `${Math.round((resolved / tickets.length) * 100)}%`
            : 'N/A',
      },
    ];
    stats.forEach((s, i) => {
      const x = 50 + i * (statBoxW + 10);
      doc.rect(x, statY, statBoxW, 50).fill('#f0f7f0').stroke('#c0dcc0');
      doc
        .fontSize(18)
        .fillColor(GREEN)
        .text(s.value, x, statY + 8, { width: statBoxW, align: 'center' });
      doc
        .fontSize(8)
        .fillColor(GRAY)
        .text(s.label, x, statY + 32, { width: statBoxW, align: 'center' });
    });
    doc.y = statY + 70;

    doc
      .fontSize(9)
      .fillColor(GRAY)
      .text(`Generated: ${new Date().toLocaleString()} UTC`, { align: 'right' });
    doc.moveDown(1);

    // ── Table ──
    doc.fontSize(13).fillColor(DARK).text('Ticket Details', { underline: true });
    doc.moveDown(0.4);

    const colWidths = [35, 180, 60, 60, 60, 90];
    const headers = ['ID', 'Title', 'Status', 'Priority', 'Category', 'Assignee'];
    const tableLeft = 50;

    // Header row
    doc.rect(tableLeft, doc.y, 495, 18).fill(GREEN);
    const hY = doc.y + 4;
    let cx = tableLeft + 4;
    headers.forEach((h, i) => {
      doc.fontSize(8).fillColor('#ffffff').text(h, cx, hY, {
        width: colWidths[i] - 4,
        lineBreak: false,
      });
      cx += colWidths[i];
    });
    doc.y = hY + 18;

    tickets.slice(0, 200).forEach((t, idx) => {
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
      }
      const rowY = doc.y;
      if (idx % 2 === 0) {
        doc.rect(tableLeft, rowY - 1, 495, 14).fill('#f5faf5');
      }
      cx = tableLeft + 4;
      const cols = [
        String(t.id),
        (t.title || '').slice(0, 32),
        t.status || '',
        t.priority || '',
        t.category || '',
        (t.assignee || 'Unassigned').slice(0, 16),
      ];
      cols.forEach((col, i) => {
        const color =
          col === 'critical'
            ? '#cc2222'
            : col === 'resolved' || col === 'closed'
            ? '#2d6a2d'
            : DARK;
        doc
          .fontSize(8)
          .fillColor(color)
          .text(col, cx, rowY, { width: colWidths[i] - 4, lineBreak: false });
        cx += colWidths[i];
      });
      doc.y = rowY + 14;
    });

    if (tickets.length > 200) {
      doc
        .moveDown(0.5)
        .fontSize(8)
        .fillColor(GRAY)
        .text(`... and ${tickets.length - 200} more tickets (truncated for PDF).`);
    }

    doc.end();
  });
}

// ─── MONTHLY REPORT: GATHER DATA + ATLAS NARRATION ───────────────────────────
export async function generateMonthlyReport() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Stats for the *previous* calendar month
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const prevEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59
  ).toISOString();

  const [ticketStats, staffStats, categoryStats, satisfaction] = await Promise.all([
    db.get(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('resolved','closed')) as resolved,
        COUNT(*) FILTER (WHERE priority = 'critical') as critical,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
          FILTER (WHERE resolved_at IS NOT NULL) as avg_resolution_hours,
        COUNT(*) FILTER (WHERE ai_attempted = 1 OR ai_auto_assigned = 1) as atlas_handled
       FROM tickets WHERE created_at BETWEEN ? AND ?`,
      prevStart,
      prevEnd
    ),
    db.all(
      `SELECT u.name,
        COUNT(t.id) FILTER (WHERE t.resolved_at IS NOT NULL) as resolved_count,
        AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600)
          FILTER (WHERE t.resolved_at IS NOT NULL) as avg_hours
       FROM users u
       LEFT JOIN tickets t ON t.assignee_id = u.id
         AND t.created_at BETWEEN ? AND ?
       WHERE u.role IN ('it_staff', 'admin') AND u.is_active = 1
       GROUP BY u.id, u.name
       ORDER BY resolved_count DESC
       LIMIT 5`,
      prevStart,
      prevEnd
    ),
    db.all(
      `SELECT category, COUNT(*) as count
       FROM tickets WHERE created_at BETWEEN ? AND ?
       GROUP BY category ORDER BY count DESC`,
      prevStart,
      prevEnd
    ),
    db.get(
      `SELECT COUNT(*) as total_rated,
        COUNT(*) FILTER (WHERE sr.rating = 'up') as thumbs_up
       FROM satisfaction_ratings sr
       JOIN tickets t ON sr.ticket_id = t.id
       WHERE sr.submitted_at BETWEEN ? AND ?`,
      prevStart,
      prevEnd
    ),
  ]);

  const stats = { ticketStats, staffStats, categoryStats, satisfaction, monthKey };
  const prevMonthLabel = new Date(prevStart).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // ── ATLAS narration ──
  let reportText = '';
  try {
    const aiRows = await db.all(
      "SELECT key, value FROM settings WHERE key IN ('ai_enabled', 'company_name')"
    );
    const settings = Object.fromEntries(aiRows.map(r => [r.key, r.value]));

    if (settings.ai_enabled !== 'false') {
      const client = new Anthropic();
      const satRate =
        satisfaction.total_rated > 0
          ? `${Math.round((satisfaction.thumbs_up / satisfaction.total_rated) * 100)}%`
          : 'N/A (no survey responses)';

      const prompt = `You are ATLAS, the AI IT assistant for ${
        settings.company_name || 'this company'
      }. Write a professional monthly IT report for ${prevMonthLabel}.

Key metrics:
- Total tickets: ${ticketStats.total}
- Resolved: ${ticketStats.resolved}
- Critical incidents: ${ticketStats.critical}
- Average resolution time: ${
        ticketStats.avg_resolution_hours
          ? Math.round(ticketStats.avg_resolution_hours * 10) / 10
          : 'N/A'
      } hours
- ATLAS AI handled: ${ticketStats.atlas_handled} tickets
- Customer satisfaction: ${satRate}
- Top performer: ${staffStats[0]?.name || 'N/A'} (${staffStats[0]?.resolved_count || 0} resolved)
- Most common issue category: ${categoryStats[0]?.category || 'N/A'}

Write a concise, insightful report (under 400 words) including:
1. Executive summary
2. Key highlights and wins
3. Areas that need attention
4. Recommendations for next month
Use a professional but friendly tone. Do not use markdown headers.`;

      const msg = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      });
      reportText = msg.content[0]?.text || '';
    }
  } catch (e) {
    console.error('[Monthly Report] ATLAS narration failed:', e.message);
  }

  if (!reportText) {
    reportText =
      `Monthly IT Report — ${prevMonthLabel}\n\n` +
      `Total tickets: ${ticketStats.total}\n` +
      `Resolved: ${ticketStats.resolved}\n` +
      `Average resolution time: ${
        ticketStats.avg_resolution_hours
          ? Math.round(ticketStats.avg_resolution_hours * 10) / 10
          : 'N/A'
      } hours\n` +
      `ATLAS handled: ${ticketStats.atlas_handled} tickets\n` +
      `Top performer: ${staffStats[0]?.name || 'N/A'}`;
  }

  await db.run(
    `INSERT INTO monthly_reports (report_month, report_text, stats)
     VALUES (?, ?, ?)
     ON CONFLICT (report_month)
     DO UPDATE SET report_text = EXCLUDED.report_text,
                   stats = EXCLUDED.stats,
                   generated_at = NOW()`,
    monthKey,
    reportText,
    JSON.stringify(stats)
  );

  return { reportText, stats };
}

// ─── MONTHLY REPORT PDF ───────────────────────────────────────────────────────
export function generateMonthlyPdf(reportText, statsData) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const GREEN = '#2d6a2d';
    const GRAY  = '#555555';

    const { ticketStats = {}, staffStats = [], categoryStats = [], satisfaction = {}, monthKey = '' } =
      statsData || {};

    const prevMonthLabel = monthKey
      ? new Date(monthKey + '-01').toLocaleString('en-US', {
          month: 'long',
          year: 'numeric',
        })
      : 'Monthly';

    // ── Header ──
    doc.rect(0, 0, doc.page.width, 80).fill(GREEN);
    doc
      .fontSize(22)
      .fillColor('#ffffff')
      .text('Sentinel IT — Monthly Report', 50, 18, { align: 'center' });
    doc
      .fontSize(13)
      .fillColor('#ccffcc')
      .text(prevMonthLabel, 50, 46, { align: 'center' });
    doc
      .fontSize(9)
      .fillColor('#aaeaaa')
      .text(`Generated by ATLAS • ${new Date().toLocaleString()}`, 50, 64, {
        align: 'center',
      });
    doc.y = 100;

    // ── Metrics grid ──
    const metrics = [
      ['Total Tickets', String(ticketStats.total || 0)],
      ['Resolved', String(ticketStats.resolved || 0)],
      ['Critical', String(ticketStats.critical || 0)],
      ['ATLAS Handled', String(ticketStats.atlas_handled || 0)],
      [
        'Avg Resolution',
        ticketStats.avg_resolution_hours
          ? `${Math.round(ticketStats.avg_resolution_hours * 10) / 10}h`
          : 'N/A',
      ],
      [
        'Satisfaction',
        satisfaction.total_rated > 0
          ? `${Math.round((satisfaction.thumbs_up / satisfaction.total_rated) * 100)}%`
          : 'N/A',
      ],
    ];

    const boxW = 80;
    const boxH = 44;
    const startX = 50;
    const mY = doc.y;
    metrics.forEach((m, i) => {
      const x = startX + i * (boxW + 6);
      doc.rect(x, mY, boxW, boxH).fill('#f0f7f0').stroke('#b8d8b8');
      doc.fontSize(16).fillColor(GREEN).text(m[1], x, mY + 6, {
        width: boxW,
        align: 'center',
      });
      doc.fontSize(7).fillColor(GRAY).text(m[0], x, mY + 28, {
        width: boxW,
        align: 'center',
      });
    });
    doc.y = mY + boxH + 20;

    // ── Report text ──
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke(GREEN);
    doc.moveDown(0.5);
    doc
      .fontSize(13)
      .fillColor('#1a1a1a')
      .text('Executive Summary', { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor('#333333').text(reportText, { lineGap: 4 });
    doc.moveDown(1);

    // ── Top performers ──
    if (staffStats.length > 0) {
      if (doc.y > doc.page.height - 120) doc.addPage();
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke(GREEN);
      doc.moveDown(0.5);
      doc
        .fontSize(13)
        .fillColor('#1a1a1a')
        .text('Top Performers', { underline: true });
      doc.moveDown(0.4);
      const medals = ['🥇', '🥈', '🥉'];
      staffStats.forEach((s, i) => {
        doc
          .fontSize(10)
          .fillColor('#333333')
          .text(
            `${medals[i] || `${i + 1}.`} ${s.name} — ${s.resolved_count || 0} resolved${
              s.avg_hours
                ? ` (avg ${Math.round(s.avg_hours * 10) / 10}h)`
                : ''
            }`
          );
      });
      doc.moveDown(0.8);
    }

    // ── Category breakdown ──
    if (categoryStats.length > 0) {
      if (doc.y > doc.page.height - 100) doc.addPage();
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke(GREEN);
      doc.moveDown(0.5);
      doc
        .fontSize(13)
        .fillColor('#1a1a1a')
        .text('Tickets by Category', { underline: true });
      doc.moveDown(0.4);
      const total = categoryStats.reduce((s, c) => s + Number(c.count), 0);
      categoryStats.forEach(c => {
        const pct = total > 0 ? Math.round((c.count / total) * 100) : 0;
        doc
          .fontSize(10)
          .fillColor('#333333')
          .text(
            `${c.category.charAt(0).toUpperCase() + c.category.slice(1)}: ${c.count} tickets (${pct}%)`
          );
      });
    }

    // ── Footer ──
    doc
      .fontSize(8)
      .fillColor('#aaaaaa')
      .text(
        'Sentinel IT Helpdesk — Powered by ATLAS AI',
        50,
        doc.page.height - 30,
        { align: 'center' }
      );

    doc.end();
  });
}
