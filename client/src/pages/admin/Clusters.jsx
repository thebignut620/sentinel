import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function Clusters() {
  const { token } = useAuth();
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [expandedData, setExpandedData] = useState({});
  const [resolving, setResolving] = useState(null);
  const [resolutionText, setResolutionText] = useState('');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/clusters', { headers });
      setClusters(await r.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function expand(id) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!expandedData[id]) {
      const r = await fetch(`/api/clusters/${id}`, { headers });
      const data = await r.json();
      setExpandedData(prev => ({ ...prev, [id]: data }));
    }
  }

  async function analyze() {
    setAnalyzing(true);
    try {
      const r = await fetch('/api/clusters/analyze', { method: 'POST', headers });
      const data = await r.json();
      if (data.clusters?.length) {
        load();
      } else {
        alert(data.message || 'No clusters found.');
      }
    } catch {
      alert('Analysis failed. Try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function bulkResolve(clusterId) {
    setResolving(clusterId);
  }

  async function confirmResolve(clusterId) {
    try {
      const r = await fetch(`/api/clusters/${clusterId}/bulk-resolve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ resolution: resolutionText }),
      });
      const data = await r.json();
      alert(`Resolved ${data.resolved} ticket(s).`);
      setResolving(null);
      setResolutionText('');
      load();
    } catch {
      alert('Bulk resolve failed.');
    }
  }

  const open = clusters.filter(c => c.status === 'open');
  const resolved = clusters.filter(c => c.status === 'resolved');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Related Ticket Clusters</h1>
          <p className="text-gray-400 text-sm mt-1">ATLAS groups related tickets so you can resolve them together.</p>
        </div>
        <button
          onClick={analyze}
          disabled={analyzing}
          className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {analyzing ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⟳</span> Analyzing…
            </span>
          ) : '✦ Run ATLAS Analysis'}
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-12">Loading…</div>
      ) : (
        <>
          {open.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">No open clusters.</p>
              <p className="text-sm mt-1">Run ATLAS Analysis to group related open tickets.</p>
            </div>
          )}

          {open.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-gray-300 font-semibold text-sm uppercase tracking-wider">Open Clusters</h2>
              {open.map(c => (
                <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                  <button
                    onClick={() => expand(c.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-yellow-900/40 text-yellow-400 rounded-lg flex items-center justify-center text-sm font-bold">
                        {c.ticket_count}
                      </span>
                      <div>
                        <p className="text-white font-medium">{c.title}</p>
                        <p className="text-gray-400 text-xs capitalize">{c.category} • {c.ticket_count} tickets</p>
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform ${expanded === c.id ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {expanded === c.id && (
                    <div className="border-t border-gray-700 px-4 pb-4">
                      {c.description && (
                        <p className="text-gray-400 text-sm py-3">{c.description}</p>
                      )}

                      {/* Tickets in this cluster */}
                      {expandedData[c.id] ? (
                        <div className="space-y-1 mb-4">
                          {expandedData[c.id].tickets?.map(t => (
                            <div key={t.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-gray-700/50">
                              <span className="text-gray-500 w-8">#{t.id}</span>
                              <span className="text-white flex-1">{t.title}</span>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                t.status === 'open' ? 'bg-green-900/40 text-green-400' :
                                t.status === 'in_progress' ? 'bg-yellow-900/40 text-yellow-400' :
                                'bg-gray-700 text-gray-400'
                              }`}>{t.status}</span>
                              <a href={`/tickets/${t.id}`} className="text-green-400 hover:underline text-xs">View</a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-500 text-sm py-3">Loading tickets…</div>
                      )}

                      {resolving === c.id ? (
                        <div className="space-y-2">
                          <textarea
                            rows={2}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 resize-none"
                            placeholder="Resolution note for all tickets in this cluster…"
                            value={resolutionText}
                            onChange={e => setResolutionText(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => confirmResolve(c.id)}
                              className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm"
                            >
                              Confirm Bulk Resolve
                            </button>
                            <button
                              onClick={() => setResolving(null)}
                              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => bulkResolve(c.id)}
                          className="mt-2 px-4 py-2 bg-green-900/40 hover:bg-green-900/60 text-green-400 border border-green-700 rounded-lg text-sm transition-colors"
                        >
                          Bulk Resolve All {c.ticket_count} Tickets
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {resolved.length > 0 && (
            <div className="space-y-3 opacity-60">
              <h2 className="text-gray-400 font-semibold text-sm uppercase tracking-wider">Resolved Clusters</h2>
              {resolved.map(c => (
                <div key={c.id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="w-8 h-8 bg-gray-700 text-gray-400 rounded-lg flex items-center justify-center text-sm">
                    {c.ticket_count}
                  </span>
                  <div>
                    <p className="text-gray-300 font-medium">{c.title}</p>
                    <p className="text-gray-500 text-xs capitalize">{c.category} • resolved</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
