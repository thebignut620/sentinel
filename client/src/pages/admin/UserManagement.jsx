import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { RoleBadge } from '../../components/Badges.jsx';
import api from '../../api/client.js';

const EMPTY_FORM = { name: '', email: '', password: '', role: 'employee' };

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // user object or null for create
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
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (editing) {
        const payload = { name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await api.patch(`/users/${editing.id}`, payload);
      } else {
        await api.post('/users', form);
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
      await loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  };

  const handleReactivate = async (u) => {
    try {
      await api.patch(`/users/${u.id}`, { is_active: true });
      await loadUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <button
          onClick={openCreate}
          className="bg-blue-900 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Add User
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-left">
            <tr>
              <th className="px-4 py-3 text-gray-500 font-medium">Name</th>
              <th className="px-4 py-3 text-gray-500 font-medium">Email</th>
              <th className="px-4 py-3 text-gray-500 font-medium">Role</th>
              <th className="px-4 py-3 text-gray-500 font-medium">Status</th>
              <th className="px-4 py-3 text-gray-500 font-medium">Joined</th>
              <th className="px-4 py-3 text-gray-500 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={`border-b last:border-0 ${!u.is_active ? 'opacity-50' : 'hover:bg-gray-50'}`}>
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${u.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button onClick={() => openEdit(u)} className="text-blue-600 hover:underline text-xs">
                      Edit
                    </button>
                    {u.id !== currentUser.id && u.is_active && (
                      <button onClick={() => handleDeactivate(u)} className="text-red-500 hover:underline text-xs">
                        Deactivate
                      </button>
                    )}
                    {!u.is_active && (
                      <button onClick={() => handleReactivate(u)} className="text-green-600 hover:underline text-xs">
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">
              {editing ? 'Edit User' : 'Create New User'}
            </h2>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editing && <span className="text-gray-400">(leave blank to keep)</span>}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={!editing}
                  minLength={editing ? 0 : 6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="employee">Employee</option>
                  <option value="it_staff">IT Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium"
                >
                  {submitting ? 'Saving…' : (editing ? 'Update User' : 'Create User')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg text-sm"
                >
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
