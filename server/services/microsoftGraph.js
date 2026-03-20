import db from '../db/connection.js';

const TENANT_ID      = () => process.env.MICROSOFT_TENANT_ID     || '';
const CLIENT_ID      = () => process.env.MICROSOFT_CLIENT_ID     || '';
const CLIENT_SECRET  = () => process.env.MICROSOFT_CLIENT_SECRET || '';
const REDIRECT_URI   = () => process.env.MICROSOFT_REDIRECT_URI  || '';

const SCOPES = [
  'https://graph.microsoft.com/User.ReadWrite.All',
  'https://graph.microsoft.com/Directory.Read.All',
  'https://graph.microsoft.com/Sites.FullControl.All',
  'offline_access',
].join(' ');

// ─── SAFETY LIMITS ────────────────────────────────────────────────────────────
// Hardcoded. Cannot be overridden by any config, prompt, or user action.
const SAFE_SP_ROLES = ['read', 'write', 'contribute'];
const ADMIN_ROLE_NAMES = ['Global Administrator', 'Company Administrator', 'Privileged Role Administrator'];

function assertNotGlobalAdmin(roleNames = []) {
  if (roleNames.some(r => ADMIN_ROLE_NAMES.includes(r))) {
    throw new Error('SAFETY_LIMIT: ATLAS cannot modify Microsoft 365 global admin accounts');
  }
}
// ATLAS is explicitly prohibited from: deleting accounts, modifying global admin accounts,
// accessing email content, or changing billing/license assignments.

// ─── OAUTH ────────────────────────────────────────────────────────────────────
export function getAuthUrl() {
  console.log('[Microsoft OAuth] tenant_id =', TENANT_ID(), '| redirect_uri =', REDIRECT_URI());
  const params = new URLSearchParams({
    client_id:     CLIENT_ID(),
    response_type: 'code',
    redirect_uri:  REDIRECT_URI(),
    scope:         SCOPES,
    response_mode: 'query',
    prompt:        'consent',
  });
  return `https://login.microsoftonline.com/${TENANT_ID()}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeCode(code) {
  const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
      code,
      redirect_uri:  REDIRECT_URI(),
      scope:         SCOPES,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`M365 token exchange failed: ${text}`);
  }
  return res.json();
}

export async function getIntegration() {
  return db.get(
    "SELECT * FROM integrations WHERE provider = 'microsoft' AND is_active = 1 ORDER BY connected_at DESC LIMIT 1",
  );
}

// ─── TOKEN MANAGEMENT ─────────────────────────────────────────────────────────
async function getAccessToken() {
  const integration = await getIntegration();
  if (!integration) throw new Error('Microsoft 365 not connected');

  const expiry = integration.token_expiry ? new Date(integration.token_expiry).getTime() : 0;
  const BUFFER = 5 * 60 * 1000; // refresh 5 minutes before expiry

  if (expiry - Date.now() < BUFFER && integration.refresh_token) {
    console.log('[M365] Token expiring soon, refreshing…');
    const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID()}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'refresh_token',
        client_id:     CLIENT_ID(),
        client_secret: CLIENT_SECRET(),
        refresh_token: integration.refresh_token,
        scope:         SCOPES,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`M365 token refresh failed: ${text}`);
    }
    const tokens = await res.json();
    const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await db.run(
      "UPDATE integrations SET access_token = ?, token_expiry = ?, last_sync_at = NOW() WHERE provider = 'microsoft' AND is_active = 1",
      tokens.access_token, newExpiry,
    );
    return tokens.access_token;
  }

  return integration.access_token;
}

// ─── GRAPH API HELPERS ────────────────────────────────────────────────────────
async function graphGet(path) {
  const token = await getAccessToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Graph API ${res.status}: ${path}`);
  }
  return res.json();
}

async function graphPatch(path, body) {
  const token = await getAccessToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Graph API PATCH ${res.status}: ${path}`);
  }
  return res.status === 204 ? null : res.json();
}

async function graphPost(path, body) {
  const token = await getAccessToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Graph API POST ${res.status}: ${path}`);
  }
  return res.status === 204 ? null : res.json();
}

// ─── USER LOOKUP ──────────────────────────────────────────────────────────────
export async function lookupUser(email) {
  try {
    const enc = encodeURIComponent(email);
    const [userRes, groupsRes, licensesRes] = await Promise.allSettled([
      graphGet(`/users/${enc}?$select=id,displayName,mail,accountEnabled,jobTitle,department,lastPasswordChangeDateTime,signInActivity`),
      graphGet(`/users/${enc}/memberOf?$select=displayName,@odata.type`),
      graphGet(`/users/${enc}/licenseDetails?$select=skuPartNumber`),
    ]);

    if (userRes.status === 'rejected' || !userRes.value) return null;
    const user = userRes.value;

    const groups = groupsRes.status === 'fulfilled' && groupsRes.value
      ? (groupsRes.value.value || [])
          .filter(g => g['@odata.type'] === '#microsoft.graph.group')
          .map(g => g.displayName)
      : [];

    const licenses = licensesRes.status === 'fulfilled' && licensesRes.value
      ? (licensesRes.value.value || []).map(l => l.skuPartNumber)
      : [];

    return {
      found:                true,
      full_name:            user.displayName,
      email:                user.mail || email,
      account_enabled:      !!user.accountEnabled,
      job_title:            user.jobTitle,
      department:           user.department,
      last_sign_in:         user.signInActivity?.lastSignInDateTime,
      last_password_change: user.lastPasswordChangeDateTime,
      groups,
      licenses,
    };
  } catch {
    return null;
  }
}

