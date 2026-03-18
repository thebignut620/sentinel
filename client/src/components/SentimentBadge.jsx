const SENTIMENT_CONFIG = {
  frustrated: {
    label: 'Frustrated',
    icon: '😤',
    className: 'bg-red-900/50 text-red-300 border-red-800/50',
    dot: 'bg-red-400',
  },
  urgent: {
    label: 'Urgent',
    icon: '⚡',
    className: 'bg-amber-900/50 text-amber-300 border-amber-800/50',
    dot: 'bg-amber-400',
  },
  calm: {
    label: 'Calm',
    icon: '😊',
    className: 'bg-gray-800/80 text-gray-400 border-gray-700/50',
    dot: 'bg-gray-500',
  },
};

export default function SentimentBadge({ sentiment, size = 'sm' }) {
  if (!sentiment) return null;
  const cfg = SENTIMENT_CONFIG[sentiment];
  if (!cfg) return null;

  if (size === 'xs') {
    return (
      <span
        title={`User sentiment: ${cfg.label}`}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${cfg.className}`}
      >
        <span>{cfg.icon}</span>
        <span>{cfg.label}</span>
      </span>
    );
  }

  return (
    <span
      title={`ATLAS detected: ${cfg.label}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.className}`}
    >
      <span>{cfg.icon}</span>
      <span>ATLAS: {cfg.label}</span>
    </span>
  );
}
