import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import SpinnerButton from '../../components/SpinnerButton.jsx';
import api from '../../api/client.js';

const EMPTY_FORM = { name: '', email: '', password: '', role: 'employee' };

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function Avatar({ name, size = 8 }) {
  const bg = { admin: 'bg-amber-900/70 border-amber-700/60 text-amber-300', it_staff: 'bg-pine-900/70 border-pine-700/60 text-pine-300', employee: 'bg-gray-800 border-gray-700 text-gray-400' };
  return null; // we'll compute role-based in UserRow
}

// Role badge with gold/pine/grey
function RoleBadge({ role }) {
  const styles = {
    admin:    'bg-amber-900/60 text-amber-300 border-amber-700/50',
    it_staff: 'bg-pine-900/60 text-pine-300 border-pine-700/50',
    employee: 'bg-gray-800 text-gray-400 border-gray-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${styles[role] || styles.employee}`}>
      {role?.replace('_', ' ')}
    </span>
  );
}

// Sort icon
function SortIcon({ col, sortState }) {
  if (sortState.col !== col) return <span className="text-gray-700 ml-1">⇅</span>;
  return <span className="text-pine-400 ml-1">{sortState.dir === 'asc' ? '↑' : '↓'}</span>;
}

// Custom confirm modal
function ConfirmModal({ message, onConfirm, onCancel, danger = true }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="card w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className={`text-2xl ${danger ? 'text-red-400' : 'text-amber-400'}`}>{danger ? '⚠' : '?'}</span>
          <h3 className="text-base font-semibold text-white">Confirm Action</h3>
        </div>
        <p className="text-sm text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95 ${danger ? 'bg-red-800/60 hover:bg-red-700/60 border border-red-700/50 text-red-300' : 'btn-primary'}`}>
            Confirm
          </button>
          <button onClick={onCancel} className="btn-secondary flex-1 py-2.5 text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── User row ──────────────────────────────────────────────────────────────────
function UserRow({ u, isEven, currentUserId, onEdit, onDeactivate, onReactivate }) {
  const avatarStyle = {
    admin:    'bg-amber-900/60 border-amber-700/50 text-amber-300',
    it_staff: 'bg-pine-900/60 border-pine-700/50 text-pine-300',
    employee: 'bg-gray-800 border-gray-700 text-gray-400',
  }[u.role] || 'bg-gray-800 border-gray-700 text-gray-400';

  return (
    <tr className={`border-b border-gray-800/60 last:border-0 transition-colors hover:bg-gray-800/40 ${isEven ? 'bg-gray-900/30' : ''} ${!u.is_active ? 'opacity-50' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className={`h-7 w-7 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${avatarStyle}`}>
            {initials(u.name)}
          </div>
          <span className="text-sm font-medium text-gray-200">{u.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-gray-400 text-xs">{u.email}</td>
      <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
      <td className="px-4 py-3">
        <span className={`text-xs font-medium flex items-center gap-1 ${u.is_active ? 'text-pine-400' : 'text-gray-600'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? 'bg-pine-400' : 'bg-gray-600'}`} />
          {u.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-600 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
      <td className="px-4 py-3">
        <div className="flex gap-3">
          <button onClick={() => onEdit(u)} className="text-xs text-pine-400 hover:text-pine-300 transition-colors">
            Edit
          </button>
          {u.id !== currentUserId && u.is_active && (
            <button onClick={() => onDeactivate(u)} className="text-xs text-red-500 hover:text-red-400 transition-colors">
              Deactivate
            </button>
          )}
          {!u.is_active && (
            <button onClick={() => onReactivate(u)} className="text-xs text-pine-500 hover:text-pine-400 transition-colors">
              Reactivate
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sort, setSort]           = useState({ col: 'name', dir: 'asc' });
  const [confirm, setConfirm]     = useState(null); // { message, onConfirm }

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    const res = await api.get('/users');
    setUsers(res.data);
    setLoading(false);
  };

  const cycleSort = (col) => {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  };

  const filtered = useMemo(() => {
    let list = [...users];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (roleFilter !== 'all') list = list.filter(u => u.role === roleFilter);
    list.sort((a, b) => {
      const av = sort.col === 'joined' ? a.created_at : String(a[sort.col] ?? '');
      const bv = sort.col === 'joined' ? b.created_at : String(b[sort.col] ?? '');
      return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [users, search, roleFilter, sort]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormError(''); setShowModal(true); };
  const openEdit = (u) => { setEditing(u); setForm({ name: u.name, email: u.email, password: '', role: u.role }); setFormError(''); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setFormError('');
    try {
      if (editing) {
        const p = { name: form.name, email: form.email, role: form.role };
        if (form.password) p.password = form.password;
        await api.patch(`/users/${editing.id}`, p);
        addToast('User updated', 'success');
      } else {
        await api.post('/users', form);
        addToast('User created', 'success');
      }
      await loadUsers();
      setShowModal(false);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = (u) => {
    setConfirm({
      message: `Deactivate ${u.name}? They will no longer be able to log in.`,
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try { await api.delete(`/users/${u.id}`); addToast(`${u.name} deactivated`, 'warning'); await loadUsers(); }
        catch (err) { addToast(err.response?.data?.error || 'Failed', 'error'); }
      },
    });
  };

  const handleReactivate = async (u) => {
    try { await api.patch(`/users/${u.id}`, { is_active: true }); addToast(`${u.name} reactivated`, 'success'); await loadUsers(); }
    catch (err) { addToast(err.response?.data?.error || 'Failed', 'error'); }
  };

  const exportCSV = () => {
    const rows = [
      ['Name', 'Email', 'Role', 'Status', 'Joined'],
      ...users.map(u => [u.name, u.email, u.role, u.is_active ? 'Active' : 'Inactive', new Date(u.created_at).toLocaleDateString()]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'sentinel-users.csv' });
    a.click();
    URL.revokeObjectURL(url);
    addToast('CSV exported', 'success');
  };

  const SORT_COLS = [
    { key: 'name',      label: 'Name' },
    { key: 'email',     label: 'Email' },
    { key: 'role',      label: 'Role' },
    { key: 'is_active', label: 'Status' },
    { key: 'joined',    label: 'Joined' },
  ];

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary px-4 py-2 text-sm flex items-center gap-1.5">
            ↓ Export CSV
          </button>
          <button onClick={openCreate} className="btn-primary px-4 py-2 text-sm">
            + Add User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap gap-3 items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email…" className="flex-1 min-w-48" />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input">
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="it_staff">IT Staff</option>
          <option value="employee">Employee</option>
        </select>
        <span className="text-xs text-gray-600">{filtered.length} of {users.length} users</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card py-12 text-center text-gray-600">Loading…</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/60 border-b border-gray-800">
              <tr>
                {SORT_COLS.map(col => (
                  <th key={col.key} onClick={() => cycleSort(col.key)}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-400 hover:text-gray-200 cursor-pointer select-none transition-colors">
                    {col.label}<SortIcon col={col.key} sortState={sort} />
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-600 text-sm">No users match.</td></tr>
              ) : (
                filtered.map((u, i) => (
                  <UserRow key={u.id} u={u} isEven={i % 2 === 1} currentUserId={currentUser.id}
                    onEdit={openEdit} onDeactivate={handleDeactivate} onReactivate={handleReactivate} />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-white mb-5">{editing ? 'Edit User' : 'Create New User'}</h2>
            {formError && (
              <div className="bg-red-900/40 border border-red-800/50 text-red-300 text-sm px-3 py-2 rounded-lg mb-4">{formError}</div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { label: 'Full Name', key: 'name', type: 'text', required: true },
                { label: 'Email', key: 'email', type: 'email', required: true },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">{f.label}</label>
                  <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="input w-full" required={f.required} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Password {editing && <span className="text-gray-600">(blank = keep current)</span>}
                </label>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="input w-full" required={!editing} minLength={editing ? 0 : 6} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Role</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="input w-full">
                  <option value="employee">Employee</option>
                  <option value="it_staff">IT Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <SpinnerButton type="submit" disabled={submitting} loading={submitting} className="btn-primary flex-1 py-2.5 text-sm">
                  {editing ? 'Update' : 'Create'}
                </SpinnerButton>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-2.5 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom confirm modal */}
      {confirm && (
        <ConfirmModal message={confirm.message} danger={confirm.danger}
          onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}
