import db from '../db/connection.js';

export async function logAudit(req, { action, entityType, entityId, details } = {}) {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
    const companyId = req.user?.company_id || 1;
    await db.run(
      `INSERT INTO audit_log (user_id, user_name, user_role, action, entity_type, entity_id, details, ip_address, company_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      req.user?.id || null,
      req.user?.name || null,
      req.user?.role || null,
      action,
      entityType || null,
      entityId || null,
      details ? JSON.stringify(details) : null,
      ip,
      companyId
    );
  } catch (e) {
    console.error('[audit] Failed to log:', e.message);
  }
}
