import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { StatusBadge, PriorityBadge } from '../components/Badges.jsx';
import api from '../api/client.js';

function StatCard({ label, value, colorClass }) {
  return (
    <div className={`rounded-xl border p-5 ${colorClass}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-1 font-medium">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tickets').then(r => setTickets(r.data)).finally(() => setLoading(false));
  }, []);

  const stats = {
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    total: tickets.length,
  };

  const ticketsLink = user.role === 'employee' ? '/my-tickets' : '/tickets';

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user.name}</h1>
        <p className="text-gray-500 text-sm mt-1 capitalize">{user.role.replace('_', ' ')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Open" value={stats.open} colorClass="bg-red-50 border-red-200 text-red-700" />
        <StatCard label="In Progress" value={stats.in_progress} colorClass="bg-amber-50 border-amber-200 text-amber-700" />
        <StatCard label="Resolved" value={stats.resolved} colorClass="bg-green-50 border-green-200 text-green-700" />
        <StatCard label="Total Tickets" value={stats.total} colorClass="bg-blue-50 border-blue-200 text-blue-700" />
      </div>

      {/* Employee CTA */}
      {user.role === 'employee' && (
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-xl p-6 text-white">
          <h2 className="text-lg font-semibold mb-1">Having an IT issue?</h2>
          <p className="text-blue-200 text-sm mb-4">
            Our AI assistant can solve most common issues instantly — no waiting required.
          </p>
          <Link
            to="/help"
            className="inline-block bg-white text-blue-900 font-semibold px-5 py-2 rounded-lg text-sm hover:bg-blue-50 transition-colors"
          >
            Get AI Help Now →
          </Link>
        </div>
      )}

      {/* Recent tickets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">
            {user.role === 'employee' ? 'My Recent Tickets' : 'Recent Tickets'}
          </h2>
          <Link to={ticketsLink} className="text-sm text-blue-600 hover:underline">
            View all →
          </Link>
        </div>

        {tickets.length === 0 ? (
          <div className="bg-white rounded-xl border py-12 text-center text-gray-400">
            No tickets yet
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-left">
                <tr>
                  <th className="px-4 py-3 text-gray-500 font-medium">Title</th>
                  <th className="px-4 py-3 text-gray-500 font-medium">Status</th>
                  <th className="px-4 py-3 text-gray-500 font-medium">Priority</th>
                  <th className="px-4 py-3 text-gray-500 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {tickets.slice(0, 6).map(t => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/tickets/${t.id}`} className="text-blue-600 hover:underline font-medium">
                        {t.title}
                      </Link>
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
    </div>
  );
}
