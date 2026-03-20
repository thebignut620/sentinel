import { useState, useEffect } from 'react';
import { useToast } from '../../contexts/ToastContext.jsx';
import api from '../../api/client.js';

const ROLES = [
  { key: 'it_staff', label: 'IT Staff', color: 'text-blue-400' },
  { key: 'employee', label: 'Employee', color: 'text-gray-300' },
];

export default function Permissions() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(null);
  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    const r = await api.get('/permissions');
    setData(r.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (role, permKey, currentlyOn) => {
    if (!data) return;
    const current = data.permissions[role] || [];
    const next = currentlyOn ? current.filter(k => k !== permKey) : [...current, permKey];
    setSaving(`${role}.${permKey}`);
    try {
      await api.put(`/permissions/${role}`, { permissions: next });
      setData(d => ({
        ...d,
        permissions: { ...d.permissions, [role]: next },
      }));
    } catch (e) {
      addToast(e.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="card p-8 text-center text-gray-500">Loading…</div>;
  if (!data)   return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Role Permissions</h1>
        <p className="text-gray-400 text-sm mt-1">Control what each role can do. Admin always has full access.</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-5 py-3 text-xs text-gray-500 uppercase tracking-wide w-64">Permission</th>
              {ROLES.map(r => (
                <th key={r.key} className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide ${r.color}`}>
                  {r.label}
                </th>
              ))}
              <th className="px-5 py-3 text-xs text-pine-600 uppercase tracking-wide">Admin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {data.all.map(perm => (
              <tr key={perm.key} className="hover:bg-gray-800/30 transition-colors">
                <td className="px-5 py-3">
                  <p className="text-white font-medium">{perm.label}</p>
                  <p className="text-xs text-gray-500">{perm.description}</p>
                </td>
                {ROLES.map(role => {
                  const on = (data.permissions[role.key] || []).includes(perm.key);
                  const key = `${role.key}.${perm.key}`;
                  return (
                    <td key={role.key} className="px-5 py-3">
                      <button
                        onClick={() => toggle(role.key, perm.key, on)}
                        disabled={saving === key}
                        className={`w-10 h-6 rounded-full transition-all duration-200 relative
                          ${on ? 'bg-pine-600' : 'bg-gray-700'}
                          ${saving === key ? 'opacity-50' : ''}`}
                        title={on ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200
                          ${on ? 'left-4' : 'left-0.5'}`} />
                      </button>
                    </td>
                  );
                })}
                <td className="px-5 py-3">
                  <div className="w-10 h-6 rounded-full bg-pine-700 relative opacity-50 cursor-not-allowed">
                    <span className="absolute top-0.5 left-4 h-5 w-5 rounded-full bg-white shadow" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-600">
        Changes take effect immediately for new requests. Active sessions are not affected until users re-login.
      </p>
    </div>
  );
}
