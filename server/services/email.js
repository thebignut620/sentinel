import nodemailer from 'nodemailer';
import db from '../db/connection.js';

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

async function getConfig() {
  const rows = await db.all('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

const BASE_URL = process.env.CLIENT_URL || 'http://localhost:5173';

export async function sendTicketStatusEmail({ to, name, ticketId, title, newStatus }) {
  try {
    const transporter = await getTransporter();
    if (!transporter) return;
    const cfg = await getConfig();
    const company = cfg.company_name || 'Sentinel IT';
    const statusLabel = newStatus.replace('_', ' ');
    await transporter.sendMail({
      from: cfg.smtp_from || cfg.smtp_user,
      to,
      subject: `[${company}] Ticket #${ticketId} — Status updated to "${statusLabel}"`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0d0d0d;color:#e5e5e5;border-radius:12px;overflow:hidden;">
          <div style="background:#2d6a2d;padding:20px 32px;">
            <h1 style="margin:0;font-size:20px;color:#fff;">${company}</h1>
          </div>
          <div style="padding:32px;">
            <h2 style="margin-top:0;color:#fff;">Ticket Status Update</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your ticket has been updated:</p>
            <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;margin:20px 0;">
              <p style="margin:0 0 8px;"><strong>Ticket:</strong> #${ticketId} — ${title}</p>
              <p style="margin:0;"><strong>New Status:</strong> <span style="color:#4aaa4a;text-transform:capitalize;">${statusLabel}</span></p>
            </div>
            <a href="${BASE_URL}/tickets/${ticketId}"
               style="display:inline-block;background:#2d6a2d;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
              View Ticket
            </a>
            <p style="margin-top:32px;color:#888;font-size:13px;">— ${company} Support Team</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('[email] Failed to send status email:', err.message);
  }
}

export async function sendWeeklyReport({ to, name, report, stats }) {
  try {
    const transporter = await getTransporter();
    if (!transporter) return;
    const cfg = await getConfig();
    const company = cfg.company_name || 'Sentinel IT';

    const topCatsHtml = stats.topCategories.length
      ? stats.topCategories.map(c =>
          `<tr><td style="padding:4px 8px;color:#ccc;text-transform:capitalize;">${c.category}</td><td style="padding:4px 8px;color:#4aaa4a;font-weight:600;">${c.count} tickets</td></tr>`
        ).join('')
      : '<tr><td colspan="2" style="padding:4px 8px;color:#666;">No data</td></tr>';

    const reportHtml = report
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff;">$1</strong>')
      .replace(/\n\n/g, '</p><p style="margin:0 0 12px;color:#aaa;line-height:1.6;">')
      .replace(/\n/g, '<br>');

    await transporter.sendMail({
      from: cfg.smtp_from || cfg.smtp_user,
      to,
      subject: `[${company}] ATLAS Weekly Intelligence Report — ${stats.weekOf}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;background:#0d0d0d;color:#e5e5e5;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1a3a1a,#2d6a2d);padding:24px 32px;">
            <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#4aaa4a;">ATLAS Intelligence</p>
            <h1 style="margin:0;font-size:22px;color:#fff;">${company} — Weekly Briefing</h1>
            <p style="margin:8px 0 0;font-size:13px;color:#a0d0a0;">${stats.weekOf}</p>
          </div>

          <div style="padding:28px 32px;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
              ${[
                ['Tickets Created', stats.ticketsCreated],
                ['Tickets Resolved', stats.ticketsResolved],
                ['Avg Handle Time', stats.avgResolutionHours ? `${stats.avgResolutionHours}h` : '—'],
              ].map(([label, val]) => `
                <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:14px;text-align:center;">
                  <div style="font-size:24px;font-weight:700;color:#4aaa4a;">${val}</div>
                  <div style="font-size:11px;color:#888;margin-top:2px;">${label}</div>
                </div>
              `).join('')}
            </div>

            ${stats.topCategories.length ? `
            <div style="margin-bottom:24px;">
              <p style="margin:0 0 10px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#666;">Top Issue Categories</p>
              <table style="width:100%;border-collapse:collapse;">
                ${topCatsHtml}
              </table>
            </div>` : ''}

            <div style="background:#111;border:1px solid #222;border-radius:8px;padding:20px;margin-bottom:24px;">
              <p style="margin:0 0 14px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#4aaa4a;">ATLAS Intelligence Report</p>
              <p style="margin:0 0 12px;color:#aaa;line-height:1.6;">${reportHtml}</p>
            </div>

            <p style="margin-top:24px;color:#555;font-size:12px;text-align:center;">
              Generated by ATLAS — ${company} IT Intelligence System<br>
              ${stats.newSolutionsLearned} new solution pattern${stats.newSolutionsLearned !== 1 ? 's' : ''} learned this week
            </p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('[email] Failed to send weekly report:', err.message);
  }
}

export async function sendGoogleTempPassword({ to, name, tempPassword, ticketId }) {
  try {
    const transporter = await getTransporter();
    if (!transporter) return;
    const cfg = await getConfig();
    const company = cfg.company_name || 'Sentinel IT';
    await transporter.sendMail({
      from: cfg.smtp_from || cfg.smtp_user,
      to,
      subject: `[${company}] Your temporary Google Workspace password — Ticket #${ticketId}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0d0d0d;color:#e5e5e5;border-radius:12px;overflow:hidden;">
          <div style="background:#2d6a2d;padding:20px 32px;">
            <h1 style="margin:0;font-size:20px;color:#fff;">${company}</h1>
          </div>
          <div style="padding:32px;">
            <h2 style="margin-top:0;color:#fff;">Your Temporary Password</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your IT team has reset your Google Workspace password. Use the temporary password below to sign in:</p>
            <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
              <p style="margin:0 0 8px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Temporary Password</p>
              <p style="margin:0;font-size:26px;font-weight:700;color:#4aaa4a;letter-spacing:4px;font-family:monospace;">${tempPassword}</p>
            </div>
            <p style="color:#f59e0b;">⚠️ You will be required to change this password when you next sign in.</p>
            <p style="color:#888;font-size:13px;">This was actioned on Ticket #${ticketId}. If you did not request this reset, contact your IT team immediately.</p>
            <p style="margin-top:32px;color:#888;font-size:13px;">— ${company} Support Team</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('[email] Failed to send temp password email:', err.message);
  }
}

export async function sendMicrosoftTempPassword({ to, name, tempPassword, ticketId }) {
  try {
    const transporter = await getTransporter();
    if (!transporter) return;
    const cfg = await getConfig();
    const company = cfg.company_name || 'Sentinel IT';
    await transporter.sendMail({
      from: cfg.smtp_from || cfg.smtp_user,
      to,
      subject: `[${company}] Your temporary Microsoft 365 password — Ticket #${ticketId}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0d0d0d;color:#e5e5e5;border-radius:12px;overflow:hidden;">
          <div style="background:#0078d4;padding:20px 32px;">
            <h1 style="margin:0;font-size:20px;color:#fff;">${company}</h1>
          </div>
          <div style="padding:32px;">
            <h2 style="margin-top:0;color:#fff;">Your Temporary Microsoft 365 Password</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your IT team has reset your Microsoft 365 password. Use the temporary password below to sign in:</p>
            <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
              <p style="margin:0 0 8px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Temporary Password</p>
              <p style="margin:0;font-size:26px;font-weight:700;color:#0078d4;letter-spacing:4px;font-family:monospace;">${tempPassword}</p>
            </div>
            <p style="color:#f59e0b;">⚠️ You will be required to change this password when you next sign in.</p>
            <p style="color:#888;font-size:13px;">This was actioned on Ticket #${ticketId}. If you did not request this reset, contact your IT team immediately.</p>
            <p style="margin-top:32px;color:#888;font-size:13px;">— ${company} Support Team</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('[email] Failed to send Microsoft temp password email:', err.message);
  }
}

export async function sendSatisfactionSurvey({ to, name, ticketId, ticketTitle, token }) {
  try {
    const transporter = await getTransporter();
    if (!transporter) return;
    const cfg = await getConfig();
    const company = cfg.company_name || 'Sentinel IT';
    const surveyUrl = `${BASE_URL}/survey/${token}`;
    await transporter.sendMail({
      from: cfg.smtp_from || cfg.smtp_user,
      to,
      subject: `[${company}] How did we do? Quick feedback on Ticket #${ticketId}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0d0d0d;color:#e5e5e5;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1a3a1a,#2d6a2d);padding:24px 32px;">
            <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#4aaa4a;">Sentinel IT</p>
            <h1 style="margin:0;font-size:20px;color:#fff;">How did we do?</h1>
          </div>
          <div style="padding:32px;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your IT ticket has been resolved. We'd love to hear how it went — it only takes 2 seconds.</p>
            <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;margin:20px 0;">
              <p style="margin:0;color:#aaa;font-size:13px;"><strong style="color:#fff;">Ticket #${ticketId}:</strong> ${ticketTitle}</p>
            </div>
            <p style="text-align:center;margin:28px 0 12px;font-size:15px;color:#ccc;">Was your issue resolved to your satisfaction?</p>
            <div style="text-align:center;margin:0 0 28px;">
              <a href="${surveyUrl}?rating=up"
                 style="display:inline-block;background:#2d6a2d;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:22px;margin:0 8px;">
                👍 Yes
              </a>
              <a href="${surveyUrl}?rating=down"
                 style="display:inline-block;background:#3a1a1a;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:22px;margin:0 8px;">
                👎 No
              </a>
            </div>
            <p style="color:#555;font-size:12px;text-align:center;">— ${company} IT Team</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('[email] Failed to send satisfaction survey:', err.message);
  }
}

export async function sendMonthlyReport({ to, name, reportText, stats, pdfBuffer }) {
  try {
    const transporter = await getTransporter();
    if (!transporter) return;
    const cfg = await getConfig();
    const company = cfg.company_name || 'Sentinel IT';

    const { ticketStats = {}, monthKey = '' } = stats || {};
    const prevMonthLabel = monthKey
      ? new Date(monthKey + '-01').toLocaleString('en-US', { month: 'long', year: 'numeric' })
      : 'Monthly';

    const reportHtml = (reportText || '')
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff;">$1</strong>')
      .replace(/\n\n/g, '</p><p style="margin:0 0 12px;color:#aaa;line-height:1.6;">')
      .replace(/\n/g, '<br>');

    const attachments = pdfBuffer
      ? [{ filename: `sentinel-monthly-${monthKey}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
      : [];

    await transporter.sendMail({
      from: cfg.smtp_from || cfg.smtp_user,
      to,
      subject: `[${company}] ATLAS Monthly IT Report — ${prevMonthLabel}`,
      attachments,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;background:#0d0d0d;color:#e5e5e5;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1a3a1a,#2d6a2d);padding:24px 32px;">
            <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#4aaa4a;">ATLAS Intelligence</p>
            <h1 style="margin:0;font-size:22px;color:#fff;">${company} — Monthly Report</h1>
            <p style="margin:8px 0 0;font-size:13px;color:#a0d0a0;">${prevMonthLabel}</p>
          </div>
          <div style="padding:28px 32px;">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
              ${[
                ['Total Tickets', ticketStats.total || 0],
                ['Resolved', ticketStats.resolved || 0],
                ['ATLAS Handled', ticketStats.atlas_handled || 0],
              ].map(([label, val]) => `
                <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:14px;text-align:center;">
                  <div style="font-size:24px;font-weight:700;color:#4aaa4a;">${val}</div>
                  <div style="font-size:11px;color:#888;margin-top:2px;">${label}</div>
                </div>
              `).join('')}
            </div>
            <div style="background:#111;border:1px solid #222;border-radius:8px;padding:20px;margin-bottom:20px;">
              <p style="margin:0 0 14px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#4aaa4a;">ATLAS Monthly Analysis</p>
              <p style="margin:0 0 12px;color:#aaa;line-height:1.6;">${reportHtml}</p>
            </div>
            ${pdfBuffer ? '<p style="color:#666;font-size:12px;text-align:center;">Full PDF report attached.</p>' : ''}
            <p style="margin-top:16px;color:#555;font-size:12px;text-align:center;">
              Generated by ATLAS — ${company} IT Intelligence System
            </p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('[email] Failed to send monthly report:', err.message);
  }
}

export async function sendIncidentAlert({ to, name, title, description, category, count, companyName }) {
  try {
    const transporter = await getTransporter();
    if (!transporter) return;
    const cfg = await getConfig();
    const company = companyName || cfg.company_name || 'Sentinel IT';
    const appUrl = process.env.CLIENT_URL?.split(',')[0]?.trim() || 'http://localhost:5173';
    await transporter.sendMail({
      from: cfg.smtp_from || cfg.smtp_user,
      to,
      subject: `🚨 [${company}] Incident Alert: ${title}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0d0d0d;color:#e5e5e5;border-radius:12px;overflow:hidden;">
          <div style="background:#7f1d1d;padding:20px 32px;">
            <h1 style="margin:0;font-size:20px;color:#fff;">🚨 ${company} — Incident Alert</h1>
          </div>
          <div style="padding:32px;">
            <h2 style="margin-top:0;color:#ef4444;">${title}</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>ATLAS has detected a spike in ${category} tickets that may indicate a system-wide issue.</p>
            <div style="background:#1a1a1a;border:1px solid #7f1d1d;border-radius:8px;padding:16px;margin:20px 0;">
              <p style="margin:0 0 8px;"><strong>Category:</strong> ${category}</p>
              <p style="margin:0 0 8px;"><strong>Tickets in last 2 hours:</strong> ${count}</p>
              <p style="margin:0;color:#aaa;">${description}</p>
            </div>
            <a href="${appUrl}/admin/tickets"
               style="display:inline-block;background:#7f1d1d;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
              View Tickets →
            </a>
            <p style="color:#888;font-size:13px;">— ${company} ATLAS Monitoring</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('[email] Failed to send incident alert:', err.message);
  }
}

export async function sendPredictionBriefing({ to, name, briefingText, patterns, companyName }) {
  try {
    const transporter = await getTransporter();
    if (!transporter) return;
    const cfg = await getConfig();
    const company = companyName || cfg.company_name || 'Sentinel IT';
    const appUrl = process.env.CLIENT_URL?.split(',')[0]?.trim() || 'http://localhost:5173';

    const patternRows = patterns.slice(0, 5).map(p =>
      `<tr>
        <td style="padding:8px 12px;text-transform:capitalize;">${p.category}</td>
        <td style="padding:8px 12px;text-align:center;">${p.cnt}</td>
        <td style="padding:8px 12px;text-align:center;">${Math.round(p.avg_hours || 0)}h</td>
      </tr>`
    ).join('');

    const briefingHtml = briefingText
      .split('\n\n')
      .map(p => `<p>${p.trim()}</p>`)
      .join('');

    await transporter.sendMail({
      from: cfg.smtp_from || cfg.smtp_user,
      to,
      subject: `[${company}] ATLAS Weekly Prevention Briefing`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0d0d0d;color:#e5e5e5;border-radius:12px;overflow:hidden;">
          <div style="background:#1e3a5f;padding:20px 32px;">
            <h1 style="margin:0;font-size:20px;color:#fff;">🔮 ${company} — ATLAS Prevention Briefing</h1>
          </div>
          <div style="padding:32px;">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Here's your weekly ticket prevention analysis from ATLAS:</p>
            ${briefingHtml}
            <h3 style="color:#fff;margin-top:24px;">Top Categories (Last 30 Days)</h3>
            <table style="width:100%;border-collapse:collapse;background:#1a1a1a;border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#111;">
                  <th style="padding:8px 12px;text-align:left;color:#aaa;">Category</th>
                  <th style="padding:8px 12px;text-align:center;color:#aaa;">Tickets</th>
                  <th style="padding:8px 12px;text-align:center;color:#aaa;">Avg Resolve</th>
                </tr>
              </thead>
              <tbody>${patternRows}</tbody>
            </table>
            <p style="margin-top:24px;"><a href="${appUrl}/admin/analytics" style="color:#4aaa4a;">View Full Analytics →</a></p>
            <p style="color:#888;font-size:13px;">— ${company} ATLAS AI System</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('[email] Failed to send prediction briefing:', err.message);
  }
}

export async function sendPasswordResetEmail({ to, name, token }) {
  try {
    const transporter = await getTransporter();
    if (!transporter) return;
    const cfg = await getConfig();
    const company = cfg.company_name || 'Sentinel IT';
    const resetUrl = `${BASE_URL}/reset-password/${token}`;
    await transporter.sendMail({
      from: cfg.smtp_from || cfg.smtp_user,
      to,
      subject: `[${company}] Password Reset Request`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0d0d0d;color:#e5e5e5;border-radius:12px;overflow:hidden;">
          <div style="background:#2d6a2d;padding:20px 32px;">
            <h1 style="margin:0;font-size:20px;color:#fff;">${company}</h1>
          </div>
          <div style="padding:32px;">
            <h2 style="margin-top:0;color:#fff;">Password Reset</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>We received a request to reset your password. Click the button below to set a new one.</p>
            <a href="${resetUrl}"
               style="display:inline-block;background:#2d6a2d;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
              Reset My Password
            </a>
            <p style="color:#888;font-size:13px;">This link expires in 1 hour. If you did not request a reset, you can safely ignore this email.</p>
            <p style="margin-top:32px;color:#888;font-size:13px;">— ${company} Support Team</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('[email] Failed to send reset email:', err.message);
  }
}

export async function sendWelcomeEmail({ to, name, companyName, trialEnd }) {
  try {
    const transporter = await getTransporter();
    if (!transporter) return;
    const trialDate = new Date(trialEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const dashUrl = `${BASE_URL}/dashboard`;
    await transporter.sendMail({
      from: (await getConfig()).smtp_from || (await getConfig()).smtp_user,
      to,
      subject: `Welcome to Sentinel — your 14-day trial has started`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0d0d0d;color:#e5e5e5;border-radius:12px;overflow:hidden;">
          <div style="background:#2d6a2d;padding:24px 32px;">
            <h1 style="margin:0;font-size:22px;color:#fff;">Welcome to Sentinel</h1>
            <p style="margin:6px 0 0;color:#a7f3a7;font-size:14px;">AI-powered IT helpdesk</p>
          </div>
          <div style="padding:32px;">
            <h2 style="margin-top:0;color:#fff;">Hi ${name}, you're all set!</h2>
            <p>Your 14-day free trial for <strong>${companyName}</strong> is now active. No credit card required.</p>
            <div style="background:#1a1a1a;border:1px solid #2d6a2d;border-radius:8px;padding:16px;margin:20px 0;">
              <p style="margin:0 0 6px;color:#4aaa4a;font-weight:600;">Trial Details</p>
              <p style="margin:0;font-size:14px;">Expires: <strong>${trialDate}</strong></p>
              <p style="margin:4px 0 0;font-size:13px;color:#888;">Upgrade anytime to keep access.</p>
            </div>
            <p style="margin-bottom:6px;font-weight:600;color:#ccc;">Getting started:</p>
            <ol style="color:#aaa;font-size:14px;line-height:1.8;padding-left:20px;">
              <li>Set up your company profile and SMTP email settings</li>
              <li>Invite your IT staff and employees</li>
              <li>Submit your first ticket and watch ATLAS analyze it</li>
            </ol>
            <a href="${dashUrl}"
               style="display:inline-block;background:#2d6a2d;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:20px;">
              Open Dashboard
            </a>
            <p style="margin-top:32px;color:#888;font-size:13px;">Questions? Reply to this email and we'll help you get set up.</p>
            <p style="color:#888;font-size:13px;">— The Sentinel Team</p>
          </div>
        </div>
      `,
    });
  } catch (err) {
    console.error('[email] Failed to send welcome email:', err.message);
  }
}
