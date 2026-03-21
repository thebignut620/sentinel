import { useState, useEffect } from 'react';
import api from '../api/client.js';

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  const ampm = i < 12 ? 'AM' : 'PM';
  return { value: i, label: `${h}:00 ${ampm}` };
});

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-700/50 last:border-0">
      <div>
        <p className="text-white text-sm font-medium">{label}</p>
        {description && <p className="text-gray-500 text-xs mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative ${
          checked ? 'bg-green-600' : 'bg-gray-600'
        }`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`} />
      </button>
    </div>
  );
}

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/notifications/preferences')
      .then(r => {
        const data = r.data;
        setPrefs({
          ticket_assigned: !!data.ticket_assigned,
          ticket_updated: !!data.ticket_updated,
          ticket_resolved: !!data.ticket_resolved,
          new_comment: !!data.new_comment,
          incident_alert: !!data.incident_alert,
          weekly_briefing: !!data.weekly_briefing,
          digest_enabled: !!data.digest_enabled,
          digest_hour: data.digest_hour ?? 8,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set(key, value) {
    setPrefs(p => ({ ...p, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await api.put('/notifications/preferences', prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-500 text-center">Loading…</div>;
  if (!prefs) return null;

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Notification Preferences</h1>
        <p className="text-gray-400 text-sm mt-1">Control which notifications you receive and how.</p>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <h2 className="text-gray-300 font-semibold text-sm mb-2">In-App Notifications</h2>
        <Toggle label="Ticket assigned to me" checked={prefs.ticket_assigned} onChange={v => set('ticket_assigned', v)} />
        <Toggle label="Ticket updated" description="Status or priority changes" checked={prefs.ticket_updated} onChange={v => set('ticket_updated', v)} />
        <Toggle label="Ticket resolved" checked={prefs.ticket_resolved} onChange={v => set('ticket_resolved', v)} />
        <Toggle label="New comment" description="On tickets you're involved in" checked={prefs.new_comment} onChange={v => set('new_comment', v)} />
        <Toggle label="Incident alerts" description="System-wide spikes detected by ATLAS" checked={prefs.incident_alert} onChange={v => set('incident_alert', v)} />
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <h2 className="text-gray-300 font-semibold text-sm mb-2">Email Notifications</h2>
        <Toggle label="Weekly ATLAS briefing" description="Summary + prevention tips every Monday" checked={prefs.weekly_briefing} onChange={v => set('weekly_briefing', v)} />
        <Toggle
          label="Daily digest"
          description="Batch low-priority notifications into one daily email"
          checked={prefs.digest_enabled}
          onChange={v => set('digest_enabled', v)}
        />
        {prefs.digest_enabled && (
          <div className="mt-3 pl-0 space-y-1">
            <label className="text-gray-400 text-sm">Digest delivery time (UTC)</label>
            <select
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              value={prefs.digest_hour}
              onChange={e => set('digest_hour', parseInt(e.target.value))}
            >
              {HOURS.map(h => (
                <option key={h.value} value={h.value}>{h.label} UTC</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 bg-green-700 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
      >
        {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Preferences'}
      </button>
    </div>
  );
}
