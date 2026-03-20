import { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext.jsx';
import api from '../../api/client.js';

function WindowModal({ win, onSave, onClose }) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const toInput = iso => iso ? iso.slice(0,16) : '';
  const fromInput = str => str ? new Date(str).toISOString() : '';

  const [form, setForm] = useState({
    title: win?.title || '',
    description: win?.description || '',
    starts_at: toInput(win?.starts_at),
    ends_at: toInput(win?.ends_at),
    notify_users: win?.notify_users !== 0,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.starts_at || !form.ends_at) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        starts_at: fromInput(form.starts_at),
        ends_at: fromInput(form.ends_at),
      };
      if (win) {
        await api.patch(`/maintenance/${win.id}`, payload);
      } else {
        await api.post('/maintenance', payload);
      }
      addToast(win ? 'Window updated' : 'Maintenance window scheduled', 'success');
      onSave();
    } catch (e) {
      addToast(e.response?.data?.error || 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">{win ? 'Edit Window' : 'Schedule Maintenance'}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Title *</label>
            <input className="input w-full" value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="e.g. Server maintenance" autoFocus />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <textarea className="input w-full resize-none" rows={2} value={form.description}
              onChange={e => set('description', e.target.value)} placeholder="What will be affected?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Starts *</label>
              <input type="datetime-local" className="input w-full" value={form.starts_at}
                onChange={e => set('starts_at', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Ends *</label>
              <input type="datetime-local" className="input w-full" value={form.ends_at}
                onChange={e => set('ends_at', e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
            <input type="checkbox" className="accent-pine-500" checked={form.notify_users}
              onChange={e => set('notify_users', e.target.checked)} />
            Email all users 30 min before window starts
          </label>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.title.trim() || !form.starts_at || !form.ends_at}
            className="btn-primary px-4 py-2 text-sm">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function WindowStatus({ win }) {
  const now = Date.now();
  const start = new Date(win.starts_at).getTime();
  const end   = new Date(win.ends_at).getTime();
  if (now >= start && now <= end) return <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-900/40 text-amber-400">Active Now</span>;
  if (now < start)  return <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-900/30 text-blue-400">Upcoming</span>;
  return <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-500">Past</span>;
}

export default function Maintenance() {
  const [windows, setWindows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    const r = await api.get('/maintenance');
    setWindows(r.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (win) => {
    if (!confirm(`Delete "${win.title}"?`)) return;
    await api.delete(`/maintenance/${win.id}`);
    addToast('Window deleted', 'success');
    load();
  };

  const fmt = iso => new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Maintenance Windows</h1>
          <p className="text-gray-400 text-sm mt-1">Schedule downtime and notify users automatically</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary px-4 py-2 text-sm">+ Schedule Window</button>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-500">Loading…</div>
      ) : windows.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          <p className="text-4xl mb-3">🔧</p>
          <p className="font-medium">No maintenance windows</p>
        </div>
      ) : (
        <div className="space-y-3">
          {windows.map(w => (
            <div key={w.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-white">{w.title}</p>
                    <WindowStatus win={w} />
                    {w.notified_at && <span className="text-xs text-pine-500">✓ Notified</span>}
                  </div>
                  {w.description && <p className="text-sm text-gray-400 mb-2">{w.description}</p>}
                  <p className="text-xs text-gray-500">{fmt(w.starts_at)} → {fmt(w.ends_at)}</p>
                  {w.created_by_name && <p className="text-xs text-gray-600 mt-0.5">Created by {w.created_by_name}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setModal(w)} className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700">Edit</button>
                  <button onClick={() => handleDelete(w)} className="text-gray-400 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-red-950/40">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(modal === 'new' || (modal && typeof modal === 'object')) && (
        <WindowModal
          win={modal === 'new' ? null : modal}
          onSave={() => { setModal(null); load(); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
