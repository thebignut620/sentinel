import nodemailer from 'nodemailer';
import db from '../db/connection.js';

async function getTransporter(companyId = 1) {
  const rows = await db.all("SELECT key, value FROM settings WHERE company_id = ? AND key LIKE 'smtp_%'", companyId);
  const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
  if (!cfg.smtp_host || !cfg.smtp_user) {
    console.warn('[email] SMTP not configured — smtp_host or smtp_user missing from settings table. Email will not send.');
    return null;
  }
  console.log(`[email] SMTP config found: host=${cfg.smtp_host} port=${cfg.smtp_port || 587} user=${cfg.smtp_user}`);
  return nodemailer.createTransport({
    host: cfg.smtp_host,
    port: parseInt(cfg.smtp_port || '587'),
    secure: cfg.smtp_secure === 'true',
    auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
  });
}

async function getConfig(companyId = 1) {
  const rows = await db.all('SELECT key, value FROM settings WHERE company_id = ?', companyId);
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

const BASE_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ─── Shared HTML shell ────────────────────────────────────────────────────────
function emailShell({ company, title, previewText, body, footerText = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <!-- Preview text (hidden) -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText}</span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background:#111;border:1px solid #1f2937;border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f2010,#1a3a1a,#0f2010);padding:24px 32px;border-bottom:1px solid #1a3a1a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display:inline-flex;align-items:center;gap:10px;">
                      <div style="width:32px;height:32px;background:#2d6a2d;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;line-height:32px;text-align:center;">🛡️</div>
                      <div>
                        <div style="font-size:16px;font-weight:700;color:#fff;letter-spacing:-0.3px;">${company}</div>
                        <div style="font-size:10px;color:#4aaa4a;text-transform:uppercase;letter-spacing:1.5px;">IT Helpdesk</div>
                      </div>
                    </div>
                  </td>
                  <td align="right">
                    <div style="font-size:10px;color:#374151;text-transform:uppercase;letter-spacing:1px;">ATLAS</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #1f2937;background:#0d0d0d;">
              <p style="margin:0;font-size:11px;color:#374151;text-align:center;line-height:1.6;">
                ${footerText || `You're receiving this from ${company} IT Support.`}<br>
                <a href="${BASE_URL}" style="color:#4a7a4a;text-decoration:none;">Sentinel IT Helpdesk</a>
                &nbsp;·&nbsp;
                <a href="${BASE_URL}/status" style="color:#4a7a4a;text-decoration:none;">System Status</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────
function emailButton(href, label, color = '#2d6a2d') {
  return `<a href="${href}"
    style="display:inline-block;background:${color};color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:-0.2px;">
    ${label} →
  </a>`;
}

function emailInfoBox(rows) {
  const inner = rows.map(([label, val, highlight]) => `
    <tr>
      <td style="padding:8px 16px;border-bottom:1px solid #1f2937;font-size:12px;color:#6b7280;white-space:nowrap;">${label}</td>
      <td style="padding:8px 16px;border-bottom:1px solid #1f2937;font-size:13px;color:${highlight ? '#4aaa4a' : '#e5e7eb'};font-weight:${highlight ? '600' : '400'};text-transform:${highlight ? 'capitalize' : 'none'};">${val}</td>
    </tr>
  `).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;border:1px solid #1f2937;border-radius:10px;overflow:hidden;margin:20px 0;">${inner}</table>`;
}

export async function sendTicketStatusEmail({ to, name, ticketId, title, newStatus, companyId = 1 }) {
  try {
    const transporter = await getTransporter(companyId);
    if (!transporter) return;
    const cfg = await getConfig(companyId);
    const company = cfg.company_name || 'Sentinel IT';
    const statusLabel = newStatus.replace('_', ' ');
    const isResolved = ['resolved', 'closed'].includes(newStatus);

    const body = `
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#fff;">
        ${isResolved ? '✅ Your ticket has been resolved' : '🔔 Ticket status update'}
      </h2>
      <p style="margin:0 0 24px;font-size:14px;color:#9ca3af;">Hi <strong style="color:#e5e7eb;">${name}</strong>, here's the latest on your request.</p>

      ${emailInfoBox([
        ['Ticket', `#${ticketId} — ${title}`],
        ['Status', statusLabel, true],
      ])}

      <p style="margin:0 0 24px;font-size:13px;color:#6b7280;line-height:1.6;">
        ${isResolved
          ? 'We hope this resolved your issue. If you need any further assistance, feel free to open a new request.'
          : 'Our team is working on your request. We\'ll keep you posted on any updates.'}
      </p>

      ${emailButton(`${BASE_URL}/tickets/${ticketId}`, 'View ticket')}
    `;

    await transporter.sendMail({
      from: cfg.smtp_from || cfg.smtp_user,
      to,
      subject: isResolved
        ? `✅ Resolved: ${title} (#${ticketId})`
        : `[${company}] Ticket #${ticketId} — ${statusLabel}`,
      html: emailShell({
        company,
        title: `Ticket #${ticketId} update`,
        previewText: `Your ticket #${ticketId} status changed to ${statusLabel}`,
        body,
      }),
    });
  } catch (err) {
    console.error('[email] Failed to send status email:', err.message);
  }
}

