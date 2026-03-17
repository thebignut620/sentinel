import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { StatusBadge, PriorityBadge } from '../../components/Badges.jsx';
import api from '../../api/client.js';

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [staffUsers, setStaffUsers] = useState([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Edit state for IT staff/admin
  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [updateMsg, setUpdateMsg] = useState('');

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
      setEditAssignee(res.data.assignee_id ?? '');
    } catch {
      navigate('/tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setSubmitting(true);
    setUpdateMsg('');
    try {
      await api.patch(`/tickets/${id}`, {
        status: editStatus,
        priority: editPriority,
        assignee_id: editAssignee || null,
      });
      setUpdateMsg('Ticket updated.');
      await loadTicket();
      setTimeout(() => setUpdateMsg(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
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
      await loadTicket();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  if (!ticket) return null;

  const canManage = user.role === 'it_staff' || user.role === 'admin';

  return (
    <div className="space-y-1">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-400 hover:text-gray-600 mb-3 flex items-center gap-1"
      >
        ← Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Ticket header */}
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <h1 className="text-xl font-bold text-gray-900">{ticket.title}</h1>
              <span className="text-sm text-gray-400 shrink-0">#{ticket.id}</span>
            </div>
            <div className="flex gap-2 mb-4">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              {ticket.ai_attempted === 1 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">
                  🤖 AI attempted
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Submitted by <span className="text-gray-600 font-medium">{ticket.submitter_name}</span>
              {' '}on {new Date(ticket.created_at).toLocaleString()}
              {ticket.assignee_name && (
                <> · Assigned to <span className="text-gray-600 font-medium">{ticket.assignee_name}</span></>
              )}
            </p>

            <h3 className="text-sm font-semibold text-gray-700 mb-2">Problem Description</h3>
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {ticket.description}
            </div>

            {ticket.ai_suggestion && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">AI Suggested Solution</h3>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {ticket.ai_suggestion}
                </div>
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              Comments {ticket.comments?.length > 0 && `(${ticket.comments.length})`}
            </h2>

            {ticket.comments?.length > 0 && (
              <div className="space-y-4 mb-5">
                {ticket.comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-pine-100 flex items-center justify-center text-pine-700 font-medium text-xs shrink-0">
                      {c.author_name?.[0]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-800">{c.author_name}</span>
                        <span className="text-xs text-gray-400 capitalize">{c.author_role?.replace('_', ' ')}</span>
                        <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-3">
                {error}
              </div>
            )}

            <form onSubmit={handleComment}>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pine-700 resize-none"
                placeholder="Write a comment…"
              />
              <button
                type="submit"
                disabled={!comment.trim() || submitting}
                className="mt-2 bg-pine-900 hover:bg-pine-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Post Comment
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        {canManage && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Manage Ticket</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pine-700"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                  <select
                    value={editPriority}
                    onChange={e => setEditPriority(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pine-700"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Assign To</label>
                  <select
                    value={editAssignee}
                    onChange={e => setEditAssignee(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pine-700"
                  >
                    <option value="">— Unassigned —</option>
                    {staffUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                {updateMsg && (
                  <p className="text-xs text-green-600">{updateMsg}</p>
                )}

                <button
                  onClick={handleUpdate}
                  disabled={submitting}
                  className="w-full bg-pine-900 hover:bg-pine-800 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
                >
                  {submitting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl border p-4 text-xs text-gray-500 space-y-1.5">
              <div><span className="font-medium text-gray-600">Created:</span> {new Date(ticket.created_at).toLocaleString()}</div>
              <div><span className="font-medium text-gray-600">Updated:</span> {new Date(ticket.updated_at).toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
