import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { StatusBadge, PriorityBadge } from '../components/Badges.jsx';
import { SkeletonStatCards, SkeletonCard } from '../components/Skeleton.jsx';
import api from '../api/client.js';

// ── Animated counter hook ─────────────────────────────────────────────────────
function useCounter(target, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#4aaa4a', height = 32 }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => d.count);
  const max = Math.max(...vals, 1);
  const w = 80, h = height;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="opacity-70">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
      {/* Fill gradient below line */}
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="url(#sg)"
        stroke="none"
        points={`0,${h} ${pts} ${w},${h}`}
      />
    </svg>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, icon, value, sub, accent, sparkData }) {
  const count = useCounter(value);
  const accentMap = {
    red:    { border: 'border-red-900/60',    icon: 'bg-red-900/50 text-red-400',    num: 'text-red-300' },
    amber:  { border: 'border-amber-900/60',  icon: 'bg-amber-900/50 text-amber-400',num: 'text-amber-300' },
    pine:   { border: 'border-pine-900/60',   icon: 'bg-pine-900/50 text-pine-400',  num: 'text-pine-300' },
    purple: { border: 'border-purple-900/60', icon: 'bg-purple-900/50 text-purple-400', num: 'text-purple-300' },
    blue:   { border: 'border-blue-900/60',   icon: 'bg-blue-900/50 text-blue-400',  num: 'text-blue-300' },
  };
  const a = accentMap[accent] || accentMap.pine;
  return (
    <div className={`card p-5 border ${a.border} hover:border-opacity-80 transition-all duration-200 hover:-translate-y-0.5`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${a.icon}`}>
          {icon}
        </div>
        {sparkData && <Sparkline data={sparkData} color={accent === 'red' ? '#f87171' : accent === 'amber' ? '#fbbf24' : '#4aaa4a'} />}
      </div>
      <div className={`text-3xl font-bold ${a.num} tabular-nums`}>{count}</div>
      <div className="text-sm text-gray-400 mt-0.5 font-medium">{label}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Weekly bar chart ──────────────────────────────────────────────────────────
function WeeklyChart({ data }) {
  if (!data || data.length === 0) return (
    <div className="flex items-center justify-center h-32 text-gray-600 text-sm">No data yet</div>
  );
  const max = Math.max(...data.map(d => d.count), 1);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return (
    <div className="flex items-end gap-1.5 h-28 mt-3">
      {data.map((d, i) => {
        const pct = (d.count / max) * 100;
        const dayName = days[new Date(d.day + 'T00:00:00').getDay()];
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700
                            text-gray-200 text-xs px-2 py-1 rounded shadow-xl whitespace-nowrap
                            opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {d.count} ticket{d.count !== 1 ? 's' : ''}
            </div>
            <div
              className="w-full rounded-t-md bg-pine-700/60 group-hover:bg-pine-500/80 transition-all duration-200"
              style={{ height: `${Math.max(pct, 4)}%` }}
            />
            <span className="text-[10px] text-gray-600">{dayName}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Category pie chart ────────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  software: '#4aaa4a',
  hardware: '#60a5fa',
  network:  '#a78bfa',
  access:   '#fbbf24',
  account:  '#f87171',
};

function PieChart({ data }) {
  if (!data || data.length === 0) return (
    <div className="flex items-center justify-center h-32 text-gray-600 text-sm">No data yet</div>
  );
  const total = data.reduce((s, d) => s + d.count, 0);
  let cumAngle = -Math.PI / 2;
  const cx = 56, cy = 56, r = 44;

  const slices = data.map(d => {
    const angle = (d.count / total) * Math.PI * 2;
    const startAngle = cumAngle;
    cumAngle += angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;
    return { ...d, path, color: CATEGORY_COLORS[d.category] || '#6b7280' };
  });

  return (
    <div className="flex items-center gap-4 mt-3">
      <svg width="112" height="112" className="shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} opacity="0.85" stroke="#111827" strokeWidth="1.5" />
        ))}
        <circle cx={cx} cy={cy} r="22" fill="#111827" />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="11" fill="#9ca3af">{total}</text>
      </svg>
      <div className="space-y-1.5 text-xs">
        {slices.map(s => (
          <div key={s.category} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-gray-400 capitalize">{s.category}</span>
            <span className="text-gray-600 ml-auto">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Activity feed ─────────────────────────────────────────────────────────────
function ActivityFeed({ items }) {
  if (!items || items.length === 0) return (
    <div className="text-gray-600 text-sm py-4 text-center">No recent activity</div>
  );
  return (
    <div className="space-y-2 mt-3">
      {items.map(item => (
        <Link
          key={item.id}
          to={`/tickets/${item.id}`}
          className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-800 transition-colors group"
        >
          <div className="h-7 w-7 rounded-full bg-pine-900/60 border border-pine-800/40 flex items-center justify-center text-pine-400 text-xs font-bold shrink-0">
            #{item.id}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-300 truncate group-hover:text-white transition-colors">{item.title}</p>
            <p className="text-xs text-gray-600">
              {new Date(item.updated_at).toLocaleDateString()} · {item.updated_by}
            </p>
          </div>
          <div className="shrink-0">
            <StatusBadge status={item.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Health Score Widget ────────────────────────────────────────────────────────
function HealthScoreWidget() {
  const { token } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/analytics/health-score', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {});
  }, [token]);

  if (!data) return null;

  const score = data.score;
  const color = score >= 85 ? '#4aaa4a' : score >= 70 ? '#fbbf24' : '#ef4444';
  const bgColor = score >= 85 ? 'border-green-900/60' : score >= 70 ? 'border-amber-900/60' : 'border-red-900/60';
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={`card p-5 border ${bgColor}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold text-gray-200 text-sm">Sentinel Health Score</h2>
          <p className="text-xs text-gray-600 mt-0.5">Last 30 days</p>
        </div>
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
      </div>

      <div className="flex items-center gap-5">
        <svg width="90" height="90" className="shrink-0">
          <circle cx="45" cy="45" r="40" fill="none" stroke="#1f2937" strokeWidth="8" />
          <circle
            cx="45" cy="45" r="40" fill="none"
            stroke={color} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 45 45)"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
          <text x="45" y="50" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>
            {data.grade}
          </text>
        </svg>

        <div className="space-y-1.5 flex-1 text-xs">
          {Object.entries(data.breakdown).map(([key, b]) => {
            const labels = {
              resolution: 'Resolution Rate',
              avgResolutionTime: 'Response Time',
              satisfaction: 'Satisfaction',
              atlasAutonomy: 'ATLAS Rate',
              volumeTrend: 'Volume Trend',
              recurringIssues: 'Recurring Issues',
            };
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-gray-500 w-28 shrink-0">{labels[key]}</span>
                <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(b.score / b.max) * 100}%`, background: color }}
                  />
                </div>
                <span className="text-gray-400 w-8 text-right">{b.score}/{b.max}</span>
              </div>
            );
          })}
        </div>
      </div>
      {score < 70 && (
        <p className="mt-3 text-xs text-red-400 flex items-center gap-1">
          ⚠️ Health score is below threshold. Check Analytics for details.
        </p>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    console.log('[Dashboard] fetching /dashboard for role:', user?.role);
    api.get('/dashboard')
      .then(r => {
        console.log('[Dashboard] response:', r.status, r.data);
        setStats(r.data);
      })
      .catch(err => {
        console.error('[Dashboard] error:', err.response?.status, err.response?.data, err.message);
        setError(err.response?.data?.error || err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const ticketsLink = user.role === 'employee' ? '/my-tickets' : '/tickets';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-64" />
        <SkeletonStatCards />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <SkeletonCard className="lg:col-span-2" />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="card p-8 text-center space-y-2">
        <p className="text-red-400 font-medium text-sm">Failed to load dashboard</p>
        <p className="text-gray-600 text-xs font-mono">{error || 'No data returned'}</p>
        <p className="text-gray-700 text-xs mt-2">Check the browser console and Railway logs for details.</p>
        <button onClick={() => window.location.reload()} className="btn-secondary px-4 py-2 text-xs mt-2">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn relative">
      {/* Dot grid background */}
      <div className="fixed inset-0 dot-grid opacity-30 pointer-events-none" />
      {/* Welcome */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{greeting}, {user.name.split(' ')[0]} 👋</h1>
          <p className="text-gray-500 text-sm mt-0.5 capitalize">{user.role.replace('_', ' ')} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 flex-wrap">
          {user.role === 'employee' ? (
            <>
              <Link to="/help" className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
                <span>+</span> Get AI Help
              </Link>
              <Link to="/my-tickets" className="btn-secondary px-4 py-2 text-sm">
                My Tickets
              </Link>
            </>
          ) : (
            <>
              <Link to="/tickets?status=open" className="btn-primary px-4 py-2 text-sm">
                Open Tickets
              </Link>
              <Link to="/tickets?priority=critical" className="btn-secondary px-4 py-2 text-sm">
                Critical
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Open Tickets"
          accent="red"
          value={stats.open}
          sparkData={stats.last7Days}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
        <StatCard
          label="Resolved Today"
          accent="pine"
          value={stats.resolvedToday}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          label="Critical Alerts"
          accent="amber"
          value={stats.critical}
          sub={stats.critical > 0 ? 'Needs attention' : 'All clear'}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
        />
        <StatCard
          label="Avg Resolution"
          accent="blue"
          value={stats.avgResolutionHours != null ? Math.round(stats.avgResolutionHours) : 0}
          sub={stats.avgResolutionHours != null ? `${stats.avgResolutionHours}h average` : 'No data yet'}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* Employee CTA */}
      {user.role === 'employee' && (
        <div className="relative overflow-hidden bg-gradient-to-r from-pine-900 to-pine-800 rounded-xl p-6 border border-pine-700/40">
          <div className="absolute right-0 top-0 w-48 h-48 bg-pine-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <h2 className="text-lg font-semibold text-white mb-1">Having an IT issue?</h2>
          <p className="text-pine-300 text-sm mb-4">
            Our AI assistant can solve most common issues instantly — no waiting required.
          </p>
          <Link
            to="/help"
            className="inline-flex items-center gap-2 bg-white text-pine-900 font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-pine-50 transition-colors active:scale-95"
          >
            Get AI Help Now →
          </Link>
        </div>
      )}

      {/* Health Score — admin/staff only */}
      {user.role !== 'employee' && <HealthScoreWidget />}

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Weekly trend */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-gray-200 text-sm">Weekly Ticket Trend</h2>
          <p className="text-xs text-gray-600 mt-0.5">Tickets created in the last 7 days</p>
          <WeeklyChart data={stats.last7Days} />
        </div>

        {/* Category pie */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-200 text-sm">By Category</h2>
          <p className="text-xs text-gray-600 mt-0.5">Ticket distribution</p>
          <PieChart data={stats.categoryDist} />
        </div>
      </div>

      {/* Activity feed */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-200 text-sm">Recent Activity</h2>
            <p className="text-xs text-gray-600 mt-0.5">Latest ticket updates</p>
          </div>
          <Link to={ticketsLink} className="text-xs text-pine-400 hover:text-pine-300 transition-colors">
            View all →
          </Link>
        </div>
        <ActivityFeed items={stats.recentActivity} />
      </div>
    </div>
  );
}
