import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const router = express.Router();

// Upload attachment to ticket
router.post('/tickets/:id/attachments', authenticate, upload.single('file'), async (req, res) => {
  const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  if (req.user.role === 'employee' && ticket.submitter_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const result = await db.run(
    'INSERT INTO ticket_attachments (ticket_id, user_id, filename, original, size, mimetype) VALUES (?, ?, ?, ?, ?, ?)',
    req.params.id, req.user.id,
    req.file.filename, req.file.originalname, req.file.size, req.file.mimetype
  );

  const attachment = await db.get('SELECT * FROM ticket_attachments WHERE id = ?', result.lastInsertRowid);
  res.status(201).json(attachment);
});

// Delete attachment
router.delete('/tickets/:ticketId/attachments/:attachId', authenticate, async (req, res) => {
  const attachment = await db.get(
    'SELECT * FROM ticket_attachments WHERE id = ? AND ticket_id = ?',
    req.params.attachId, req.params.ticketId
  );
  if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

  const isOwner = attachment.user_id === req.user.id;
  const isStaff = req.user.role !== 'employee';
  if (!isOwner && !isStaff) return res.status(403).json({ error: 'Access denied' });

  const filePath = path.join(UPLOADS_DIR, attachment.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  await db.run('DELETE FROM ticket_attachments WHERE id = ?', attachment.id);
  res.json({ ok: true });
});

export default router;
