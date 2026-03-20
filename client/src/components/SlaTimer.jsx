import { useState, useEffect } from 'react';

const SLA_HOURS = { critical: 1, high: 4, medium: 24, low: 72 };

function pad(n) { return String(n).padStart(2, '0'); }

function formatCountdown(ms) {
  if (ms <= 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

/**
 * SlaTimer — shows a countdown to the SLA deadline, or a breach indicator.
 * Props:
 *   sla_due_at  — ISO string
 *   priority    — 'critical' | 'high' | 'medium' | 'low'
 *   is_escalated — boolean
 *   status      — ticket status string
 *   compact     — boolean, smaller layout
 */
export default function SlaTimer({ sla_due_at, priority, is_escalated, status, compact = false }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (status === 'resolved' || status === 'closed') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status]);

  if (!sla_due_at || status === 'resolved' || status === 'closed') return null;

  const due = new Date(sla_due_at).getTime();
  const ms  = due - now;
  const breached = ms <= 0;
  const urgent   = !breached && ms < 30 * 60 * 1000; // < 30 min

  if (compact) {
    return (
      <span
        title={`SLA due: ${new Date(sla_due_at).toLocaleString()}`}
        className={`text-[10px] font-mono font-medium
          ${breached || is_escalated ? 'text-red-400 animate-pulse' : urgent ? 'text-amber-400' : 'text-gray-500'}`}
      >
        {breached || is_escalated ? '⚠ SLA breached' : `⏱ ${formatCountdown(ms)}`}
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-1.5 border
      ${breached || is_escalated
        ? 'bg-red-950/40 border-red-800/60 text-red-400'
        : urgent
          ? 'bg-amber-950/40 border-amber-800/60 text-amber-400'
          : 'bg-gray-800/50 border-gray-700/50 text-gray-400'}`}
    >
      <span className="shrink-0">⏱</span>
      <span className="font-medium">SLA:</span>
      {breached || is_escalated ? (
        <span className="font-semibold animate-pulse">Breached</span>
      ) : (
        <span className="font-mono tabular-nums">{formatCountdown(ms)} remaining</span>
      )}
      <span className="text-xs opacity-60">({SLA_HOURS[priority] || 24}h target)</span>
    </div>
  );
}
