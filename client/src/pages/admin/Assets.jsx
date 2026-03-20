import { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext.jsx';
import api from '../../api/client.js';

const ASSET_TYPES = ['laptop','desktop','monitor','phone','printer','tablet','server','other'];
const ASSET_STATUSES = ['active','retired','in_repair','storage'];

const STATUS_COLORS = {
  active: 'text-pine-400 bg-pine-900/40',
  retired: 'text-gray-400 bg-gray-800',
  in_repair: 'text-amber-400 bg-amber-900/30',
  storage: 'text-blue-400 bg-blue-900/30',
};
const TYPE_ICONS = {
  laptop: '💻', desktop: '🖥', monitor: '🖥', phone: '📱',
  printer: '🖨', tablet: '📱', server: '🗄', other: '📦',
};

function AssetModal({ asset, users, onSave, onClose }) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: asset?.name || '',
    asset_type: asset?.asset_type || 'laptop',
    serial_number: asset?.serial_number || '',
    manufacturer: asset?.manufacturer || '',
    model: asset?.model || '',
    purchase_date: asset?.purchase_date?.slice(0,10) || '',
    warranty_expiry: asset?.warranty_expiry?.slice(0,10) || '',
    assigned_user_id: asset?.assigned_user_id || '',
    status: asset?.status || 'active',
    notes: asset?.notes || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.asset_type) return;
    setSaving(true);
    try {
      const payload = { ...form, assigned_user_id: form.assigned_user_id || null };
      if (asset) {
        await api.patch(`/assets/${asset.id}`, payload);
      } else {
        await api.post('/assets', payload);
      }
      addToast(asset ? 'Asset updated' : 'Asset created', 'success');
      onSave();
    } catch (e) {
      addToast(e.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="card w-full max-w-xl p-6 space-y-4 my-8">
        <h2 className="text-lg font-semibold text-white">{asset ? 'Edit Asset' : 'New Asset'}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1">Name *</label>
            <input className="input w-full" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. MacBook Pro #12" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Type *</label>
            <select className="input w-full" value={form.asset_type} onChange={e => set('asset_type', e.target.value)}>
              {ASSET_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <select className="input w-full" value={form.status} onChange={e => set('status', e.target.value)}>
              {ASSET_STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Manufacturer</label>
            <input className="input w-full" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} placeholder="Apple, Dell…" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Model</label>
            <input className="input w-full" value={form.model} onChange={e => set('model', e.target.value)} placeholder="MacBook Pro 14" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Serial Number</label>
            <input className="input w-full" value={form.serial_number} onChange={e => set('serial_number', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Assigned to</label>
            <select className="input w-full" value={form.assigned_user_id} onChange={e => set('assigned_user_id', e.target.value)}>
              <option value="">— Unassigned —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Purchase Date</label>
            <input type="date" className="input w-full" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Warranty Expiry</label>
            <input type="date" className="input w-full" value={form.warranty_expiry} onChange={e => set('warranty_expiry', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-400 mb-1">Notes</label>
            <textarea className="input w-full resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn-primary px-4 py-2 text-sm">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MaintenanceModal({ assetId, onClose, onSave }) {
  const { addToast } = useToast();
  const [desc, setDesc]   = useState('');
  const [cost, setCost]   = useState('');
  const [date, setDate]   = useState(new Date().toISOString().slice(0,10));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!desc.trim()) return;
    setSaving(true);
    try {
      await api.post(`/assets/${assetId}/maintenance`, { description: desc, cost: cost || null, performed_at: date });
      addToast('Maintenance log added', 'success');
      onSave();
    } catch {
      addToast('Failed to add log', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Log Maintenance</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description *</label>
            <textarea className="input w-full resize-none" rows={3} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What was done?" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Cost ($)</label>
              <input type="number" className="input w-full" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" step="0.01" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Date</label>
              <input type="date" className="input w-full" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving || !desc.trim()} className="btn-primary px-4 py-2 text-sm">
            {saving ? 'Saving…' : 'Add Log'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssetDetail({ assetId, onClose, onRefresh }) {
  const [data, setData]     = useState(null);
  const [showMaint, setShowMaint] = useState(false);
  const { addToast } = useToast();

  const load = async () => {
    const r = await api.get(`/assets/${assetId}`);
    setData(r.data);
  };

  useEffect(() => { load(); }, [assetId]);

  if (!data) return null;

  const warrantyDate = data.warranty_expiry ? new Date(data.warranty_expiry) : null;
  const warrantyExpired = warrantyDate && warrantyDate < new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="card w-full max-w-2xl p-6 my-8 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{TYPE_ICONS[data.asset_type] || '📦'}</span>
              <h2 className="text-xl font-bold text-white">{data.name}</h2>
            </div>
            <p className="text-sm text-gray-400 mt-1">{data.manufacturer} {data.model}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Type', data.asset_type],
            ['Status', <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[data.status]}`}>{data.status.replace('_',' ')}</span>],
            ['Serial', data.serial_number || '—'],
            ['Assigned to', data.assigned_user_name || '—'],
            ['Purchase Date', data.purchase_date?.slice(0,10) || '—'],
            ['Warranty', warrantyDate
              ? <span className={warrantyExpired ? 'text-red-400' : 'text-pine-400'}>{warrantyDate.toLocaleDateString()} {warrantyExpired ? '(Expired)' : '(Active)'}</span>
              : '—'],
          ].map(([label, val]) => (
            <div key={label} className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">{label}</p>
              <p className="text-white font-medium">{val}</p>
            </div>
          ))}
        </div>

        {data.notes && (
          <div className="bg-gray-800/40 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Notes</p>
            <p className="text-sm text-gray-300">{data.notes}</p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white text-sm">Maintenance History</h3>
            <button onClick={() => setShowMaint(true)} className="text-xs btn-ghost px-3 py-1">+ Log</button>
          </div>
          {data.maintenance.length === 0 ? (
            <p className="text-sm text-gray-500">No maintenance records</p>
          ) : (
            <div className="space-y-2">
              {data.maintenance.map(m => (
                <div key={m.id} className="bg-gray-800/50 rounded-lg p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-gray-200">{m.description}</p>
                    {m.cost && <span className="text-pine-400 shrink-0 font-medium">${m.cost}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{new Date(m.performed_at).toLocaleDateString()} · {m.performed_by_name || 'Unknown'}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {data.tickets.length > 0 && (
          <div>
            <h3 className="font-semibold text-white text-sm mb-2">Linked Tickets</h3>
            <div className="space-y-1">
              {data.tickets.map(t => (
                <div key={t.id} className="flex items-center justify-between text-sm bg-gray-800/40 rounded px-3 py-2">
                  <span className="text-gray-300">#{t.id} — {t.title}</span>
                  <span className="text-xs text-gray-500 capitalize">{t.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {showMaint && (
        <MaintenanceModal
          assetId={assetId}
          onClose={() => setShowMaint(false)}
          onSave={() => { setShowMaint(false); load(); onRefresh(); }}
        />
      )}
    </div>
  );
}

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(null);
  const [detail, setDetail] = useState(null);
  const [filterType, setFilterType]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterType)   params.set('type', filterType);
    if (filterStatus) params.set('status', filterStatus);
    const [ar, ur] = await Promise.all([
      api.get(`/assets?${params}`),
      api.get('/users'),
    ]);
    setAssets(ar.data);
    setUsers(ur.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterType, filterStatus]);

  const handleDelete = async (id) => {
    if (!confirm('Delete this asset? This cannot be undone.')) return;
    await api.delete(`/assets/${id}`);
    addToast('Asset deleted', 'success');
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Asset Management</h1>
          <p className="text-gray-400 text-sm mt-1">Track company devices and their maintenance history</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary px-4 py-2 text-sm">+ New Asset</button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select className="input text-sm" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {ASSET_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
        </select>
        <select className="input text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {ASSET_STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-500">Loading…</div>
      ) : assets.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          <p className="text-4xl mb-3">💻</p>
          <p className="font-medium">No assets found</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Assigned to</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Warranty</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {assets.map(a => {
                const warExp = a.warranty_expiry ? new Date(a.warranty_expiry) < new Date() : false;
                return (
                  <tr key={a.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => setDetail(a.id)} className="text-left">
                        <p className="text-white font-medium hover:text-pine-300 transition-colors">{TYPE_ICONS[a.asset_type]} {a.name}</p>
                        {a.serial_number && <p className="text-xs text-gray-500">{a.serial_number}</p>}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-400 capitalize">{a.asset_type}</td>
                    <td className="px-4 py-3 text-gray-300">{a.assigned_user_name || <span className="text-gray-600">Unassigned</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[a.status]}`}>
                        {a.status.replace('_',' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {a.warranty_expiry
                        ? <span className={warExp ? 'text-red-400' : 'text-gray-400'}>{a.warranty_expiry.slice(0,10)} {warExp ? '⚠' : ''}</span>
                        : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setModal(a)} className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700 mr-1">Edit</button>
                      <button onClick={() => handleDelete(a.id)} className="text-gray-400 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-red-950/40">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(modal === 'new' || (modal && typeof modal === 'object')) && (
        <AssetModal
          asset={modal === 'new' ? null : modal}
          users={users}
          onSave={() => { setModal(null); load(); }}
          onClose={() => setModal(null)}
        />
      )}
      {detail && <AssetDetail assetId={detail} onClose={() => setDetail(null)} onRefresh={load} />}
    </div>
  );
}