// ─── PASSWORD RESET ───────────────────────────────────────────────────────────
function generateTempPassword() {
  const upper   = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '!@#$';
  let pw = '';
  for (let i = 0; i < 4; i++) pw += upper[Math.floor(Math.random() * upper.length)];
  for (let i = 0; i < 4; i++) pw += lower[Math.floor(Math.random() * lower.length)];
  for (let i = 0; i < 2; i++) pw += digits[Math.floor(Math.random() * digits.length)];
  pw += special[Math.floor(Math.random() * special.length)];
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

export async function resetPassword(email) {
  const enc = encodeURIComponent(email);
  // Safety: verify not a global admin
  const rolesRes = await graphGet(`/users/${enc}/memberOf/microsoft.graph.directoryRole?$select=displayName`).catch(() => null);
  assertNotGlobalAdmin((rolesRes?.value || []).map(r => r.displayName));

  const tempPassword = generateTempPassword();
  await graphPatch(`/users/${enc}`, {
    passwordProfile: { password: tempPassword, forceChangePasswordNextSignIn: true },
  });

  await db.run("UPDATE integrations SET last_sync_at = NOW() WHERE provider = 'microsoft' AND is_active = 1");
  return { tempPassword };
}

// ─── ACCOUNT UNLOCK ───────────────────────────────────────────────────────────
export async function unlockAccount(email) {
  const enc = encodeURIComponent(email);
  // Safety: verify not a global admin
  const rolesRes = await graphGet(`/users/${enc}/memberOf/microsoft.graph.directoryRole?$select=displayName`).catch(() => null);
  assertNotGlobalAdmin((rolesRes?.value || []).map(r => r.displayName));

  await graphPatch(`/users/${enc}`, { accountEnabled: true });

  await db.run("UPDATE integrations SET last_sync_at = NOW() WHERE provider = 'microsoft' AND is_active = 1");
  return { userEmail: email };
}

// ─── SHAREPOINT ACCESS GRANT ──────────────────────────────────────────────────
export async function grantSharePointAccess(siteId, targetEmail, role = 'read') {
  if (!SAFE_SP_ROLES.includes(role)) {
    throw new Error('SAFETY_LIMIT: Invalid SharePoint permission role');
  }

  const user = await graphGet(`/users/${encodeURIComponent(targetEmail)}?$select=id`);
  if (!user) throw new Error(`User ${targetEmail} not found in Microsoft 365`);

  await graphPost(`/sites/${siteId}/permissions`, {
    roles: [role],
    grantedToIdentities: [{ user: { id: user.id, email: targetEmail } }],
  });

  await db.run("UPDATE integrations SET last_sync_at = NOW() WHERE provider = 'microsoft' AND is_active = 1");
  return { siteId, targetEmail, role };
}

// ─── TEAMS NOTIFICATION ───────────────────────────────────────────────────────
export async function sendTeamsNotification(message, title = 'ATLAS Notification') {
  try {
    const integration = await getIntegration();
    if (!integration) return;
    const metadata = integration.metadata ? JSON.parse(integration.metadata) : {};
    const webhookUrl = metadata.teams_webhook_url;
    if (!webhookUrl) return;

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        '@type':    'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: '0078D4',
        summary:    title,
        sections: [{
          activityTitle:    `🤖 ${title}`,
          activitySubtitle: new Date().toLocaleString(),
          activityText:     message,
        }],
      }),
    });
    if (!res.ok) console.warn('[M365 Teams] Webhook responded:', res.status);
  } catch (err) {
    console.error('[M365 Teams] Notification error:', err.message);
  }
}

// ─── ACTION TYPE DETECTION ────────────────────────────────────────────────────
export function detectActionType(title, description) {
  const text = `${title} ${description}`.toLowerCase();

  const pwdPatterns = [
    'locked out', 'lock out', "can't log in", 'cant log in', 'cannot log in',
    'forgot password', 'reset password', 'password expired', 'password not working',
    'account locked', 'locked account', "can't sign in", 'cant sign in',
    'login not working', 'password reset', 'login failed', 'unable to login',
    'unable to sign in', 'wrong password', 'password incorrect',
    'microsoft password', 'office password', 'outlook password',
    'office 365', 'microsoft 365', 'entra',
  ];

  const unlockPatterns = [
    'account suspended', 'suspended account', 'account disabled',
    'disabled account', 'account deactivated', 'deactivated account',
    'account blocked', 'account inactive', 'access revoked', 'been suspended',
    'microsoft account disabled', 'office account disabled', 'entra id disabled',
  ];

  const accessPatterns = [
    'need access to', 'request access', 'grant access',
    'give me access', 'sharepoint', 'onedrive',
    "can't access", 'cant access', 'need permission to',
    'request permission', 'no access to sharepoint', 'access to sharepoint',
    'onedrive access', 'sharepoint access', 'teams channel access',
  ];

  if (pwdPatterns.some(p => text.includes(p)))    return 'password_reset';
  if (unlockPatterns.some(p => text.includes(p))) return 'account_unlock';
  if (accessPatterns.some(p => text.includes(p))) return 'access_grant';
  return null;
}
