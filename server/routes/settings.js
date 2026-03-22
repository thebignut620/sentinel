import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM settings');
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  } catch (err) {
    console.error('[settings GET] error:', err.message);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.patch('/', authenticate, requireRole('admin'), async (req, res) => {
  const entries = Object.entries(req.body);
  console.log(`[settings PATCH] saving ${entries.length} key(s):`, entries.map(([k]) => k).join(', '));
  try {
    for (const [key, value] of entries) {
      await db.run(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        key, String(value ?? '')
      );
    }
    const rows = await db.all('SELECT * FROM settings');
    console.log('[settings PATCH] saved successfully');
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  } catch (err) {
    console.error('[settings PATCH] error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

export default router;
