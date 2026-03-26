import { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext.jsx';
import api from '../../api/client.js';

const TRIGGERS = [
  { value: 'ticket.created', label: 'New ticket created' },
  { value: 'ticket.updated', label: 'Ticket status changed' },
  { value: 'ticket.overdue', label: 'Ticket is overdue' },
  { value: 'ticket.resolved', label: 'Ticket resolved' },
];

const CONDITION_FIELDS = [
  { value: 'priority', label: 'Priority' },
  { value: 'category', label: 'Category' },
  { value: 'status', label: 'Status' },
  { value: 'title', label: 'Title contains' },
];

const CONDITION_OPS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
];

const ACTION_TYPES = [
  { value: 'add_note', label: 'Add internal note', placeholder: 'Note text...' },
  { value: 'change_priority', label: 'Change priority', placeholder: 'low / medium / high / critical' },
  { value: 'change_status', label: 'Change status', placeholder: 'open / in_progress / resolved' },
];

const TEMPLATES = [
  {
    name: 'Auto-escalate critical tickets',
    description: 'Adds a note when a critical ticket is created',
    trigger_type: 'ticket.created',
    condition_logic: 'AND',
    conditions: [{ field: 'priority', op: 'eq', value: 'critical' }],
    actions: [{ type: 'add_note', value: 'CRITICAL ticket — requires immediate attention per SLA policy.' }],
  },
  {
    name: 'Flag network issues',
    description: 'Adds a note to all network category tickets',
    trigger_type: 'ticket.created',
    condition_logic: 'AND',
    conditions: [{ field: 'category', op: 'eq', value: 'network' }],
    actions: [{ type: 'add_note', value: 'Network issue flagged — check infrastructure dashboard.' }],
  },
];

