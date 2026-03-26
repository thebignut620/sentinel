import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge, PriorityBadge, CategoryBadge } from '../../components/Badges.jsx';
import { SkeletonTable } from '../../components/Skeleton.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import SentimentBadge from '../../components/SentimentBadge.jsx';
import sentinelLogo from '../../assets/sentinel_logo.png';
import api from '../../api/client.js';
import { useSession } from '../../contexts/SessionContext.jsx';

const PRIORITY_STRIP = { critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-gray-600' };
const CATEGORY_ICONS = { hardware:'🖥', software:'💾', network:'🌐', access:'🔑', account:'👤' };

function isNew(createdAt) {
  return Date.now() - new Date(createdAt).getTime() < 48 * 3_600_000;
}

function OpenAge({ createdAt }) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  return <span className="text-xs text-gray-600">{d > 0 ? `${d}d ${h%24}h` : `${h}h`} open</span>;
}

function initials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export default function MyTickets() {
  const { sessionStart } = useSession();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');
  const [search, setSearch]   = useState('');

  useEffect(() => {
    const params = sessionStart ? { session_start: sessionStart } : {};
    console.log('[MyTickets] fetching /tickets — session_start:', sessionStart ?? 'none');
    api.get('/tickets', { params }).then(r => setTickets(r.data)).finally(() => setLoading(false));
  }, [sessionStart]);

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
        <Link to="/help" className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
          <span>+</span> New Issue
        </Link>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search tickets…" className="w-full max-w-sm" />

      <div className="flex gap-2 flex-wrap">
        {['all','open','in_progress','resolved','closed'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all duration-150 active:scale-95 ${
              filter === f ? 'bg-pine-700 text-white' : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'
            }`}>
            {f.replace('_',' ')}
            <span className={`ml-1.5 ${filter === f ? 'text-pine-200' : 'text-gray-600'}`}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonTable rows={4} />
      ) : filtered.length === 0 ? (
        <div className="card py-16 text-center animate-fadeIn">
          {filter === 'all' && !search ? (
            <div className="flex flex-col items-center gap-4">
              <img src={sentinelLogo} alt="Sentinel" className="h-12 w-auto opacity-20" />
              <div>
                <p className="text-gray-400 font-medium">No tickets yet.</p>
                <p className="text-gray-600 text-sm mt-1">Your systems are running clean.</p>
              </div>
              <Link to="/help" className="btn-primary px-5 py-2 text-sm mt-1">
                Report an Issue
              </Link>
            </div>
          ) : (
            <p className="text-gray-600">No tickets match your search.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <Link key={t.id} to={`/tickets/${t.id}`}
              className="flex rounded-xl overflow-hidden border border-gray-800 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40 hover:border-gray-700 transition-all duration-200 bg-gray-900 group">
              {/* Priority strip */}
              <div className={`w-1 shrink-0 ${PRIORITY_STRIP[t.priority]}`} />
              {/* Content */}
              <div className="flex-1 px-4 py-3 flex items-center gap-3 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {isNew(t.created_at) && (
                      <span className="h-1.5 w-1.5 rounded-full bg-pine-400 shrink-0 animate-pulse" title="New" />
                    )}
                    <span className="text-xs text-gray-600">#{t.id}</span>
                    <span className="text-sm">{CATEGORY_ICONS[t.category]}</span>
                    {t.ai_attempted === 1 && <span className="text-xs text-gray-600">🤖</span>}
                  </div>
                  <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors truncate">{t.title}</p>
                </div>
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <CategoryBadge category={t.category} />
                  <StatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                  {t.sentiment && t.sentiment !== 'calm' && <SentimentBadge sentiment={t.sentiment} size="xs" />}
                </div>
                {t.assignee_name && (
                  <div className="h-7 w-7 rounded-full bg-pine-900/60 border border-pine-800/40 flex items-center justify-center text-pine-400 text-[9px] font-bold shrink-0">
                    {initials(t.assignee_name)}
                  </div>
                )}
                <div className="hidden md:block shrink-0">
                  <OpenAge createdAt={t.created_at} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
