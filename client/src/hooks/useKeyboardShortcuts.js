import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * useKeyboardShortcuts — global keyboard navigation for Sentinel
 * Disabled when focus is inside input / textarea / select / contenteditable
 */
export default function useKeyboardShortcuts({ onShowShortcuts, userRole }) {
  const navigate = useNavigate();
  const sequenceRef = useRef('');
  const timerRef = useRef(null);

  const clearSequence = useCallback(() => {
    sequenceRef.current = '';
  }, []);

  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        el.contentEditable === 'true'
      );
    };

    const handler = (e) => {
      if (isTyping()) return;
      // Ignore modifier combos (Ctrl+S etc)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key;

      // Instant single-key shortcuts
      if (key === 'Escape') {
        // Dispatch a synthetic close event that modals can listen for
        window.dispatchEvent(new CustomEvent('sentinel:close-modal'));
        clearSequence();
        return;
      }

      if (key === '?') {
        e.preventDefault();
        onShowShortcuts?.();
        clearSequence();
        return;
      }

      if (key === '/') {
        e.preventDefault();
        // Focus the first visible search input
        const input = document.querySelector('input[type="search"], input[placeholder*="earch"], input[placeholder*="earch"]');
        if (input) { input.focus(); input.select(); }
        clearSequence();
        return;
      }

      if (key === 'n' || key === 'N') {
        if (userRole === 'employee') {
          navigate('/help');
        } else {
          navigate('/tickets');
        }
        clearSequence();
        return;
      }

      if (key === 'k' || key === 'K') {
        navigate('/knowledge-base');
        clearSequence();
        return;
      }

      // Two-key sequences: G then D / G then T
      if (key === 'g' || key === 'G') {
        sequenceRef.current = 'g';
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(clearSequence, 1500);
        return;
      }

      if (sequenceRef.current === 'g') {
        clearTimeout(timerRef.current);
        if (key === 'd' || key === 'D') {
          navigate('/dashboard');
        } else if (key === 't' || key === 'T') {
          navigate(userRole === 'employee' ? '/my-tickets' : '/tickets');
        }
        clearSequence();
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      clearTimeout(timerRef.current);
    };
  }, [navigate, onShowShortcuts, userRole, clearSequence]);
}
