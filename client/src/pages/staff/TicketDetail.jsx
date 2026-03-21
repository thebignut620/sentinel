import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { StatusBadge, PriorityBadge, CategoryBadge } from '../../components/Badges.jsx';
import { SkeletonCard } from '../../components/Skeleton.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import Confetti from '../../components/Confetti.jsx';
import SmartTextarea from '../../components/SmartTextarea.jsx';
import SpinnerButton from '../../components/SpinnerButton.jsx';
import SentimentBadge from '../../components/SentimentBadge.jsx';
import api from '../../api/client.js';

// ── ATLAS Action Approval Card ────────────────────────────────────────────────
const GOOGLE_ACTION_LABELS = {
  password_reset: 'Reset Google Workspace Password',
  account_unlock: 'Unlock Google Workspace Account',
  access_grant:   'Grant Google Drive Access',
};
const MS_ACTION_LABELS = {
  password_reset: 'Reset Microsoft 365 Password',
  account_unlock: 'Unlock Microsoft 365 Account',
  access_grant:   'Grant SharePoint Access',
};
const ACTION_ICONS = { password_reset: '🔑', account_unlock: '🔓', access_grant: '📂' };
const DRIVE_ROLES  = ['reader', 'commenter', 'writer'];
const SP_ROLES     = ['read', 'contribute', 'write'];

function getActionLabel(action) {
  return (action.provider === 'microsoft' ? MS_ACTION_LABELS : GOOGLE_ACTION_LABELS)[action.action_type];
}

function AtlasActionCard({ action, onApprove, onDeny, loading }) {
  const [resourceId, setResourceId] = useState('');
  const [role, setRole]             = useState(action.provider === 'microsoft' ? 'read' : 'reader');
  const [saving, setSaving]         = useState(false);
  const isMs         = action.provider === 'microsoft';
  const needsResId   = action.action_type === 'access_grant';
  const details      = JSON.parse(action.details || '{}');
  const hasResId     = isMs ? !!(details.site_id) : !!(details.drive_id);

  const handleSaveResId = async () => {
    if (!resourceId.trim()) return;
    setSaving(true);
    try {
      const patch = isMs
        ? { site_id: resourceId.trim(), role }
        : { drive_id: resourceId.trim(), role };
      await api.patch(`/integrations/actions/${action.id}`, patch);
      onApprove(action.id, true);
    } catch { setSaving(false); }
  };

  return (
    <div className="rounded-xl border border-blue-800/50 bg-blue-900/20 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-blue-900/60 border border-blue-800/50 flex items-center justify-center text-base shrink-0">
          {ACTION_ICONS[action.action_type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-800/50 font-medium">
              ATLAS Action
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-800/50">
              Awaiting approval
            </span>
            {isMs ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-900/30 text-blue-400 border border-blue-800/30">M365</span>
            ) : (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500 border border-gray-700">Google</span>
            )}
          </div>
          <p className="text-sm font-semibold text-white mt-1">{getActionLabel(action)}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Target: <span className="text-gray-300 font-medium">{action.target_email}</span>
            {action.target_name && <> ({action.target_name})</>}
          </p>
        </div>
      </div>

      {needsResId && !hasResId && (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-gray-400">
            {isMs
              ? 'Enter the SharePoint site ID before approving:'
              : 'Enter the Google Drive folder ID before approving:'}
          </p>
          <input
            className="input w-full text-xs"
            placeholder={isMs ? 'SharePoint site ID (e.g. contoso.sharepoint.com,abc…)' : 'Drive folder ID (from URL: /folders/[ID])'}
            value={resourceId}
            onChange={e => setResourceId(e.target.value)}
          />
          <select className="input w-full text-xs" value={role} onChange={e => setRole(e.target.value)}>
            {(isMs ? SP_ROLES : DRIVE_ROLES).map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <SpinnerButton loading={saving} onClick={handleSaveResId} disabled={!resourceId.trim() || saving} className="btn-primary px-3 py-1.5 text-xs">
              Approve & Execute
            </SpinnerButton>
            <button type="button" onClick={() => onDeny(action.id)} disabled={loading} className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 border border-gray-700 text-gray-400 hover:border-red-700 hover:text-red-400 transition-colors disabled:opacity-50">
              Deny
            </button>
          </div>
        </div>
      )}

      {(!needsResId || hasResId) && (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              console.log('[AtlasActionCard] approve clicked — action.id:', action.id, 'type:', action.action_type, 'provider:', action.provider);
              onApprove(action.id);
            }}
            disabled={loading}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-pine-800/60 border border-pine-700/50 text-pine-200 hover:bg-pine-700/60 transition-colors disabled:opacity-50"
          >
            ✓ Approve & Execute
          </button>
          <button
            type="button"
            onClick={() => {
              console.log('[AtlasActionCard] deny clicked — action.id:', action.id);
              onDeny(action.id);
            }}
            disabled={loading}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-gray-800 border border-gray-700 text-gray-400 hover:border-red-700 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            ✕ Deny
          </button>
        </div>
      )}
    </div>
  );
}

