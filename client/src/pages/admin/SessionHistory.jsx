import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client.js';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function SessionHistory() {
  const [sessions, setSessions] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    api.get('/sessions')
      .then(r => setSessions(r.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load sessions'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Session History</h1>
          <p className="text-gray-500 text-sm mt-0.5">Named reporting windows — each session is a clean measurement period</p>
        </div>
        <Link to="/dashboard" className="btn-secondary px-4 py-2 text-sm">
          ← Dashboard
        </Link>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="skeleton h-4 w-48 mb-2" />
              <div className="skeleton h-3 w-32" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="card p-6 text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && sessions?.length === 0 && (
        <div className="card p-10 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-pine-900/40 border border-pine-800/30 flex items-center justify-center mx-auto text-pine-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <p className="text-gray-400 font-medium text-sm">No sessions yet</p>
          <p className="text-gray-600 text-xs max-w-xs mx-auto">
            Use the refresh icon on the dashboard to start your first session and begin tracking a clean reporting window.
          </p>
          <Link to="/dashboard" className="btn-primary px-5 py-2 text-sm inline-block mt-2">
            Go to Dashboard
          </Link>
        </div>
      )}

      {!loading && !error && sessions?.length > 0 && (
        <div className="space-y-3">
          {sessions.map((session, idx) => (
            <div key={session.id} className={`card p-5 border ${idx === 0 ? 'border-pine-800/50' : 'border-gray-800/60'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold
                    ${idx === 0 ? 'bg-pine-900/60 border border-pine-800/40 text-pine-400' : 'bg-gray-800 border border-gray-700 text-gray-500'}`}>
                    {idx === 0 ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3" fill="currentColor" />
                      </svg>
                    ) : (
                      `#${sessions.length - idx}`
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-white font-medium text-sm">{session.name}</h3>
                      {idx === 0 && (
                        <span className="text-[10px] font-semibold text-pine-400 bg-pine-900/40 border border-pine-800/40 px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">
                      Started {formatDateTime(session.started_at)} by {session.started_by_name}
                    </p>
                    {session.notes && (
                      <p className="text-gray-600 text-xs mt-1 italic">{session.notes}</p>
                    )}
                  </div>
                </div>

                {idx < sessions.length - 1 && sessions[idx + 1] && (
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-600">Duration</p>
                    <p className="text-xs text-gray-400 font-medium">
                      {Math.round((new Date(session.started_at) - new Date(sessions[idx + 1].started_at)) / (1000 * 60 * 60 * 24))} days
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
