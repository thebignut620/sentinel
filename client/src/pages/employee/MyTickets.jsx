import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge, PriorityBadge } from '../../components/Badges.jsx';
import api from '../../api/client.js';

export default function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get('/tickets').then(r => setTickets(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
        <Link
          to="/help"
          className="bg-blue-900 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + New Issue
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'open', 'in_progress', 'resolved', 'closed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
              filter === f
                ? 'bg-blue-900 text-white'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border py-14 text-center text-gray-400">
          {filter === 'all' ? 'You have no tickets yet.' : `No ${filter.replace('_', ' ')} tickets.`}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-left">
              <tr>
                <th className="px-4 py-3 text-gray-500 font-medium">#</th>
                <th className="px-4 py-3 text-gray-500 font-medium">Title</th>
                <th className="px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="px-4 py-3 text-gray-500 font-medium">Priority</th>
                <th className="px-4 py-3 text-gray-500 font-medium">Created</th>
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
                      <span className="ml-2 text-xs text-gray-400" title="AI was consulted">🤖</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-3 text-gray-400">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
