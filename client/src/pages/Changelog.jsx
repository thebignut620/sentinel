import { Link } from 'react-router-dom';

const RELEASES = [
  {
    version: '1.0.0',
    date: 'March 2026',
    badge: 'Latest',
    badgeColor: 'bg-pine-800/60 text-pine-300 border-pine-700/50',
    changes: [
      { type: 'new', text: 'ATLAS AI engine — autonomous ticket triage, resolution, and learning' },
      { type: 'new', text: 'Knowledge Base with AI-powered article suggestions' },
      { type: 'new', text: 'Real-time ticket kanban board with drag-and-drop' },
      { type: 'new', text: 'Sentiment analysis on every ticket reply' },
      { type: 'new', text: 'SLA tracking with escalation alerts' },
      { type: 'new', text: 'Asset management and maintenance scheduling' },
      { type: 'new', text: 'Ticket clusters — AI groups similar issues automatically' },
      { type: 'new', text: 'Public API with key management and rate limiting' },
      { type: 'new', text: 'SSO via Google and Microsoft' },
      { type: 'new', text: 'Two-factor authentication (TOTP)' },
      { type: 'new', text: 'Mobile-first responsive design with bottom navigation' },
      { type: 'new', text: 'Weekly and monthly email reports' },
      { type: 'security', text: 'End-to-end rate limiting, brute force protection, and input sanitization' },
    ],
  },
  {
    version: '0.9.0',
    date: 'February 2026',
    badge: 'Beta',
    badgeColor: 'bg-gray-800 text-gray-400 border-gray-700',
    changes: [
      { type: 'new', text: 'Department management and employee bulk invite' },
      { type: 'new', text: 'Custom ticket fields per department' },
      { type: 'new', text: 'Reply templates with variable substitution' },
      { type: 'new', text: 'Satisfaction surveys sent automatically on ticket close' },
      { type: 'improvement', text: 'Faster AI response times via model caching' },
      { type: 'fix', text: 'Fixed notification delivery for SSO-authenticated users' },
    ],
  },
  {
    version: '0.8.0',
    date: 'January 2026',
    badge: 'Alpha',
    badgeColor: 'bg-gray-800 text-gray-400 border-gray-700',
    changes: [
      { type: 'new', text: 'ATLAS onboarding wizard for new workspaces' },
      { type: 'new', text: 'Analytics dashboard with response-time breakdowns' },
      { type: 'new', text: 'Audit log for all admin actions' },
      { type: 'new', text: 'Maintenance windows with automatic ticket pause' },
      { type: 'improvement', text: 'Improved search across tickets and knowledge articles' },
    ],
  },
];

const TYPE_STYLES = {
  new:         { label: 'New',         color: 'bg-green-900/40 text-green-400 border-green-800/50' },
  improvement: { label: 'Improved',    color: 'bg-blue-900/40 text-blue-400 border-blue-800/50' },
  fix:         { label: 'Fixed',       color: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50' },
  security:    { label: 'Security',    color: 'bg-red-900/40 text-red-400 border-red-800/50' },
  removed:     { label: 'Removed',     color: 'bg-gray-800 text-gray-400 border-gray-700' },
};

function ChangeItem({ type, text }) {
  const style = TYPE_STYLES[type] || TYPE_STYLES.improvement;
  return (
    <li className="flex items-start gap-3 py-2">
      <span className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold mt-0.5 ${style.color}`}>
        {style.label}
      </span>
      <span className="text-gray-300 text-sm leading-relaxed">{text}</span>
    </li>
  );
}

export default function Changelog() {
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
        <Link to="/status" className="flex items-center gap-1.5 text-gray-600 hover:text-gray-400 transition-colors text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          System Status
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-3">Changelog</h1>
          <p className="text-gray-400 text-base">
            Everything that's new, improved, fixed, and shipped in Sentinel.
          </p>
        </div>

        <div className="space-y-12">
          {RELEASES.map(release => (
            <article key={release.version}>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">v{release.version}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${release.badgeColor}`}>
                    {release.badge}
                  </span>
                </div>
                <div className="flex-1 h-px bg-gray-800" />
                <time className="text-gray-600 text-sm shrink-0">{release.date}</time>
              </div>

              <div className="card">
                <ul className="divide-y divide-gray-800/60 px-5">
                  {release.changes.map((change, i) => (
                    <ChangeItem key={i} type={change.type} text={change.text} />
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </main>

      <footer className="border-t border-gray-800 px-6 py-4 text-center max-w-3xl mx-auto mt-8">
        <p className="text-gray-700 text-xs">
          Sentinel IT Helpdesk · <Link to="/status" className="hover:text-gray-500 transition-colors">System Status</Link>
        </p>
      </footer>
    </div>
  );
}
