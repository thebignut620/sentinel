import express from 'express';
import db from '../db/connection.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// Search / list KB articles
router.get('/', async (req, res) => {
  const { q, category } = req.query;

  let query = 'SELECT id, title, category, problem, solution, steps, views, ticket_id, created_at FROM knowledge_base WHERE 1=1';
  const params = [];

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
router.get('/:id', async (req, res) => {
  const article = await db.get(
    'SELECT * FROM knowledge_base WHERE id = ?',
    req.params.id
  );
  if (!article) return res.status(404).json({ error: 'Article not found' });

  await db.run("UPDATE knowledge_base SET views = views + 1 WHERE id = ?", req.params.id);
  res.json({ ...article, steps: article.steps ? JSON.parse(article.steps) : [] });
});

// Delete article (admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  await db.run('DELETE FROM knowledge_base WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

export default router;
