import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';

const CATEGORIES = ['hardware', 'software', 'network', 'access', 'account', 'general'];

export default function Templates() {
  const { token } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // template object being edited
  const [form, setForm] = useState({ name: '', category: '', body: '' });
  const [saving, setSaving] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/ticket-templates', { headers });
      setTemplates(await r.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm({ name: '', category: '', body: '' });
    setShowForm(true);
  }

  function openEdit(t) {
    setEditing(t);
    setForm({ name: t.name, category: t.category || '', body: t.body });
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await fetch(`/api/ticket-templates/${editing.id}`, {
          method: 'PUT', headers, body: JSON.stringify(form),
        });
      } else {
        await fetch('/api/ticket-templates', {
          method: 'POST', headers, body: JSON.stringify(form),
        });
      }
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this template?')) return;
    await fetch(`/api/ticket-templates/${id}`, { method: 'DELETE', headers });
    load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reply Templates</h1>
          <p className="text-gray-400 text-sm mt-1">Reusable responses for common tickets. ATLAS suggests the best match.</p>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
        >
          + New Template
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
          <h2 className="text-white font-semibold">{editing ? 'Edit Template' : 'New Template'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-gray-400 text-sm">Template Name *</label>
              <input
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                placeholder="e.g. Password Reset Steps"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-gray-400 text-sm">Category</label>
              <select
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                <option value="">All categories</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-gray-400 text-sm">Response Body *</label>
            <textarea
              rows={6}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500 resize-none font-mono"
              placeholder="Write the full reply template here. Use [Name] or [Ticket #] as placeholders if needed."
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={saving || !form.name.trim() || !form.body.trim()}
              className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Template')}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      {loading ? (
        <div className="text-gray-500 text-center py-12">Loading…</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">No templates yet.</p>
          <p className="text-sm mt-1">Create your first template to speed up ticket responses.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-medium">{t.name}</h3>
                    {t.category && (
                      <span className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded text-xs capitalize">
                        {t.category}
                      </span>
                    )}
                    {t.usage_count > 0 && (
                      <span className="px-2 py-0.5 bg-green-900/40 text-green-400 rounded text-xs">
                        used {t.usage_count}×
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm line-clamp-2 font-mono">{t.body}</p>
                  {t.created_by_name && (
                    <p className="text-gray-600 text-xs mt-1">by {t.created_by_name}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => openEdit(t)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(t.id)}
                    className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-xs transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
