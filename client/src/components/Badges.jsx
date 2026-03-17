export function StatusBadge({ status }) {
  const styles = {
    open: 'bg-red-100 text-red-700',
    in_progress: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] || styles.open}`}>
      {status?.replace('_', ' ')}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const styles = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[priority] || styles.medium}`}>
      {priority}
    </span>
  );
}

export function RoleBadge({ role }) {
  const styles = {
    admin: 'bg-purple-100 text-purple-700',
    it_staff: 'bg-blue-100 text-blue-700',
    employee: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[role] || styles.employee}`}>
      {role?.replace('_', ' ')}
    </span>
  );
}
