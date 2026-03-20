/**
 * ATLAS Learning Engine
 * Tracks solution outcomes and promotes high-confidence solutions to the KB.
 */

import db from '../db/connection.js';
import * as atlas from './atlas.js';

// Update success/tried counts when an employee reports an outcome
export async function updateSolutionOutcome(solutionIds, resolved) {
  if (!Array.isArray(solutionIds) || solutionIds.length === 0) return;

  for (const id of solutionIds) {
    try {
      const sol = await db.get('SELECT * FROM learned_solutions WHERE id = ?', id);
      if (!sol) continue;

      const newTried   = sol.tried_count + 1;
      const newSuccess = resolved ? sol.success_count + 1 : sol.success_count;
      const newRate    = (newSuccess / newTried) * 100;

      await db.run(
        `UPDATE learned_solutions
           SET tried_count = ?, success_count = ?, success_rate = ?,
               last_used_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        newTried, newSuccess, newRate, id
      );

      // Auto-promote to KB once threshold is reached
      if (newRate >= 70 && newTried >= 5 && !sol.kb_article_id) {
        setImmediate(() => checkAutoKBPromotion(id).catch(e =>
          console.error('[ATLAS] auto-KB promotion error:', e.message)
        ));
      }
    } catch (e) {
      console.error('[ATLAS] updateSolutionOutcome error for id', id, ':', e.message);
    }
  }
}

// Auto-generate a KB article from a high-confidence learned solution
async function checkAutoKBPromotion(solutionId) {
  const sol = await db.get('SELECT * FROM learned_solutions WHERE id = ?', solutionId);
  if (!sol || sol.kb_article_id) return; // already promoted

  // Re-check thresholds (could have changed while async)
  if (sol.success_rate < 70 || sol.tried_count < 5) return;

  // Build a fake ticket-like object for generateKBArticle
  const sourceFakeTicket = {
    title: sol.problem_summary,
    category: sol.category,
    description: sol.problem_summary,
  };

  const report = `Solution: ${sol.solution_text}\n\nThis solution has been verified by ${sol.tried_count} users with a ${Math.round(sol.success_rate)}% success rate.`;

  try {
    const article = await atlas.generateKBArticle(sourceFakeTicket, report);
    if (!article) return;

    const { lastInsertRowid } = await db.run(
      `INSERT INTO knowledge_base (title, category, problem, solution, steps)
       VALUES (?, ?, ?, ?, ?)`,
      article.title,
      sol.category,
      article.problem,
      article.solution,
      JSON.stringify(article.steps || [])
    );

    await db.run(
      'UPDATE learned_solutions SET kb_article_id = ?, updated_at = NOW() WHERE id = ?',
      lastInsertRowid, solutionId
    );

    console.log(`[ATLAS] Auto-promoted learned solution #${solutionId} to KB article #${lastInsertRowid}`);
  } catch (e) {
    console.error('[ATLAS] checkAutoKBPromotion failed:', e.message);
  }
}

// Gather stats for the weekly intelligence report
export async function gatherWeeklyStats() {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    ticketsCreated,
    ticketsResolved,
    avgResRow,
    topCategories,
    topSolutions,
    newSolutions,
    struggling,
  ] = await Promise.all([
    db.get('SELECT COUNT(*) as count FROM tickets WHERE created_at >= ?', oneWeekAgo),
    db.get("SELECT COUNT(*) as count FROM tickets WHERE resolved_at >= ? AND status IN ('resolved','closed')", oneWeekAgo),
    db.get(`SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours
            FROM tickets WHERE resolved_at >= ? AND status IN ('resolved','closed')`, oneWeekAgo),
    db.all(`SELECT category, COUNT(*) as count FROM tickets
            WHERE created_at >= ? GROUP BY category ORDER BY count DESC LIMIT 5`, oneWeekAgo),
    db.all(`SELECT category, problem_summary, success_count, tried_count, success_rate
            FROM learned_solutions
            WHERE tried_count >= 3 ORDER BY success_rate DESC, tried_count DESC LIMIT 5`),
    db.get('SELECT COUNT(*) as count FROM learned_solutions WHERE created_at >= ?', oneWeekAgo),
    db.all(`SELECT category, problem_summary, success_count, tried_count, success_rate
            FROM learned_solutions
            WHERE tried_count >= 3 AND success_rate < 50
            ORDER BY tried_count DESC LIMIT 3`),
  ]);

  return {
    weekOf: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    ticketsCreated: ticketsCreated?.count ?? 0,
    ticketsResolved: ticketsResolved?.count ?? 0,
    avgResolutionHours: avgResRow?.avg_hours ? Math.round(avgResRow.avg_hours) : 0,
    atlasResolved: 0, // placeholder — future: track ATLAS self-service resolutions
    topCategories: topCategories || [],
    topSolutions: topSolutions || [],
    newSolutionsLearned: newSolutions?.count ?? 0,
    strugglingAreas: struggling || [],
  };
}