function AtlasActionResult({ action }) {
  const statusColors = {
    executed: 'text-pine-300 bg-pine-900/30 border-pine-800/40',
    denied:   'text-gray-500 bg-gray-800/40 border-gray-700/30',
    failed:   'text-red-300 bg-red-900/20 border-red-800/30',
  };
  const icon = { executed: '✓', denied: '✕', failed: '⚠' };
  return (
    <div className={`rounded-xl border p-3 text-xs ${statusColors[action.status] || ''}`}>
      <span className="font-semibold">{icon[action.status]} {getActionLabel(action)}</span>
      {action.result        && <p className="mt-0.5 opacity-80">{action.result}</p>}
      {action.error_message && <p className="mt-0.5 opacity-80">Error: {action.error_message}</p>}
    </div>
  );
}

// ── Integration Context Panels ────────────────────────────────────────────────
// Single fetch for both providers; renders whichever panels have data.
function IntegrationContextPanels({ email }) {
  const [ctx, setCtx]         = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) { setLoading(false); return; }
    api.get(`/integrations/user-context?email=${encodeURIComponent(email)}`)
      .then(r => setCtx(r.data))
      .catch(() => setCtx(null))
      .finally(() => setLoading(false));
  }, [email]);

  if (loading) return <div className="skeleton h-24 rounded-xl" />;
  if (!ctx) return null;

  return (
    <>
      {ctx.google?.found    && <GoogleContextPanel    ctx={ctx.google} />}
      {ctx.microsoft?.found && <MicrosoftContextPanel ctx={ctx.microsoft} />}
    </>
  );
}

function GroupChips({ groups, max = 4 }) {
  if (!groups?.length) return null;
  return (
    <div>
      <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wider mb-1.5">Groups</p>
      <div className="flex flex-wrap gap-1">
        {groups.slice(0, max).map(g => (
          <span key={g} className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-500 truncate max-w-[120px]">
            {g.includes('@') ? g.split('@')[0] : g}
          </span>
        ))}
        {groups.length > max && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-600">
            +{groups.length - max}
          </span>
        )}
      </div>
    </div>
  );
}

function GoogleContextPanel({ ctx }) {
  return (
    <div className="card p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 48 48" className="w-3.5 h-3.5 shrink-0">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Google Workspace</h3>
        {ctx.suspended ? (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-red-900/40 text-red-300 border border-red-800/40">Suspended</span>
        ) : (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-pine-900/40 text-pine-300 border border-pine-800/40">Active</span>
        )}
      </div>
      <div className="space-y-1.5 text-xs">
        {ctx.org_unit   && <div className="flex justify-between"><span className="text-gray-600">Org unit</span><span className="text-gray-400 text-right max-w-[60%] truncate">{ctx.org_unit}</span></div>}
        {ctx.last_login && <div className="flex justify-between"><span className="text-gray-600">Last login</span><span className="text-gray-400">{new Date(ctx.last_login).toLocaleDateString()}</span></div>}
        {ctx.is_admin   && <div className="flex justify-between"><span className="text-gray-600">Role</span><span className="text-amber-400">Admin</span></div>}
      </div>
      <GroupChips groups={ctx.groups} />
    </div>
  );
}

