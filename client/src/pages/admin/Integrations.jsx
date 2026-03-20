import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext.jsx';
import api from '../../api/client.js';

const ACTION_LABELS = {
  password_reset: 'Password Reset',
  account_unlock: 'Account Unlock',
  access_grant:   'Access Grant',
};

const ACTION_ICONS = {
  password_reset: '🔑',
  account_unlock: '🔓',
  access_grant:   '📂',
};

const STATUS_STYLES = {
  pending:  'bg-amber-900/40 text-amber-300 border-amber-800/50',
  approved: 'bg-blue-900/40 text-blue-300 border-blue-800/50',
  executed: 'bg-pine-900/40 text-pine-300 border-pine-800/50',
  denied:   'bg-gray-800 text-gray-500 border-gray-700',
  failed:   'bg-red-900/40 text-red-300 border-red-800/50',
};

function StatusBadge({ status }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
      {status}
    </span>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-7 h-7 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function ConnectedCard({ status, onDisconnect, disconnecting }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-pine-400 animate-pulse" />
          <span className="text-sm font-medium text-pine-300">Connected</span>
        </div>
        <button
          onClick={onDisconnect}
          disabled={disconnecting}
          className="text-xs text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/40">
          <p className="text-gray-500 mb-0.5">Connected</p>
          <p className="text-gray-300">{status.connected_at ? new Date(status.connected_at).toLocaleDateString() : '—'}</p>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/40">
          <p className="text-gray-500 mb-0.5">Last sync</p>
          <p className="text-gray-300">
            {status.last_sync_at ? new Date(status.last_sync_at).toLocaleString() : 'Never'}
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Enabled actions</p>
        <div className="space-y-1.5">
          {(status.actions_enabled || []).map(action => (
            <div key={action} className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg bg-gray-800/40 border border-gray-700/30">
              <span>{ACTION_ICONS[action]}</span>
              <span className="text-sm text-gray-300">{ACTION_LABELS[action]}</span>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-pine-900/40 text-pine-400 border border-pine-800/40">
                Active
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-1">
        <p className="text-[10px] text-gray-600 leading-relaxed">
          All actions require IT staff approval before execution. ATLAS cannot delete accounts,
          modify admin users, access email content, or change billing settings.
        </p>
      </div>
    </div>
  );
}

function ActionLog({ actions, loading }) {
  if (loading) return <div className="skeleton h-32 rounded-xl" />;
  if (actions.length === 0) return (
    <p className="text-sm text-gray-600 py-4 text-center">No actions yet. Actions will appear here once employees submit tickets that ATLAS can handle.</p>
  );

  return (
    <div className="space-y-2">
      {actions.map(action => (
        <div key={action.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/40 border border-gray-700/30">
          <span className="text-lg shrink-0">{ACTION_ICONS[action.action_type] || '⚙'}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-300">{ACTION_LABELS[action.action_type]}</span>
              <StatusBadge status={action.status} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {action.target_email}
              {action.ticket_title && <> · <span className="text-gray-600">{action.ticket_title}</span></>}
            </p>
            {action.result && (
              <p className="text-[10px] text-pine-500 mt-0.5 truncate">{action.result}</p>
            )}
            {action.error_message && (
              <p className="text-[10px] text-red-400 mt-0.5 truncate">{action.error_message}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            {action.approver_name && (
              <p className="text-[10px] text-gray-600">{action.approver_name}</p>
            )}
            <p className="text-[10px] text-gray-700">
              {new Date(action.requested_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Integrations() {
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  const [status, setStatus]             = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [connecting, setConnecting]     = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [actions, setActions]           = useState([]);
  const [loadingActions, setLoadingActions] = useState(true);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error     = searchParams.get('error');
    if (connected === '1') addToast('Google Workspace connected successfully.', 'success');
    if (error === 'oauth_denied') addToast('Google authorization was cancelled.', 'warning');
    if (error === 'oauth_failed') addToast('Failed to connect Google Workspace. Check your OAuth credentials.', 'error');
  }, []);

  useEffect(() => {
    loadStatus();
    loadActions();
  }, []);

  const loadStatus = () => {
    setLoadingStatus(true);
    api.get('/integrations').then(r => setStatus(r.data)).catch(() => setStatus(null)).finally(() => setLoadingStatus(false));
  };

  const loadActions = () => {
    api.get('/integrations/actions').then(r => setActions(r.data)).catch(() => {}).finally(() => setLoadingActions(false));
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data } = await api.get('/integrations/google/connect-url');
      window.location.href = data.url;
    } catch {
      addToast('Failed to start Google authorization', 'error');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await api.delete('/integrations/google');
      setStatus({ connected: false });
      addToast('Google Workspace disconnected', 'info');
    } catch {
      addToast('Failed to disconnect', 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
        <p className="text-sm text-gray-500 mt-1">Connect external services so ATLAS can take automated actions on your behalf.</p>
      </div>

      {/* Google Workspace card */}
      <div className="card p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="p-2.5 rounded-xl bg-gray-800 border border-gray-700/50 shrink-0">
            <GoogleIcon />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-semibold text-white">Google Workspace</h2>
              {!loadingStatus && status?.connected && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-pine-900/60 text-pine-300 border border-pine-800/50 font-medium">
                  Connected
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Let ATLAS reset passwords, unlock accounts, and grant Drive access with one-click IT approval.
            </p>
          </div>
        </div>

        {loadingStatus ? (
          <div className="skeleton h-28 rounded-xl" />
        ) : status?.connected ? (
          <ConnectedCard status={status} onDisconnect={handleDisconnect} disconnecting={disconnecting} />
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/30 space-y-2">
              {[
                ['🔑', 'Password Reset', 'Auto-reset locked-out users and email them a temporary password'],
                ['🔓', 'Account Unlock', 'Unsuspend disabled accounts without leaving Sentinel'],
                ['📂', 'Drive Access', 'Grant employees access to shared drives after approval'],
                ['👁', 'User Context', 'See any employee\'s Google account status, last login, and groups on every ticket'],
              ].map(([icon, label, desc]) => (
                <div key={label} className="flex items-start gap-2.5">
                  <span className="mt-0.5">{icon}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-300">{label}</p>
                    <p className="text-xs text-gray-600">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600">
              Requires <code className="text-gray-500">GOOGLE_CLIENT_ID</code>, <code className="text-gray-500">GOOGLE_CLIENT_SECRET</code>, and <code className="text-gray-500">GOOGLE_REDIRECT_URI</code> environment variables.
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60"
            >
              {connecting ? 'Redirecting to Google…' : 'Connect Google Workspace'}
            </button>
          </div>
        )}
      </div>

      {/* Placeholder future integrations */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { name: 'Microsoft 365', icon: '🪟', desc: 'Entra ID, Exchange, SharePoint' },
          { name: 'Okta', icon: '🔐', desc: 'SSO, user lifecycle management' },
          { name: 'JumpCloud', icon: '☁', desc: 'Cloud directory and MDM' },
          { name: 'Slack', icon: '💬', desc: 'Ticket notifications and approvals' },
        ].map(({ name, icon, desc }) => (
          <div key={name} className="card p-4 opacity-50">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-xl">{icon}</span>
              <div>
                <p className="text-sm font-medium text-gray-400">{name}</p>
                <p className="text-[10px] text-gray-600">{desc}</p>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-600 border border-gray-700">
              Coming soon
            </span>
          </div>
        ))}
      </div>

      {/* Action log */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-200">ATLAS Action Log</h2>
          <button onClick={loadActions} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Refresh
          </button>
        </div>
        <ActionLog actions={actions} loading={loadingActions} />
      </div>
    </div>
  );
}
