import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import db from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../services/email.js';
import { loginLimiter, forgotPasswordLimiter, signupLimiter } from '../middleware/rateLimiter.js';
import { isValidEmail, validatePasswordStrength } from '../middleware/sanitize.js';

const router = express.Router();

// ─── Brute-force protection ────────────────────────────────────────────────────
// In-memory store: email → { count, lockedUntil }
const loginAttempts = new Map();
const MAX_ATTEMPTS   = 5;
const LOCK_DURATION  = 30 * 60 * 1000; // 30 minutes

function getAttemptInfo(email) {
  return loginAttempts.get(email) || { count: 0, lockedUntil: null };
}

function recordFailedAttempt(email) {
  const info = getAttemptInfo(email);
  const count = info.count + 1;
  const lockedUntil = count >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION) : info.lockedUntil;
  loginAttempts.set(email, { count, lockedUntil });
  return { count, lockedUntil };
}

function clearAttempts(email) {
  loginAttempts.delete(email);
}

function isLocked(email) {
  const { lockedUntil } = getAttemptInfo(email);
  if (!lockedUntil) return null;
  if (Date.now() < lockedUntil.getTime()) return lockedUntil;
  loginAttempts.delete(email); // lock expired
  return null;
}

// ─── JWT helpers ───────────────────────────────────────────────────────────────
function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, company_id: user.company_id || 1 },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

async function createRefreshToken(userId) {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  await db.run(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    userId, token, expiresAt
  );
  return token;
}

// ─── POST /login ───────────────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password, totp_code } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const normalEmail = email.toLowerCase().trim();

  // Brute-force check
  const lockedUntil = isLocked(normalEmail);
  if (lockedUntil) {
    const minutesLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
    return res.status(423).json({
      error: `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
      lockedUntil: lockedUntil.toISOString(),
    });
  }

  const user = await db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', normalEmail);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    const { count, lockedUntil: newLock } = recordFailedAttempt(normalEmail);
    await logAudit(req, {
      action: 'auth.login_failed',
      entityType: 'user',
      details: { email: normalEmail, attempt: count, locked: !!newLock },
    });
    if (newLock) {
      const minutesLeft = Math.ceil((newLock.getTime() - Date.now()) / 60000);
      return res.status(423).json({
        error: `Too many failed attempts. Account locked for ${minutesLeft} minutes.`,
        lockedUntil: newLock.toISOString(),
      });
    }
    const remaining = MAX_ATTEMPTS - count;
    return res.status(401).json({
      error: remaining > 0
        ? `Invalid email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
        : 'Invalid email or password.',
    });
  }

  // 2FA check
  if (user.totp_enabled) {
    if (!totp_code) return res.status(200).json({ requires_2fa: true });
    const valid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: String(totp_code),
      window: 1,
    });
    if (!valid) {
      await logAudit(req, { action: 'auth.2fa_failed', entityType: 'user', entityId: user.id });
      return res.status(401).json({ error: 'Invalid authenticator code' });
    }
  }

  clearAttempts(normalEmail);

  const token = signAccessToken(user);
  const refreshToken = await createRefreshToken(user.id);

  res.json({
    token,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, company_id: user.company_id || 1 },
  });
});

// ─── POST /refresh — issue new access token using refresh token ────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  const row = await db.get(
    `SELECT rt.*, u.id as uid, u.email, u.role, u.name, u.is_active, u.company_id
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.token = ? AND rt.revoked = 0 AND rt.expires_at > NOW()`,
    refreshToken
  );

  if (!row || !row.is_active) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const token = signAccessToken({ id: row.uid, email: row.email, role: row.role, name: row.name, company_id: row.company_id || 1 });
  res.json({ token });
});

// ─── GET /me ───────────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const user = await db.get(
    'SELECT id, name, email, role, company_id, created_at FROM users WHERE id = ?',
    req.user.id
  );
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ─── POST /forgot-password ─────────────────────────────────────────────────────
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body;
  console.log('[forgot-password] request received for:', email);
  if (!email) return res.status(400).json({ error: 'Email required' });

  const user = await db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', email.toLowerCase().trim());
  // Always respond OK — prevent email enumeration
  if (!user) {
    console.log('[forgot-password] no active user found for email, returning ok silently');
    return res.json({ ok: true });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await db.run(
    'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    user.id, token, expiresAt
  );

  console.log('[forgot-password] reset token created, attempting to send email to:', user.email);
  try {
    await sendPasswordResetEmail({ to: user.email, name: user.name, token, companyId: user.company_id || 1 });
    console.log('[forgot-password] email sent successfully to:', user.email);
  } catch (err) {
    console.error('[forgot-password] failed to send reset email:', err.message, err.stack);
  }
  res.json({ ok: true });
});

// ─── POST /reset-password ──────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });

  const strengthError = validatePasswordStrength(password);
  if (strengthError) return res.status(400).json({ error: strengthError });

  const row = await db.get(
    'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > NOW()',
    token
  );
  if (!row) return res.status(400).json({ error: 'Invalid or expired reset link' });

  const hash = bcrypt.hashSync(password, 10);
  await db.run('UPDATE users SET password = ? WHERE id = ?', hash, row.user_id);
  await db.run('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', row.id);

  // Revoke all refresh tokens for this user on password reset (security)
  await db.run('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', row.user_id);

  res.json({ ok: true });
});

