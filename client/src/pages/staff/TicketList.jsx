import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useSession } from '../../contexts/SessionContext.jsx';
import { StatusBadge, PriorityBadge, CategoryBadge } from '../../components/Badges.jsx';
import { SkeletonTable } from '../../components/Skeleton.jsx';
import { useToast } from '../../contexts/ToastContext.jsx';
import SearchInput from '../../components/SearchInput.jsx';
import SentimentBadge from '../../components/SentimentBadge.jsx';
import SlaTimer from '../../components/SlaTimer.jsx';
import sentinelLogo from '../../assets/sentinel_logo.png';
import api from '../../api/client.js';

// ── Shared helpers ────────────────────────────────────────────────────────────
const PRIORITY_STRIP = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-yellow-500',
  low:      'bg-gray-600',
};

const CATEGORY_ICONS = {
  hardware: '🖥', software: '💾', network: '🌐', access: '🔑', account: '👤',
};

function initials(name = '') {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function OpenAge({ createdAt }) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const h  = Math.floor(ms / 3_600_000);
  const d  = Math.floor(h / 24);
  if (d >= 1) return <span className="text-[10px] text-gray-500">{d}d {h % 24}h open</span>;
  return <span className="text-[10px] text-gray-500">{h}h open</span>;
}

function isNew(createdAt) {
  return Date.now() - new Date(createdAt).getTime() < 48 * 3_600_000;
}

