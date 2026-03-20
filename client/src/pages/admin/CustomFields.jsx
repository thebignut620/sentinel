import { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext.jsx';
import api from '../../api/client.js';

const CATEGORIES = ['hardware','software','network','access','account'];
const FIELD_TYPES = ['text','textarea','select','number'];

function FieldModal({ field, onSave, onClose }) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category:    field?.category    || 'hardware',
    field_name:  field?.field_name  || '',
    field_label: field?.field_label || '',
    field_type:  field?.field_type  || 'text',
    options:     field?.options ? JSON.parse(field.options).join('\n') : '',
    required:    !!field?.required,
    sort_order:  field?.sort_order  ?? 0,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.field_name.trim() || !form.field_label.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        options: form.field_type === 'select' && form.options.trim()
          ? form.options.split('\n').map(s => s.trim()).filter(Boolean)
          : null,
      };
      if (field) {
        await api.patch(`/custom-fields/${field.id}`, payload);
      } else {
        await api.post('/custom-fields', payload);
      }
      addToast('Field saved', 'success');
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
        <h2 className="text-lg font-semibold text-white">{field ? 'Edit Field' : 'New Custom Field'}</h2>
        <div className="space-y-3">
          {!field && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Category *</label>
              <select className="input w-full" value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Field Name (key) *</label>
            <input className="input w-full font-mono text-sm" value={form.field_name}
              onChange={e => set('field_name', e.target.value.toLowerCase().replace(/\s+/g,'_'))}
              placeholder="e.g. device_type" disabled={!!field} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Label *</label>
            <input className="input w-full" value={form.field_label}
              onChange={e => set('field_label', e.target.value)} placeholder="e.g. Device Type" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Field Type</label>
              <select className="input w-full" value={form.field_type} onChange={e => set('field_type', e.target.value)}>
                {FIELD_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Sort Order</label>
              <input type="number" className="input w-full" value={form.sort_order}
                onChange={e => set('sort_order', parseInt(e.target.value)||0)} />
            </div>
          </div>
          {form.field_type === 'select' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Options (one per line)</label>
              <textarea className="input w-full font-mono text-sm resize-none" rows={4}
                value={form.options} onChange={e => set('options', e.target.value)}
                placeholder={"Option 1\nOption 2\nOption 3"} />
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
            <input type="checkbox" className="accent-pine-500" checked={form.required}
              onChange={e => set('required', e.target.checked)} />
            Required field
          </label>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
          <button onClick={handleSave}
            disabled={saving || !form.field_name.trim() || !form.field_label.trim()}
            className="btn-primary px-4 py-2 text-sm">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomFields() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    const r = await api.get('/custom-fields');
    setFields(r.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (f) => {
    if (!confirm(`Delete field "${f.field_label}"?`)) return;
    await api.delete(`/custom-fields/${f.id}`);
    addToast('Field deleted', 'success');
    load();
  };

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = fields.filter(f => f.category === cat);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Custom Ticket Fields</h1>
          <p className="text-gray-400 text-sm mt-1">Add per-category fields that appear when submitting tickets</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary px-4 py-2 text-sm">+ New Field</button>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-4">
          {CATEGORIES.map(cat => (
            <div key={cat} className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <h3 className="font-semibold text-white capitalize">{cat}</h3>
                <span className="text-xs text-gray-500">{grouped[cat].length} field{grouped[cat].length !== 1 ? 's' : ''}</span>
              </div>
              {grouped[cat].length === 0 ? (
                <p className="px-4 py-4 text-sm text-gray-600">No custom fields for this category</p>
              ) : (
                <div className="divide-y divide-gray-800">
                  {grouped[cat].map(f => (
                    <div key={f.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm">{f.field_label}</span>
                          {f.required ? <span className="text-xs text-red-400">required</span> : null}
                          <span className="text-xs text-gray-500 font-mono bg-gray-800 px-1.5 py-0.5 rounded">{f.field_type}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 font-mono">{f.field_name}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setModal(f)} className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700">Edit</button>
                        <button onClick={() => handleDelete(f)} className="text-gray-400 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-red-950/40">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(modal === 'new' || (modal && typeof modal === 'object')) && (
        <FieldModal
          field={modal === 'new' ? null : modal}
          onSave={() => { setModal(null); load(); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
