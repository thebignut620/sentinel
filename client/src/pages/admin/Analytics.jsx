import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/client.js';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n, unit = '') {
  if (n === null || n === undefined) return '—';
  return `${n}${unit}`;
}

function StatCard({ label, value, sub, accent = false }) {
  return (
    <div className={`rounded-xl border p-4 ${accent
      ? 'bg-pine-900/30 border-pine-700/40'
      : 'bg-gray-900 border-gray-800'}`}>
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-pine-300' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// Simple SVG bar chart
function BarChart({ data, height = 140, color = '#4aaa4a' }) {
  if (!data?.length) return <div className="h-32 flex items-center justify-center text-gray-600 text-sm">No data</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  const barW = Math.max(4, Math.floor(500 / data.length) - 3);

  return (
    <div className="overflow-x-auto">
      <svg width={Math.max(500, data.length * (barW + 3))} height={height + 28} className="block">
        {data.map((d, i) => {
          const h = Math.round((d.count / max) * height);
          const x = i * (barW + 3);
          return (
            <g key={i}>
              <rect
                x={x} y={height - h} width={barW} height={h}
                rx={2} fill={color} opacity={0.85}
              />
              <title>{d.label}: {d.count}</title>
              {data.length <= 14 && (
                <text
                  x={x + barW / 2} y={height + 18}
                  textAnchor="middle" fontSize={8} fill="#666"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Heatmap cell color
function heatColor(count, max) {
  if (!count || !max) return '#1a1a1a';
  const pct = count / max;
  if (pct < 0.2) return '#1a2e1a';
  if (pct < 0.4) return '#1e4a1e';
  if (pct < 0.6) return '#2d6a2d';
  if (pct < 0.8) return '#3a8a3a';
  return '#4aaa4a';
}

const TABS = [
  { id: 'realtime',    label: 'Real-time',      icon: '⚡' },
  { id: 'staff',       label: 'Staff',           icon: '🏆' },
  { id: 'volume',      label: 'Volume',          icon: '📊' },
  { id: 'heatmap',     label: 'Peak Hours',      icon: '🔥' },
  { id: 'issues',      label: 'Common Issues',   icon: '🔍' },
  { id: 'cost',        label: 'Cost Analysis',   icon: '💰' },
  { id: 'satisfaction',label: 'Satisfaction',    icon: '😊' },
  { id: 'reports',     label: 'Reports',         icon: '📄' },
];

// ─── TAB: REAL-TIME ───────────────────────────────────────────────────────────
function RealtimeTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [pulse, setPulse] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/analytics/realtime');
      setData(r.data);
      setLastUpdated(new Date());
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    } catch {/* ignore */} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading) return <div className="text-gray-500 py-8 text-center">Loading…</div>;

  return (
    <div>
      {/* Live indicator */}
      <div className="flex items-center gap-3 mb-6">
        <span className="relative flex h-3 w-3">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-pine-400 opacity-75 ${pulse ? 'opacity-100' : ''}`} />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-pine-500" />
        </span>
        <span className="text-pine-400 text-sm font-semibold tracking-wide">LIVE</span>
        <span className="text-gray-600 text-xs">Auto-refreshes every 30 seconds</span>
        {lastUpdated && (
          <span className="ml-auto text-gray-600 text-xs">
            Last update: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Open Tickets" value={fmt(data?.open)} accent />
        <StatCard label="In Progress" value={fmt(data?.inProgress)} />
        <StatCard label="Resolved Today" value={fmt(data?.resolvedToday)} accent />
        <StatCard label="Total Tickets" value={fmt(data?.total)} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard
          label="Avg Resolution"
          value={data?.avgResolutionHours ? `${data.avgResolutionHours}h` : '—'}
          sub="all time"
        />
        <StatCard
          label="ATLAS Handled"
          value={fmt(data?.atlasHandled)}
          sub="AI-assisted tickets"
          accent
        />
        <StatCard
          label="Tickets This Hour"
          value={fmt(data?.ticketsThisHour)}
          sub="last 60 minutes"
        />
      </div>
    </div>
  );
}

// ─── TAB: STAFF PERFORMANCE ───────────────────────────────────────────────────
function StaffTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/staff-performance')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500 py-8 text-center">Loading…</div>;
  if (!data?.length) return <div className="text-gray-500 py-8 text-center">No staff data yet.</div>;

  const maxResolved = Math.max(...data.map(s => s.resolved_count), 1);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">IT Staff Leaderboard</h3>
      <div className="space-y-3">
        {data.map((s, i) => (
          <div key={s.id} className={`rounded-xl border p-4 ${i === 0 ? 'bg-pine-900/20 border-pine-700/40' : 'bg-gray-900 border-gray-800'}`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl w-8">{medals[i] || `#${i + 1}`}</span>
              <div className="flex-1">
                <p className="font-semibold text-white">{s.name}</p>
                <div className="h-1.5 bg-gray-800 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-pine-500 rounded-full transition-all duration-700"
                    style={{ width: `${Math.round((s.resolved_count / maxResolved) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="text-pine-300 font-bold text-lg">{s.resolved_count}</p>
                <p className="text-gray-600 text-xs">resolved</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-800/60 rounded-lg p-2">
                <p className="text-white text-sm font-medium">
                  {s.avg_resolution_hours != null ? `${s.avg_resolution_hours}h` : '—'}
                </p>
                <p className="text-gray-500 text-xs">Avg Time</p>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-2">
                <p className="text-white text-sm font-medium">{s.fcr_rate}%</p>
                <p className="text-gray-500 text-xs">FCR Rate</p>
              </div>
              <div className="bg-gray-800/60 rounded-lg p-2">
                <p className={`text-sm font-medium ${s.sat_score != null ? (s.sat_score >= 80 ? 'text-pine-400' : s.sat_score >= 60 ? 'text-yellow-400' : 'text-red-400') : 'text-gray-500'}`}>
                  {s.sat_score != null ? `${s.sat_score}%` : '—'}
                </p>
                <p className="text-gray-500 text-xs">Satisfaction</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Resolution time breakdown link */}
      <p className="text-gray-600 text-xs mt-4 text-center">FCR = First Contact Resolution rate</p>
    </div>
  );
}

// ─── TAB: VOLUME ──────────────────────────────────────────────────────────────
function VolumeTab() {
  const [period, setPeriod] = useState('day');
  const [data, setData] = useState(null);
  const [resTime, setResTime] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/analytics/volume?period=${period}`),
      api.get('/analytics/resolution-time'),
    ])
      .then(([vr, rr]) => { setData(vr.data); setResTime(rr.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  const total = data?.reduce((s, d) => s + Number(d.count), 0) || 0;

  return (
    <div>
      {/* Period selector */}
      <div className="flex gap-2 mb-6">
        {['day', 'week', 'month'].map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              period === p
                ? 'bg-pine-700 text-pine-200'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {p === 'day' ? 'Daily (30d)' : p === 'week' ? 'Weekly (12w)' : 'Monthly (12mo)'}
          </button>
        ))}
        <span className="ml-auto text-gray-500 text-sm self-center">
          {total} tickets in period
        </span>
      </div>

      {loading
        ? <div className="text-gray-500 py-8 text-center">Loading…</div>
        : <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <BarChart data={data} />
          </div>
      }

      {/* Resolution time breakdown */}
      {resTime && (
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          {/* By category */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Avg Resolution by Category</h4>
            <div className="space-y-2">
              {resTime.byCategory.map(r => (
                <div key={r.category} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 capitalize">{r.category}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-xs">{r.count} tickets</span>
                    <span className="text-pine-300 font-medium w-16 text-right">
                      {r.avg_hours != null ? `${r.avg_hours}h` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* By priority */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Avg Resolution by Priority</h4>
            <div className="space-y-2">
              {resTime.byPriority.map(r => {
                const color = r.priority === 'critical' ? 'text-red-400' :
                  r.priority === 'high' ? 'text-orange-400' :
                  r.priority === 'medium' ? 'text-yellow-400' : 'text-green-400';
                return (
                  <div key={r.priority} className="flex items-center justify-between text-sm">
                    <span className={`capitalize font-medium ${color}`}>{r.priority}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-xs">{r.count} tickets</span>
                      <span className="text-white font-medium w-16 text-right">
                        {r.avg_hours != null ? `${r.avg_hours}h` : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: PEAK HOURS HEATMAP ──────────────────────────────────────────────────
function HeatmapTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    api.get('/analytics/peak-hours')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500 py-8 text-center">Loading…</div>;
  if (!data) return null;

  const { matrix, maxCount, days } = data;
  const hours = Array.from({ length: 24 }, (_, h) => {
    if (h === 0) return '12am';
    if (h < 12) return `${h}am`;
    if (h === 12) return '12pm';
    return `${h - 12}pm`;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Ticket Creation Heatmap</h3>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Low</span>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((p, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded"
              style={{ background: heatColor(p, 1) }}
            />
          ))}
          <span>High</span>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
        <div className="flex gap-1">
          {/* Hour labels */}
          <div className="flex flex-col gap-1 mr-2" style={{ minWidth: 36 }}>
            <div className="h-6" /> {/* spacer for day row */}
            {hours.map(h => (
              <div key={h} className="h-5 flex items-center justify-end">
                <span className="text-gray-600 text-[10px] whitespace-nowrap">{h}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, di) => (
            <div key={day} className="flex flex-col gap-1" style={{ minWidth: 28 }}>
              <div className="h-6 flex items-center justify-center">
                <span className="text-gray-500 text-xs font-medium">{day}</span>
              </div>
              {hours.map((_, hi) => {
                const count = matrix[di]?.[hi] || 0;
                return (
                  <div
                    key={hi}
                    className="h-5 w-7 rounded-sm cursor-default transition-transform hover:scale-110"
                    style={{ background: heatColor(count, maxCount) }}
                    onMouseEnter={() => setTooltip({ day, hour: hours[hi], count })}
                    onMouseLeave={() => setTooltip(null)}
                    title={`${day} ${hours[hi]}: ${count} tickets`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {tooltip && (
        <div className="mt-2 text-center text-sm text-gray-400">
          <span className="text-pine-300 font-medium">{tooltip.day} at {tooltip.hour}</span>
          {' '}— <span className="text-white">{tooltip.count} ticket{tooltip.count !== 1 ? 's' : ''}</span>
        </div>
      )}

      <p className="text-gray-600 text-xs mt-3 text-center">
        Based on all tickets in the system. Times are server UTC.
      </p>
    </div>
  );
}

// ─── TAB: COMMON ISSUES ───────────────────────────────────────────────────────
function IssuesTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/common-issues')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500 py-8 text-center">Loading…</div>;
  if (!data) return null;

  const maxTotal = Math.max(...(data.byCategory || []).map(c => c.total), 1);

  return (
    <div>
      <div className="grid md:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Issues by Category</h3>
          <div className="space-y-3">
            {data.byCategory.map(c => (
              <div key={c.category} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium capitalize">{c.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{c.total} tickets</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.atlas_rate >= 70
                          ? 'bg-pine-900/50 text-pine-300'
                          : c.atlas_rate >= 40
                          ? 'bg-yellow-900/40 text-yellow-300'
                          : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      {c.atlas_rate}% ATLAS
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pine-600 rounded-full"
                    style={{ width: `${Math.round((c.total / maxTotal) * 100)}%` }}
                  />
                </div>
                <p className="text-gray-600 text-xs mt-1">
                  {c.resolved} resolved · {c.atlas_resolved} by ATLAS
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Top keywords */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Top Issue Keywords</h3>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex flex-wrap gap-2">
              {data.topKeywords.map(({ word, count }) => (
                <span
                  key={word}
                  className="px-3 py-1 rounded-full text-sm border border-gray-700 text-gray-300"
                  style={{
                    fontSize: `${Math.max(11, Math.min(16, 10 + count * 0.5))}px`,
                    opacity: Math.max(0.5, Math.min(1, 0.4 + count * 0.04)),
                  }}
                  title={`${count} mentions`}
                >
                  {word}
                  <span className="ml-1 text-pine-500 text-xs">{count}</span>
                </span>
              ))}
            </div>
          </div>

          {/* ATLAS resolution rate explanation */}
          <div className="mt-4 bg-pine-900/20 border border-pine-800/40 rounded-xl p-4">
            <p className="text-pine-300 text-sm font-medium mb-1">About ATLAS Rate</p>
            <p className="text-gray-400 text-xs leading-relaxed">
              The ATLAS% shows how often AI resolved tickets in each category without
              full human intervention. Higher = more automation savings for your team.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: COST ANALYSIS ───────────────────────────────────────────────────────
function CostTab() {
  const [costPerTicket, setCostPerTicket] = useState(25);
  const [atlasHandledCost, setAtlasHandledCost] = useState(3);
  const [minutesPerTicket, setMinutesPerTicket] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const r = await api.get('/analytics/cost-savings', {
        params: { costPerTicket, atlasHandledCost, minutesPerTicket },
      });
      setData(r.data);
    } catch {/* ignore */} finally {
      setLoading(false);
    }
  }, [costPerTicket, atlasHandledCost, minutesPerTicket]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div>
      {/* Calculator inputs */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-widest">Calculator Settings</h3>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { label: 'Cost per manual ticket ($)', value: costPerTicket, set: setCostPerTicket, min: 5, max: 200, step: 5 },
            { label: 'Cost per ATLAS ticket ($)', value: atlasHandledCost, set: setAtlasHandledCost, min: 1, max: 20, step: 1 },
            { label: 'Avg minutes per manual ticket', value: minutesPerTicket, set: setMinutesPerTicket, min: 5, max: 120, step: 5 },
          ].map(({ label, value, set, min, max, step }) => (
            <div key={label}>
              <label className="text-gray-400 text-xs block mb-2">{label}</label>
              <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={e => set(Number(e.target.value))}
                className="w-full accent-pine-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>${min || min}{ label.includes('minutes') ? ' min' : ''}</span>
                <span className="text-pine-300 font-semibold text-sm">
                  {label.includes('minutes') ? `${value} min` : `$${value}`}
                </span>
                <span>{max}{label.includes('minutes') ? ' min' : ''}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading
        ? <div className="text-gray-500 py-8 text-center">Loading…</div>
        : data && (
          <>
            {/* Main savings card */}
            <div className="bg-pine-900/30 border border-pine-700/50 rounded-2xl p-6 mb-6 text-center">
              <p className="text-pine-400 text-sm uppercase tracking-widest mb-2">Estimated IT Savings</p>
              <p className="text-5xl font-black text-white">
                ${data.totalSavings.toLocaleString()}
              </p>
              <p className="text-pine-300 text-sm mt-2">
                {data.hoursSaved} staff hours saved · {data.savingsRate}% of tickets handled by ATLAS
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Tickets" value={fmt(data.totalTickets)} />
              <StatCard label="ATLAS Handled" value={fmt(data.atlasHandled)} accent />
              <StatCard label="Manual Tickets" value={fmt(data.manualTickets)} />
              <StatCard label="Fully Automated" value={fmt(data.fullyAutomated)} accent />
            </div>

            {/* Monthly trend */}
            {data.monthly?.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">Monthly Breakdown (last 6 months)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs">
                        <th className="text-left py-2">Month</th>
                        <th className="text-right py-2">Total</th>
                        <th className="text-right py-2">ATLAS</th>
                        <th className="text-right py-2">Savings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.monthly.map(m => {
                        const saving = m.atlas_handled * (costPerTicket - atlasHandledCost);
                        return (
                          <tr key={m.month} className="border-t border-gray-800">
                            <td className="py-2 text-gray-300">{m.month}</td>
                            <td className="py-2 text-right text-gray-400">{m.total}</td>
                            <td className="py-2 text-right text-pine-400">{m.atlas_handled}</td>
                            <td className="py-2 text-right text-white font-medium">${Math.round(saving)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )
      }
    </div>
  );
}

// ─── TAB: SATISFACTION ────────────────────────────────────────────────────────
function SatisfactionTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/satisfaction')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500 py-8 text-center">Loading…</div>;
  if (!data) return null;

  const rate = data.satisfaction_rate;

  return (
    <div>
      {/* Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="md:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center">
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Overall Satisfaction</p>
          {rate != null ? (
            <>
              <p className={`text-5xl font-black ${rate >= 80 ? 'text-pine-400' : rate >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {rate}%
              </p>
              <div className="flex gap-4 mt-3 text-sm">
                <span className="text-gray-400">👍 {data.thumbs_up}</span>
                <span className="text-gray-400">👎 {data.thumbs_down}</span>
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-lg">No ratings yet</p>
          )}
        </div>
        <StatCard label="Surveys Sent" value={fmt(data.total_sent)} />
        <StatCard label="Responses" value={fmt(data.total_rated)} sub={data.total_sent > 0 ? `${Math.round((data.total_rated / data.total_sent) * 100)}% response rate` : ''} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* By staff */}
        {data.byStaff?.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Satisfaction by Staff</h4>
            <div className="space-y-2">
              {data.byStaff.map(s => (
                <div key={s.staff_name} className="flex items-center gap-3">
                  <span className="text-gray-300 text-sm flex-1 truncate">{s.staff_name}</span>
                  <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.rate >= 80 ? 'bg-pine-500' : s.rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${s.rate}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium w-10 text-right ${s.rate >= 80 ? 'text-pine-400' : s.rate >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {s.rate}%
                  </span>
                  <span className="text-gray-600 text-xs w-10 text-right">{s.total_rated} rated</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent ratings */}
        {data.recent?.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Recent Feedback</h4>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {data.recent.map((r, i) => (
                <div key={i} className="border-b border-gray-800 pb-2 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{r.rating === 'up' ? '👍' : '👎'}</span>
                    <span className="text-gray-300 text-xs flex-1 truncate">{r.ticket_title}</span>
                    <span className="text-gray-600 text-xs">
                      {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="text-gray-400 text-xs ml-6 italic">"{r.comment}"</p>
                  )}
                  {r.staff_name && (
                    <p className="text-gray-600 text-xs ml-6">via {r.staff_name}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!data.byStaff?.length && !data.recent?.length && (
          <div className="md:col-span-2 text-center py-8 text-gray-500">
            No satisfaction data yet. Surveys are sent automatically when tickets are resolved.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TAB: REPORTS ─────────────────────────────────────────────────────────────
function ReportsTab() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [format, setFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);
  const [monthlyReports, setMonthlyReports] = useState([]);
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [exportMsg, setExportMsg] = useState('');

  useEffect(() => {
    api.get('/analytics/reports/monthly')
      .then(r => setMonthlyReports(r.data))
      .catch(() => {})
      .finally(() => setLoadingMonthly(false));
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setExportMsg('');
    try {
      const res = await api.post('/analytics/reports/export', { format, dateFrom, dateTo }, {
        responseType: 'blob',
      });
      const ext = format === 'pdf' ? 'pdf' : 'csv';
      const mime = format === 'pdf' ? 'application/pdf' : 'text/csv';
      const url = URL.createObjectURL(new Blob([res.data], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `sentinel-report-${new Date().toISOString().split('T')[0]}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg(`${format.toUpperCase()} exported successfully.`);
    } catch (e) {
      setExportMsg('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const downloadMonthlyPdf = async (id, month) => {
    try {
      const res = await api.get(`/analytics/reports/monthly/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `sentinel-monthly-${month}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {/* ignore */}
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Custom report builder */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4">Custom Report Builder</h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs block mb-1">From Date</label>
              <input
                type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-pine-600"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1">To Date</label>
              <input
                type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-pine-600"
              />
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-xs block mb-2">Export Format</label>
            <div className="flex gap-3">
              {['csv', 'pdf'].map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    format === f
                      ? 'bg-pine-800/60 border-pine-600 text-pine-200'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {f === 'csv' ? '📋 CSV' : '📄 PDF'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-500">
            {dateFrom || dateTo
              ? `Exporting tickets from ${dateFrom || 'all time'} to ${dateTo || 'present'}`
              : 'No date range set — will export all tickets'}
          </div>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full py-2.5 bg-pine-700 hover:bg-pine-600 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            {exporting ? 'Generating…' : `Export ${format.toUpperCase()}`}
          </button>

          {exportMsg && (
            <p className={`text-xs text-center ${exportMsg.includes('failed') ? 'text-red-400' : 'text-pine-400'}`}>
              {exportMsg}
            </p>
          )}
        </div>
      </div>

      {/* Monthly reports archive */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4">Monthly Reports Archive</h3>
        <p className="text-gray-500 text-xs mb-4">
          Generated by ATLAS on the first Monday of each month and emailed to admins.
        </p>

        {loadingMonthly
          ? <div className="text-gray-500 text-sm text-center py-4">Loading…</div>
          : monthlyReports.length === 0
          ? (
            <div className="text-center py-8">
              <p className="text-gray-600 text-sm">No monthly reports yet.</p>
              <p className="text-gray-700 text-xs mt-2">
                The first report will be generated on the first Monday of next month.
              </p>
            </div>
          )
          : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {monthlyReports.map(r => {
                const ts = r.stats?.ticketStats;
                return (
                  <div key={r.id} className="border border-gray-800 rounded-lg p-3 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-gray-200 font-medium text-sm">{r.report_month}</p>
                      {ts && (
                        <p className="text-gray-500 text-xs mt-0.5">
                          {ts.total} tickets · {ts.resolved} resolved · {ts.atlas_handled} by ATLAS
                        </p>
                      )}
                      <p className="text-gray-700 text-xs">
                        {r.generated_at ? new Date(r.generated_at).toLocaleDateString() : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => downloadMonthlyPdf(r.id, r.report_month)}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors"
                    >
                      PDF
                    </button>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Analytics() {
  const [tab, setTab] = useState('realtime');

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">
          Phase 5 — real-time metrics, staff performance, trends, and automated reports
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap bg-gray-900/60 border border-gray-800 rounded-xl p-1.5 mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-pine-800/70 text-pine-200 shadow-[0_0_10px_rgba(74,170,74,0.2)]'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-64">
        {tab === 'realtime'     && <RealtimeTab />}
        {tab === 'staff'        && <StaffTab />}
        {tab === 'volume'       && <VolumeTab />}
        {tab === 'heatmap'      && <HeatmapTab />}
        {tab === 'issues'       && <IssuesTab />}
        {tab === 'cost'         && <CostTab />}
        {tab === 'satisfaction' && <SatisfactionTab />}
        {tab === 'reports'      && <ReportsTab />}
      </div>
    </div>
  );
}
