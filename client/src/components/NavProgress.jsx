import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function NavProgress() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 500);
    return () => clearTimeout(timerRef.current);
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '2px', zIndex: 9999, overflow: 'hidden' }}>
      <div
        className="animate-progressIndeterminate"
        style={{
          height: '100%',
          background: 'linear-gradient(90deg, transparent, #4aaa4a, #74bb74, #4aaa4a, transparent)',
          boxShadow: '0 0 8px #4aaa4a',
        }}
      />
    </div>
  );
}
