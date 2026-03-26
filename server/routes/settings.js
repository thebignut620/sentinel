import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const companyId = req.user.company_id || 1;
    const rows = await db.all('SELECT key, value FROM settings WHERE company_id = ?', companyId);
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  } catch (err) {
    console.error('[settings GET] error:', err.message);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.get('/support-email', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const company = await db.get('SELECT support_email, support_email_slug FROM companies WHERE id = ?', companyId);
  res.json(company || { support_email: null, support_email_slug: null });
});

router.patch('/', authenticate, requireRole('admin'), async (req, res) => {
  const entries = Object.entries(req.body);
  const companyId = req.user.company_id || 1;
  console.log(`[settings PATCH] saving ${entries.length} key(s):`, entries.map(([k]) => k).join(', '));
  try {
    for (const [key, value] of entries) {
      await db.run(
        'INSERT INTO settings (company_id, key, value) VALUES (?, ?, ?) ON CONFLICT (company_id, key) DO UPDATE SET value = EXCLUDED.value',
        companyId, key, String(value ?? '')
      );
    }
    const rows = await db.all('SELECT key, value FROM settings WHERE company_id = ?', companyId);
    console.log('[settings PATCH] saved successfully');
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  } catch (err) {
    console.error('[settings PATCH] error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

export default router;
