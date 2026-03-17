import { useState, useEffect } from 'react';
import api from '../../api/client.js';

export default function AdminSettings() {
  const [settings, setSettings] = useState({ ai_enabled: 'true', company_name: 'Sentinel IT' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/settings').then(r => setSettings(r.data)).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await api.patch('/settings', settings);
      setSettings(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;

  return (
    <div className="max-w-lg space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>

      <div className="bg-white rounded-xl border p-6">
        {saved && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg mb-5">
            ✓ Settings saved successfully
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-5">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company / System Name</label>
            <input
              type="text"
              value={settings.company_name || ''}
              onChange={e => setSettings(s => ({ ...s, company_name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pine-700"
              placeholder="e.g. Acme Corp IT"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">AI Help Desk</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSettings(s => ({ ...s, ai_enabled: s.ai_enabled === 'true' ? 'false' : 'true' }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  settings.ai_enabled === 'true' ? 'bg-pine-900' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  settings.ai_enabled === 'true' ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
              <span className="text-sm text-gray-700">
                {settings.ai_enabled === 'true' ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              When enabled, employees receive AI-powered troubleshooting steps before a ticket is created.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-pine-900 hover:bg-pine-800 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}
