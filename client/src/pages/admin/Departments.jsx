import { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext.jsx';
import api from '../../api/client.js';

function DeptModal({ dept, onSave, onClose }) {
  const [name, setName]   = useState(dept?.name || '');
  const [desc, setDesc]   = useState(dept?.description || '');
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (dept) {
        await api.patch(`/departments/${dept.id}`, { name: name.trim(), description: desc });
      } else {
        await api.post('/departments', { name: name.trim(), description: desc });
      }
      addToast(dept ? 'Department updated' : 'Department created', 'success');
      onSave();
    } catch (e) {
      addToast(e.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">{dept ? 'Edit Department' : 'New Department'}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name *</label>
            <input className="input w-full" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. IT, HR, Finance" autoFocus />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea className="input w-full resize-none" rows={3} value={desc}
              onChange={e => setDesc(e.target.value)} placeholder="Optional description" />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary px-4 py-2 text-sm">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Departments() {
  const [depts, setDepts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(null); // null | 'new' | dept object
  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    const r = await api.get('/departments');
    setDepts(r.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (dept) => {
    if (!confirm(`Delete "${dept.name}"? Users and tickets in this department will be unassigned.`)) return;
    await api.delete(`/departments/${dept.id}`);
    addToast('Department deleted', 'success');
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Departments</h1>
          <p className="text-gray-400 text-sm mt-1">Organise users and tickets into departments</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary px-4 py-2 text-sm">
          + New Department
        </button>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-500">Loading…</div>
      ) : depts.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          <p className="text-4xl mb-3">🏢</p>
          <p className="font-medium">No departments yet</p>
          <p className="text-sm mt-1">Create your first department to organise your team</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {depts.map(d => (
            <div key={d.id} className="card p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-white truncate">{d.name}</p>
                {d.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{d.description}</p>}
                <p className="text-xs text-pine-400 mt-1">{d.member_count ?? 0} member{d.member_count !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setModal(d)}
                  className="text-gray-400 hover:text-white px-2 py-1 text-xs rounded hover:bg-gray-700 transition-colors">
                  Edit
                </button>
                <button onClick={() => handleDelete(d)}
                  className="text-gray-400 hover:text-red-400 px-2 py-1 text-xs rounded hover:bg-red-950/40 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(modal === 'new' || (modal && typeof modal === 'object')) && (
        <DeptModal
          dept={modal === 'new' ? null : modal}
          onSave={() => { setModal(null); load(); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
