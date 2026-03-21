/**
 * ATLAS Scheduled Tasks
 * - Weekly intelligence report — Monday 9am UTC
 * - SLA escalation check — every 15 minutes
 * - Maintenance window notifications — every 10 minutes
 */

import cron from 'node-cron';
import db from '../db/connection.js';
import * as atlas from './atlas.js';
import { gatherWeeklyStats } from './learning.js';
import { sendWeeklyReport, sendMonthlyReport, sendIncidentAlert, sendPredictionBriefing } from './email.js';
import nodemailer from 'nodemailer';
import { pollEmailInbox } from './emailIngestion.js';
import { checkCriticalUnassignedTickets } from './pagerduty.js';
import { generateMonthlyReport, generateMonthlyPdf } from './analyticsReport.js';

async function getTransporter() {
  const rows = await db.all("SELECT key, value FROM settings WHERE key LIKE 'smtp_%'");
  const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
  if (!cfg.smtp_host || !cfg.smtp_user) return null;
  return nodemailer.createTransport({
    host: cfg.smtp_host,
    port: parseInt(cfg.smtp_port || '587'),
    secure: cfg.smtp_secure === 'true',
    auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
  });
}

async function getSmtpConfig() {
  const rows = await db.all('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// ─── SLA ESCALATION ───────────────────────────────────────────────────────────

async function runSlaEscalation() {
  try {
    const now = new Date().toISOString();
    // Find tickets past SLA that aren't already escalated and aren't resolved/closed
    const overdue = await db.all(
      `SELECT id, title, priority, assignee_id FROM tickets
       WHERE sla_due_at IS NOT NULL
         AND sla_due_at < ?
         AND is_escalated = 0
         AND status NOT IN ('resolved','closed')`,
      now
    );
    if (!overdue.length) return;

    for (const ticket of overdue) {
      await db.run(
        `UPDATE tickets SET is_escalated = 1, updated_at = NOW() WHERE id = ?`,
        ticket.id
      );
      await db.run(
        `INSERT INTO ticket_comments (ticket_id, user_id, body) VALUES (?, NULL, ?)`,
        ticket.id,
        `⚠️ SLA breach: This ${ticket.priority} priority ticket has exceeded its response time target.`
      );
    }
    console.log(`[SLA Cron] Escalated ${overdue.length} ticket(s)`);
  } catch (e) {
    console.error('[SLA Cron] escalation failed:', e.message);
  }
}

// ─── MAINTENANCE NOTIFICATIONS ────────────────────────────────────────────────

async function runMaintenanceNotifications() {
  try {
    const transporter = await getTransporter();
    if (!transporter) return;
    const cfg = await getSmtpConfig();
    const company = cfg.company_name || 'Sentinel IT';

    // Find windows starting within the next 30 minutes that haven't been notified yet
    const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const now  = new Date().toISOString();

    const windows = await db.all(
      `SELECT * FROM maintenance_windows
       WHERE notify_users = 1
         AND notified_at IS NULL
         AND starts_at > ?
         AND starts_at <= ?`,
      now, soon
    );

    for (const win of windows) {
      // Send to all active users
      const users = await db.all('SELECT email, name FROM users WHERE is_active = 1');
      const startsAt = new Date(win.starts_at).toLocaleString('en-GB', { timeZone: 'UTC' });
      const endsAt   = new Date(win.ends_at).toLocaleString('en-GB', { timeZone: 'UTC' });

      for (const user of users) {
        await transporter.sendMail({
          from: cfg.smtp_from || cfg.smtp_user,
          to: user.email,
          subject: `[${company}] Scheduled Maintenance — ${win.title}`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0d0d0d;color:#e5e5e5;border-radius:12px;overflow:hidden;">
              <div style="background:#b45309;padding:20px 32px;">
                <h1 style="margin:0;font-size:20px;color:#fff;">${company} — Maintenance Notice</h1>
              </div>
              <div style="padding:32px;">
                <h2 style="margin-top:0;color:#fff;">${win.title}</h2>
                <p>Hi <strong>${user.name}</strong>,</p>
                <p>A scheduled maintenance window is starting soon. Some services may be unavailable during this time.</p>
                <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;margin:20px 0;">
                  <p style="margin:0 0 8px;"><strong>Starts:</strong> ${startsAt} UTC</p>
                  <p style="margin:0;"><strong>Ends:</strong> ${endsAt} UTC</p>
                  ${win.description ? `<p style="margin:8px 0 0;color:#aaa;">${win.description}</p>` : ''}
                </div>
                <p style="color:#888;font-size:13px;">— ${company} IT Team</p>
              </div>
            </div>
          `,
        }).catch(() => {});
      }

      await db.run('UPDATE maintenance_windows SET notified_at = NOW() WHERE id = ?', win.id);
      console.log(`[Maintenance Cron] Notified ${users.length} user(s) for window: ${win.title}`);
    }
  } catch (e) {
    console.error('[Maintenance Cron] failed:', e.message);
  }
}

// ─── PROACTIVE MONITORING ────────────────────────────────────────────────────

async function runProactiveMonitoring() {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Find categories with 3+ tickets in last 2 hours
    const spikes = await db.all(
      `SELECT category, COUNT(*) as cnt
       FROM tickets
       WHERE created_at >= ? AND status NOT IN ('resolved','closed')
       GROUP BY category
       HAVING COUNT(*) >= 3`,
      twoHoursAgo
    );

    for (const spike of spikes) {
      // Check if we already have an active incident for this category
      const existing = await db.get(
        `SELECT id FROM incidents WHERE category = ? AND status = 'active' AND created_at >= ?`,
        spike.category, twoHoursAgo
      );
      if (existing) continue;

      // Create incident
      const title = `${spike.category.charAt(0).toUpperCase() + spike.category.slice(1)} Spike Detected`;
      const description = `${spike.cnt} ${spike.category} tickets submitted in the last 2 hours. Possible system-wide issue.`;

      const result = await db.run(
        `INSERT INTO incidents (title, description, category) VALUES (?, ?, ?)`,
        title, description, spike.category
      );
      const incidentId = result.lastID || result.id;

      // Create a critical incident ticket
      const adminUser = await db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
      if (adminUser) {
        await db.run(
          `INSERT INTO tickets (title, description, status, priority, category, submitter_id, ai_attempted)
           VALUES (?, ?, 'open', 'critical', ?, ?, 0)`,
          title, description, spike.category, adminUser.id
        );
      }

      // Notify all IT staff + admins
      const staff = await db.all(
        "SELECT id, name, email FROM users WHERE role IN ('it_staff','admin') AND is_active = 1"
      );

      const cfg = await getSmtpConfig();
      const transporter = await getTransporter();

      for (const member of staff) {
        // In-app notification
        await db.run(
          `INSERT INTO notifications (user_id, type, title, body, link)
           VALUES (?, 'incident', ?, ?, '/admin/incidents')`,
          member.id, title, description
        );

        // Email
        if (transporter) {
          await sendIncidentAlert({
            to: member.email,
            name: member.name,
            title,
            description,
            category: spike.category,
            count: spike.cnt,
            companyName: cfg.company_name || 'Sentinel IT',
          }).catch(() => {});
        }
      }

      console.log(`[Proactive Monitor] Incident created: ${title} (id=${incidentId}), notified ${staff.length} staff`);
    }
  } catch (e) {
    console.error('[Proactive Monitor] failed:', e.message);
  }
}

// ─── PREDICTIVE TICKET PREVENTION ────────────────────────────────────────────

async function runPredictivePrevention() {
  try {
    const aiEnabled = await db.get("SELECT value FROM settings WHERE key = 'ai_enabled'");
    if (aiEnabled?.value !== 'true') return;

    // Gather patterns from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const patterns = await db.all(
      `SELECT category, COUNT(*) as cnt, AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_hours
       FROM tickets
       WHERE created_at >= ?
       GROUP BY category
       ORDER BY cnt DESC`,
      thirtyDaysAgo
    );

    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const peakDay = await db.all(
      `SELECT EXTRACT(DOW FROM created_at) as dow, COUNT(*) as cnt
       FROM tickets WHERE created_at >= ?
       GROUP BY dow ORDER BY cnt DESC LIMIT 3`,
      thirtyDaysAgo
    );

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic();

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are an IT operations analyst. Based on the following ticket patterns from the past 30 days, write a brief weekly prevention briefing for the IT team. Include: top 3 actionable prevention recommendations, expected high-volume periods next week, and any quick wins.

Ticket patterns by category:
${patterns.map(p => `• ${p.category}: ${p.cnt} tickets, avg ${Math.round(p.avg_hours || 0)}h resolution`).join('\n')}

Peak volume days: ${peakDay.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.dow] + ` (${d.cnt} tickets)`).join(', ')}

Write 3-4 short paragraphs. Be specific and actionable. No fluff.`
      }]
    });

    const briefingText = message.content[0].text;
    const cfg = await getSmtpConfig();
    const admins = await db.all("SELECT name, email FROM users WHERE role = 'admin' AND is_active = 1");

    for (const admin of admins) {
      await sendPredictionBriefing({
        to: admin.email,
        name: admin.name,
        briefingText,
        patterns,
        companyName: cfg.company_name || 'Sentinel IT',
      }).catch(() => {});
    }

    console.log(`[Predictive Cron] Prevention briefing sent to ${admins.length} admin(s)`);
  } catch (e) {
    console.error('[Predictive Cron] failed:', e.message);
  }
}

// ─── HEALTH SCORE ALERT ────────────────────────────────────────────────────────

async function runHealthScoreAlert() {
  try {
    const thresholdRow = await db.get("SELECT value FROM settings WHERE key = 'health_score_alert_threshold'");
    const threshold = parseInt(thresholdRow?.value || '70');

    // Quick health score calc (resolution rate only for lightweight check)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const total = await db.get(`SELECT COUNT(*) as cnt FROM tickets WHERE created_at >= ?`, thirtyDaysAgo);
    const resolved = await db.get(
      `SELECT COUNT(*) as cnt FROM tickets WHERE created_at >= ? AND status IN ('resolved','closed')`,
      thirtyDaysAgo
    );
    const resolutionRate = parseInt(total.cnt) > 0
      ? parseInt(resolved.cnt) / parseInt(total.cnt)
      : 1;

    // Only alert if resolution rate is extremely low (rough proxy)
    const estimatedScore = Math.round(resolutionRate * 100 * 0.65); // rough estimate
    if (estimatedScore >= threshold) return;

    const cfg = await getSmtpConfig();
    const admins = await db.all("SELECT id, name, email FROM users WHERE role = 'admin' AND is_active = 1");

    for (const admin of admins) {
      await db.run(
        `INSERT INTO notifications (user_id, type, title, body, link)
         VALUES (?, 'health_alert', 'Health Score Warning', ?, '/admin/analytics')`,
        admin.id,
        `Sentinel Health Score is critically low (est. ${estimatedScore}/100). Check the Analytics dashboard for details.`
      );
    }
    console.log('[Health Score Cron] Low health score alert sent to admins');
  } catch (e) {
    console.error('[Health Score Cron] failed:', e.message);
  }
}

// ─── DAILY DIGEST ────────────────────────────────────────────────────────────

async function runDailyDigest() {
  try {
    const transporter = await getTransporter();
    if (!transporter) return;
    const cfg = await getSmtpConfig();

    // Find staff with digest enabled
    const digestUsers = await db.all(
      `SELECT u.id, u.name, u.email, np.digest_hour
       FROM notification_preferences np
       JOIN users u ON u.id = np.user_id
       WHERE np.digest_enabled = 1 AND u.is_active = 1`
    );

    const currentHour = new Date().getUTCHours();

    for (const user of digestUsers) {
      if (user.digest_hour !== currentHour) continue;

      // Gather unread low-priority notifications
      const notifs = await db.all(
        `SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC LIMIT 20`,
        user.id
      );
      if (notifs.length === 0) continue;

      const notifHtml = notifs.map(n =>
        `<div style="padding:8px 0;border-bottom:1px solid #333;">
          <strong>${n.title}</strong><br>
          <span style="color:#aaa;font-size:13px;">${n.body}</span>
        </div>`
      ).join('');

      await transporter.sendMail({
        from: cfg.smtp_from || cfg.smtp_user,
        to: user.email,
        subject: `[${cfg.company_name || 'Sentinel IT'}] Your Daily Notification Digest`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0d0d0d;color:#e5e5e5;border-radius:12px;overflow:hidden;">
            <div style="background:#166534;padding:20px 32px;">
              <h1 style="margin:0;font-size:20px;color:#fff;">${cfg.company_name || 'Sentinel IT'} — Daily Digest</h1>
            </div>
            <div style="padding:32px;">
              <p>Hi <strong>${user.name}</strong>, here are your ${notifs.length} unread notification${notifs.length !== 1 ? 's' : ''}:</p>
              ${notifHtml}
              <p style="margin-top:24px;"><a href="${process.env.CLIENT_URL || 'http://localhost:5173'}" style="color:#4aaa4a;">View in Sentinel →</a></p>
            </div>
          </div>
        `,
      }).catch(() => {});

      // Mark as read
      await db.run(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`, user.id);
    }
  } catch (e) {
    console.error('[Digest Cron] failed:', e.message);
  }
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────

export function startCronJobs() {
  // Monday at 9:00 AM UTC — weekly intelligence report
  cron.schedule('0 9 * * 1', async () => {
    console.log('[ATLAS Cron] Running weekly intelligence report…');
    try {
      const stats = await gatherWeeklyStats();
      const reportText = await atlas.generateWeeklyReport(stats);
      if (!reportText) {
        console.log('[ATLAS Cron] No report generated (AI disabled?)');
        return;
      }
      const admins = await db.all("SELECT name, email FROM users WHERE role = 'admin' AND is_active = 1");
      for (const admin of admins) {
        await sendWeeklyReport({ to: admin.email, name: admin.name, report: reportText, stats });
      }
      console.log(`[ATLAS Cron] Weekly report sent to ${admins.length} admin(s)`);
    } catch (e) {
      console.error('[ATLAS Cron] Weekly report failed:', e.message);
    }
  }, { timezone: 'UTC' });

  // Every 15 minutes — SLA escalation
  cron.schedule('*/15 * * * *', runSlaEscalation);

  // Every 10 minutes — maintenance window notifications
  cron.schedule('*/10 * * * *', runMaintenanceNotifications);

  // Every 2 minutes — email ingestion (IMAP polling)
  cron.schedule('*/2 * * * *', async () => {
    try {
      await pollEmailInbox();
    } catch (e) {
      console.error('[Email Ingestion Cron] failed:', e.message);
    }
  });

  // Every 15 minutes — PagerDuty critical ticket check
  cron.schedule('*/15 * * * *', async () => {
    try {
      await checkCriticalUnassignedTickets();
    } catch (e) {
      console.error('[PagerDuty Cron] failed:', e.message);
    }
  });

  // Every Monday at 8:00 AM UTC — check if it's the first Monday of the month
  // and generate + email the monthly report
  cron.schedule('0 8 * * 1', async () => {
    const today = new Date();
    // First Monday = day-of-month is 1..7
    if (today.getDate() > 7) return;
    console.log('[ATLAS Cron] Running monthly IT report…');
    try {
      const { reportText, stats } = await generateMonthlyReport();
      const pdfBuffer = await generateMonthlyPdf(reportText, stats);
      const admins = await db.all(
        "SELECT name, email FROM users WHERE role = 'admin' AND is_active = 1"
      );
      for (const admin of admins) {
        await sendMonthlyReport({
          to: admin.email,
          name: admin.name,
          reportText,
          stats,
          pdfBuffer,
        });
      }
      console.log(`[ATLAS Cron] Monthly report sent to ${admins.length} admin(s)`);
    } catch (e) {
      console.error('[ATLAS Cron] Monthly report failed:', e.message);
    }
  }, { timezone: 'UTC' });

  // Every 5 minutes — proactive monitoring (spike detection)
  cron.schedule('*/5 * * * *', runProactiveMonitoring);

  // Every Friday at 5pm UTC — predictive ticket prevention briefing
  cron.schedule('0 17 * * 5', runPredictivePrevention, { timezone: 'UTC' });

  // Daily at 9am UTC — health score check
  cron.schedule('0 9 * * *', runHealthScoreAlert, { timezone: 'UTC' });

  // Every hour — daily digest (checks per-user digest_hour preference)
  cron.schedule('0 * * * *', runDailyDigest);

  console.log('✓ ATLAS cron jobs scheduled');
}
