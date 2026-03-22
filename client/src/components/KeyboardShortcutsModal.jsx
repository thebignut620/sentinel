import { useEffect } from 'react';

const SHORTCUTS = [
  { keys: ['N'],         desc: 'New ticket / Get AI help' },
  { keys: ['K'],         desc: 'Go to Knowledge Base' },
  { keys: ['G', 'D'],   desc: 'Go to Dashboard' },
  { keys: ['G', 'T'],   desc: 'Go to Tickets' },
  { keys: ['/'],         desc: 'Focus search' },
  { keys: ['?'],         desc: 'Show this shortcuts panel' },
  { keys: ['Esc'],       desc: 'Close modal / dismiss' },
];

export default function KeyboardShortcutsModal({ onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9990] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-white font-semibold">Keyboard Shortcuts</h2>
            <p className="text-gray-500 text-xs mt-0.5">Navigate Sentinel at the speed of thought</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 hover:bg-gray-800 rounded-lg"
            aria-label="Close shortcuts"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-2">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800/60 last:border-0">
              <span className="text-gray-300 text-sm">{s.desc}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, j) => (
                  <span key={j} className="flex items-center gap-1">
                    {j > 0 && <span className="text-gray-600 text-xs">then</span>}
                    <kbd className="inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300">
                      {k}
                    </kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 pb-4">
          <p className="text-gray-600 text-xs text-center">
            Shortcuts are disabled when typing in a text field
          </p>
        </div>
      </div>
    </div>
  );
}
