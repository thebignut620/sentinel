import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { StatusBadge, PriorityBadge, CategoryBadge } from '../../components/Badges.jsx';
import { SkeletonTable } from '../../components/Skeleton.jsx';
import api from '../../api/client.js';

const STATUS_FILTERS = ['all', 'open', 'in_progress', 'resolved', 'closed'];
const PRIORITY_FILTERS = ['all', 'critical', 'high', 'medium', 'low'];
const CATEGORY_FILTERS = ['all', 'hardware', 'software', 'network', 'access', 'account'];

export default function TicketList() {
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]     = useState(searchParams.get('status') || 'all');
  const [priority, setPriority] = useState(searchParams.get('priority') || 'all');
  const [category, setCategory] = useState('all');
  const [search, setSearch]     = useState('');

  useEffect(() => {
    api.get('/tickets').then(r => setTickets(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = tickets
    .filter(t => status === 'all'   || t.status === status)
    .filter(t => priority === 'all' || t.priority === priority)
    .filter(t => category === 'all' || t.category === category)
    .filter(t => !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.submitter_name?.toLowerCase().includes(search.toLowerCase())
    );

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
        <h1 className="text-2xl font-bold text-white">All Tickets</h1>
        <span className="text-sm text-gray-500">{filtered.length} of {tickets.length}</span>
      </div>

      {/* Filters row */}
      <div className="card p-4 space-y-3">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title or submitter…"
          className="input w-full"
        />

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setStatus(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all duration-150 active:scale-95 ${
                status === f
                  ? 'bg-pine-700 text-white shadow-sm'
                  : 'bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-750 hover:text-gray-200'
              }`}
            >
              {f.replace('_', ' ')}
              {f !== 'all' && counts[f] !== undefined && (
                <span className={`ml-1.5 ${status === f ? 'text-pine-200' : 'text-gray-600'}`}>
                  {counts[f]}
                </span>
              )}
              {f === 'all' && (
                <span className={`ml-1.5 ${status === f ? 'text-pine-200' : 'text-gray-600'}`}>
                  {counts.all}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Priority + Category filter */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-600">Priority:</span>
            {PRIORITY_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setPriority(f)}
                className={`px-2.5 py-1 rounded-lg text-xs capitalize transition-all duration-150 active:scale-95 ${
                  priority === f
                    ? 'bg-gray-700 text-gray-100 border border-gray-600'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-600">Category:</span>
            {CATEGORY_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setCategory(f)}
                className={`px-2.5 py-1 rounded-lg text-xs capitalize transition-all duration-150 active:scale-95 ${
                  category === f
                    ? 'bg-gray-700 text-gray-100 border border-gray-600'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={6} />
      ) : filtered.length === 0 ? (
        <div className="card py-14 text-center text-gray-600">
          No tickets match your filters.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50 border-b border-gray-800 text-left">
              <tr>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">#</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Title</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Submitter</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Category</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Status</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Priority</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Assignee</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-gray-800/60 last:border-0 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-600 text-xs">{t.id}</td>
                  <td className="px-4 py-3 max-w-xs">
                    <Link to={`/tickets/${t.id}`} className="text-pine-400 hover:text-pine-300 font-medium transition-colors truncate block">
                      {t.title}
                    </Link>
                    {t.ai_attempted === 1 && (
                      <span className="text-[10px] text-gray-600">🤖 AI consulted</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{t.submitter_name}</td>
                  <td className="px-4 py-3"><CategoryBadge category={t.category} /></td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{t.assignee_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
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
