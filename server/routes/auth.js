import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';
import { sendPasswordResetEmail } from '../services/email.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = await db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
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
    "SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')",
    token
  );
  if (!row) return res.status(400).json({ error: 'Invalid or expired reset link' });

  const hash = bcrypt.hashSync(password, 10);
  await db.run('UPDATE users SET password = ? WHERE id = ?', hash, row.user_id);
  await db.run('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', row.id);

  res.json({ ok: true });
});

export default router;
