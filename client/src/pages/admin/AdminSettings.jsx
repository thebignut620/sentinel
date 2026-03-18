import { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext.jsx';
import { SkeletonCard } from '../../components/Skeleton.jsx';
import SpinnerButton from '../../components/SpinnerButton.jsx';
import api from '../../api/client.js';

function Toggle({ value, onChange }) {
  const on = value === 'true';
  return (
    <button
      type="button"
      onClick={() => onChange(on ? 'false' : 'true')}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${on ? 'bg-pine-700' : 'bg-gray-700'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function SectionHeader({ title, description }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
      {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
    </div>
  );
}

export default function AdminSettings() {
  const { addToast } = useToast();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(r => setSettings(r.data)).finally(() => setLoading(false));
  }, []);

  const set = (key) => (val) => setSettings(s => ({ ...s, [key]: val }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch('/settings', settings);
      setSettings(res.data);
      addToast('Settings saved', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg space-y-5">
        <div className="skeleton h-8 w-48" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-5 animate-fadeIn">
      <h1 className="text-2xl font-bold text-white">System Settings</h1>

      <form onSubmit={handleSave} className="space-y-4">
        {/* General */}
        <div className="card p-6">
          <SectionHeader title="General" description="Basic system configuration" />
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Company / System Name</label>
              <input
                type="text"
                value={settings.company_name || ''}
                onChange={e => set('company_name')(e.target.value)}
                className="input w-full"
                placeholder="e.g. Acme Corp IT"
              />
            </div>
          </div>
        </div>

        {/* AI */}
        <div className="card p-6">
          <SectionHeader title="AI Help Desk" description="Control the AI troubleshooting feature" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300">Enable AI Assistant</p>
              <p className="text-xs text-gray-600 mt-0.5">Employees receive AI-powered steps before a ticket is created</p>
            </div>
            <Toggle value={settings.ai_enabled || 'true'} onChange={set('ai_enabled')} />
          </div>
        </div>

        {/* SMTP */}
        <div className="card p-6">
          <SectionHeader
            title="Email / SMTP"
            description="Configure outbound email for ticket notifications and password resets"
          />
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">SMTP Host</label>
                <input
                  type="text"
                  value={settings.smtp_host || ''}
                  onChange={e => set('smtp_host')(e.target.value)}
                  className="input w-full"
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Port</label>
                <input
                  type="number"
                  value={settings.smtp_port || '587'}
                  onChange={e => set('smtp_port')(e.target.value)}
                  className="input w-full"
                  placeholder="587"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Username / Email</label>
              <input
                type="email"
                value={settings.smtp_user || ''}
                onChange={e => set('smtp_user')(e.target.value)}
                className="input w-full"
                placeholder="noreply@yourcompany.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Password / App Password</label>
              <input
                type="password"
                value={settings.smtp_pass || ''}
                onChange={e => set('smtp_pass')(e.target.value)}
                className="input w-full"
                placeholder="••••••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">From Address (optional)</label>
              <input
                type="email"
                value={settings.smtp_from || ''}
                onChange={e => set('smtp_from')(e.target.value)}
                className="input w-full"
                placeholder="Sentinel IT <noreply@yourcompany.com>"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm text-gray-300">Use TLS / SSL</p>
                <p className="text-xs text-gray-600">Enable for port 465</p>
              </div>
              <Toggle value={settings.smtp_secure || 'false'} onChange={set('smtp_secure')} />
            </div>
          </div>
        </div>

        <SpinnerButton type="submit" disabled={saving} loading={saving} className="btn-primary w-full py-3 text-sm">
          Save Settings
        </SpinnerButton>
      </form>
    </div>
  );
}
