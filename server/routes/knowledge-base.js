import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Public KB - accessible without auth
router.get('/public', async (req, res) => {
  const { q, category, company } = req.query;
  let companyId = 1;
  if (company) {
    const comp = await db.get('SELECT id FROM companies WHERE slug = ?', company);
    if (comp) companyId = comp.id;
  }

  let query = `SELECT id, title, category, problem, solution, steps, views, created_at
               FROM knowledge_base WHERE company_id = ? AND is_public = 1`;
  const params = [companyId];

  if (category && category !== 'all') { query += ' AND category = ?'; params.push(category); }
  if (q?.trim()) {
    const words = q.trim().split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
      const conditions = words.map(() => '(LOWER(title) LIKE ? OR LOWER(problem) LIKE ? OR LOWER(solution) LIKE ?)').join(' OR ');
      query += ` AND (${conditions})`;
      words.forEach(w => { const like = `%${w.toLowerCase()}%`; params.push(like, like, like); });
    }
  }
  query += ' ORDER BY views DESC, created_at DESC LIMIT 20';
  const articles = await db.all(query, ...params);
  res.json(articles);
});

router.get('/public/:id', async (req, res) => {
  const article = await db.get(
    'SELECT id, title, category, problem, solution, steps, views, created_at FROM knowledge_base WHERE id = ? AND is_public = 1',
    req.params.id
  );
  if (!article) return res.status(404).json({ error: 'Article not found' });
  await db.run('UPDATE knowledge_base SET views = views + 1 WHERE id = ?', req.params.id);
  res.json({ ...article, steps: article.steps ? JSON.parse(article.steps) : [] });
});

// Search / list KB articles
router.get('/', authenticate, async (req, res) => {
  const { q, category } = req.query;
  const companyId = req.user.company_id || 1;

  let query = 'SELECT id, title, category, problem, solution, steps, views, ticket_id, created_at FROM knowledge_base WHERE company_id = ?';
  const params = [companyId];

  if (category && category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }

  if (q?.trim()) {
    // Simple multi-word relevance: search title + problem
    const words = q.trim().split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
      const conditions = words.map(() => '(LOWER(title) LIKE ? OR LOWER(problem) LIKE ? OR LOWER(solution) LIKE ?)').join(' OR ');
      query += ` AND (${conditions})`;
      words.forEach(w => {
        const like = `%${w.toLowerCase()}%`;
        params.push(like, like, like);
      });
    }
  }

  query += ' ORDER BY views DESC, created_at DESC LIMIT 20';

  const articles = await db.all(query, ...params);
  res.json(articles);
});

// Get single article (increments view count)
router.get('/:id', authenticate, async (req, res) => {
  const companyId = req.user.company_id || 1;
  const article = await db.get(
    'SELECT * FROM knowledge_base WHERE id = ? AND company_id = ?',
    req.params.id, companyId
  );
  if (!article) return res.status(404).json({ error: 'Article not found' });

  await db.run("UPDATE knowledge_base SET views = views + 1 WHERE id = ?", req.params.id);
  res.json({ ...article, steps: article.steps ? JSON.parse(article.steps) : [] });
});

// Delete article (admin only)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  await db.run('DELETE FROM knowledge_base WHERE id = ? AND company_id = ?', req.params.id, companyId);
  res.json({ ok: true });
});

// Toggle public visibility
router.patch('/:id/publish', authenticate, requireRole('admin', 'it_staff'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const { is_public } = req.body;
  await db.run('UPDATE knowledge_base SET is_public = ? WHERE id = ? AND company_id = ?', is_public ? 1 : 0, req.params.id, companyId);
  res.json({ ok: true });
});

export default router;
