import { useState, useEffect } from 'react';
import api from '../api/client.js';

export default function IncidentBanner() {
  const [incidents, setIncidents] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());

  useEffect(() => {
    const poll = () => {
      api.get('/incidents/active')
        .then(r => setIncidents(Array.isArray(r.data) ? r.data : []))
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 60_000);
    return () => clearInterval(id);
  }, []);

  const visible = incidents.filter(i => !dismissed.has(i.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-px">
      {visible.map(incident => (
        <div
          key={incident.id}
          className="bg-red-900/80 border-b border-red-700 px-4 py-2 flex items-center gap-3"
        >
          <span className="text-red-400 text-lg flex-shrink-0">🚨</span>
          <div className="flex-1 min-w-0">
            <span className="text-red-200 font-semibold text-sm">{incident.title}</span>
            <span className="text-red-300/80 text-xs ml-2">{incident.description}</span>
          </div>
          <button
            onClick={() => setDismissed(prev => new Set([...prev, incident.id]))}
            className="text-red-400 hover:text-red-200 flex-shrink-0 text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