export async function sendWeeklyReport({ to, name, report, stats, companyId = 1 }) {
  try {
    const transporter = await getTransporter(companyId);
    if (!transporter) return;
    const cfg = await getConfig(companyId);
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

export async function sendGoogleTempPassword({ to, name, tempPassword, ticketId, companyId = 1 }) {
  try {
    const transporter = await getTransporter(companyId);
    if (!transporter) return;
    const cfg = await getConfig(companyId);
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

export async function sendMicrosoftTempPassword({ to, name, tempPassword, ticketId, companyId = 1 }) {
  try {
    const transporter = await getTransporter(companyId);
    if (!transporter) return;
    const cfg = await getConfig(companyId);
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

export async function sendSatisfactionSurvey({ to, name, ticketId, ticketTitle, token, companyId = 1 }) {
  try {
    const transporter = await getTransporter(companyId);
    if (!transporter) return;
    const cfg = await getConfig(companyId);
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

export async function sendMonthlyReport({ to, name, reportText, stats, pdfBuffer, companyId = 1 }) {
  try {
    const transporter = await getTransporter(companyId);
    if (!transporter) return;
    const cfg = await getConfig(companyId);
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

export async function sendIncidentAlert({ to, name, title, description, category, count, companyName, companyId = 1 }) {
  try {
    const transporter = await getTransporter(companyId);
    if (!transporter) return;
    const cfg = await getConfig(companyId);
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

export async function sendPredictionBriefing({ to, name, briefingText, patterns, companyName, companyId = 1 }) {
  try {
    const transporter = await getTransporter(companyId);
    if (!transporter) return;
    const cfg = await getConfig(companyId);
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

export async function sendPasswordResetEmail({ to, name, token, companyId = 1 }) {
  console.log('[email:password-reset] attempting to send to:', to);
  try {
    const transporter = await getTransporter(companyId);
    if (!transporter) {
      console.warn('[email:password-reset] no transporter — SMTP not configured. Configure smtp_host, smtp_user, smtp_pass in Admin → Settings.');
      return;
    }
    const cfg = await getConfig(companyId);
    const company = cfg.company_name || 'Sentinel IT';
    const resetUrl = `${BASE_URL}/reset-password/${token}`;

    const body = `
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#fff;">🔑 Reset your password</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#9ca3af;">Hi <strong style="color:#e5e7eb;">${name}</strong>, we got your reset request.</p>
      <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px;">
        Click the button below to choose a new password. This link expires in <strong style="color:#e5e7eb;">1 hour</strong>.
      </p>
      ${emailButton(resetUrl, 'Set new password')}
      <p style="margin-top:24px;font-size:12px;color:#4b5563;line-height:1.6;">
        Didn't request this? You can safely ignore this email. Your password won't change.
      </p>
    `;

    await transporter.sendMail({
      from: cfg.smtp_from || cfg.smtp_user,
      to,
      subject: `Reset your ${company} password`,
      html: emailShell({
        company,
        title: 'Password Reset',
        previewText: 'Someone requested a password reset for your account.',
        body,
        footerText: `For security, this link expires in 1 hour. If you didn't request this, ignore this email.`,
      }),
    });
  } catch (err) {
    console.error('[email:password-reset] failed to send to', to, '—', err.message);
    console.error('[email:password-reset] full error:', err);
    throw err; // re-throw so the caller can log it too
  }
}

export async function sendWelcomeEmail({ to, name, companyName, trialEnd, companyId = 1 }) {
  try {
    const transporter = await getTransporter(companyId);
    if (!transporter) return;
    const cfg = await getConfig(companyId);
    const trialDate = new Date(trialEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const dashUrl = `${BASE_URL}/dashboard`;

    const body = `
      <h2 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#fff;">Welcome aboard, ${name}! 🎉</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Your 14-day free trial for <strong style="color:#e5e7eb;">${companyName}</strong> is live. No credit card needed.</p>

      <div style="background:#0d1a0d;border:1px solid #1a4a1a;border-radius:12px;padding:20px;margin:0 0 24px;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#4aaa4a;">Trial active until ${trialDate}</p>
        <p style="margin:0;font-size:13px;color:#6b7280;">Upgrade anytime from your billing dashboard to keep access and unlock unlimited users.</p>
      </div>

      <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#d1d5db;">Get started in 3 steps:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;">
        ${[
          ['1', 'Set up your company profile and SMTP settings', `${BASE_URL}/admin/company-profile`],
          ['2', 'Invite your IT staff and employees', `${BASE_URL}/admin/users`],
          ['3', 'Submit a test ticket and watch ATLAS work its magic', `${BASE_URL}/help`],
        ].map(([num, text, link]) => `
          <tr>
            <td style="padding:8px 0;vertical-align:top;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:28px;height:28px;background:#1a3a1a;border-radius:50%;text-align:center;vertical-align:middle;font-size:12px;font-weight:700;color:#4aaa4a;padding-right:12px;">${num}</td>
                  <td style="font-size:13px;color:#9ca3af;line-height:1.5;">
                    ${text} — <a href="${link}" style="color:#4aaa4a;text-decoration:none;">Go →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        `).join('')}
      </table>

      ${emailButton(dashUrl, 'Open my dashboard')}

      <p style="margin-top:24px;font-size:12px;color:#4b5563;line-height:1.6;">
        Questions? Just reply to this email — we read every one.
      </p>
    `;

    await transporter.sendMail({
      from: cfg.smtp_from || cfg.smtp_user,
      to,
      subject: `Welcome to Sentinel — your free trial is live 🚀`,
      html: emailShell({
        company: 'Sentinel',
        title: 'Welcome to Sentinel',
        previewText: `Your 14-day free trial for ${companyName} is now active. No credit card required.`,
        body,
        footerText: `You're receiving this because you signed up for Sentinel IT Helpdesk.`,
      }),
    });
  } catch (err) {
    console.error('[email] Failed to send welcome email:', err.message);
  }
}
