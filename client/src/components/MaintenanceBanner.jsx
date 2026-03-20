import { useState, useEffect } from 'react';
import api from '../api/client.js';

export default function MaintenanceBanner() {
  const [win, setWin]         = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await api.get('/maintenance/active');
        setWin(r.data);
      } catch {}
    };
    check();
    const id = setInterval(check, 60_000); // re-check every minute
    return () => clearInterval(id);
  }, []);

  if (!win || dismissed) return null;

  const ends = new Date(win.ends_at);
  const fmt = d => d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-amber-900/95 border-b border-amber-700 text-amber-100 px-4 py-2.5 flex items-center justify-between gap-4 shadow-lg animate-fadeIn">
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0 text-amber-300">🔧</span>
        <p className="text-sm font-medium truncate">
          <strong>{win.title}</strong>
          {win.description && ` — ${win.description}`}
          <span className="ml-2 text-amber-300 font-normal text-xs">Ends {fmt(ends)}</span>
        </p>
      </div>
      <button onClick={() => setDismissed(true)}
        className="shrink-0 text-amber-300 hover:text-white text-lg leading-none transition-colors">
        ×
      </button>
    </div>
  );
}
