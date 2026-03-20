import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client.js';

const ENTITY_COLORS = {
  ticket: 'text-blue-400 bg-blue-900/30',
  user: 'text-purple-400 bg-purple-900/30',
  asset: 'text-amber-400 bg-amber-900/30',
};

function ActionBadge({ action }) {
  const color = action.includes('delete') ? 'text-red-400' :
                action.includes('create') ? 'text-pine-400' :
                action.includes('update') || action.includes('bulk') ? 'text-amber-400' :
                'text-gray-400';
  return <span className={`font-mono text-xs ${color}`}>{action}</span>;
}

export default function AuditLog() {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [offset, setOffset]   = useState(0);
  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: LIMIT, offset });
    if (search)     params.set('action', search);
    if (entityType) params.set('entity_type', entityType);
    if (from)       params.set('from', new Date(from).toISOString());
    if (to)         params.set('to', new Date(to + 'T23:59:59').toISOString());
    const r = await api.get(`/audit-log?${params}`);
    setRows(r.data);
    setLoading(false);
  }, [search, entityType, from, to, offset]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e) => { e.preventDefault(); setOffset(0); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-gray-400 text-sm mt-1">Full history of all actions taken in Sentinel</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 flex-wrap">
        <input className="input text-sm flex-1 min-w-40" placeholder="Filter by action…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input text-sm" value={entityType} onChange={e => setEntityType(e.target.value)}>
          <option value="">All entities</option>
          <option value="ticket">Ticket</option>
          <option value="user">User</option>
          <option value="asset">Asset</option>
        </select>
        <input type="date" className="input text-sm" value={from} onChange={e => setFrom(e.target.value)} />
        <input type="date" className="input text-sm" value={to} onChange={e => setTo(e.target.value)} />
        <button type="submit" className="btn-primary px-4 py-2 text-sm">Search</button>
      </form>

      {loading ? (
        <div className="card p-8 text-center text-gray-500">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          <p className="text-4xl mb-3">📋</p>
          <p>No log entries found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {rows.map(r => {
                let details = null;
                try { details = r.details ? JSON.parse(r.details) : null; } catch {}
                return (
                  <tr key={r.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-200 text-sm">{r.user_name || <span className="text-gray-600">System</span>}</p>
                      {r.user_role && <p className="text-xs text-gray-600 capitalize">{r.user_role.replace('_',' ')}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={r.action} />
                    </td>
                    <td className="px-4 py-3">
                      {r.entity_type && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${ENTITY_COLORS[r.entity_type] || 'text-gray-400 bg-gray-800'}`}>
                          {r.entity_type}{r.entity_id ? ` #${r.entity_id}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                      {details ? JSON.stringify(details) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800 text-sm text-gray-500">
            <span>Showing {rows.length} entries</span>
            <div className="flex gap-2">
              <button onClick={() => setOffset(Math.max(0, offset - LIMIT))} disabled={offset === 0}
                className="btn-ghost px-3 py-1 text-xs disabled:opacity-40">← Prev</button>
              <button onClick={() => setOffset(offset + LIMIT)} disabled={rows.length < LIMIT}
                className="btn-ghost px-3 py-1 text-xs disabled:opacity-40">Next →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
