import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge, PriorityBadge, CategoryBadge } from '../../components/Badges.jsx';
import { SkeletonTable } from '../../components/Skeleton.jsx';
import api from '../../api/client.js';

export default function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/tickets').then(r => setTickets(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = tickets
    .filter(t => filter === 'all' || t.status === filter)
    .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()));

  const counts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">My Tickets</h1>
        <Link
          to="/help"
          className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5"
        >
          <span>+</span> New Issue
        </Link>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search tickets…"
        className="input w-full max-w-sm"
      />

      {/* Status filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'open', 'in_progress', 'resolved', 'closed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all duration-150 active:scale-95 ${
              filter === f
                ? 'bg-pine-700 text-white shadow-sm'
                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            {f.replace('_', ' ')}
            <span className={`ml-1.5 ${filter === f ? 'text-pine-200' : 'text-gray-600'}`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonTable rows={4} />
      ) : filtered.length === 0 ? (
        <div className="card py-14 text-center text-gray-600">
          {filter === 'all' && !search ? 'You have no tickets yet.' : 'No tickets match your filters.'}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50 border-b border-gray-800 text-left">
              <tr>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">#</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Title</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Category</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Status</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Priority</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-gray-800/60 last:border-0 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-600 text-xs">{t.id}</td>
                  <td className="px-4 py-3">
                    <Link to={`/tickets/${t.id}`} className="text-pine-400 hover:text-pine-300 font-medium transition-colors">
                      {t.title}
                    </Link>
                    {t.ai_attempted === 1 && (
                      <span className="ml-2 text-xs text-gray-600">🤖</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><CategoryBadge category={t.category} /></td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
