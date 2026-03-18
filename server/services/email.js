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
