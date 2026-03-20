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

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 21 21" className="w-7 h-7 shrink-0">
      <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
      <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  );
}

function ConnectedCard({ status, onDisconnect, disconnecting, children }) {
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
          <p className="text-gray-300">{status.last_sync_at ? new Date(status.last_sync_at).toLocaleString() : 'Never'}</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Enabled actions</p>
        <div className="space-y-1.5">
          {(status.actions_enabled || []).map(action => (
            <div key={action} className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg bg-gray-800/40 border border-gray-700/30">
              <span>{ACTION_ICONS[action]}</span>
              <span className="text-sm text-gray-300">{ACTION_LABELS[action]}</span>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-pine-900/40 text-pine-400 border border-pine-800/40">Active</span>
            </div>
          ))}
        </div>
      </div>

      {children}

      <div className="pt-1">
        <p className="text-[10px] text-gray-600 leading-relaxed">
          All actions require IT staff approval before execution. ATLAS cannot delete accounts,
          modify admin users, access email content, or change billing settings.
        </p>
      </div>
    </div>
  );
}

function MicrosoftConnectedCard({ status, onDisconnect, disconnecting }) {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savingWebhook, setSavingWebhook]  = useState(false);
  const [webhookSaved, setWebhookSaved]    = useState(false);
  const { addToast } = useToast();

  const handleSaveWebhook = async () => {
    setSavingWebhook(true);
    try {
      await api.patch('/integrations/microsoft', { teams_webhook_url: webhookUrl.trim() || null });
      setWebhookSaved(true);
      setTimeout(() => setWebhookSaved(false), 2000);
      addToast(webhookUrl.trim() ? 'Teams webhook URL saved.' : 'Teams webhook removed.', 'success');
    } catch {
      addToast('Failed to save webhook URL', 'error');
    } finally {
      setSavingWebhook(false);
    }
  };

  return (
    <ConnectedCard status={status} onDisconnect={onDisconnect} disconnecting={disconnecting}>
      {/* Teams webhook config */}
      <div className="pt-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">💬</span>
          <p className="text-xs font-medium text-gray-400">Teams Notifications</p>
          {status.teams_webhook_configured && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-pine-900/40 text-pine-400 border border-pine-800/40">Configured</span>
          )}
        </div>
        <p className="text-[10px] text-gray-600">
          Post to a Teams channel when critical tickets are created or ATLAS actions are approved.
        </p>
        <div className="flex gap-2">
          <input
            className="input flex-1 text-xs"
            placeholder="https://…webhook.office.com/…"
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
          />
          <button
            onClick={handleSaveWebhook}
            disabled={savingWebhook}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-900/40 border border-blue-800/50 text-blue-300 hover:bg-blue-800/50 transition-colors disabled:opacity-50 shrink-0"
          >
            {webhookSaved ? '✓ Saved' : savingWebhook ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </ConnectedCard>
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
              {action.provider === 'microsoft' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-900/30 text-blue-400 border border-blue-800/30">M365</span>
              )}
              {(!action.provider || action.provider === 'google') && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500 border border-gray-700">Google</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {action.target_email}
              {action.ticket_title && <> · <span className="text-gray-600">{action.ticket_title}</span></>}
            </p>
            {action.result        && <p className="text-[10px] text-pine-500 mt-0.5 truncate">{action.result}</p>}
            {action.error_message && <p className="text-[10px] text-red-400 mt-0.5 truncate">{action.error_message}</p>}
          </div>
          <div className="text-right shrink-0">
            {action.approver_name && <p className="text-[10px] text-gray-600">{action.approver_name}</p>}
            <p className="text-[10px] text-gray-700">{new Date(action.requested_at).toLocaleDateString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SLACK CARD ───────────────────────────────────────────────────────────────

function SlackCard() {
  const { addToast } = useToast();
  const [cfg, setCfg]           = useState(null);
  const [loading, setLoading]   = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channel, setChannel]   = useState('');
  const [enabled, setEnabled]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);

  useEffect(() => {
    api.get('/slack')
      .then(r => {
        setCfg(r.data);
        setWebhookUrl(r.data.slack_webhook_url || '');
        setChannel(r.data.slack_channel || '');
        setEnabled(r.data.slack_enabled);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/slack', { slack_webhook_url: webhookUrl.trim(), slack_channel: channel.trim(), slack_enabled: enabled });
      addToast('Slack settings saved', 'success');
      setCfg(c => ({ ...c, configured: !!webhookUrl.trim(), slack_enabled: enabled }));
    } catch {
      addToast('Failed to save Slack settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await api.get('/slack/test');
      addToast('Test notification sent to Slack!', 'success');
    } catch (e) {
      addToast(e.response?.data?.error || 'Test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-start gap-4 mb-5">
        <div className="p-2.5 rounded-xl bg-gray-800 border border-gray-700/50 shrink-0 text-2xl leading-none flex items-center justify-center w-12 h-12">
          💬
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-semibold text-white">Slack</h2>
            {!loading && cfg?.configured && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pine-900/60 text-pine-300 border border-pine-800/50 font-medium">
                {enabled ? 'Active' : 'Configured'}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Post ticket notifications to a Slack channel via an incoming webhook.</p>
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-24 rounded-xl" />
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Incoming Webhook URL</label>
            <input
              className="input w-full text-sm"
              placeholder="https://hooks.slack.com/services/…"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Channel (optional display name)</label>
            <input
              className="input w-full text-sm"
              placeholder="#it-alerts"
              value={channel}
              onChange={e => setChannel(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="slack-enabled"
              type="checkbox"
              className="rounded border-gray-600 bg-gray-800 text-pine-500 focus:ring-pine-500"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
            />
            <label htmlFor="slack-enabled" className="text-sm text-gray-400">Enable Slack notifications</label>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2 text-sm">
              {saving ? 'Saving…' : 'Save'}
            </button>
            {cfg?.configured && (
              <button onClick={handleTest} disabled={testing} className="btn-ghost px-4 py-2 text-sm">
                {testing ? 'Sending…' : 'Send Test'}
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-600">Notifications fire on: new ticket, critical ticket, ticket resolved.</p>
        </div>
      )}
    </div>
  );
}

// ─── EMAIL INGESTION CARD ─────────────────────────────────────────────────────

function EmailIngestionCard() {
  const { addToast } = useToast();
  const [cfg, setCfg]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState({ imap_host: '', imap_user: '', imap_pass: '', imap_port: '993', email_ingestion_enabled: false });
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    api.get('/email-ingestion/status')
      .then(r => {
        setCfg(r.data);
        setForm(f => ({ ...f, imap_host: r.data.imap_host, imap_user: r.data.imap_user, imap_port: r.data.imap_port, email_ingestion_enabled: r.data.enabled }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/email-ingestion', form);
      addToast('IMAP settings saved', 'success');
      setCfg(c => ({ ...c, configured: !!(form.imap_host && form.imap_user), enabled: form.email_ingestion_enabled }));
    } catch {
      addToast('Failed to save IMAP settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="card p-6">
      <div className="flex items-start gap-4 mb-5">
        <div className="p-2.5 rounded-xl bg-gray-800 border border-gray-700/50 shrink-0 text-2xl leading-none flex items-center justify-center w-12 h-12">
          📨
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-semibold text-white">Email to Ticket</h2>
            {!loading && cfg?.configured && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pine-900/60 text-pine-300 border border-pine-800/50 font-medium">
                {cfg.enabled ? 'Active' : 'Configured'}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Automatically create tickets from emails via IMAP polling. Polled every 2 minutes.</p>
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-32 rounded-xl" />
      ) : (
        <div className="space-y-3">
          {cfg?.tickets_ingested > 0 && (
            <div className="bg-pine-900/20 border border-pine-800/30 rounded-lg px-3 py-2">
              <p className="text-xs text-pine-400">{cfg.tickets_ingested.toLocaleString()} ticket{cfg.tickets_ingested !== 1 ? 's' : ''} ingested from email</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">IMAP Host</label>
              <input className="input w-full text-sm" placeholder="imap.gmail.com" value={form.imap_host} onChange={e => set('imap_host', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Username / Email</label>
              <input className="input w-full text-sm" placeholder="helpdesk@company.com" value={form.imap_user} onChange={e => set('imap_user', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Port</label>
              <input className="input w-full text-sm" type="number" value={form.imap_port} onChange={e => set('imap_port', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Password / App Password</label>
              <input className="input w-full text-sm" type="password" placeholder="••••••••" value={form.imap_pass} onChange={e => set('imap_pass', e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="imap-enabled"
              type="checkbox"
              className="rounded border-gray-600 bg-gray-800 text-pine-500 focus:ring-pine-500"
              checked={form.email_ingestion_enabled}
              onChange={e => set('email_ingestion_enabled', e.target.checked)}
            />
            <label htmlFor="imap-enabled" className="text-sm text-gray-400">Enable email ingestion</label>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2 text-sm">
            {saving ? 'Saving…' : 'Save IMAP Settings'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── WEBHOOKS CARD ────────────────────────────────────────────────────────────

const ALL_EVENTS = ['ticket.created', 'ticket.updated', 'ticket.resolved', 'ticket.closed'];

function WebhooksCard() {
  const { addToast } = useToast();
  const [hooks, setHooks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name: '', url: '', secret: '', events: [...ALL_EVENTS] });
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => { loadHooks(); }, []);

  const loadHooks = () => {
    api.get('/webhooks')
      .then(r => setHooks(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/webhooks', { ...form, events: form.events.join(',') });
      setHooks(h => [data, ...h]);
      setForm({ name: '', url: '', secret: '', events: [...ALL_EVENTS] });
      setShowForm(false);
      addToast('Webhook created', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to create webhook', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this webhook?')) return;
    setDeleting(id);
    try {
      await api.delete(`/webhooks/${id}`);
      setHooks(h => h.filter(x => x.id !== id));
      addToast('Webhook deleted', 'success');
    } catch {
      addToast('Failed to delete webhook', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const handleTest = async (id) => {
    setTesting(id);
    try {
      const { data } = await api.post(`/webhooks/${id}/test`);
      addToast(data.ok ? `Test delivered (HTTP ${data.status})` : `Test failed (HTTP ${data.status})`, data.ok ? 'success' : 'error');
    } catch (e) {
      addToast(e.response?.data?.error || 'Test failed', 'error');
    } finally {
      setTesting(null);
    }
  };

  const handleToggleEvent = (evt) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(evt) ? f.events.filter(e => e !== evt) : [...f.events, evt],
    }));
  };

  const handleToggleActive = async (hook) => {
    try {
      const { data } = await api.patch(`/webhooks/${hook.id}`, { is_active: !hook.is_active });
      setHooks(h => h.map(x => x.id === hook.id ? { ...x, ...data } : x));
    } catch {
      addToast('Failed to update webhook', 'error');
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-start gap-4 mb-5">
        <div className="p-2.5 rounded-xl bg-gray-800 border border-gray-700/50 shrink-0 text-2xl leading-none flex items-center justify-center w-12 h-12">
          🪝
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-semibold text-white">Custom Webhooks</h2>
            {hooks.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700 font-medium">
                {hooks.filter(h => h.is_active).length} active
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Send signed HMAC-SHA256 payloads to external URLs when ticket events occur.</p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="btn-ghost px-3 py-1.5 text-xs shrink-0"
        >
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 mb-5 bg-gray-800/40 rounded-xl p-4 border border-gray-700/30">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Name</label>
              <input className="input w-full text-sm" placeholder="My Webhook" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">URL</label>
              <input className="input w-full text-sm" type="url" placeholder="https://…" required value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Secret (for HMAC signature)</label>
              <input className="input w-full text-sm" placeholder="Optional signing secret" value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Events</label>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENTS.map(evt => (
                <label key={evt} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-600 bg-gray-800 text-pine-500 focus:ring-pine-500"
                    checked={form.events.includes(evt)}
                    onChange={() => handleToggleEvent(evt)}
                  />
                  <span className="text-xs text-gray-400">{evt}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm">
            {saving ? 'Creating…' : 'Create Webhook'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="skeleton h-20 rounded-xl" />
      ) : hooks.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-6">No webhooks configured yet.</p>
      ) : (
        <div className="space-y-2">
          {hooks.map(hook => (
            <div key={hook.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-800/40 border border-gray-700/30">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-300">{hook.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${hook.is_active ? 'bg-pine-900/40 text-pine-300 border-pine-800/40' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                    {hook.is_active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="text-xs text-gray-600 truncate mt-0.5">{hook.url}</p>
                <p className="text-[10px] text-gray-700 mt-0.5">{hook.events}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => handleTest(hook.id)} disabled={testing === hook.id} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                  {testing === hook.id ? '…' : 'Test'}
                </button>
                <button onClick={() => handleToggleActive(hook)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                  {hook.is_active ? 'Pause' : 'Resume'}
                </button>
                <button onClick={() => handleDelete(hook.id)} disabled={deleting === hook.id} className="text-xs text-gray-600 hover:text-red-400 transition-colors">
                  {deleting === hook.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PAGERDUTY CARD ───────────────────────────────────────────────────────────

function PagerDutyCard() {
  const { addToast } = useToast();
  const [cfg, setCfg]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [routingKey, setRoutingKey] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    api.get('/settings')
      .then(r => {
        const map = r.data || {};
        setRoutingKey(map.pagerduty_routing_key || '');
        setEnabled(map.pagerduty_enabled === 'true');
        setCfg({ configured: !!map.pagerduty_routing_key });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/settings', {
        pagerduty_routing_key: routingKey.trim(),
        pagerduty_enabled: enabled ? 'true' : 'false',
      });
      setCfg({ configured: !!routingKey.trim() });
      addToast('PagerDuty settings saved', 'success');
    } catch {
      addToast('Failed to save PagerDuty settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-start gap-4 mb-5">
        <div className="p-2.5 rounded-xl bg-gray-800 border border-gray-700/50 shrink-0 text-2xl leading-none flex items-center justify-center w-12 h-12">
          🚨
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-semibold text-white">PagerDuty</h2>
            {!loading && cfg?.configured && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pine-900/60 text-pine-300 border border-pine-800/50 font-medium">
                {enabled ? 'Active' : 'Configured'}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Auto-trigger PagerDuty incidents for critical unassigned tickets older than 15 minutes.</p>
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-20 rounded-xl" />
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Events API v2 Routing Key</label>
            <input
              className="input w-full text-sm font-mono"
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={routingKey}
              onChange={e => setRoutingKey(e.target.value)}
            />
            <p className="text-[10px] text-gray-600 mt-1">Found in PagerDuty under Services &gt; Integrations &gt; Events API v2.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="pd-enabled"
              type="checkbox"
              className="rounded border-gray-600 bg-gray-800 text-pine-500 focus:ring-pine-500"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
            />
            <label htmlFor="pd-enabled" className="text-sm text-gray-400">Enable PagerDuty escalation</label>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2 text-sm">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── JIRA CARD ────────────────────────────────────────────────────────────────

function JiraCard() {
  const { addToast } = useToast();
  const [cfg, setCfg]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState({ jira_host: '', jira_email: '', jira_token: '', jira_project: '', jira_enabled: false });
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    api.get('/jira/settings')
      .then(r => {
        setCfg(r.data);
        setForm(f => ({
          ...f,
          jira_host: r.data.jira_host,
          jira_email: r.data.jira_email,
          jira_project: r.data.jira_project,
          jira_enabled: r.data.jira_enabled,
        }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/jira/settings', form);
      setCfg(c => ({ ...c, jira_enabled: form.jira_enabled, jira_token_configured: c?.jira_token_configured || !!form.jira_token }));
      addToast('Jira settings saved', 'success');
    } catch {
      addToast('Failed to save Jira settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isConfigured = cfg?.jira_host && cfg?.jira_email && cfg?.jira_token_configured;

  return (
    <div className="card p-6">
      <div className="flex items-start gap-4 mb-5">
        <div className="p-2.5 rounded-xl bg-gray-800 border border-gray-700/50 shrink-0 text-2xl leading-none flex items-center justify-center w-12 h-12">
          🔷
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-semibold text-white">Jira</h2>
            {!loading && isConfigured && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pine-900/60 text-pine-300 border border-pine-800/50 font-medium">
                {form.jira_enabled ? 'Active' : 'Configured'}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Push Sentinel tickets to Jira and sync status back. Push individual tickets from the ticket detail view.</p>
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-32 rounded-xl" />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Jira Host</label>
              <input className="input w-full text-sm" placeholder="yourcompany.atlassian.net" value={form.jira_host} onChange={e => set('jira_host', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Project Key</label>
              <input className="input w-full text-sm" placeholder="IT" value={form.jira_project} onChange={e => set('jira_project', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
              <input className="input w-full text-sm" placeholder="admin@company.com" value={form.jira_email} onChange={e => set('jira_email', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                API Token {cfg?.jira_token_configured && <span className="text-pine-500 ml-1">✓ saved</span>}
              </label>
              <input className="input w-full text-sm" type="password" placeholder="Leave blank to keep existing" value={form.jira_token} onChange={e => set('jira_token', e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="jira-enabled"
              type="checkbox"
              className="rounded border-gray-600 bg-gray-800 text-pine-500 focus:ring-pine-500"
              checked={form.jira_enabled}
              onChange={e => set('jira_enabled', e.target.checked)}
            />
            <label htmlFor="jira-enabled" className="text-sm text-gray-400">Enable Jira integration</label>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2 text-sm">
            {saving ? 'Saving…' : 'Save Jira Settings'}
          </button>
          <p className="text-[10px] text-gray-600">Generate an API token at <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="text-pine-600 hover:text-pine-400">id.atlassian.com</a>.</p>
        </div>
      )}
    </div>
  );
}

export default function Integrations() {
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  const [status, setStatus]               = useState(null);   // { google: {…}, microsoft: {…} }
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [connectingGoogle, setConnectingGoogle]       = useState(false);
  const [connectingMicrosoft, setConnectingMicrosoft] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle]       = useState(false);
  const [disconnectingMicrosoft, setDisconnectingMicrosoft] = useState(false);
  const [actions, setActions]             = useState([]);
  const [loadingActions, setLoadingActions] = useState(true);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error     = searchParams.get('error');
    const provider  = searchParams.get('provider');

    if (connected === 'google')     addToast('Google Workspace connected successfully.', 'success');
    if (connected === 'microsoft')  addToast('Microsoft 365 connected successfully.', 'success');
    if (connected === '1')          addToast('Integration connected successfully.', 'success'); // legacy
    if (error === 'oauth_denied')   addToast(`${provider === 'microsoft' ? 'Microsoft' : 'Google'} authorization was cancelled.`, 'warning');
    if (error === 'oauth_failed')   addToast(`Failed to connect ${provider === 'microsoft' ? 'Microsoft 365' : 'Google Workspace'}. Check your OAuth credentials.`, 'error');
  }, []);

  useEffect(() => {
    loadStatus();
    loadActions();
  }, []);

  const loadStatus = () => {
    setLoadingStatus(true);
    api.get('/integrations')
      .then(r => setStatus(r.data))
      .catch(() => setStatus({ google: { connected: false }, microsoft: { connected: false } }))
      .finally(() => setLoadingStatus(false));
  };

  const loadActions = () => {
    api.get('/integrations/actions').then(r => setActions(r.data)).catch(() => {}).finally(() => setLoadingActions(false));
  };

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      const { data } = await api.get('/integrations/google/connect-url');
      window.location.href = data.url;
    } catch {
      addToast('Failed to start Google authorization', 'error');
      setConnectingGoogle(false);
    }
  };

  const handleConnectMicrosoft = async () => {
    setConnectingMicrosoft(true);
    try {
      const { data } = await api.get('/integrations/microsoft/connect-url');
      window.location.href = data.url;
    } catch {
      addToast('Failed to start Microsoft authorization', 'error');
      setConnectingMicrosoft(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    setDisconnectingGoogle(true);
    try {
      await api.delete('/integrations/google');
      setStatus(s => ({ ...s, google: { connected: false } }));
      addToast('Google Workspace disconnected', 'info');
    } catch {
      addToast('Failed to disconnect', 'error');
    } finally {
      setDisconnectingGoogle(false);
    }
  };

  const handleDisconnectMicrosoft = async () => {
    setDisconnectingMicrosoft(true);
    try {
      await api.delete('/integrations/microsoft');
      setStatus(s => ({ ...s, microsoft: { connected: false } }));
      addToast('Microsoft 365 disconnected', 'info');
    } catch {
      addToast('Failed to disconnect', 'error');
    } finally {
      setDisconnectingMicrosoft(false);
    }
  };

  const google    = status?.google    || {};
  const microsoft = status?.microsoft || {};

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
              {!loadingStatus && google.connected && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-pine-900/60 text-pine-300 border border-pine-800/50 font-medium">Connected</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Let ATLAS reset passwords, unlock accounts, and grant Drive access with one-click IT approval.
            </p>
          </div>
        </div>

        {loadingStatus ? (
          <div className="skeleton h-28 rounded-xl" />
        ) : google.connected ? (
          <ConnectedCard status={google} onDisconnect={handleDisconnectGoogle} disconnecting={disconnectingGoogle} />
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/30 space-y-2">
              {[
                ['🔑', 'Password Reset',  'Auto-reset locked-out users and email them a temporary password'],
                ['🔓', 'Account Unlock',  'Unsuspend disabled accounts without leaving Sentinel'],
                ['📂', 'Drive Access',    'Grant employees access to shared drives after approval'],
                ['👁', 'User Context',    "See any employee's Google account status, last login, and groups on every ticket"],
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
              onClick={handleConnectGoogle}
              disabled={connectingGoogle}
              className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60"
            >
              {connectingGoogle ? 'Redirecting to Google…' : 'Connect Google Workspace'}
            </button>
          </div>
        )}
      </div>

      {/* Microsoft 365 card */}
      <div className="card p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="p-2.5 rounded-xl bg-gray-800 border border-gray-700/50 shrink-0">
            <MicrosoftIcon />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-semibold text-white">Microsoft 365</h2>
              {!loadingStatus && microsoft.connected && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-pine-900/60 text-pine-300 border border-pine-800/50 font-medium">Connected</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Let ATLAS reset passwords, unlock Entra ID accounts, and grant SharePoint access with one-click IT approval.
            </p>
          </div>
        </div>

        {loadingStatus ? (
          <div className="skeleton h-28 rounded-xl" />
        ) : microsoft.connected ? (
          <MicrosoftConnectedCard status={microsoft} onDisconnect={handleDisconnectMicrosoft} disconnecting={disconnectingMicrosoft} />
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-800/40 rounded-xl p-4 border border-gray-700/30 space-y-2">
              {[
                ['🔑', 'Password Reset',       'Auto-reset Microsoft 365 passwords and email a temporary password'],
                ['🔓', 'Account Unlock',        'Re-enable disabled Entra ID accounts without leaving Sentinel'],
                ['📂', 'SharePoint Access',     'Grant employees access to SharePoint sites after IT approval'],
                ['👁', 'User Context',          "See any employee's M365 account status, last sign-in, groups, and licenses"],
                ['💬', 'Teams Notifications',   'Post alerts to a Teams channel when critical tickets arrive or actions execute'],
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
              Requires <code className="text-gray-500">MICROSOFT_CLIENT_ID</code>, <code className="text-gray-500">MICROSOFT_CLIENT_SECRET</code>, <code className="text-gray-500">MICROSOFT_TENANT_ID</code>, and <code className="text-gray-500">MICROSOFT_REDIRECT_URI</code> environment variables.
            </p>
            <button
              onClick={handleConnectMicrosoft}
              disabled={connectingMicrosoft}
              className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60"
            >
              {connectingMicrosoft ? 'Redirecting to Microsoft…' : 'Connect Microsoft 365'}
            </button>
          </div>
        )}
      </div>

      {/* Placeholder future integrations */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { name: 'Okta',         icon: '🔐', desc: 'SSO, user lifecycle management' },
          { name: 'JumpCloud',    icon: '☁',  desc: 'Cloud directory and MDM' },
          { name: 'Duo Security', icon: '🔒', desc: 'MFA enforcement and monitoring' },
          { name: 'ServiceNow',   icon: '🛎', desc: 'Enterprise ITSM sync' },
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

      {/* ─── SLACK ─────────────────────────────────────────────────────────────── */}
      <SlackCard />

      {/* ─── EMAIL-TO-TICKET ───────────────────────────────────────────────────── */}
      <EmailIngestionCard />

      {/* ─── WEBHOOKS ──────────────────────────────────────────────────────────── */}
      <WebhooksCard />

      {/* ─── PAGERDUTY ─────────────────────────────────────────────────────────── */}
      <PagerDutyCard />

      {/* ─── JIRA ──────────────────────────────────────────────────────────────── */}
      <JiraCard />

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
