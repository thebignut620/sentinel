/**
 * useMilestone — tracks ticket resolution milestones and fires celebrations
 *
 * Milestones:
 *   1 → first ticket resolved (confetti + sound)
 *   100 → 100 tickets resolved (toast)
 *   50 → 50 ATLAS autonomous resolutions (toast)
 */
import { useCallback } from 'react';
import { soundCelebration } from './useSound.js';

const MILESTONE_KEY = 'sentinel_milestones_seen';

function getSeenMilestones() {
  try {
    return new Set(JSON.parse(localStorage.getItem(MILESTONE_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function markMilestoneSeen(key) {
  const seen = getSeenMilestones();
  seen.add(key);
  localStorage.setItem(MILESTONE_KEY, JSON.stringify([...seen]));
}

export function useMilestone() {
  /**
   * checkResolved(count) — call after a ticket is resolved.
   * Returns 'first' | '100' | null — the milestone fired, if any.
   */
  const checkResolved = useCallback((count) => {
    const seen = getSeenMilestones();

    if (count === 1 && !seen.has('first_resolved')) {
      markMilestoneSeen('first_resolved');
      soundCelebration();
      return 'first';
    }

    if (count >= 100 && !seen.has('100_resolved')) {
      markMilestoneSeen('100_resolved');
      soundCelebration();
      return '100';
    }

    return null;
  }, []);

  /**
   * checkAtlasResolved(count) — call after ATLAS auto-resolves a ticket.
   * Returns '50_atlas' | null
   */
  const checkAtlasResolved = useCallback((count) => {
    const seen = getSeenMilestones();

    if (count >= 50 && !seen.has('50_atlas')) {
      markMilestoneSeen('50_atlas');
      soundCelebration();
      return '50_atlas';
    }

    return null;
  }, []);

  return { checkResolved, checkAtlasResolved };
}

// Helper used by TicketDetail to decide whether to fire confetti
export function shouldShowConfetti(milestone) {
  return milestone === 'first' || milestone === '100';
}
