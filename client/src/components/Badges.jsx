export function StatusBadge({ status }) {
  const styles = {
    open:        'bg-red-900/60 text-red-300 border border-red-800/50',
    in_progress: 'bg-amber-900/60 text-amber-300 border border-amber-800/50',
    resolved:    'bg-pine-900/60 text-pine-300 border border-pine-800/50',
    closed:      'bg-gray-800 text-gray-400 border border-gray-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] || styles.open}`}>
      {status?.replace('_', ' ')}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const styles = {
    low:      'bg-gray-800 text-gray-400 border border-gray-700',
    medium:   'bg-pine-900/60 text-pine-300 border border-pine-800/50',
    high:     'bg-orange-900/60 text-orange-300 border border-orange-800/50',
    critical: 'bg-red-900/70 text-red-300 border border-red-700/60 animate-pulse',
  };
  const dots = {
    low: '●', medium: '●', high: '●', critical: '●',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[priority] || styles.medium}`}>
      <span className="text-[8px]">{dots[priority]}</span>
      {priority}
    </span>
  );
}

export function CategoryBadge({ category }) {
  const styles = {
    hardware: 'bg-blue-900/60 text-blue-300 border border-blue-800/50',
    software: 'bg-pine-900/60 text-pine-300 border border-pine-800/50',
    network:  'bg-purple-900/60 text-purple-300 border border-purple-800/50',
    access:   'bg-amber-900/60 text-amber-300 border border-amber-800/50',
    account:  'bg-pink-900/60 text-pink-300 border border-pink-800/50',
  };
  const icons = {
    hardware: '🖥',
    software: '💾',
    network:  '🌐',
    access:   '🔑',
    account:  '👤',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[category] || styles.software}`}>
      <span>{icons[category] || '📋'}</span>
      {category}
    </span>
  );
}

export function RoleBadge({ role }) {
  const styles = {
    admin:    'bg-purple-900/60 text-purple-300 border border-purple-800/50',
    it_staff: 'bg-pine-900/60 text-pine-300 border border-pine-800/50',
    employee: 'bg-gray-800 text-gray-400 border border-gray-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[role] || styles.employee}`}>
      {role?.replace('_', ' ')}
    </span>
  );
}
