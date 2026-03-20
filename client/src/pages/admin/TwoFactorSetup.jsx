import { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext.jsx';
import api from '../../api/client.js';

export default function TwoFactorSetup() {
  const [status, setStatus]   = useState(null); // { enabled }
  const [setup, setSetup]     = useState(null);  // { qrDataUrl, secret }
  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const loadStatus = async () => {
    const r = await api.get('/2fa/status');
    setStatus(r.data);
  };

  useEffect(() => { loadStatus(); }, []);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const r = await api.post('/2fa/setup');
      setSetup(r.data);
      setCode('');
    } catch (e) {
      addToast(e.response?.data?.error || 'Setup failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      await api.post('/2fa/enable', { code });
      addToast('Two-factor authentication enabled!', 'success');
      setSetup(null);
      setCode('');
      loadStatus();
    } catch (e) {
      addToast(e.response?.data?.error || 'Invalid code', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!code.trim()) return;
    if (!confirm('Disable two-factor authentication? Your account will be less secure.')) return;
    setLoading(true);
    try {
      await api.post('/2fa/disable', { code });
      addToast('Two-factor authentication disabled', 'success');
      setCode('');
      loadStatus();
    } catch (e) {
      addToast(e.response?.data?.error || 'Invalid code', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!status) return <div className="card p-8 text-center text-gray-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Two-Factor Authentication</h1>
        <p className="text-gray-400 text-sm mt-1">Add an extra layer of security to your account</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className={`h-3 w-3 rounded-full ${status.enabled ? 'bg-pine-400' : 'bg-gray-600'}`} />
          <span className="font-medium text-white">
            2FA is {status.enabled ? <span className="text-pine-400">enabled</span> : <span className="text-gray-400">disabled</span>}
          </span>
        </div>

        {!status.enabled && !setup && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Use an authenticator app like <strong className="text-white">Google Authenticator</strong> or{' '}
              <strong className="text-white">Authy</strong> to generate a 6-digit code on every login.
            </p>
            <button onClick={handleSetup} disabled={loading} className="btn-primary px-5 py-2 text-sm">
              {loading ? 'Setting up…' : 'Set up 2FA'}
            </button>
          </div>
        )}

        {setup && (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-medium text-white mb-1">Step 1 — Scan this QR code</p>
              <p className="text-xs text-gray-500 mb-3">Open your authenticator app and scan the code below</p>
              <img src={setup.qrDataUrl} alt="2FA QR code"
                className="w-44 h-44 rounded-xl border-2 border-gray-700 bg-white p-1" />
            </div>
            <div>
              <p className="text-sm font-medium text-white mb-1">Or enter the secret manually</p>
              <code className="text-xs bg-gray-800 text-pine-300 px-3 py-2 rounded-lg font-mono tracking-widest block w-fit">
                {setup.secret}
              </code>
            </div>
            <div>
              <p className="text-sm font-medium text-white mb-2">Step 2 — Enter the 6-digit code to confirm</p>
              <div className="flex gap-3">
                <input
                  className="input w-36 text-center text-lg tracking-widest font-mono"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleEnable()}
                />
                <button onClick={handleEnable} disabled={loading || code.length !== 6}
                  className="btn-primary px-5 py-2 text-sm">
                  {loading ? 'Verifying…' : 'Enable 2FA'}
                </button>
                <button onClick={() => { setSetup(null); setCode(''); }} className="btn-ghost px-4 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {status.enabled && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Your account is protected with TOTP two-factor authentication.
              To disable it, enter a code from your authenticator app.
            </p>
            <div className="flex gap-3">
              <input
                className="input w-36 text-center text-lg tracking-widest font-mono"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                placeholder="000000"
                maxLength={6}
                onKeyDown={e => e.key === 'Enter' && handleDisable()}
              />
              <button onClick={handleDisable} disabled={loading || code.length !== 6}
                className="px-5 py-2 text-sm rounded-xl bg-red-900/50 border border-red-800 text-red-300 hover:bg-red-900 transition-colors">
                {loading ? 'Disabling…' : 'Disable 2FA'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
