import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

export const ALL_PERMISSIONS = [
  { key: 'close_tickets',       label: 'Close Tickets',           description: 'Can close/resolve tickets' },
  { key: 'see_internal_notes',  label: 'See Internal Notes',      description: 'Can view staff-only internal notes' },
  { key: 'access_kb',           label: 'Access Knowledge Base',   description: 'Can view the knowledge base' },
  { key: 'export_data',         label: 'Export Data',             description: 'Can export ticket/asset data' },
  { key: 'manage_users',        label: 'Manage Users',            description: 'Can create/edit/deactivate users' },
  { key: 'manage_assets',       label: 'Manage Assets',           description: 'Can create and edit assets' },
  { key: 'view_audit_log',      label: 'View Audit Log',          description: 'Can view the full audit log' },
  { key: 'manage_departments',  label: 'Manage Departments',      description: 'Can create/edit/delete departments' },
  { key: 'manage_custom_fields',label: 'Manage Custom Fields',    description: 'Can define custom ticket fields' },
  { key: 'manage_permissions',  label: 'Manage Permissions',      description: 'Can change role permissions' },
];

// Get all permissions grouped by role
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  const rows = await db.all('SELECT * FROM role_permissions');
  const byRole = {};
  for (const { role, permission_key } of rows) {
    if (!byRole[role]) byRole[role] = [];
    byRole[role].push(permission_key);
  }
  res.json({ permissions: byRole, all: ALL_PERMISSIONS });
});

// Set permissions for a role (replaces all)
router.put('/:role', authenticate, requireRole('admin'), async (req, res) => {
  const { role } = req.params;
  const allowed = ['employee', 'it_staff', 'admin'];
  if (!allowed.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (role === 'admin') return res.status(403).json({ error: 'Admin permissions cannot be modified' });

  const { permissions } = req.body; // array of permission_keys
  if (!Array.isArray(permissions)) return res.status(400).json({ error: 'permissions must be an array' });

  await db.run('DELETE FROM role_permissions WHERE role = ?', role);
  for (const key of permissions) {
    if (ALL_PERMISSIONS.find(p => p.key === key)) {
      await db.run('INSERT INTO role_permissions (role, permission_key) VALUES (?, ?)', role, key);
    }
  }
  res.json({ ok: true });
});

export default router;
