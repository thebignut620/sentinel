// Strip HTML tags and common XSS vectors from a string
function stripHtml(str) {
  return str
    .replace(/<[^>]*>/g, '')          // remove HTML tags
    .replace(/javascript:/gi, '')      // remove javascript: URIs
    .replace(/on\w+\s*=/gi, '')        // remove inline event handlers
    .trim();
}

function sanitizeValue(val) {
  if (typeof val === 'string') return stripHtml(val);
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (val !== null && typeof val === 'object') return sanitizeObject(val);
  return val;
}

// Fields that must never be sanitized — passwords are hashed/compared as-is,
// tokens are opaque, and the XSS regex can corrupt them (e.g. strips "onclick=" patterns)
const SKIP_SANITIZE = new Set([
  'password', 'currentPassword', 'newPassword', 'confirmPassword',
  'token', 'totp_code', 'backup_code',
]);

function sanitizeObject(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SKIP_SANITIZE.has(k) ? v : sanitizeValue(v);
  }
  return out;
}

// Applied globally after express.json() — strips HTML from all body string fields
export function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object' && !(req.body instanceof Buffer)) {
    req.body = sanitizeObject(req.body);
  }
  next();
}

// Email format validation
export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

// Numeric ID validation — rejects anything that's not a positive integer string
export function isValidId(id) {
  return /^\d+$/.test(String(id)) && parseInt(id, 10) > 0;
}

// Password strength: 8+ chars, 1 uppercase, 1 number
export function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null; // valid
}
