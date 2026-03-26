import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/status', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const company = await db.get('SELECT is_sandbox FROM companies WHERE id = ?', companyId);
  res.json({ is_sandbox: company?.is_sandbox === 1 });
});

router.post('/enable', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  await db.run('UPDATE companies SET is_sandbox = 1 WHERE id = ?', companyId);

  // Seed fake data
  const fakeEmployees = [
    { name: 'Alice Johnson', email: `alice.demo${companyId}@sandbox.demo`, role: 'employee' },
    { name: 'Bob Smith', email: `bob.demo${companyId}@sandbox.demo`, role: 'employee' },
    { name: 'Carol Davis', email: `carol.demo${companyId}@sandbox.demo`, role: 'employee' },
    { name: 'Dave Wilson', email: `dave.demo${companyId}@sandbox.demo`, role: 'it_staff' },
    { name: 'Eve Martinez', email: `eve.demo${companyId}@sandbox.demo`, role: 'employee' },
  ];

  const bcrypt = await import('bcryptjs');
  const hash = bcrypt.default.hashSync('sandbox123', 10);
  const userIds = [];
  for (const emp of fakeEmployees) {
    try {
      const r = await db.run(
        'INSERT INTO users (name, email, password, role, is_active, company_id) VALUES (?, ?, ?, ?, 1, ?)',
        emp.name, emp.email, hash, emp.role, companyId
      );
      userIds.push(r.lastInsertRowid);
    } catch {}
  }

  const fakeTickets = [
    { title: 'Cannot connect to VPN', description: 'Getting "connection timeout" every morning', priority: 'high', category: 'network', status: 'open' },
    { title: 'Outlook keeps crashing', description: 'Microsoft Outlook crashes after 10 minutes of use', priority: 'medium', category: 'software', status: 'in_progress' },
    { title: 'New laptop setup needed', description: 'Need MacBook Pro configured for remote work', priority: 'low', category: 'hardware', status: 'open' },
    { title: 'Password reset required', description: 'Locked out of Google Workspace account', priority: 'critical', category: 'account', status: 'resolved' },
    { title: 'Printer not working', description: 'HP LaserJet on 3rd floor shows offline', priority: 'low', category: 'hardware', status: 'open' },
    { title: 'Zoom audio issues', description: 'Microphone not detected in Zoom meetings', priority: 'medium', category: 'software', status: 'in_progress' },
    { title: 'Drive access needed', description: 'Need access to Marketing shared drive', priority: 'medium', category: 'access', status: 'resolved' },
    { title: 'Slow computer performance', description: 'MacBook running extremely slow since update', priority: 'medium', category: 'hardware', status: 'open' },
    { title: 'Email not syncing', description: 'Emails from 3 days ago still showing as unread', priority: 'low', category: 'software', status: 'open' },
    { title: 'Two-factor auth setup', description: 'Need help setting up authenticator app', priority: 'low', category: 'account', status: 'resolved' },
  ];

  const submitterId = userIds[0] || req.user.id;
  for (const t of fakeTickets) {
    await db.run(
      `INSERT INTO tickets (title, description, priority, category, status, submitter_id, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      t.title, t.description, t.priority, t.category, t.status, submitterId, companyId
    );
  }

  // Seed KB
  const kbArticles = [
    { title: 'VPN Connection Troubleshooting', category: 'network', problem: 'Unable to connect to company VPN', solution: 'Restart the VPN client, clear credentials, and try again. If issue persists, contact IT.', steps: JSON.stringify(['Open VPN client', 'Click Disconnect', 'Restart the application', 'Re-enter your credentials', 'Try connecting again']) },
    { title: 'Microsoft Office Crashes Fix', category: 'software', problem: 'Office applications crash unexpectedly', solution: 'Run Office repair from Control Panel, or disable add-ins in safe mode.', steps: JSON.stringify(['Press Win+R, type appwiz.cpl', 'Find Microsoft Office', 'Click Change then Quick Repair', 'Restart computer']) },
    { title: 'Password Reset Guide', category: 'account', problem: 'Forgot or locked out of account', solution: 'Use the self-service password reset portal or contact IT for assistance.', steps: JSON.stringify(['Visit the password reset portal', 'Enter your email', 'Follow the instructions sent to your recovery email']) },
  ];

  for (const kb of kbArticles) {
    await db.run(
      'INSERT INTO knowledge_base (title, category, problem, solution, steps, company_id, is_public) VALUES (?, ?, ?, ?, ?, ?, 0)',
      kb.title, kb.category, kb.problem, kb.solution, kb.steps, companyId
    );
  }

  res.json({ ok: true, message: 'Sandbox enabled with sample data' });
});

router.post('/disable', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  await db.run('UPDATE companies SET is_sandbox = 0 WHERE id = ?', companyId);
  res.json({ ok: true });
});

router.post('/reset', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  // Remove sandbox data (demo users and their tickets)
  const demoUsers = await db.all(`SELECT id FROM users WHERE company_id = ? AND email LIKE ?`, companyId, `%.demo${companyId}@sandbox.demo`);
  for (const u of demoUsers) {
    await db.run('DELETE FROM tickets WHERE submitter_id = ? AND company_id = ?', u.id, companyId);
    await db.run('DELETE FROM users WHERE id = ?', u.id);
  }
  await db.run(`DELETE FROM knowledge_base WHERE company_id = ? AND title IN ('VPN Connection Troubleshooting', 'Microsoft Office Crashes Fix', 'Password Reset Guide')`, companyId);
  await db.run('UPDATE companies SET is_sandbox = 0 WHERE id = ?', companyId);
  res.json({ ok: true, message: 'Sandbox data cleared' });
});

export default router;
