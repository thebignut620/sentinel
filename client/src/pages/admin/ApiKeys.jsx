import { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext.jsx';
import api from '../../api/client.js';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
    }
  };
  return (
    <button
      onClick={handleCopy}
      className="text-xs px-2 py-1 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors shrink-0"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

function NewKeyModal({ keyData, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card p-6 max-w-lg w-full space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-pine-900/60 border border-pine-700/50 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-pine-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">API Key Created</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Copy this key now — it will not be shown again.
            </p>
          </div>
        </div>

        <div className="bg-gray-900 border border-pine-800/50 rounded-xl p-4">
          <p className="text-[10px] font-medium text-pine-400 uppercase tracking-wider mb-2">Secret Key</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm text-pine-300 font-mono break-all">{keyData.key}</code>
            <CopyButton text={keyData.key} />
          </div>
        </div>

        <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-3">
          <p className="text-xs text-amber-300">
            <span className="font-semibold">Important:</span> Store this key securely. For security reasons, it cannot be retrieved after closing this dialog.
          </p>
        </div>

        <button onClick={onClose} className="btn-primary w-full py-2.5 text-sm">
          I've saved the key
        </button>
      </div>
    </div>
  );
}

function CreateKeyForm({ onCreated }) {
  const [name, setName] = useState('');
  const [rateLimit, setRateLimit] = useState('100');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/api-keys', { name: name.trim(), rate_limit: parseInt(rateLimit) || 100 });
      setName('');
      setRateLimit('100');
      onCreated(data);
    } catch {
      addToast('Failed to create API key', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-200">Generate New Key</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Key Name</label>
          <input
            className="input w-full text-sm"
            placeholder="e.g. Zapier Integration, CI/CD Pipeline"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Rate Limit (req/min)</label>
          <input
            className="input w-full text-sm"
            type="number"
            min="1"
            max="10000"
            value={rateLimit}
            onChange={e => setRateLimit(e.target.value)}
          />
        </div>
      </div>
      <button type="submit" disabled={loading || !name.trim()} className="btn-primary px-5 py-2 text-sm">
        {loading ? 'Generating…' : 'Generate API Key'}
      </button>
    </form>
  );
}

export default function ApiKeys() {
  const [keys, setKeys]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [newKeyData, setNewKeyData] = useState(null);
  const [revoking, setRevoking]   = useState(null);
  const { addToast } = useToast();

  useEffect(() => { loadKeys(); }, []);

  const loadKeys = () => {
    setLoading(true);
    api.get('/api-keys')
      .then(r => setKeys(r.data))
      .catch(() => addToast('Failed to load API keys', 'error'))
      .finally(() => setLoading(false));
  };

  const handleCreated = (data) => {
    setNewKeyData(data);
    loadKeys();
  };

  const handleRevoke = async (key) => {
    if (!confirm(`Revoke "${key.name}"? Any integrations using this key will stop working immediately.`)) return;
    setRevoking(key.id);
    try {
      await api.delete(`/api-keys/${key.id}`);
      setKeys(k => k.filter(x => x.id !== key.id));
      addToast('API key revoked', 'success');
    } catch {
      addToast('Failed to revoke key', 'error');
    } finally {
      setRevoking(null);
    }
  };

  const handleToggle = async (key) => {
    try {
      const { data } = await api.patch(`/api-keys/${key.id}`, { is_active: !key.is_active });
      setKeys(k => k.map(x => x.id === key.id ? { ...x, ...data } : x));
      addToast(data.is_active ? 'API key enabled' : 'API key disabled', 'success');
    } catch {
      addToast('Failed to update key', 'error');
    }
  };

  return (
    <div className="max-w-3xl space-y-6 animate-fadeIn">
      {newKeyData && (
        <NewKeyModal
          keyData={newKeyData}
          onClose={() => setNewKeyData(null)}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-white">API Keys</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage API keys for the{' '}
          <a href="/api-docs" target="_blank" rel="noopener noreferrer" className="text-pine-400 hover:text-pine-300 transition-colors">
            Sentinel Public API
          </a>
          . Keys authenticate requests to <code className="text-gray-400 text-xs">/v1/*</code> endpoints.
        </p>
      </div>

      <CreateKeyForm onCreated={handleCreated} />

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-200">Active Keys</h2>
          <button onClick={loadKeys} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-10">
            <div className="h-12 w-12 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">No API keys yet. Generate one above to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map(key => (
              <div key={key.id} className="flex items-center gap-4 p-4 rounded-xl bg-gray-800/40 border border-gray-700/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-200">{key.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
                      key.is_active
                        ? 'bg-pine-900/40 text-pine-300 border-pine-800/40'
                        : 'bg-gray-800 text-gray-500 border-gray-700'
                    }`}>
                      {key.is_active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <code className="text-xs text-gray-500 font-mono">{key.key_prefix}…</code>
                    <span className="text-[10px] text-gray-600">·</span>
                    <span className="text-[10px] text-gray-600">{key.rate_limit} req/min</span>
                    <span className="text-[10px] text-gray-600">·</span>
                    <span className="text-[10px] text-gray-600">{key.requests_count.toLocaleString()} total requests</span>
                    {key.last_used_at && (
                      <>
                        <span className="text-[10px] text-gray-600">·</span>
                        <span className="text-[10px] text-gray-600">Last used {new Date(key.last_used_at).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(key)}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {key.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleRevoke(key)}
                    disabled={revoking === key.id}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    {revoking === key.id ? 'Revoking…' : 'Revoke'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage info */}
      <div className="card p-5 border-pine-900/30">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">How to use</h3>
        <div className="space-y-2 text-xs text-gray-500">
          <p>Include your API key in the <code className="text-gray-400">X-API-Key</code> header on all requests to <code className="text-gray-400">/v1/*</code> endpoints.</p>
          <div className="bg-gray-900 rounded-lg p-3 mt-2">
            <code className="text-gray-400 font-mono text-[11px]">curl https://your-sentinel.com/v1/tickets \<br />{'  '}-H "X-API-Key: sk_live_…"</code>
          </div>
          <p className="mt-2">See the <a href="/api-docs" target="_blank" rel="noopener noreferrer" className="text-pine-400 hover:text-pine-300">full API documentation</a> for all available endpoints and examples.</p>
        </div>
      </div>
    </div>
  );
}