function RuleModal({ rule, onSave, onClose }) {
  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [trigger, setTrigger] = useState(rule?.trigger_type || 'ticket.created');
  const [logic, setLogic] = useState(rule?.condition_logic || 'AND');
  const [conditions, setConditions] = useState(rule?.conditions || []);
  const [actions, setActions] = useState(rule?.actions || [{ type: 'add_note', value: '' }]);
  const [saving, setSaving] = useState(false);

  const addCondition = () => setConditions(c => [...c, { field: 'priority', op: 'eq', value: '' }]);
  const removeCondition = i => setConditions(c => c.filter((_, idx) => idx !== i));
  const updateCondition = (i, key, val) => setConditions(c => c.map((cond, idx) => idx === i ? { ...cond, [key]: val } : cond));
  const addAction = () => setActions(a => [...a, { type: 'add_note', value: '' }]);
  const removeAction = i => setActions(a => a.filter((_, idx) => idx !== i));
  const updateAction = (i, key, val) => setActions(a => a.map((act, idx) => idx === i ? { ...act, [key]: val } : act));

  async function handleSave() {
    if (!name.trim() || !actions.length) return;
    setSaving(true);
    try {
      await onSave({ name, description, trigger_type: trigger, condition_logic: logic, conditions, actions });
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">{rule?.id ? 'Edit Rule' : 'New Automation Rule'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Rule Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-green-600" placeholder="e.g. Auto-escalate critical tickets" />
          </div>
          {/* Trigger */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">WHEN (Trigger)</label>
            <div className="grid grid-cols-2 gap-2">
              {TRIGGERS.map(t => (
                <button key={t.value} onClick={() => setTrigger(t.value)} className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${trigger === t.value ? 'border-green-600 bg-green-900/30 text-green-300' : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">IF (Conditions)</label>
              <div className="flex items-center gap-2">
                <select value={logic} onChange={e => setLogic(e.target.value)} className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1">
                  <option value="AND">All conditions (AND)</option>
                  <option value="OR">Any condition (OR)</option>
                </select>
                <button onClick={addCondition} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded-lg">+ Add</button>
              </div>
            </div>
            {conditions.length === 0 && <p className="text-gray-500 text-sm">No conditions — rule runs on every trigger</p>}
            {conditions.map((c, i) => (
              <div key={i} className="flex gap-2 items-center mb-2">
                <select value={c.field} onChange={e => updateCondition(i, 'field', e.target.value)} className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1.5 flex-1">
                  {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select value={c.op} onChange={e => updateCondition(i, 'op', e.target.value)} className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1.5 flex-1">
                  {CONDITION_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input value={c.value} onChange={e => updateCondition(i, 'value', e.target.value)} className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1.5 flex-1" placeholder="value" />
                <button onClick={() => removeCondition(i)} className="text-gray-500 hover:text-red-400 text-lg leading-none">×</button>
              </div>
            ))}
          </div>
          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">THEN (Actions)</label>
              <button onClick={addAction} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded-lg">+ Add</button>
            </div>
            {actions.map((a, i) => (
              <div key={i} className="flex gap-2 items-center mb-2">
                <select value={a.type} onChange={e => updateAction(i, 'type', e.target.value)} className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1.5 flex-1">
                  {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input value={a.value} onChange={e => updateAction(i, 'value', e.target.value)} className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1.5 flex-1" placeholder={ACTION_TYPES.find(t => t.value === a.type)?.placeholder || ''} />
                <button onClick={() => removeAction(i)} className="text-gray-500 hover:text-red-400 text-lg leading-none">×</button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="px-4 py-2 text-sm bg-green-700 hover:bg-green-600 text-white rounded-lg disabled:opacity-50">{saving ? 'Saving...' : 'Save Rule'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Automations() {
  const { addToast } = useToast();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const [viewLogs, setViewLogs] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => { fetchRules(); }, []);

  async function fetchRules() {
    try { const { data } = await api.get('/automations'); setRules(data); } catch {}
    setLoading(false);
  }

  async function handleSave(ruleData) {
    try {
      if (editRule?.id) {
        await api.patch(`/automations/${editRule.id}`, ruleData);
        addToast('Rule updated', 'success');
      } else {
        await api.post('/automations', ruleData);
        addToast('Rule created', 'success');
      }
      setEditRule(null);
      fetchRules();
    } catch {
      addToast('Failed to save rule', 'error');
      throw new Error('Save failed');
    }
  }

  async function toggleRule(rule) {
    await api.patch(`/automations/${rule.id}`, { is_enabled: rule.is_enabled ? 0 : 1 });
    fetchRules();
  }

  async function deleteRule(id) {
    if (!confirm('Delete this automation rule?')) return;
    await api.delete(`/automations/${id}`);
    addToast('Rule deleted', 'success');
    fetchRules();
  }

  async function viewRuleLogs(rule) {
    const { data } = await api.get(`/automations/${rule.id}/logs`);
    setLogs(data);
    setViewLogs(rule);
  }

  function useTemplate(t) {
    setEditRule({ ...t, id: null });
    setShowModal(true);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Automations</h1>
          <p className="text-gray-400 text-sm mt-1">IF this THEN that — automate your helpdesk workflow</p>
        </div>
        <button onClick={() => { setEditRule(null); setShowModal(true); }} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">+ New Rule</button>
      </div>

      {/* Templates */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Start Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TEMPLATES.map((t, i) => (
            <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-white font-medium text-sm">{t.name}</div>
                <div className="text-gray-400 text-xs mt-0.5">{t.description}</div>
              </div>
              <button onClick={() => useTemplate(t)} className="shrink-0 text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg">Use</button>
            </div>
          ))}
        </div>
      </div>

      {/* Rules list */}
      {loading ? <div className="text-gray-500 text-sm">Loading...</div> : rules.length === 0 ? (
        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">⚡</div>
          <h3 className="text-white font-semibold mb-1">No automation rules yet</h3>
          <p className="text-gray-400 text-sm">Create your first rule to automate helpdesk tasks</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.id} className={`bg-gray-800/50 border rounded-xl p-4 ${rule.is_enabled ? 'border-gray-700' : 'border-gray-800 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium text-sm">{rule.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${rule.is_enabled ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}`}>{rule.is_enabled ? 'Active' : 'Disabled'}</span>
                  </div>
                  <div className="text-gray-400 text-xs">
                    Trigger: <span className="text-gray-300">{TRIGGERS.find(t => t.value === rule.trigger_type)?.label || rule.trigger_type}</span>
                    {' · '}Ran <span className="text-gray-300">{rule.run_count || 0}</span> times
                    {rule.last_run_at && <> · Last: <span className="text-gray-300">{new Date(rule.last_run_at).toLocaleDateString()}</span></>}
                  </div>
                  {rule.conditions?.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">{rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''} · {rule.actions?.length || 0} action{rule.actions?.length !== 1 ? 's' : ''}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => viewRuleLogs(rule)} className="text-xs text-gray-400 hover:text-white px-2 py-1 border border-gray-700 rounded-lg">Logs</button>
                  <button onClick={() => { setEditRule(rule); setShowModal(true); }} className="text-xs text-gray-400 hover:text-white px-2 py-1 border border-gray-700 rounded-lg">Edit</button>
                  <button onClick={() => toggleRule(rule)} className={`text-xs px-2 py-1 rounded-lg border transition-colors ${rule.is_enabled ? 'border-yellow-700 text-yellow-400 hover:bg-yellow-900/20' : 'border-green-700 text-green-400 hover:bg-green-900/20'}`}>{rule.is_enabled ? 'Disable' : 'Enable'}</button>
                  <button onClick={() => deleteRule(rule.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1 border border-red-900/50 rounded-lg">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <RuleModal
          rule={editRule}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditRule(null); }}
        />
      )}

      {viewLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Logs: {viewLogs.name}</h2>
              <button onClick={() => setViewLogs(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {logs.length === 0 ? <p className="text-gray-400 text-sm">No logs yet</p> : logs.map(log => (
                <div key={log.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm">{log.ticket_title || `Ticket #${log.ticket_id}`}</span>
                    <span className="text-gray-500 text-xs">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <div className="text-gray-400 text-xs mt-1">Actions: {log.actions_taken.map(a => a.type).join(', ')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
