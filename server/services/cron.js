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
import { sendWeeklyReport, sendMonthlyReport } from './email.js';
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

  console.log('✓ ATLAS cron jobs scheduled');
}