// ── Performance stats bar ─────────────────────────────────────────────────────
function StatsBar({ tickets, myId }) {
  const resolvedToday = tickets.filter(t => t.resolved_at && new Date(t.resolved_at).toDateString() === new Date().toDateString()).length;
  const open = tickets.filter(t => t.status === 'open').length;
  const mine = tickets.filter(t => t.assignee_id === myId).length;
  const resolved = tickets.filter(t => t.status === 'resolved');
  const avgMs = resolved.length
    ? resolved.filter(t => t.resolved_at).reduce((s, t) => s + new Date(t.resolved_at) - new Date(t.created_at), 0) / resolved.length
    : 0;
  const avgH = Math.round(avgMs / 3_600_000);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        { label: 'Open', value: open, color: 'text-red-400' },
        { label: 'Resolved Today', value: resolvedToday, color: 'text-pine-400' },
        { label: 'Assigned to Me', value: mine, color: 'text-blue-400' },
        { label: 'Avg Handle Time', value: avgH ? `${avgH}h` : '—', color: 'text-amber-400' },
      ].map(s => (
        <div key={s.label} className="card p-3 text-center">
          <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
          <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Kanban card ───────────────────────────────────────────────────────────────
function KanbanCard({ ticket, staffUsers, onUpdate, selected, onToggleSelect, bulkMode }) {
  const [assigning, setAssigning] = useState(false);
  const [dragging, setDragging]   = useState(false);

  const quickAssign = async (assignee_id) => {
    setAssigning(false);
    await onUpdate(ticket.id, { assignee_id: assignee_id || null });
  };

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('ticketId', ticket.id); setDragging(true); }}
      onDragEnd={() => setDragging(false)}
      className={`relative flex rounded-xl overflow-hidden border transition-all duration-200 cursor-grab active:cursor-grabbing
        ${dragging ? 'opacity-40 scale-95' : 'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40'}
        ${selected ? 'border-pine-600 bg-gray-800/90' : 'border-gray-800 bg-gray-900'}`}
    >
      {/* Priority strip */}
      <div className={`w-1 shrink-0 ${PRIORITY_STRIP[ticket.priority]}`} />

      <div className="flex-1 p-3 min-w-0">
        {/* Header row */}
        <div className="flex items-start gap-2 mb-2">
          {bulkMode && (
            <input type="checkbox" checked={selected} onChange={() => onToggleSelect(ticket.id)}
              className="mt-0.5 shrink-0 accent-pine-500" onClick={e => e.stopPropagation()} />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              {isNew(ticket.created_at) && (
                <span className="h-1.5 w-1.5 rounded-full bg-pine-400 shrink-0 animate-pulse" title="New ticket" />
              )}
              <span className="text-[10px] text-gray-600">#{ticket.id}</span>
              <span className="text-sm">{CATEGORY_ICONS[ticket.category]}</span>
            </div>
            <Link to={`/tickets/${ticket.id}`} className="text-sm font-medium text-gray-200 hover:text-pine-300 transition-colors leading-snug line-clamp-2 block">
              {ticket.title}
            </Link>
            {ticket.category_ticket_count >= 3 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-900/50 text-amber-300 border border-amber-800/50 mt-1">
                ↩ Recurring Issue
              </span>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <PriorityBadge priority={ticket.priority} />
            {ticket.sentiment && ticket.sentiment !== 'calm' && (
              <SentimentBadge sentiment={ticket.sentiment} size="xs" />
            )}
          </div>
          <CategoryBadge category={ticket.category} />
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span className="text-[10px] text-gray-600 truncate">{ticket.submitter_name}</span>
            <span className="text-gray-700">·</span>
            <OpenAge createdAt={ticket.created_at} />
            <SlaTimer sla_due_at={ticket.sla_due_at} priority={ticket.priority}
              is_escalated={ticket.is_escalated} status={ticket.status} compact />
          </div>
          {/* Assignee avatar */}
          <div className="relative shrink-0">
            <button
              onClick={e => { e.stopPropagation(); setAssigning(a => !a); }}
              title={ticket.assignee_name ? `Assigned: ${ticket.assignee_name}` : 'Unassigned'}
              className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all
                ${ticket.assignee_name
                  ? 'bg-pine-800 text-pine-200 border border-pine-700 hover:border-pine-500'
                  : 'bg-gray-800 text-gray-500 border border-gray-700 hover:border-gray-500'
                }`}
            >
              {ticket.assignee_name ? initials(ticket.assignee_name) : '?'}
            </button>
            {/* Quick assign dropdown */}
            {assigning && (
              <div className="absolute bottom-7 right-0 z-30 bg-gray-850 border border-gray-700 rounded-xl shadow-2xl shadow-black/60 overflow-hidden min-w-[160px]"
                style={{ background: '#161b22' }}>
                <div className="px-3 py-2 text-[10px] text-gray-500 font-semibold uppercase tracking-wider border-b border-gray-800">
                  Assign to
                </div>
                <button onClick={() => quickAssign(null)} className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
                  — Unassigned
                </button>
                {staffUsers.map(u => (
                  <button key={u.id} onClick={() => quickAssign(u.id)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full bg-pine-900 text-pine-300 text-[8px] font-bold flex items-center justify-center shrink-0">
                      {initials(u.name)}
                    </span>
                    {u.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* One-click status buttons */}
        <div className="flex gap-1 mt-2 pt-2 border-t border-gray-800/60">
          {ticket.status !== 'open' && (
            <button onClick={() => onUpdate(ticket.id, { status: 'open' })}
              className="flex-1 text-[10px] text-gray-600 hover:text-gray-300 hover:bg-gray-800 rounded-md py-1 transition-all">
              ← Open
            </button>
          )}
          {ticket.status !== 'in_progress' && (
            <button onClick={() => onUpdate(ticket.id, { status: 'in_progress' })}
              className="flex-1 text-[10px] text-amber-600 hover:text-amber-300 hover:bg-amber-950/30 rounded-md py-1 transition-all">
              In Progress
            </button>
          )}
          {ticket.status !== 'resolved' && (
            <button onClick={() => onUpdate(ticket.id, { status: 'resolved' })}
              className="flex-1 text-[10px] text-pine-600 hover:text-pine-300 hover:bg-pine-950/30 rounded-md py-1 transition-all">
              Resolve ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Kanban column ─────────────────────────────────────────────────────────────
const COLUMN_CONFIG = [
  { key: 'open',        label: 'Open',        statuses: ['open'],                  color: 'text-red-400',    border: 'border-red-900/40' },
  { key: 'in_progress', label: 'In Progress',  statuses: ['in_progress'],           color: 'text-amber-400',  border: 'border-amber-900/40' },
  { key: 'done',        label: 'Done',         statuses: ['resolved', 'closed'],    color: 'text-pine-400',   border: 'border-pine-900/40' },
];

function KanbanColumn({ column, tickets, staffUsers, onUpdate, selectedIds, onToggleSelect, bulkMode }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const ticketId = e.dataTransfer.getData('ticketId');
    if (!ticketId) return;
    // Use column.statuses[0] as the drop target status.
    // Do NOT look up the ticket in `tickets` — that array only holds cards already
    // in this column, so a card dragged from another column won't be found there.
    await onUpdate(Number(ticketId), { status: column.statuses[0] });
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
      onDrop={handleDrop}
      className={`flex flex-col gap-2 min-h-[200px] rounded-xl p-3 border transition-all duration-200
        ${dragOver ? 'bg-gray-800/60 border-pine-700/50 scale-[1.01]' : `bg-gray-900/40 ${column.border}`}`}
    >
      <div className="flex items-center gap-2 mb-1 px-1">
        <span className={`text-xs font-bold uppercase tracking-wider ${column.color}`}>{column.label}</span>
        <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded-full">{tickets.length}</span>
      </div>
      {tickets.map(t => (
        <KanbanCard
          key={t.id}
          ticket={t}
          staffUsers={staffUsers}
          onUpdate={onUpdate}
          selected={selectedIds.has(t.id)}
          onToggleSelect={onToggleSelect}
          bulkMode={bulkMode}
        />
      ))}
      {tickets.length === 0 && (
        <div className={`flex-1 flex items-center justify-center text-xs text-gray-700 border-2 border-dashed rounded-xl p-4 ${dragOver ? 'border-pine-700' : 'border-gray-800'}`}>
          Drop here
        </div>
      )}
    </div>
  );
}

// ── List row ──────────────────────────────────────────────────────────────────
function ListRow({ ticket, selected, onToggleSelect, bulkMode, onQuickUpdate, staffUsers }) {
  const [showAssign, setShowAssign] = useState(false);
  return (
    <tr className="border-b border-gray-800/60 last:border-0 hover:bg-gray-800/30 transition-colors group">
      {bulkMode && (
        <td className="pl-4 py-3">
          <input type="checkbox" checked={selected} onChange={() => onToggleSelect(ticket.id)} className="accent-pine-500" />
        </td>
      )}
      <td className="pl-2 py-3">
        {/* Priority strip */}
        <div className={`w-0.5 h-8 rounded-full ${PRIORITY_STRIP[ticket.priority]}`} />
      </td>
      <td className="px-3 py-3 text-gray-600 text-xs">{ticket.id}</td>
      <td className="px-3 py-3 max-w-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {isNew(ticket.created_at) && <span className="h-1.5 w-1.5 rounded-full bg-pine-400 shrink-0 animate-pulse" />}
          <span className="text-sm">{CATEGORY_ICONS[ticket.category]}</span>
          <Link to={`/tickets/${ticket.id}`} className="text-pine-400 hover:text-pine-300 font-medium transition-colors truncate">
            {ticket.title}
          </Link>
          {ticket.category_ticket_count >= 3 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-900/50 text-amber-300 border border-amber-800/50 shrink-0">
              ↩ Recurring
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-gray-400 text-xs">{ticket.submitter_name}</td>
      <td className="px-3 py-3"><CategoryBadge category={ticket.category} /></td>
      <td className="px-3 py-3"><StatusBadge status={ticket.status} /></td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <PriorityBadge priority={ticket.priority} />
          {ticket.sentiment && ticket.sentiment !== 'calm' && <SentimentBadge sentiment={ticket.sentiment} size="xs" />}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="relative">
          <button onClick={() => setShowAssign(a => !a)}
            className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all
              ${ticket.assignee_name ? 'bg-pine-800 text-pine-200 border border-pine-700' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>
            {ticket.assignee_name ? initials(ticket.assignee_name) : '?'}
          </button>
          {showAssign && (
            <div className="absolute right-0 top-8 z-30 border border-gray-700 rounded-xl shadow-2xl overflow-hidden min-w-[160px]" style={{ background: '#161b22' }}>
              <button onClick={() => { onQuickUpdate(ticket.id, { assignee_id: null }); setShowAssign(false); }}
                className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-800 border-b border-gray-800">
                — Unassigned
              </button>
              {staffUsers.map(u => (
                <button key={u.id} onClick={() => { onQuickUpdate(ticket.id, { assignee_id: u.id }); setShowAssign(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full bg-pine-900 text-pine-300 text-[8px] font-bold flex items-center justify-center shrink-0">
                    {initials(u.name)}
                  </span>
                  {u.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-gray-600 text-xs"><OpenAge createdAt={ticket.created_at} /></td>
    </tr>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TicketList() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { sessionStart } = useSession();
  const [tickets, setTickets]     = useState([]);
  const [staffUsers, setStaff]    = useState([]);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState('kanban');
  const [scope, setScope]         = useState('all');       // 'all' | 'mine'
  const [search, setSearch]       = useState('');
  const [filterPriority, setFP]   = useState('all');
  const [filterCat, setFC]        = useState('all');
  const [selectedIds, setSelected] = useState(new Set());
  const [bulkMode, setBulkMode]   = useState(false);
  const [mobileKanbanTab, setMobileKanbanTab] = useState('open');

  const load = useCallback(async () => {
    try {
      const ticketParams = sessionStart ? { session_start: sessionStart } : {};
      console.log('[TicketList] fetching /tickets — session_start:', sessionStart ?? 'none (all-time)', '| params:', JSON.stringify(ticketParams));
      const [tRes, uRes] = await Promise.all([
        api.get('/tickets', { params: ticketParams }),
        api.get('/users'),
      ]);
      console.log('[TicketList] tickets response:', tRes.status, 'count:', tRes.data?.length, 'role:', user?.role);
      console.log('[TicketList] users response:', uRes.status, 'count:', uRes.data?.length);
      setTickets(tRes.data);
      setStaff(uRes.data.filter(u => u.role !== 'employee' && u.is_active));
    } catch (err) {
      console.error('[TicketList] load error:', err.response?.status, err.response?.data, err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionStart]); // re-fetch when session changes

  useEffect(() => { load(); }, [load]);

  const handleUpdate = useCallback(async (ticketId, patch) => {
    // Optimistic update
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ...patch, assignee_name: patch.assignee_id !== undefined
      ? (staffUsers.find(u => u.id === patch.assignee_id)?.name ?? null)
      : t.assignee_name } : t));
    try {
      await api.patch(`/tickets/${ticketId}`, patch);
      if (patch.status) addToast(`Ticket #${ticketId} → ${patch.status.replace('_', ' ')}`, 'success');
    } catch {
      addToast('Update failed', 'error');
      load(); // revert
    }
  }, [staffUsers, addToast, load]);

  const handleBulkAction = async (payload) => {
    const ids = [...selectedIds];
    try {
      await api.patch('/tickets/bulk', { ids, ...payload });
      addToast(`${ids.length} tickets updated`, 'success');
      setSelected(new Set());
      load();
    } catch {
      addToast('Bulk update failed', 'error');
    }
  };

  const toggleSelect = (id) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  // Filter
  let visible = tickets
    .filter(t => scope === 'mine' ? t.assignee_id === user.id : true)
    .filter(t => filterPriority === 'all' || t.priority === filterPriority)
    .filter(t => filterCat === 'all' || t.category === filterCat)
    .filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.submitter_name?.toLowerCase().includes(search.toLowerCase()));

  const kanbanCols = COLUMN_CONFIG.map(col => ({
    ...col,
    tickets: visible.filter(t => col.statuses.includes(t.status)),
  }));

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Tickets</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex bg-gray-800 border border-gray-700 rounded-lg p-0.5">
            {[['kanban','⊞ Kanban'],['list','☰ List']].map(([v,label]) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === v ? 'bg-pine-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                {label}
              </button>
            ))}
          </div>
          {/* My / All toggle */}
          <div className="flex bg-gray-800 border border-gray-700 rounded-lg p-0.5">
            {[['all','All'],['mine','Mine']].map(([s,label]) => (
              <button key={s} onClick={() => setScope(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${scope === s ? 'bg-pine-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => { setBulkMode(b => !b); setSelected(new Set()); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${bulkMode ? 'bg-pine-800/40 border-pine-700/50 text-pine-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'}`}>
            ☑ Bulk
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <StatsBar tickets={tickets} myId={user.id} />

      {/* Filters */}
      <div className="card p-3 flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search tickets…" className="flex-1 min-w-0" />
        <div className="flex gap-3 flex-wrap">
          <select value={filterPriority} onChange={e => setFP(e.target.value)} className="input flex-1 sm:flex-none">
            <option value="all">All priorities</option>
            {['critical','high','medium','low'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterCat} onChange={e => setFC(e.target.value)} className="input flex-1 sm:flex-none">
            <option value="all">All categories</option>
            {['hardware','software','network','access','account'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-xs text-gray-600 self-center">{visible.length} ticket{visible.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="card p-3 flex flex-wrap items-center gap-3 border-pine-800/50 animate-fadeIn">
          <span className="text-sm font-medium text-pine-300 shrink-0">{selectedIds.size} selected</span>
          <div className="flex flex-wrap gap-2 items-center flex-1">
            <span className="text-xs text-gray-500">Status:</span>
            {['open','in_progress','resolved','closed'].map(s => (
              <button key={s} onClick={() => handleBulkAction({ status: s })}
                className="btn-secondary px-3 py-1.5 text-xs capitalize">{s.replace('_',' ')}</button>
            ))}
            <span className="text-xs text-gray-500 ml-2">Priority:</span>
            {['critical','high','medium','low'].map(p => (
              <button key={p} onClick={() => handleBulkAction({ priority: p })}
                className="btn-secondary px-3 py-1.5 text-xs capitalize">{p}</button>
            ))}
            <span className="text-xs text-gray-500 ml-2">Assign:</span>
            <select className="input text-xs py-1" defaultValue=""
              onChange={e => { if (e.target.value !== '') handleBulkAction({ assignee_id: e.target.value || null }); e.target.value = ''; }}>
              <option value="">— pick assignee</option>
              <option value="">Unassign</option>
              {staffUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <button onClick={() => { setSelected(new Set()); setBulkMode(false); }} className="text-xs text-gray-600 hover:text-gray-300 shrink-0">
            ✕ Clear
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={6} />
      ) : view === 'kanban' ? (
        <>
          {/* Mobile: column tabs */}
          <div className="md:hidden flex bg-gray-800 border border-gray-700 rounded-lg p-0.5 gap-0.5">
            {COLUMN_CONFIG.map(col => (
              <button
                key={col.key}
                onClick={() => setMobileKanbanTab(col.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
                  mobileKanbanTab === col.key ? 'bg-pine-700 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <span className={mobileKanbanTab === col.key ? '' : col.color}>{col.label}</span>
                <span className="text-[10px] bg-gray-700/60 px-1.5 py-0.5 rounded-full">
                  {kanbanCols.find(c => c.key === col.key)?.tickets.length ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Mobile: single active column */}
          <div className="md:hidden">
            {kanbanCols.filter(col => col.key === mobileKanbanTab).map(col => (
              <KanbanColumn
                key={col.key}
                column={col}
                tickets={col.tickets}
                staffUsers={staffUsers}
                onUpdate={handleUpdate}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                bulkMode={bulkMode}
              />
            ))}
          </div>

          {/* Desktop: all 3 columns */}
          <div className="hidden md:grid md:grid-cols-3 gap-4">
            {kanbanCols.map(col => (
              <KanbanColumn
                key={col.key}
                column={col}
                tickets={col.tickets}
                staffUsers={staffUsers}
                onUpdate={handleUpdate}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                bulkMode={bulkMode}
              />
            ))}
          </div>
        </>
      ) : (
        /* ── List ── */
        visible.length === 0 ? (
          <div className="card py-16 text-center animate-fadeIn">
            <div className="flex flex-col items-center gap-3">
              <img src={sentinelLogo} alt="Sentinel" className="h-10 w-auto opacity-20" />
              <p className="text-gray-500 text-sm">No tickets match your filters.</p>
            </div>
          </div>
        ) : (
          <div className="card overflow-hidden">
            {/* Scrollable on mobile */}
            <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-800/50 border-b border-gray-800 text-left">
                  <tr>
                    {bulkMode && <th className="pl-4 py-3 w-8" />}
                    <th className="pl-2 py-3 w-1" />
                    <th className="px-3 py-3 text-gray-500 font-medium text-xs">#</th>
                    <th className="px-3 py-3 text-gray-500 font-medium text-xs">Title</th>
                    <th className="px-3 py-3 text-gray-500 font-medium text-xs">Submitter</th>
                    <th className="px-3 py-3 text-gray-500 font-medium text-xs">Category</th>
                    <th className="px-3 py-3 text-gray-500 font-medium text-xs">Status</th>
                    <th className="px-3 py-3 text-gray-500 font-medium text-xs">Priority</th>
                    <th className="px-3 py-3 text-gray-500 font-medium text-xs">Assignee</th>
                    <th className="px-3 py-3 text-gray-500 font-medium text-xs">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(t => (
                    <ListRow key={t.id} ticket={t} selected={selectedIds.has(t.id)} onToggleSelect={toggleSelect}
                      bulkMode={bulkMode} onQuickUpdate={handleUpdate} staffUsers={staffUsers} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
