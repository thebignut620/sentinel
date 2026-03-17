import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';

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
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
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

export default router;
