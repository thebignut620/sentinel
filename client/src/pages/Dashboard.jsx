import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { useSession } from '../contexts/SessionContext.jsx';
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
function HealthScoreWidget({ sessionStart, sessionName }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const params = sessionStart ? { session_start: sessionStart } : {};
    api.get('/analytics/health-score', { params })
      .then(r => setData(r.data))
      .catch(() => {});
  }, [sessionStart]);

  if (!data) return null;

  const score = data.score;
  const color = score >= 85 ? '#4aaa4a' : score >= 70 ? '#fbbf24' : '#ef4444';
  const bgColor = score >= 85 ? 'border-green-900/60' : score >= 70 ? 'border-amber-900/60' : 'border-red-900/60';
  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (score / 100) * circumference;

  const periodLabel = sessionStart
    ? (sessionName ? `Session: ${sessionName}` : 'Current session')
    : 'Last 30 days';

  const LABELS = {
    resolution: 'Resolution Rate',
    avgResolutionTime: 'Response Time',
    satisfaction: 'Satisfaction',
    atlasAutonomy: 'ATLAS Rate',
    volumeTrend: 'Volume Trend',
    recurringIssues: 'Recurring Issues',
  };

  // Fresh session: zero tickets, perfect score
  if (data.fresh) {
    return (
      <div className="card p-6 border border-green-900/60">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex flex-col items-center gap-1 shrink-0 mx-auto md:mx-0">
            <svg width="120" height="120" viewBox="0 0 140 140" className="w-28 h-28 sm:w-36 sm:h-36">
              <circle cx="70" cy="70" r="60" fill="none" stroke="#1f2937" strokeWidth="12" />
              <circle
                cx="70" cy="70" r="60" fill="none"
                stroke="#4aaa4a" strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={0}
                transform="rotate(-90 70 70)"
                style={{ transition: 'stroke-dashoffset 1.2s ease' }}
              />
              <text x="70" y="62" textAnchor="middle" fontSize="28" fontWeight="bold" fill="#4aaa4a">100</text>
              <text x="70" y="82" textAnchor="middle" fontSize="13" fill="#9ca3af">/ 100</text>
              <text x="70" y="101" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#4aaa4a">A</text>
            </svg>
            <p className="text-xs text-gray-500">Sentinel Health Score</p>
            <p className="text-[10px] text-gray-600">{periodLabel}</p>
          </div>
          <div className="flex-1">
            <h2 className="text-white font-semibold text-base mb-2">System Health Breakdown</h2>
            <p className="text-pine-400 text-sm font-medium">{data.message}</p>
            <p className="text-gray-500 text-xs mt-2">
              All metrics will populate as tickets are submitted this session.
            </p>
            <div className="mt-4 space-y-2">
              {Object.entries(LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500 w-24 sm:w-36 shrink-0 text-xs">{label}</span>
                  <div className="flex-1 h-2 bg-pine-900/40 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-pine-600/50 rounded-full" />
                  </div>
                  <span className="text-gray-600 w-12 text-right text-xs font-mono">
                    {data.breakdown[key].score}/{data.breakdown[key].max}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card p-6 border ${bgColor}`}>
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        {/* Gauge */}
        <div className="flex flex-col items-center gap-1 shrink-0 mx-auto md:mx-0">
          <svg width="120" height="120" viewBox="0 0 140 140" className="w-28 h-28 sm:w-36 sm:h-36">
            <circle cx="70" cy="70" r="60" fill="none" stroke="#1f2937" strokeWidth="12" />
            <circle
              cx="70" cy="70" r="60" fill="none"
              stroke={color} strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 70 70)"
              style={{ transition: 'stroke-dashoffset 1.2s ease' }}
            />
            <text x="70" y="62" textAnchor="middle" fontSize="28" fontWeight="bold" fill={color}>{score}</text>
            <text x="70" y="82" textAnchor="middle" fontSize="13" fill="#9ca3af">/ 100</text>
            <text x="70" y="101" textAnchor="middle" fontSize="18" fontWeight="bold" fill={color}>{data.grade}</text>
          </svg>
          <p className="text-xs text-gray-500">Sentinel Health Score</p>
          <p className="text-[10px] text-gray-600">{periodLabel}</p>
        </div>

        {/* Breakdown */}
        <div className="flex-1 space-y-2.5">
          <h2 className="text-white font-semibold text-base mb-3">System Health Breakdown</h2>
          {Object.entries(data.breakdown).map(([key, b]) => {
            const isNoTrend = key === 'volumeTrend' && b.hasPrevious === false;
            return (
              <div key={key} className="flex items-center gap-3 text-sm">
                <span className="text-gray-400 w-24 sm:w-36 shrink-0 text-xs sm:text-sm">{LABELS[key]}</span>
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: isNoTrend ? '100%' : `${(b.score / b.max) * 100}%`,
                      background: isNoTrend ? '#374151' : color,
                    }}
                  />
                </div>
                <span className="text-gray-300 w-16 text-right text-xs font-mono">
                  {isNoTrend ? '— / 10' : `${b.score}/${b.max}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {score < 70 && (
        <div className="mt-4 px-4 py-2.5 bg-red-900/20 border border-red-800/50 rounded-lg">
          <p className="text-sm text-red-400 flex items-center gap-2">
            <span>⚠️</span>
            <span>Health score is below the 70-point threshold. <Link to="/admin/analytics" className="underline hover:text-red-300">View Analytics →</Link></span>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Start Session Modal ───────────────────────────────────────────────────────
function StartSessionModal({ onClose, onSuccess }) {
  const [sessionName, setSessionName] = useState('');
  const [password, setPassword]       = useState('');
  const [error, setError]             = useState('');
  const [saving, setSaving]           = useState(false);
  const passwordRef = useRef(null);

  useEffect(() => { passwordRef.current?.focus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!password) { setError('Password is required.'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/sessions/start', {
        password,
        name: sessionName.trim() || undefined,
      });
      onSuccess(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start session. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-xl bg-pine-900/60 border border-pine-800/40 flex items-center justify-center text-pine-400 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-semibold text-base">Start Fresh Session</h2>
              <p className="text-gray-500 text-xs">Reset your reporting window</p>
            </div>
          </div>

          <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-4 mb-5 text-sm text-gray-400 leading-relaxed">
            Starting a new session gives you a clean reporting window — like pressing reset on a scoreboard.
            <strong className="text-gray-300"> Nothing is deleted.</strong> All tickets, history, and analytics are preserved.
            Session History lets you compare performance across time periods.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Session Name <span className="text-gray-600">(optional)</span></label>
              <input
                type="text"
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
                placeholder={`e.g. Q2 2026 or Post-migration`}
                className="input w-full"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Confirm your password</label>
              <input
                ref={passwordRef}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input w-full"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2 text-sm" disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-2" disabled={saving}>
                {saving ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : null}
                {saving ? 'Starting…' : 'Start Session'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { currentSession, sessionStart, sessionLoaded, startSession } = useSession();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);

  // Fetch dashboard stats — waits for session check, re-runs when sessionStart changes
  useEffect(() => {
    if (!sessionLoaded) return;
    setLoading(true);
    setError(null);
    const params = sessionStart ? { session_start: sessionStart } : {};
    console.log('[Dashboard] fetching /dashboard — session_start:', sessionStart ?? 'none (all-time)', '| params:', JSON.stringify(params));
    api.get('/dashboard', { params })
      .then(r => setStats(r.data))
      .catch(err => {
        console.error('[Dashboard] error:', err.response?.status, err.response?.data, err.message);
        setError(err.response?.data?.error || err.message);
      })
      .finally(() => setLoading(false));
  }, [sessionLoaded, sessionStart]);

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

  const handleSessionSuccess = (session) => {
    startSession(session); // updates context → triggers dashboard re-fetch via useEffect
    setShowSessionModal(false);
    addToast(`Session "${session.name}" started. Dashboard updated.`, 'success');
  };

  return (
    <div className="space-y-6 animate-fadeIn relative">
      {showSessionModal && (
        <StartSessionModal
          onClose={() => setShowSessionModal(false)}
          onSuccess={handleSessionSuccess}
        />
      )}
      {/* Dot grid background */}
      <div className="fixed inset-0 dot-grid opacity-30 pointer-events-none" />
      {/* Welcome */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{greeting}, {user.name.split(' ')[0]} 👋</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5 capitalize">{user.role.replace('_', ' ')} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          {/* Current session indicator — admin/staff only */}
          {currentSession && (() => {
            const daysRunning = Math.max(0, Math.floor((Date.now() - new Date(currentSession.started_at)) / 86400000));
            return (
              <p className="text-xs text-pine-500 mt-0.5 flex items-center gap-1">
                <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="4" />
                </svg>
                <span className="font-medium">{currentSession.name}</span>
                <span className="text-pine-700">·</span>
                <span>{daysRunning === 0 ? 'started today' : `${daysRunning} day${daysRunning !== 1 ? 's' : ''} running`}</span>
              </p>
            );
          })()}
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 flex-wrap w-full sm:w-auto items-center">
          {user.role === 'employee' ? (
            <>
              <Link to="/help" className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5 flex-1 sm:flex-none justify-center">
                <span>+</span> Get AI Help
              </Link>
              <Link to="/my-tickets" className="btn-secondary px-4 py-2 text-sm flex-1 sm:flex-none text-center">
                My Tickets
              </Link>
            </>
          ) : (
            <>
              <Link to="/tickets?status=open" className="btn-primary px-4 py-2 text-sm flex-1 sm:flex-none text-center">
                Open Tickets
              </Link>
              <Link to="/tickets?priority=critical" className="btn-secondary px-4 py-2 text-sm flex-1 sm:flex-none text-center">
                Critical
              </Link>
              <button
                onClick={() => setShowSessionModal(true)}
                title="Start a fresh session"
                className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors border border-gray-800 hover:border-gray-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Health Score — admin/staff only, filtered by active session */}
      {user.role !== 'employee' && (
        <HealthScoreWidget sessionStart={sessionStart} sessionName={currentSession?.name} />
      )}

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
