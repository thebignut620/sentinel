/**
 * SSO routes — Google and Microsoft login
 * Handles OAuth login (separate from workspace integrations).
 * On first login, auto-creates an employee account.
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import db from '../db/connection.js';

const router = express.Router();
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ─── GOOGLE SSO ───────────────────────────────────────────────────────────────

function getGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_SSO_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_SSO_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.SERVER_URL || 'http://localhost:3001'}/api/sso/google/callback`
  );
}

router.get('/google/url', (req, res) => {
  const client = getGoogleOAuthClient();
  if (!client._clientId) return res.status(501).json({ error: 'Google SSO not configured' });
  const url = client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
  });
  res.json({ url });
});

router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect(`${CLIENT_URL}/login?sso_error=denied`);

  try {
    const client = getGoogleOAuthClient();
    const { tokens } = await client.getToken(String(code));
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    const { email, name, sub: googleId } = data;

    let user = await db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', email);

    if (!user) {
      // Auto-create employee account
      const r = await db.run(
        `INSERT INTO users (name, email, password, role, sso_provider, sso_id)
         VALUES (?, ?, '', 'employee', 'google', ?)`,
        name || email.split('@')[0], email, googleId
      );
      user = await db.get('SELECT * FROM users WHERE id = ?', r.lastID);
    } else if (!user.sso_id) {
      await db.run("UPDATE users SET sso_provider = 'google', sso_id = ? WHERE id = ?", googleId, user.id);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.redirect(`${CLIENT_URL}/sso-callback?token=${token}`);
  } catch (err) {
    console.error('[SSO Google] error:', err.message);
    res.redirect(`${CLIENT_URL}/login?sso_error=failed`);
  }
});

// ─── MICROSOFT SSO ────────────────────────────────────────────────────────────

function getMsLoginUrl() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  const redirectUri = encodeURIComponent(
    `${process.env.SERVER_URL || 'http://localhost:3001'}/api/sso/microsoft/callback`
  );
  const scopes = encodeURIComponent('openid email profile User.Read');
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scopes}&response_mode=query&prompt=select_account`;
}

router.get('/microsoft/url', (req, res) => {
  if (!process.env.MICROSOFT_CLIENT_ID) return res.status(501).json({ error: 'Microsoft SSO not configured' });
  res.json({ url: getMsLoginUrl() });
});

router.get('/microsoft/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect(`${CLIENT_URL}/login?sso_error=denied`);

  try {
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    const redirectUri = `${process.env.SERVER_URL || 'http://localhost:3001'}/api/sso/microsoft/callback`;

    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        code:          String(code),
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
        scope:         'openid email profile User.Read',
      }).toString(),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error(tokens.error_description || 'Token exchange failed');

    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();
    const email = profile.mail || profile.userPrincipalName;
    const name  = profile.displayName || email.split('@')[0];
    const msId  = profile.id;

    let user = await db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', email);
    if (!user) {
      const r = await db.run(
        `INSERT INTO users (name, email, password, role, sso_provider, sso_id)
         VALUES (?, ?, '', 'employee', 'microsoft', ?)`,
        name, email, msId
      );
      user = await db.get('SELECT * FROM users WHERE id = ?', r.lastID);
    } else if (!user.sso_id) {
      await db.run("UPDATE users SET sso_provider = 'microsoft', sso_id = ? WHERE id = ?", msId, user.id);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.redirect(`${CLIENT_URL}/sso-callback?token=${token}`);
  } catch (err) {
    console.error('[SSO Microsoft] error:', err.message);
    res.redirect(`${CLIENT_URL}/login?sso_error=failed`);
  }
});

export default router;
