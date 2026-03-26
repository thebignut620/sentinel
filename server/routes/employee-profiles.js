import express from 'express';
import db from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /employee-profiles/:userId
router.get('/:userId', authenticate, async (req, res) => {
  const targetId = parseInt(req.params.userId);
  const companyId = req.user.company_id || 1;
  if (req.user.role === 'employee' && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  // Verify target user belongs to the same company
  const targetUser = await db.get('SELECT id FROM users WHERE id = ? AND company_id = ?', targetId, companyId);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });
  const profile = await db.get('SELECT * FROM employee_profiles WHERE user_id = ?', targetId);
  res.json(profile || null);
});

// PUT /employee-profiles/:userId
router.put('/:userId', authenticate, async (req, res) => {
  const targetId = parseInt(req.params.userId);
  const companyId = req.user.company_id || 1;
  if (req.user.role === 'employee' && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  // Verify target user belongs to the same company
  const targetUser = await db.get('SELECT id FROM users WHERE id = ? AND company_id = ?', targetId, companyId);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  const { department, device_type, primary_software, tenure_months, notes } = req.body;
  const existing = await db.get('SELECT id FROM employee_profiles WHERE user_id = ?', targetId);

  if (existing) {
    await db.run(
      'UPDATE employee_profiles SET department=?, device_type=?, primary_software=?, tenure_months=?, notes=?, updated_at=NOW() WHERE user_id=?',
      department || null, device_type || null, primary_software || null,
      tenure_months ? parseInt(tenure_months) : null, notes || null, targetId
    );
  } else {
    await db.run(
      'INSERT INTO employee_profiles (user_id, department, device_type, primary_software, tenure_months, notes) VALUES (?,?,?,?,?,?)',
      targetId, department || null, device_type || null, primary_software || null,
      tenure_months ? parseInt(tenure_months) : null, notes || null
    );
  }

  const updated = await db.get('SELECT * FROM employee_profiles WHERE user_id = ?', targetId);
  res.json(updated);
});

export default router;
