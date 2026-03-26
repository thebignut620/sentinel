import { google } from 'googleapis';
import db from '../db/connection.js';

export const SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
  'https://www.googleapis.com/auth/drive',
];

// ─── SAFETY LIMITS ────────────────────────────────────────────────────────────
// Hardcoded. Cannot be overridden by any config, prompt, or user action.
const SAFE_DRIVE_ROLES = ['reader', 'commenter', 'writer'];
function assertNotAdmin(user) {
  if (user?.isAdmin || user?.isDelegatedAdmin) {
    throw new Error('SAFETY_LIMIT: ATLAS cannot modify Google Workspace admin accounts');
  }
}
// ATLAS is explicitly prohibited from: deleting accounts, modifying admin accounts,
// changing billing settings, or accessing email content.

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export function getAuthUrl(companyId = 1) {
  const client = createOAuthClient();
  console.log('[Google OAuth] redirect_uri =', process.env.GOOGLE_REDIRECT_URI);
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // force refresh_token to always be returned
    state: String(companyId),
  });
}

export async function exchangeCode(code) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function getIntegration(companyId = 1) {
  return db.get(
    "SELECT * FROM integrations WHERE provider = 'google' AND is_active = 1 AND company_id = ? ORDER BY connected_at DESC LIMIT 1",
    companyId,
  );
}

async function getAuthorizedClient(companyId = 1) {
  const integration = await getIntegration(companyId);
  if (!integration) throw new Error('Google Workspace not connected');

  const client = createOAuthClient();
  client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
    expiry_date: integration.token_expiry
      ? new Date(integration.token_expiry).getTime()
      : undefined,
  });

  // Automatically persist refreshed tokens back to DB
  client.on('tokens', async (tokens) => {
    const updates = ['last_sync_at = NOW()'];
    const vals = [];
    if (tokens.access_token) { updates.push('access_token = ?'); vals.push(tokens.access_token); }
    if (tokens.expiry_date) {
      updates.push('token_expiry = ?');
      vals.push(new Date(tokens.expiry_date).toISOString());
    }
    if (vals.length) {
      await db.run(
        `UPDATE integrations SET ${updates.join(', ')} WHERE provider = 'google' AND is_active = 1 AND company_id = ?`,
        ...vals, companyId,
      );
    }
  });

  return client;
}

// ─── USER LOOKUP ──────────────────────────────────────────────────────────────
export async function lookupUser(email, companyId = 1) {
  try {
    const auth = await getAuthorizedClient(companyId);
    const admin = google.admin({ version: 'directory_v1', auth });

    const [userRes, groupsRes] = await Promise.allSettled([
      admin.users.get({ userKey: email }),
      admin.groups.list({ userKey: email, maxResults: 20 }),
    ]);

    if (userRes.status === 'rejected') return null;

    const user = userRes.value.data;
    const groups = groupsRes.status === 'fulfilled'
      ? (groupsRes.value.data.groups || []).map(g => g.email)
      : [];

    return {
      found: true,
      full_name: user.name?.fullName,
      email: user.primaryEmail,
      suspended: !!user.suspended,
      org_unit: user.orgUnitPath,
      last_login: user.lastLoginTime,
      creation_time: user.creationTime,
      groups,
      is_admin: !!(user.isAdmin || user.isDelegatedAdmin),
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
  // Shuffle for unpredictability
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

export async function resetPassword(email, companyId = 1) {
  const auth = await getAuthorizedClient(companyId);
  const admin = google.admin({ version: 'directory_v1', auth });

  const userRes = await admin.users.get({ userKey: email });
  assertNotAdmin(userRes.data); // SAFETY LIMIT: no admin account resets

  const tempPassword = generateTempPassword();
  await admin.users.update({
    userKey: email,
    requestBody: {
      password: tempPassword,
      changePasswordAtNextLogin: true,
    },
  });

  await db.run(
    "UPDATE integrations SET last_sync_at = NOW() WHERE provider = 'google' AND is_active = 1 AND company_id = ?",
    companyId,
  );
  return { tempPassword };
}

// ─── ACCOUNT UNLOCK ───────────────────────────────────────────────────────────
export async function unlockAccount(email, companyId = 1) {
  const auth = await getAuthorizedClient(companyId);
  const admin = google.admin({ version: 'directory_v1', auth });

  const userRes = await admin.users.get({ userKey: email });
  assertNotAdmin(userRes.data); // SAFETY LIMIT: no admin account unlocks

  await admin.users.update({
    userKey: email,
    requestBody: { suspended: false },
  });

  await db.run(
    "UPDATE integrations SET last_sync_at = NOW() WHERE provider = 'google' AND is_active = 1 AND company_id = ?",
    companyId,
  );
  return { userEmail: email };
}

// ─── DRIVE ACCESS GRANT ───────────────────────────────────────────────────────
export async function grantDriveAccess(fileId, targetEmail, role = 'reader', companyId = 1) {
  // SAFETY LIMIT: only safe roles allowed — never owner
  if (!SAFE_DRIVE_ROLES.includes(role)) {
    throw new Error('SAFETY_LIMIT: Invalid Drive permission role');
  }

  const auth = await getAuthorizedClient(companyId);
  const drive = google.drive({ version: 'v3', auth });

  await drive.permissions.create({
    fileId,
    requestBody: { type: 'user', role, emailAddress: targetEmail },
    sendNotificationEmail: true,
    fields: 'id',
  });

  await db.run(
    "UPDATE integrations SET last_sync_at = NOW() WHERE provider = 'google' AND is_active = 1 AND company_id = ?",
    companyId,
  );
  return { fileId, targetEmail, role };
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
  ];

  const unlockPatterns = [
    'account suspended', 'suspended account', 'account disabled',
    'disabled account', 'account deactivated', 'deactivated account',
    'account blocked', 'account inactive', 'access revoked', 'been suspended',
  ];

  const accessPatterns = [
    'need access to', 'request access', 'grant access',
    'give me access', 'share drive', 'drive access', 'folder access',
    "can't access drive", 'cant access drive', 'need permission to',
    'request permission', 'no access to drive', 'access to the drive',
    'access to shared drive',
  ];

  if (pwdPatterns.some(p => text.includes(p)))    return 'password_reset';
  if (unlockPatterns.some(p => text.includes(p))) return 'account_unlock';
  if (accessPatterns.some(p => text.includes(p))) return 'access_grant';
  return null;
}
