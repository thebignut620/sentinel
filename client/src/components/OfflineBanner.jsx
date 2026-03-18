import { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [showBack, setShowBack] = useState(false);
  const [hideTimer, setHideTimer] = useState(null);

  useEffect(() => {
    const goOffline = () => { setOffline(true); setShowBack(false); clearTimeout(hideTimer); };
    const goOnline = () => {
      setOffline(false);
      setShowBack(true);
      const t = setTimeout(() => setShowBack(false), 3000);
      setHideTimer(t);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!offline && !showBack) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[9998] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium animate-slideDown
      ${offline
        ? 'bg-red-900/90 border-b border-red-800/60 text-red-200'
        : 'bg-pine-900/90 border-b border-pine-800/60 text-pine-200'
      }`}>
      {offline ? (
        <>
          <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
          You're offline — some features may be unavailable
        </>
      ) : (
        <>
          <span className="h-2 w-2 rounded-full bg-pine-400" />
          Connection restored
        </>
      )}
    </div>
  );
}
