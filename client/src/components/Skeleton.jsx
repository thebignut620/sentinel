export function SkeletonLine({ className = '' }) {
  return <div className={`skeleton h-4 ${className}`} />;
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`card p-5 space-y-3 ${className}`}>
      <SkeletonLine className="w-1/3" />
      <SkeletonLine className="w-2/3" />
      <SkeletonLine className="w-1/2" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="card overflow-hidden">
      <div className="bg-gray-800/50 px-4 py-3 flex gap-6 border-b border-gray-800">
        {[40, 25, 15, 15].map((w, i) => (
          <div key={i} className={`skeleton h-3`} style={{ width: `${w}%` }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex gap-6 border-b border-gray-800/50 last:border-0">
          {[40, 25, 15, 15].map((w, j) => (
            <div key={j} className="skeleton h-3" style={{ width: `${w}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="card p-5 space-y-2">
          <div className="skeleton h-8 w-16" />
          <div className="skeleton h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
