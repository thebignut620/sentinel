import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge, PriorityBadge } from '../../components/Badges.jsx';
import api from '../../api/client.js';

export default function TicketList() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/tickets').then(r => setTickets(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = tickets
    .filter(t => filter === 'all' || t.status === filter)
    .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.submitter_name?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;

  const counts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">All Tickets</h1>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {['all', 'open', 'in_progress', 'resolved', 'closed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                filter === f ? 'bg-blue-900 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.replace('_', ' ')}
              <span className={`ml-1.5 text-xs ${filter === f ? 'text-blue-200' : 'text-gray-400'}`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tickets…"
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border py-14 text-center text-gray-400">
          No tickets match your filters.
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-left">
              <tr>
                <th className="px-4 py-3 text-gray-500 font-medium">#</th>
                <th className="px-4 py-3 text-gray-500 font-medium">Title</th>
                <th className="px-4 py-3 text-gray-500 font-medium">Submitted By</th>
                <th className="px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="px-4 py-3 text-gray-500 font-medium">Priority</th>
                <th className="px-4 py-3 text-gray-500 font-medium">Assignee</th>
                <th className="px-4 py-3 text-gray-500 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{t.id}</td>
                  <td className="px-4 py-3">
                    <Link to={`/tickets/${t.id}`} className="text-blue-600 hover:underline font-medium">
                      {t.title}
                    </Link>
                    {t.ai_attempted === 1 && (
                      <span className="ml-1 text-xs text-gray-400" title="AI was consulted">🤖</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.submitter_name}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-3 text-gray-500">{t.assignee_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(t.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
