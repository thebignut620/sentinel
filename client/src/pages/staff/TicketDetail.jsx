import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { StatusBadge, PriorityBadge, CategoryBadge } from '../../components/Badges.jsx';
import { SkeletonCard } from '../../components/Skeleton.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import api from '../../api/client.js';

const SERVER = (api.defaults.baseURL || 'http://localhost:3001/api').replace('/api', '');

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function Avatar({ name, className = '' }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div className={`h-8 w-8 rounded-full bg-pine-900/60 border border-pine-800/40 flex items-center justify-center text-pine-400 text-xs font-bold shrink-0 ${className}`}>
      {initials}
    </div>
  );
}

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const fileInputRef = useRef(null);

  const [ticket, setTicket]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [staffUsers, setStaffUsers] = useState([]);
  const [comment, setComment]   = useState('');
  const [note, setNote]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading]   = useState(false);

  const [editStatus,   setEditStatus]   = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAssignee, setEditAssignee] = useState('');

  useEffect(() => {
    loadTicket();
    if (user.role !== 'employee') {
      api.get('/users').then(r => setStaffUsers(r.data.filter(u => u.role !== 'employee' && u.is_active)));
    }
  }, [id]);

  const loadTicket = async () => {
    try {
      const res = await api.get(`/tickets/${id}`);
      setTicket(res.data);
      setEditStatus(res.data.status);
      setEditPriority(res.data.priority);
      setEditCategory(res.data.category || 'software');
      setEditAssignee(res.data.assignee_id ?? '');
    } catch {
      navigate('/tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setSubmitting(true);
    try {
      await api.patch(`/tickets/${id}`, {
        status: editStatus, priority: editPriority,
        category: editCategory, assignee_id: editAssignee || null,
      });
      addToast('Ticket updated successfully', 'success');
      await loadTicket();
    } catch (err) {
      addToast(err.response?.data?.error || 'Update failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/tickets/${id}/comments`, { body: comment });
      setComment('');
      addToast('Comment posted', 'success');
      await loadTicket();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to add comment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/tickets/${id}/notes`, { body: note });
      setNote('');
      addToast('Internal note added', 'success');
      await loadTicket();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to add note', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      await api.post(`/tickets/${id}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      addToast('File attached', 'success');
      await loadTicket();
    } catch (err) {
      addToast(err.response?.data?.error || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (attachId) => {
    try {
      await api.delete(`/tickets/${id}/attachments/${attachId}`);
      addToast('Attachment deleted', 'info');
      await loadTicket();
    } catch (err) {
      addToast('Failed to delete attachment', 'error');
    }
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-fadeIn">
        <div className="skeleton h-5 w-20" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <SkeletonCard className="lg:col-span-2" />
          <SkeletonCard />
        </div>
      </div>
    );
  }
  if (!ticket) return null;

  const canManage = user.role === 'it_staff' || user.role === 'admin';

  return (
    <div className="animate-fadeIn">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-500 hover:text-gray-300 mb-4 flex items-center gap-1 transition-colors"
      >
        ← Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Main column ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header card */}
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <h1 className="text-xl font-bold text-white leading-tight">{ticket.title}</h1>
              <span className="text-xs text-gray-600 shrink-0 mt-1">#{ticket.id}</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <CategoryBadge category={ticket.category} />
              {ticket.ai_attempted === 1 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-900/50 text-purple-300 border border-purple-800/50">
                  🤖 AI attempted
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-5">
              Submitted by <span className="text-gray-300 font-medium">{ticket.submitter_name}</span>
              {' '}· {new Date(ticket.created_at).toLocaleString()}
              {ticket.assignee_name && (
                <> · Assigned to <span className="text-gray-300 font-medium">{ticket.assignee_name}</span></>
              )}
            </p>

            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</h3>
            <div className="bg-gray-800/60 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed border border-gray-700/40">
              {ticket.description}
            </div>

            {ticket.ai_suggestion && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">AI Suggested Solution</h3>
                <div className="bg-pine-900/30 border border-pine-800/50 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {ticket.ai_suggestion}
                </div>
              </div>
            )}
          </div>

          {/* Attachments */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-200 text-sm">
                Attachments {ticket.attachments?.length > 0 && `(${ticket.attachments.length})`}
              </h2>
              <label className={`btn-secondary px-3 py-1.5 text-xs cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploading ? 'Uploading…' : '+ Attach File'}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
            {ticket.attachments?.length === 0 ? (
              <p className="text-xs text-gray-600">No attachments yet.</p>
            ) : (
              <div className="space-y-2">
                {ticket.attachments.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-2.5 bg-gray-800/50 rounded-lg border border-gray-700/40 group">
                    <span className="text-lg shrink-0">📎</span>
                    <div className="flex-1 min-w-0">
                      <a
                        href={`${SERVER}/uploads/${a.filename}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-pine-400 hover:text-pine-300 transition-colors truncate block"
                      >
                        {a.original}
                      </a>
                      <p className="text-xs text-gray-600">{formatBytes(a.size)}</p>
                    </div>
                    {(canManage || user.id === ticket.submitter_id) && (
                      <button
                        onClick={() => handleDeleteAttachment(a.id)}
                        className="text-gray-700 hover:text-red-400 transition-colors text-xs opacity-0 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-200 text-sm mb-4">
              Comments {ticket.comments?.length > 0 && `(${ticket.comments.length})`}
            </h2>

            {ticket.comments?.length > 0 && (
              <div className="space-y-4 mb-5">
                {ticket.comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar name={c.author_name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-gray-200">{c.author_name}</span>
                        <span className="text-xs text-gray-600 capitalize">{c.author_role?.replace('_', ' ')}</span>
                        <span className="text-xs text-gray-700">{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed">{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleComment} className="space-y-2">
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                className="input w-full resize-none"
                placeholder="Write a comment…"
              />
              <button
                type="submit"
                disabled={!comment.trim() || submitting}
                className="btn-primary px-4 py-2 text-sm"
              >
                Post Comment
              </button>
            </form>
          </div>

          {/* Internal notes (staff/admin only) */}
          {canManage && (
            <div className="card p-5 border-amber-900/40">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-amber-400">🔒</span>
                <h2 className="font-semibold text-amber-300 text-sm">Internal Notes</h2>
                <span className="text-xs text-gray-600">(IT staff only — not visible to employees)</span>
              </div>

              {ticket.notes?.length > 0 && (
                <div className="space-y-3 mb-4">
                  {ticket.notes.map(n => (
                    <div key={n.id} className="bg-amber-900/20 border border-amber-800/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-amber-300">{n.author_name}</span>
                        <span className="text-xs text-gray-700">{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed">{n.body}</p>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleNote} className="space-y-2">
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  className="input w-full resize-none border-amber-900/40 focus:border-amber-700/60"
                  placeholder="Add an internal note…"
                />
                <button
                  type="submit"
                  disabled={!note.trim() || submitting}
                  className="px-4 py-2 text-sm bg-amber-900/60 hover:bg-amber-800/60 border border-amber-800/50 text-amber-300 rounded-lg transition-colors active:scale-95 disabled:opacity-50"
                >
                  Add Note
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {/* Manage ticket */}
          {canManage && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-200 text-sm mb-4">Manage Ticket</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="input w-full">
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                  <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className="input w-full">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                  <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="input w-full">
                    <option value="hardware">Hardware</option>
                    <option value="software">Software</option>
                    <option value="network">Network</option>
                    <option value="access">Access</option>
                    <option value="account">Account</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Assign To</label>
                  <select value={editAssignee} onChange={e => setEditAssignee(e.target.value)} className="input w-full">
                    <option value="">— Unassigned —</option>
                    {staffUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleUpdate}
                  disabled={submitting}
                  className="btn-primary w-full py-2.5 text-sm"
                >
                  {submitting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="card p-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Timeline</h3>
            <div className="space-y-2">
              <TimestampRow label="Created"  value={ticket.created_at} />
              <TimestampRow label="Updated"  value={ticket.updated_at} />
              {ticket.resolved_at && (
                <TimestampRow label="Resolved" value={ticket.resolved_at} className="text-pine-400" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimestampRow({ label, value, className = '' }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-gray-600 shrink-0">{label}</span>
      <span className={`text-right ${className || 'text-gray-400'}`}>
        {new Date(value).toLocaleString()}
      </span>
    </div>
  );
}