function MicrosoftContextPanel({ ctx }) {
  return (
    <div className="card p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 21 21" className="w-3.5 h-3.5 shrink-0">
          <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
          <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
          <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
          <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
        </svg>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Microsoft 365</h3>
        {ctx.account_enabled === false ? (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-red-900/40 text-red-300 border border-red-800/40">Disabled</span>
        ) : (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-pine-900/40 text-pine-300 border border-pine-800/40">Active</span>
        )}
      </div>
      <div className="space-y-1.5 text-xs">
        {ctx.job_title   && <div className="flex justify-between"><span className="text-gray-600">Title</span><span className="text-gray-400 text-right max-w-[60%] truncate">{ctx.job_title}</span></div>}
        {ctx.department  && <div className="flex justify-between"><span className="text-gray-600">Department</span><span className="text-gray-400 text-right max-w-[60%] truncate">{ctx.department}</span></div>}
        {ctx.last_sign_in && <div className="flex justify-between"><span className="text-gray-600">Last sign-in</span><span className="text-gray-400">{new Date(ctx.last_sign_in).toLocaleDateString()}</span></div>}
      </div>
      {ctx.licenses?.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wider mb-1.5">Licenses</p>
          <div className="flex flex-wrap gap-1">
            {ctx.licenses.slice(0, 3).map(l => (
              <span key={l} className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-900/20 border border-blue-800/30 text-blue-400 truncate max-w-[150px]">
                {l.replace(/_/g, ' ')}
              </span>
            ))}
            {ctx.licenses.length > 3 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-600">+{ctx.licenses.length - 3}</span>
            )}
          </div>
        </div>
      )}
      <GroupChips groups={ctx.groups} />
    </div>
  );
}

const SERVER = api.defaults.baseURL.replace('/api', '');

const CATEGORY_ICONS = { hardware:'🖥', software:'💾', network:'🌐', access:'🔑', account:'👤' };

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}

