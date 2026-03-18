import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const rows = await db.all('SELECT * FROM settings');
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

router.patch('/', authenticate, requireRole('admin'), async (req, res) => {
  await db.transaction(async () => {
    for (const [key, value] of Object.entries(req.body)) {
      await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', key, String(value));
    }
  });

  const rows = await db.all('SELECT * FROM settings');
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

export default router;
