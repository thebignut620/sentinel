import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { RoleBadge } from '../../components/Badges.jsx';
import { SkeletonTable } from '../../components/Skeleton.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import api from '../../api/client.js';

const EMPTY_FORM = { name: '', email: '', password: '', role: 'employee' };

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    const res = await api.get('/users');
    setUsers(res.data);
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null); setForm(EMPTY_FORM); setError(''); setShowModal(true);
  };

  const openEdit = (u) => {
    setEditing(u); setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setError(''); setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      if (editing) {
        const payload = { name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await api.patch(`/users/${editing.id}`, payload);
        addToast('User updated', 'success');
      } else {
        await api.post('/users', form);
        addToast('User created', 'success');
      }
      await loadUsers();
      setShowModal(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (u) => {
    if (!window.confirm(`Deactivate ${u.name}? They will no longer be able to log in.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      addToast(`${u.name} deactivated`, 'warning');
      await loadUsers();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  const handleReactivate = async (u) => {
    try {
      await api.patch(`/users/${u.id}`, { is_active: true });
      addToast(`${u.name} reactivated`, 'success');
      await loadUsers();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <button onClick={openCreate} className="btn-primary px-4 py-2 text-sm">
          + Add User
        </button>
      </div>

      {loading ? (
        <SkeletonTable rows={5} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50 border-b border-gray-800 text-left">
              <tr>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Name</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Email</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Role</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Status</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Joined</th>
                <th className="px-4 py-3 text-gray-500 font-medium text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={`border-b border-gray-800/60 last:border-0 transition-colors ${!u.is_active ? 'opacity-40' : 'hover:bg-gray-800/30'}`}>
                  <td className="px-4 py-3 font-medium text-gray-200">{u.name}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{u.email}</td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${u.is_active ? 'text-pine-400' : 'text-gray-600'}`}>
                      {u.is_active ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => openEdit(u)} className="text-pine-400 hover:text-pine-300 text-xs transition-colors">
                        Edit
                      </button>
                      {u.id !== currentUser.id && u.is_active && (
                        <button onClick={() => handleDeactivate(u)} className="text-red-500 hover:text-red-400 text-xs transition-colors">
                          Deactivate
                        </button>
                      )}
                      {!u.is_active && (
                        <button onClick={() => handleReactivate(u)} className="text-pine-500 hover:text-pine-400 text-xs transition-colors">
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-100 mb-5">
              {editing ? 'Edit User' : 'Create New User'}
            </h2>

            {error && (
              <div className="bg-red-900/40 border border-red-800/50 text-red-300 text-sm px-3 py-2 rounded-lg mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Full Name</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input w-full" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input w-full" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Password {editing && <span className="text-gray-600">(leave blank to keep)</span>}
                </label>
                <input
                  type="password" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="input w-full"
                  required={!editing} minLength={editing ? 0 : 6}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="input w-full">
                  <option value="employee">Employee</option>
                  <option value="it_staff">IT Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={submitting} className="btn-primary flex-1 py-2.5 text-sm">
                  {submitting ? 'Saving…' : editing ? 'Update User' : 'Create User'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-2.5 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