function Avatar({ name, size = 8, className = '' }) {
  const ini = (name || '?').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  return (
    <div className={`h-${size} w-${size} rounded-full bg-pine-900/60 border border-pine-800/40
                    flex items-center justify-center text-pine-400 font-bold shrink-0 ${className}`}
      style={{ fontSize: size <= 6 ? '9px' : '11px' }}>
      {ini}
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────
const HISTORY_ICONS = {
  created:  { icon: '✦', color: 'text-pine-400',   bg: 'bg-pine-900/60 border-pine-800/50' },
  status:   { icon: '⇄', color: 'text-blue-400',   bg: 'bg-blue-900/40 border-blue-800/50' },
  priority: { icon: '↑', color: 'text-amber-400',  bg: 'bg-amber-900/40 border-amber-800/50' },
  assigned: { icon: '→', color: 'text-purple-400', bg: 'bg-purple-900/40 border-purple-800/50' },
  comment:  { icon: '💬', color: 'text-gray-400',  bg: 'bg-gray-800 border-gray-700' },
};

function historyLabel(entry) {
  if (entry.kind === 'comment') return null;
  switch (entry.action) {
    case 'created':  return <span>Ticket opened as <span className="text-pine-300">open</span></span>;
    case 'status':   return <span>Status changed from <span className="capitalize text-gray-300">{entry.from_val?.replace('_',' ')}</span> → <span className="capitalize text-pine-300">{entry.to_val?.replace('_',' ')}</span></span>;
    case 'priority': return <span>Priority changed to <span className="text-amber-300 capitalize">{entry.to_val}</span></span>;
    case 'assigned': return <span>Assigned to <span className="text-purple-300">{entry.to_val}</span></span>;
    default:         return <span>{entry.action}: {entry.to_val}</span>;
  }
}

function Timeline({ history, comments, ticket }) {
  // Merge history events + comments into one sorted list
  const events = [
    ...history.map(h => ({ ...h, kind: 'history', ts: h.created_at })),
    ...comments.map(c => ({ ...c, kind: 'comment', action: 'comment', actor_name: c.author_name, ts: c.created_at })),
  ].sort((a, b) => new Date(a.ts) - new Date(b.ts));

  return (
    <div className="space-y-1">
      {events.map((ev, i) => {
        const cfg = HISTORY_ICONS[ev.action] || HISTORY_ICONS.comment;
        const isComment = ev.kind === 'comment';
        return (
          <div key={`${ev.kind}-${ev.id ?? i}`} className="flex gap-3 group">
            {/* Spine line */}
            <div className="flex flex-col items-center">
              <div className={`h-6 w-6 rounded-full border flex items-center justify-center text-[10px] shrink-0 ${cfg.bg} ${cfg.color}`}>
                {cfg.icon}
              </div>
              {i < events.length - 1 && <div className="w-px flex-1 bg-gray-800 mt-1 mb-0" style={{ minHeight: '12px' }} />}
            </div>
            {/* Content */}
            <div className="pb-3 flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                <span className="text-xs font-medium text-gray-300">{ev.actor_name || ev.author_name}</span>
                <span className="text-[10px] text-gray-600">{new Date(ev.ts).toLocaleString()}</span>
              </div>
              {isComment ? (
                <p className="text-xs text-gray-400 leading-relaxed bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-800/60">
                  {ev.body}
                </p>
              ) : (
                <p className="text-xs text-gray-500">{historyLabel(ev)}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Resolution summary + ATLAS report ────────────────────────────────────────
function ResolutionCard({ ticket }) {
  if (!['resolved','closed'].includes(ticket.status)) return null;
  const ms = ticket.resolved_at
    ? new Date(ticket.resolved_at) - new Date(ticket.created_at)
    : null;
  const hours = ms ? Math.round(ms / 3_600_000) : null;
  const [showReport, setShowReport] = useState(false);

  // Parse the markdown-like report into sections
  const reportSections = ticket.resolution_report
    ? ticket.resolution_report.split(/\n(?=\*\*)/).map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="card p-5 border-pine-800/50">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-pine-400 text-lg">✓</span>
        <h3 className="font-semibold text-pine-300 text-sm">Resolution Summary</h3>
        {ticket.resolution_report && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pine-900/60 text-pine-400 border border-pine-800/50 ml-auto">
            ATLAS report
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs mb-3">
        <div><span className="text-gray-500">Status</span><p className="text-pine-300 font-medium capitalize mt-0.5">{ticket.status}</p></div>
        <div><span className="text-gray-500">Resolved by</span><p className="text-gray-200 font-medium mt-0.5">{ticket.assignee_name || '—'}</p></div>
        {ticket.resolved_at && <div><span className="text-gray-500">Resolved at</span><p className="text-gray-300 mt-0.5">{new Date(ticket.resolved_at).toLocaleString()}</p></div>}
        {hours !== null && <div><span className="text-gray-500">Handle time</span><p className="text-gray-300 mt-0.5">{hours}h total</p></div>}
      </div>
      {ticket.solution && (
        <div className="bg-pine-900/20 border border-pine-800/40 rounded-lg px-3 py-2.5 mb-3">
          <p className="text-[10px] text-pine-500 font-semibold uppercase tracking-wider mb-1">What fixed it</p>
          <p className="text-xs text-gray-300 leading-relaxed">{ticket.solution}</p>
        </div>
      )}

      {ticket.resolution_report && (
        <>
          <button
            onClick={() => setShowReport(r => !r)}
            className="text-xs text-pine-500 hover:text-pine-400 transition-colors flex items-center gap-1"
          >
            {showReport ? '▾ Hide' : '▸ View'} ATLAS resolution report
          </button>
          {showReport && (
            <div className="mt-3 space-y-3 animate-fadeIn">
              {reportSections.length > 0 ? reportSections.map((section, i) => {
                const boldMatch = section.match(/^\*\*(.+?):\*\*\s*([\s\S]*)/);
                if (boldMatch) {
                  return (
                    <div key={i}>
                      <p className="text-xs font-semibold text-gray-300 mb-0.5">{boldMatch[1]}</p>
                      <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{boldMatch[2]}</p>
                    </div>
                  );
                }
                return <p key={i} className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{section}</p>;
              }) : (
                <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{ticket.resolution_report}</p>
              )}
            </div>
          )}
        </>
      )}
      {!ticket.resolution_report && ['resolved','closed'].includes(ticket.status) && (
        <p className="text-[10px] text-gray-600 mt-1">ATLAS report generating in background…</p>
      )}
    </div>
  );
}

// ── ATLAS similar ticket suggestions ─────────────────────────────────────────
function AtlasSuggestions({ ticketId }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/ai/suggestions/${ticketId}`)
      .then(r => setSuggestions(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticketId]);

  if (loading || suggestions.length === 0) return null;

  const CATEGORY_ICONS_LOCAL = { hardware:'🖥', software:'💾', network:'🌐', access:'🔑', account:'👤' };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-900/60 text-purple-400 border border-purple-800/50 font-medium">
          ATLAS
        </span>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Similar Past Resolutions</h3>
      </div>
      <div className="space-y-2">
        {suggestions.map(s => (
          <Link key={s.id} to={`/tickets/${s.id}`}
            className="flex items-start gap-2 p-3 rounded-lg hover:bg-gray-800 transition-colors group border border-transparent hover:border-gray-700">
            <span className="text-sm shrink-0 mt-0.5">{CATEGORY_ICONS_LOCAL[s.category] || '📄'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-300 font-medium truncate group-hover:text-white">#{s.id} {s.title}</p>
              <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-2">{s.reason}</p>
            </div>
            <StatusBadge status={s.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Related tickets ───────────────────────────────────────────────────────────
function RelatedTickets({ ticketId }) {
  const [related, setRelated] = useState([]);
  useEffect(() => {
    api.get(`/tickets/${ticketId}/related`).then(r => setRelated(r.data)).catch(() => {});
  }, [ticketId]);
  if (related.length === 0) return null;
  return (
    <div className="card p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Related Tickets</h3>
      <div className="space-y-2">
        {related.map(t => (
          <Link key={t.id} to={`/tickets/${t.id}`}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-800 transition-colors group">
            <span className="text-sm shrink-0">{CATEGORY_ICONS[t.category]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-300 truncate group-hover:text-white">{t.title}</p>
              <p className="text-[10px] text-gray-600">#{t.id} · {t.submitter_name}</p>
            </div>
            <StatusBadge status={t.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const fileInputRef = useRef(null);
  const commentBoxRef = useRef(null);

  const [ticket, setTicket]       = useState(null);
  const [history, setHistory]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [staffUsers, setStaff]    = useState([]);
  const [comment, setComment]     = useState('');
  const [note, setNote]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [uploading, setUploading]  = useState(false);
  const [newCommentId, setNewCommentId] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [suggestedTemplates, setSuggestedTemplates] = useState([]);

  const [editStatus,   setEditStatus]   = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [solution,     setSolution]     = useState('');
  const [empProfile,   setEmpProfile]   = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadAll();
    if (user.role !== 'employee') {
      api.get('/users').then(r => setStaff(r.data.filter(u => u.role !== 'employee' && u.is_active)));
    }
  }, [id]);

  // Load employee profile once ticket is loaded (for IT staff panel)
  useEffect(() => {
    if (ticket && user.role !== 'employee') {
      api.get(`/employee-profiles/${ticket.submitter_id}`).then(r => setEmpProfile(r.data)).catch(() => {});
    }
  }, [ticket?.submitter_id]);

  const loadAll = async () => {
    try {
      const [tRes, hRes, tmplRes] = await Promise.all([
        api.get(`/tickets/${id}`),
        api.get(`/tickets/${id}/history`),
        api.get('/ticket-templates').catch(() => ({ data: [] })),
      ]);
      setTicket(tRes.data);
      setHistory(hRes.data);
      setTemplates(tmplRes.data || []);
      setEditStatus(tRes.data.status);
      setEditPriority(tRes.data.priority);
      setEditCategory(tRes.data.category || 'software');
      setEditAssignee(tRes.data.assignee_id ?? '');
    } catch {
      navigate('/tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setSubmitting(true);
    try {
      const wasNotResolved = ticket?.status !== 'resolved' && ticket?.priority === 'critical';
      const patch = {
        status: editStatus, priority: editPriority,
        category: editCategory, assignee_id: editAssignee || null,
      };
      if (['resolved', 'closed'].includes(editStatus) && solution.trim()) {
        patch.solution = solution.trim();
      }
      await api.patch(`/tickets/${id}`, patch);
      addToast('Ticket updated', 'success');
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 2000);
      // Confetti when critical ticket gets resolved
      if (wasNotResolved && editStatus === 'resolved') setShowConfetti(true);
      await loadAll();
    } catch (err) {
      addToast(err.response?.data?.error || 'Update failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveAction = async (actionId, alreadySavedDriveId = false) => {
    console.log('[handleApproveAction] called — actionId:', actionId, typeof actionId);
    if (!actionId) {
      console.error('[handleApproveAction] actionId is undefined/null — aborting');
      return;
    }
    const url = `/integrations/actions/${actionId}/approve`;
    console.log('[handleApproveAction] POSTing to:', url, '| baseURL:', api.defaults.baseURL);
    setActionLoading(true);
    try {
      const res = await api.post(url);
      console.log('[handleApproveAction] response:', res.status, res.data);
      addToast('ATLAS action executed successfully', 'success');
      await loadAll();
    } catch (err) {
      console.error('[handleApproveAction] error:', err.response?.status, err.response?.data, err.message);
      addToast(err.response?.data?.error || 'Action failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDenyAction = async (actionId) => {
    setActionLoading(true);
    try {
      await api.post(`/integrations/actions/${actionId}/deny`);
      addToast('Action denied. Manual steps added to notes.', 'info');
      await loadAll();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/tickets/${id}/comments`, { body: comment });
      setComment('');
      setNewCommentId(res.data.id);
      addToast('Comment posted', 'success');
      await loadAll();
      setTimeout(() => setNewCommentId(null), 1000);
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/tickets/${id}/notes`, { body: note });
      setNote('');
      addToast('Internal note added', 'success');
      await loadAll();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      await api.post(`/tickets/${id}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      addToast('File attached', 'success');
      await loadAll();
    } catch (err) {
      addToast(err.response?.data?.error || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (attachId) => {
    try {
      await api.delete(`/tickets/${id}/attachments/${attachId}`);
      addToast('Attachment removed', 'info');
      await loadAll();
    } catch {
      addToast('Delete failed', 'error');
    }
  };

  if (loading) return (
    <div className="space-y-5 animate-fadeIn">
      <div className="skeleton h-5 w-20" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5"><SkeletonCard className="lg:col-span-2" /><SkeletonCard /></div>
    </div>
  );
  if (!ticket) return null;

  const canManage = user.role === 'it_staff' || user.role === 'admin';

  return (
    <div className="animate-fadeIn">
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-300 mb-4 flex items-center gap-1 transition-colors">
        ← Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Main column ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header */}
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <h1 className="text-xl font-bold text-white leading-tight">{ticket.title}</h1>
              <span className="text-xs text-gray-600 shrink-0 mt-1">#{ticket.id}</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <CategoryBadge category={ticket.category} />
              {ticket.sentiment && <SentimentBadge sentiment={ticket.sentiment} />}
              {ticket.ai_attempted === 1 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-900/50 text-purple-300 border border-purple-800/50">
                  🤖 ATLAS attempted
                </span>
              )}
              {ticket.ai_auto_assigned === 1 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-900/50 text-blue-300 border border-blue-800/50">
                  ⚡ ATLAS assigned
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-5">
              Submitted by <span className="text-gray-300 font-medium">{ticket.submitter_name}</span>
              {' · '}{new Date(ticket.created_at).toLocaleString()}
              {ticket.assignee_name && <> · Assigned to <span className="text-gray-300 font-medium">{ticket.assignee_name}</span></>}
            </p>

            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</h3>
            <div className="bg-gray-800/60 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed border border-gray-700/40">
              {ticket.description}
            </div>

            {ticket.ai_suggestion && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">AI Suggestion</h3>
                <div className="bg-pine-900/30 border border-pine-800/50 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {ticket.ai_suggestion}
                </div>
              </div>
            )}
          </div>

          {/* ATLAS Action Cards */}
          {canManage && ticket.pending_actions?.length > 0 && (
            <div className="card p-5 space-y-3" style={{ borderColor: 'rgba(59,130,246,0.3)' }}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-800/50 font-medium">ATLAS</span>
                <h2 className="text-sm font-semibold text-blue-300">Automated Actions</h2>
              </div>
              {ticket.pending_actions.map(action => (
                action.status === 'pending' ? (
                  <AtlasActionCard
                    key={action.id}
                    action={action}
                    onApprove={handleApproveAction}
                    onDeny={handleDenyAction}
                    loading={actionLoading}
                  />
                ) : (
                  <AtlasActionResult key={action.id} action={action} />
                )
              ))}
            </div>
          )}

          {/* Attachments */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-200">
                Attachments {ticket.attachments?.length > 0 && `(${ticket.attachments.length})`}
              </h2>
              <label className={`btn-secondary px-3 py-1.5 text-xs cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploading ? 'Uploading…' : '+ Attach File'}
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
            {ticket.attachments?.length === 0 ? (
              <p className="text-xs text-gray-600">No attachments yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ticket.attachments.map(a => {
                  const isImage = a.mimetype?.startsWith('image/');
                  const url = `${SERVER}/uploads/${a.filename}`;
                  return (
                    <div key={a.id} className="relative group rounded-xl overflow-hidden border border-gray-800 bg-gray-800/40">
                      {isImage ? (
                        <a href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt={a.original} className="w-full h-24 object-cover transition-transform group-hover:scale-105" />
                        </a>
                      ) : (
                        <a href={url} target="_blank" rel="noreferrer"
                          className="flex flex-col items-center justify-center h-24 text-gray-400 hover:text-gray-200 gap-1 transition-colors">
                          <span className="text-2xl">📎</span>
                          <span className="text-[10px] text-center px-2 truncate w-full">{a.original}</span>
                        </a>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 flex items-center justify-between">
                        <span className="text-[9px] text-gray-400 truncate">{a.original}</span>
                        <span className="text-[9px] text-gray-600">{formatBytes(a.size)}</span>
                      </div>
                      {(canManage || user.id === ticket.submitter_id) && (
                        <button onClick={() => handleDeleteAttachment(a.id)}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 text-gray-400 hover:text-red-400 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-200 mb-4">
              Comments {ticket.comments?.length > 0 && `(${ticket.comments.length})`}
            </h2>
            {ticket.comments?.length > 0 && (
              <div className="space-y-4 mb-5">
                {ticket.comments.map(c => (
                  <div key={c.id}
                    className={`flex gap-3 transition-all duration-500 ${newCommentId === c.id ? 'animate-fadeIn' : ''}`}>
                    <Avatar name={c.author_name} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-gray-200">{c.author_name}</span>
                        <span className="text-xs text-gray-600 capitalize">{c.author_role?.replace('_',' ')}</span>
                        <span className="text-xs text-gray-700">{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed">{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* Template picker */}
            {templates.length > 0 && (
              <div className="mb-2">
                <button
                  type="button"
                  onClick={() => setShowTemplates(p => !p)}
                  className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 mb-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h8" /></svg>
                  {showTemplates ? 'Hide templates' : `Use template (${templates.length})`}
                </button>
                {showTemplates && (
                  <div className="bg-gray-850 border border-gray-700 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {templates.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setComment(t.body);
                          setShowTemplates(false);
                          api.post(`/ticket-templates/${t.id}/use`).catch(() => {});
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-700 border-b border-gray-700/50 last:border-0 group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-white text-xs font-medium group-hover:text-green-400 transition-colors">{t.name}</span>
                          {t.category && (
                            <span className="text-gray-600 text-xs capitalize">{t.category}</span>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs mt-0.5 line-clamp-1 font-mono">{t.body}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <form onSubmit={handleComment} className="space-y-2" ref={commentBoxRef}>
              <SmartTextarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                placeholder="Write a comment…"
                maxLength={1000}
              />
              <SpinnerButton
                type="submit"
                disabled={!comment.trim() || submitting}
                loading={submitting}
                className="btn-primary px-4 py-2 text-sm"
              >
                Post Comment
              </SpinnerButton>
            </form>
          </div>

          {/* Internal notes */}
          {canManage && (
            <div className="card p-5" style={{ borderColor: 'rgba(180,120,0,0.3)' }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-amber-400">🔒</span>
                <h2 className="text-sm font-semibold text-amber-300">Internal Notes</h2>
                <span className="text-xs text-gray-600">— IT staff only</span>
              </div>
              {ticket.notes?.length > 0 && (
                <div className="space-y-3 mb-4">
                  {ticket.notes.map(n => (
                    <div key={n.id} className="rounded-lg p-3 border"
                      style={{ background: 'rgba(120,80,0,0.15)', borderColor: 'rgba(180,120,0,0.25)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-amber-300">{n.author_name}</span>
                        <span className="text-xs text-gray-600">{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed">{n.body}</p>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleNote} className="space-y-2">
                <SmartTextarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  className=""
                  style={{ borderColor: 'rgba(180,120,0,0.3)' }}
                  placeholder="Add an internal note…"
                  maxLength={1000}
                />
                <button type="submit" disabled={!note.trim() || submitting}
                  className="px-4 py-2 text-xs rounded-lg transition-colors active:scale-95 disabled:opacity-50"
                  style={{ background: 'rgba(120,80,0,0.3)', color: '#fbbf24', border: '1px solid rgba(180,120,0,0.3)' }}>
                  Add Note
                </button>
              </form>
            </div>
          )}

          {/* ATLAS similar resolutions */}
          <AtlasSuggestions ticketId={id} />

          {/* Resolution summary + ATLAS report */}
          <ResolutionCard ticket={ticket} />

          {/* Related tickets */}
          <RelatedTickets ticketId={id} />
        </div>

        {/* ── Right column: manage + timeline ── */}
        <div className="space-y-4">
          {canManage && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-200 mb-4">Manage</h3>
              <div className="space-y-3">
                {[
                  { label: 'Status', val: editStatus, set: setEditStatus, opts: ['open','in_progress','resolved','closed'] },
                  { label: 'Priority', val: editPriority, set: setEditPriority, opts: ['low','medium','high','critical'] },
                  { label: 'Category', val: editCategory, set: setEditCategory, opts: ['hardware','software','network','access','account'] },
                ].map(f => (
                  <div key={f.label}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                    <select value={f.val} onChange={e => f.set(e.target.value)} className="input w-full">
                      {f.opts.map(o => <option key={o} value={o}>{o.replace('_',' ')}</option>)}
                    </select>
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Assign To</label>
                  <select value={editAssignee} onChange={e => setEditAssignee(e.target.value)} className="input w-full">
                    <option value="">— Unassigned —</option>
                    {staffUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                {['resolved', 'closed'].includes(editStatus) && !ticket.solution && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">What fixed it? <span className="text-gray-700">(optional)</span></label>
                    <SmartTextarea
                      value={solution}
                      onChange={e => setSolution(e.target.value)}
                      rows={2}
                      placeholder="e.g. Cleared print spooler and reinstalled driver…"
                      maxLength={500}
                    />
                  </div>
                )}
                <SpinnerButton
                  onClick={handleUpdate}
                  disabled={submitting}
                  loading={submitting}
                  success={updateSuccess}
                  className="btn-primary w-full py-2.5 text-sm"
                >
                  Save Changes
                </SpinnerButton>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="card p-4 space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Timeline</h3>
            {[
              { label: 'Created',  val: ticket.created_at },
              { label: 'Updated',  val: ticket.updated_at },
              ticket.resolved_at && { label: 'Resolved', val: ticket.resolved_at, highlight: true },
            ].filter(Boolean).map(row => (
              <div key={row.label} className="flex justify-between text-xs">
                <span className="text-gray-600">{row.label}</span>
                <span className={row.highlight ? 'text-pine-400' : 'text-gray-400'}>{new Date(row.val).toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Employee profile panel */}
          {canManage && empProfile && (
            <div className="card p-4 space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitter Profile</h3>
              {[
                { label: 'Department',  val: empProfile.department },
                { label: 'Device',      val: empProfile.device_type },
                { label: 'Software',    val: empProfile.primary_software },
                { label: 'Tenure',      val: empProfile.tenure_months
                    ? `${Math.floor(empProfile.tenure_months/12) > 0 ? `${Math.floor(empProfile.tenure_months/12)}y ` : ''}${empProfile.tenure_months%12 > 0 ? `${empProfile.tenure_months%12}mo` : ''}`.trim()
                    : null },
              ].filter(r => r.val).map(row => (
                <div key={row.label} className="flex justify-between text-xs">
                  <span className="text-gray-600">{row.label}</span>
                  <span className="text-gray-400 text-right max-w-[60%] truncate">{row.val}</span>
                </div>
              ))}
              {empProfile.notes && (
                <p className="text-[10px] text-gray-600 pt-1 border-t border-gray-800 leading-relaxed">{empProfile.notes}</p>
              )}
            </div>
          )}

          {/* Integration context panels (single fetch, both providers) */}
          {canManage && ticket.submitter_email && (
            <IntegrationContextPanels email={ticket.submitter_email} />
          )}

          {/* Activity timeline */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Activity</h3>
            {history.length === 0 && ticket.comments?.length === 0 ? (
              <p className="text-xs text-gray-600">No activity yet.</p>
            ) : (
              <Timeline history={history} comments={ticket.comments || []} ticket={ticket} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
