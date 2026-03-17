import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all users (admin only; it_staff can read for assigning tickets)
router.get('/', authenticate, requireRole('it_staff', 'admin'), async (req, res) => {
  const users = await db.all(
    'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at DESC'
  );
  res.json(users);
});

// Create user
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  const { name, email, password, role = 'employee' } = req.body;
  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = await db.run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      name.trim(), email.trim().toLowerCase(), hash, role
    );

    const user = await db.get(
      'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?',
      result.lastInsertRowid
    );
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    throw err;
  }
});

// Update user
router.patch('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const { name, email, password, role, is_active } = req.body;
  const fields = [];
  const values = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name.trim()); }
  if (email !== undefined) { fields.push('email = ?'); values.push(email.trim().toLowerCase()); }
  if (password !== undefined) { fields.push('password = ?'); values.push(bcrypt.hashSync(password, 10)); }
  if (role !== undefined) { fields.push('role = ?'); values.push(role); }
  if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }

  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

  try {
    await db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, ...values, req.params.id);
    const user = await db.get(
      'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?',
      req.params.id
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    throw err;
  }
});

// Delete user (deactivate)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' });
  }
  const result = await db.run('UPDATE users SET is_active = 0 WHERE id = ?', req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ message: 'User deactivated' });
});

export default router;
