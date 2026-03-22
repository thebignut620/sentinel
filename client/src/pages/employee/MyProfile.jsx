import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import SpinnerButton from '../../components/SpinnerButton.jsx';
import { isSoundEnabled, toggleSound } from '../../hooks/useSound.js';
import api from '../../api/client.js';

const DEVICE_OPTIONS = ['Windows PC', 'Mac', 'Linux PC', 'Windows Laptop', 'MacBook', 'Chromebook'];
const DEPT_OPTIONS = ['Engineering', 'Sales', 'Marketing', 'Finance', 'HR', 'Legal', 'Operations', 'Customer Support', 'Design', 'Other'];

function Chip({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 active:scale-95
        ${selected
          ? 'bg-pine-800/70 border-pine-600/60 text-pine-200'
          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
        }`}
    >
      {label}
    </button>
  );
}

export default function MyProfile() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled);
  const [form, setForm] = useState({
    department: '',
    device_type: '',
    primary_software: '',
    tenure_months: '',
    notes: '',
  });

  useEffect(() => {
    api.get(`/employee-profiles/${user.id}`)
      .then(r => {
        if (r.data) {
          setForm({
            department: r.data.department || '',
            device_type: r.data.device_type || '',
            primary_software: r.data.primary_software || '',
            tenure_months: r.data.tenure_months ?? '',
            notes: r.data.notes || '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/employee-profiles/${user.id}`, {
        ...form,
        tenure_months: form.tenure_months ? parseInt(form.tenure_months) : null,
      });
      setSaveSuccess(true);
      addToast('Profile saved. ATLAS will use this context.', 'success');
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      addToast('Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6 animate-fadeIn">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold text-white">My Profile</h1>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-pine-900/60 text-pine-300 border border-pine-800/50 font-medium uppercase tracking-wider">
            ATLAS context
          </span>
        </div>
        <p className="text-sm text-gray-500">ATLAS uses this to give you more relevant help when you submit a ticket.</p>
      </div>

      <div className="card p-6 space-y-4">
        <h3 className="text-base font-semibold text-gray-200">Your setup</h3>

        <div>
          <p className="text-sm font-medium text-gray-400 mb-2">Department</p>
          <div className="flex flex-wrap gap-2">
            {DEPT_OPTIONS.map(d => (
              <Chip key={d} label={d} selected={form.department === d}
                onClick={() => setForm(f => ({ ...f, department: f.department === d ? '' : d }))} />
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-400 mb-2">Primary device</p>
          <div className="flex flex-wrap gap-2">
            {DEVICE_OPTIONS.map(d => (
              <Chip key={d} label={d} selected={form.device_type === d}
                onClick={() => setForm(f => ({ ...f, device_type: f.device_type === d ? '' : d }))} />
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-400 mb-2">Software you use most <span className="text-gray-600 font-normal">(optional)</span></p>
          <input
            className="input w-full"
            value={form.primary_software}
            onChange={e => setForm(f => ({ ...f, primary_software: e.target.value }))}
            placeholder="e.g. Outlook, Salesforce, Adobe CC…"
          />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-400 mb-2">Time at company <span className="text-gray-600 font-normal">(months, optional)</span></p>
          <input
            className="input w-32"
            type="number"
            min="0"
            max="600"
            value={form.tenure_months}
            onChange={e => setForm(f => ({ ...f, tenure_months: e.target.value }))}
            placeholder="e.g. 18"
          />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-400 mb-2">Anything ATLAS should know <span className="text-gray-600 font-normal">(optional)</span></p>
          <textarea
            className="input w-full resize-none"
            rows={2}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="e.g. I'm on the remote team so VPN is always relevant…"
            maxLength={300}
          />
        </div>
      </div>

      {/* Sound preferences */}
      <div className="card p-6">
        <h3 className="text-base font-semibold text-gray-200 mb-4">Preferences</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-300">Sound effects</p>
            <p className="text-xs text-gray-600 mt-0.5">Subtle sounds on ticket updates and milestones</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={soundOn}
            onClick={() => { const next = toggleSound(); setSoundOn(next); }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-pine-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${soundOn ? 'bg-pine-600' : 'bg-gray-700'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${soundOn ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>
      </div>

      <div className="pb-4">
        <SpinnerButton
          onClick={handleSave}
          loading={saving}
          success={saveSuccess}
          className="btn-primary px-6 py-2.5 text-sm"
        >
          Save profile
        </SpinnerButton>
      </div>
    </div>
  );
}
