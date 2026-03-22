import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

const STATUS_URL = import.meta.env.VITE_API_URL || 'https://sentinelaiapp.com/api';

const STATUS_COLORS = {
  operational:     'bg-green-500',
  degraded:        'bg-yellow-500',
  partial_outage:  'bg-orange-500',
  major_outage:    'bg-red-500',
  maintenance:     'bg-blue-500',
};

const STATUS_LABELS = {
  operational:     'Operational',
  degraded:        'Degraded Performance',
  partial_outage:  'Partial Outage',
  major_outage:    'Major Outage',
  maintenance:     'Under Maintenance',
};

const STATUS_TEXT_COLORS = {
  operational:     'text-green-400',
  degraded:        'text-yellow-400',
  partial_outage:  'text-orange-400',
  major_outage:    'text-red-400',
  maintenance:     'text-blue-400',
};

function ComponentRow({ name, status }) {
  const color = STATUS_COLORS[status] || 'bg-gray-500';
  const label = STATUS_LABELS[status] || status;
  const textColor = STATUS_TEXT_COLORS[status] || 'text-gray-400';
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
      <span className="text-gray-300 text-sm">{name}</span>
      <span className={`flex items-center gap-2 text-sm font-medium ${textColor}`}>
        <span className={`w-2 h-2 rounded-full ${color}`} />
        {label}
      </span>
    </div>
  );
}

function UptimeBar({ days }) {
  // days: array of {date, uptime: 0-100}
  return (
    <div className="flex items-end gap-0.5 h-8">
      {days.map((d, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${Math.max(20, d.uptime)}%`,
            backgroundColor: d.uptime > 99 ? '#22c55e' : d.uptime > 95 ? '#eab308' : '#ef4444',
            opacity: 0.8,
          }}
          title={`${d.date}: ${d.uptime.toFixed(2)}% uptime`}
        />
      ))}
    </div>
  );
}

function IncidentItem({ incident }) {
  const severityColor = {
    low: 'bg-blue-900/40 border-blue-700/50 text-blue-300',
    medium: 'bg-yellow-900/40 border-yellow-700/50 text-yellow-300',
    high: 'bg-orange-900/40 border-orange-700/50 text-orange-300',
    critical: 'bg-red-900/40 border-red-700/50 text-red-300',
  }[incident.severity] || 'bg-gray-800 border-gray-700 text-gray-300';

  return (
    <div className={`rounded-xl border p-4 ${severityColor.split(' ').slice(0, 2).join(' ')} border`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className={`font-medium text-sm ${severityColor.split(' ')[2]}`}>{incident.title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${severityColor} shrink-0`}>
          {incident.status}
        </span>
      </div>
      <p className="text-gray-400 text-xs leading-relaxed">{incident.description}</p>
      <p className="text-gray-600 text-xs mt-2">
        {new Date(incident.created_at).toLocaleString()}
      </p>
    </div>
  );
}

export default function StatusPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${STATUS_URL}/status`);
      const data = await res.json();
      setStatus(data);
      setLastUpdated(new Date());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const overall = status?.overall || 'operational';
  const overallColor = STATUS_COLORS[overall] || 'bg-green-500';
  const overallLabel = STATUS_LABELS[overall] || 'Operational';
  const overallTextColor = STATUS_TEXT_COLORS[overall] || 'text-green-400';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between max-w-3xl mx-auto">
        <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Sentinel
        </Link>
        <span className="text-gray-600 text-xs">
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
        </span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Overall status banner */}
        <div className={`rounded-2xl p-6 mb-8 flex items-center gap-4
          ${overall === 'operational' ? 'bg-green-950/40 border border-green-800/50' : 'bg-red-950/40 border border-red-800/50'}`}>
          <div className={`w-4 h-4 rounded-full ${overallColor} shrink-0 shadow-[0_0_12px_currentColor]`} />
          <div>
            <h1 className={`text-xl font-bold ${overallTextColor}`}>{overallLabel}</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {overall === 'operational'
                ? 'All systems are running smoothly.'
                : 'Some systems are experiencing issues. Our team is on it.'}
            </p>
          </div>
        </div>

        {/* Components */}
        <section className="card mb-8">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-gray-200 font-semibold">System Components</h2>
          </div>
          <div className="px-5">
            {loading ? (
              <div className="py-8 text-center text-gray-600 text-sm">Checking systems...</div>
            ) : status?.components?.length > 0 ? (
              status.components.map(c => (
                <ComponentRow key={c.name} name={c.name} status={c.status} />
              ))
            ) : (
              <>
                <ComponentRow name="API" status="operational" />
                <ComponentRow name="Web Application" status="operational" />
                <ComponentRow name="Database" status="operational" />
                <ComponentRow name="AI / ATLAS Engine" status="operational" />
                <ComponentRow name="Email Delivery" status="operational" />
                <ComponentRow name="Authentication" status="operational" />
              </>
            )}
          </div>
        </section>

        {/* Uptime */}
        {status?.uptime && (
          <section className="card mb-8">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-gray-200 font-semibold">Uptime — Last 90 Days</h2>
              <span className="text-green-400 text-sm font-medium">{status.uptime.percent?.toFixed(2)}%</span>
            </div>
            <div className="p-5">
              <UptimeBar days={status.uptime.days || []} />
              <div className="flex items-center justify-between mt-2">
                <span className="text-gray-600 text-xs">90 days ago</span>
                <span className="text-gray-600 text-xs">Today</span>
              </div>
            </div>
          </section>
        )}

        {/* Recent incidents */}
        <section>
          <h2 className="text-gray-200 font-semibold mb-4">Recent Incidents</h2>
          {loading ? (
            <div className="text-gray-600 text-sm">Loading incidents...</div>
          ) : status?.incidents?.length > 0 ? (
            <div className="space-y-3">
              {status.incidents.map(inc => (
                <IncidentItem key={inc.id} incident={inc} />
              ))}
            </div>
          ) : (
            <div className="card p-6 text-center">
              <div className="text-2xl mb-2">🎉</div>
              <p className="text-gray-400 text-sm">No incidents in the past 30 days.</p>
              <p className="text-gray-600 text-xs mt-1">Your systems have been running clean.</p>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-gray-800 px-6 py-4 text-center max-w-3xl mx-auto mt-8">
        <p className="text-gray-700 text-xs">
          Sentinel IT Helpdesk · <Link to="/changelog" className="hover:text-gray-500 transition-colors">Changelog</Link>
        </p>
      </footer>
    </div>
  );
}