// ─── POST /logout — revoke refresh token ──────────────────────────────────────
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await db.run('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?', refreshToken).catch(() => {});
  }
  res.json({ ok: true });
});

// ─── POST /signup ──────────────────────────────────────────────────────────────
router.post('/signup', signupLimiter, async (req, res) => {
  const { companyName, adminName, email, password } = req.body;
  if (!companyName || !adminName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const strengthError = validatePasswordStrength(password);
  if (strengthError) return res.status(400).json({ error: strengthError });

  try {
    const existing = await db.get('SELECT id FROM users WHERE email = ?', email.toLowerCase().trim());
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const hash = bcrypt.hashSync(password, 10);
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    // Create slug from company name
    const slug = companyName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const uniqueSlug = slug + '-' + Date.now();

    // Create company
    const companyResult = await db.run(
      `INSERT INTO companies (name, slug) VALUES (?, ?) RETURNING id`,
      companyName.trim(), uniqueSlug
    );
    const companyId = companyResult.lastInsertRowid;

    // Create admin user
    const userResult = await db.run(
      `INSERT INTO users (name, email, password, role, is_active, company_id) VALUES (?, ?, ?, 'admin', 1, ?)`,
      adminName.trim(), email.toLowerCase().trim(), hash, companyId
    );
    const userId = userResult.lastInsertRowid;

    // Seed company-specific settings
    const seeds = [
      ['company_name', companyName.trim()],
      ['subscription_plan', 'trial'],
      ['subscription_status', 'trialing'],
      ['trial_ends_at', trialEnd],
      ['ai_enabled', 'true'],
      ['smtp_host', ''],
      ['smtp_port', '587'],
      ['smtp_user', ''],
      ['smtp_pass', ''],
      ['smtp_from', ''],
      ['smtp_secure', 'false'],
      ['slack_webhook_url', ''],
      ['slack_channel', ''],
      ['slack_enabled', 'false'],
      ['email_ingestion_enabled', 'false'],
      ['imap_host', ''],
      ['imap_user', ''],
      ['imap_pass', ''],
      ['imap_port', '993'],
      ['pagerduty_routing_key', ''],
      ['pagerduty_enabled', 'false'],
      ['jira_host', ''],
      ['jira_email', ''],
      ['jira_token', ''],
      ['jira_project', ''],
      ['jira_enabled', 'false'],
      ['atlas_custom_instructions', ''],
      ['weekly_briefing_enabled', 'true'],
      ['health_score_alert_threshold', '70'],
    ];
    for (const [key, value] of seeds) {
      await db.run(
        `INSERT INTO settings (company_id, key, value) VALUES (?, ?, ?) ON CONFLICT (company_id, key) DO UPDATE SET value = EXCLUDED.value`,
        companyId, key, value
      );
    }

    // Send welcome email
    try {
      await sendWelcomeEmail({ to: email.toLowerCase(), name: adminName.trim(), companyName: companyName.trim(), trialEnd });
    } catch (e) {
      console.error('[signup] welcome email failed:', e.message);
    }

    // Notify Sentinel admin of new signup
    setImmediate(async () => {
      try {
        const nodemailer = await import('nodemailer');
        if (process.env.NOTIFY_EMAIL && process.env.NOTIFY_SMTP_HOST) {
          const notifyTransport = nodemailer.default.createTransport({
            host: process.env.NOTIFY_SMTP_HOST,
            port: parseInt(process.env.NOTIFY_SMTP_PORT || '587'),
            secure: process.env.NOTIFY_SMTP_SECURE === 'true',
            auth: { user: process.env.NOTIFY_SMTP_USER, pass: process.env.NOTIFY_SMTP_PASS },
          });
          await notifyTransport.sendMail({
            from: process.env.NOTIFY_SMTP_USER,
            to: 'iguinn141@gmail.com',
            subject: `New Sentinel signup: ${companyName.trim()}`,
            html: `<p>New company signup:</p><ul><li><strong>Company:</strong> ${companyName.trim()}</li><li><strong>Admin:</strong> ${adminName.trim()}</li><li><strong>Email:</strong> ${email.toLowerCase().trim()}</li><li><strong>Signed up:</strong> ${new Date().toISOString()}</li></ul>`,
          });
        } else {
          console.log(`[signup] NEW COMPANY: ${companyName.trim()} | Admin: ${adminName.trim()} | Email: ${email.toLowerCase().trim()}`);
        }
      } catch(e) {
        console.error('[signup] notification email error:', e.message);
      }
    });

    const token = jwt.sign(
      { id: userId, email: email.toLowerCase().trim(), role: 'admin', name: adminName.trim(), company_id: companyId },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    const refreshToken = await createRefreshToken(userId);

    res.status(201).json({
      token,
      refreshToken,
      user: { id: userId, name: adminName.trim(), email: email.toLowerCase().trim(), role: 'admin', company_id: companyId },
    });
  } catch (err) {
    console.error('[signup] error:', err.message);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

export default router;
