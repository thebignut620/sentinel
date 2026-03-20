import express from 'express';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import db from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Generate TOTP secret + QR code for setup
router.post('/setup', authenticate, async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
  if (user.totp_enabled) return res.status(409).json({ error: '2FA is already enabled' });

  const secret = speakeasy.generateSecret({ name: `Sentinel (${user.email})`, length: 20 });
  // Temporarily store the secret (not yet enabled)
  await db.run('UPDATE users SET totp_secret = ? WHERE id = ?', secret.base32, user.id);

  const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
  res.json({ secret: secret.base32, qrDataUrl });
});

// Verify code and activate 2FA
router.post('/enable', authenticate, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });

  const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
  if (!user.totp_secret) return res.status(400).json({ error: 'Run /setup first' });
  if (user.totp_enabled) return res.status(409).json({ error: '2FA already enabled' });

  const valid = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token: code, window: 1 });
  if (!valid) return res.status(400).json({ error: 'Invalid code — try again' });

  await db.run('UPDATE users SET totp_enabled = 1 WHERE id = ?', user.id);
  res.json({ ok: true });
});

// Disable 2FA
router.post('/disable', authenticate, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });

  const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
  if (!user.totp_enabled) return res.status(400).json({ error: '2FA is not enabled' });

  const valid = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token: code, window: 1 });
  if (!valid) return res.status(400).json({ error: 'Invalid code' });

  await db.run('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?', user.id);
  res.json({ ok: true });
});

// Get 2FA status for current user
router.get('/status', authenticate, async (req, res) => {
  const user = await db.get('SELECT totp_enabled FROM users WHERE id = ?', req.user.id);
  res.json({ enabled: !!user.totp_enabled });
});

export default router;
