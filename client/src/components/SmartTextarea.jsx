import { useRef, useEffect } from 'react';

export default function SmartTextarea({ value, onChange, maxLength = 2000, className = '', ...props }) {
  const ref = useRef(null);

  // Auto-resize
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const remaining = maxLength - (value?.length || 0);
  const warn = remaining < 100;

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        className={`input w-full smart-textarea ${className}`}
        style={{ overflow: 'hidden' }}
        {...props}
      />
      <div className={`absolute bottom-2 right-2.5 text-[10px] tabular-nums transition-colors ${
        warn ? 'text-amber-500' : 'text-gray-600'
      }`}>
        {remaining}
      </div>
    </div>
  );
}
