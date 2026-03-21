import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import db from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../services/email.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password, totp_code } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = await db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // If 2FA is enabled, require TOTP code
  if (user.totp_enabled) {
    if (!totp_code) {
      // Signal to the client that 2FA is required
      return res.status(200).json({ requires_2fa: true });
    }
    const valid = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: String(totp_code),
      window: 1,
    });
    if (!valid) return res.status(401).json({ error: 'Invalid authenticator code' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

router.get('/me', authenticate, async (req, res) => {
  const user = await db.get(
    'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
    req.user.id
  );
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const user = await db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', email);
  // Always respond OK to prevent email enumeration
  if (!user) return res.json({ ok: true });

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  await db.run(
    'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    user.id, token, expiresAt
  );

  await sendPasswordResetEmail({ to: user.email, name: user.name, token });
  res.json({ ok: true });
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const row = await db.get(
    'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > NOW()',
    token
  );
  if (!row) return res.status(400).json({ error: 'Invalid or expired reset link' });

  const hash = bcrypt.hashSync(password, 10);
  await db.run('UPDATE users SET password = ? WHERE id = ?', hash, row.user_id);
  await db.run('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', row.id);

  res.json({ ok: true });
});

// POST /signup — self-serve company signup, starts 14-day free trial
router.post('/signup', async (req, res) => {
  const { companyName, adminName, email, password } = req.body;
  if (!companyName || !adminName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await db.get(`SELECT id FROM users WHERE email = ?`, email.toLowerCase());
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const hash = bcrypt.hashSync(password, 10);
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const result = await db.run(
      `INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, 'admin', 1)`,
      adminName, email.toLowerCase(), hash
    );
    const userId = result.lastInsertRowid;

    const seeds = [
      ['company_name',        companyName],
      ['subscription_plan',   'trial'],
      ['subscription_status', 'trialing'],
      ['trial_ends_at',       trialEnd],
    ];
    for (const [key, value] of seeds) {
      await db.run(
        `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        key, value
      );
    }

    try {
      await sendWelcomeEmail({ to: email.toLowerCase(), name: adminName, companyName, trialEnd });
    } catch (e) {
      console.error('[Signup] welcome email failed:', e.message);
    }

    const token = jwt.sign(
      { id: userId, email: email.toLowerCase(), role: 'admin', name: adminName },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.status(201).json({
      token,
      user: { id: userId, name: adminName, email: email.toLowerCase(), role: 'admin' },
    });
  } catch (err) {
    console.error('[Signup] error:', err.message);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

export default router;
