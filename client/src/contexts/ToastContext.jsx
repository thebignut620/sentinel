import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

function Toast({ toast, onRemove }) {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };
  const styles = {
    success: 'bg-pine-800 border-pine-600 text-pine-100',
    error:   'bg-red-900/90 border-red-700 text-red-100',
    warning: 'bg-amber-900/90 border-amber-700 text-amber-100',
    info:    'bg-gray-800 border-gray-600 text-gray-100',
  };
  const iconStyles = {
    success: 'bg-pine-600 text-white',
    error:   'bg-red-700 text-white',
    warning: 'bg-amber-700 text-white',
    info:    'bg-gray-600 text-white',
  };

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl
                  min-w-[280px] max-w-sm animate-slideInRight backdrop-blur-sm
                  ${styles[toast.type] || styles.info}`}
    >
      <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${iconStyles[toast.type] || iconStyles.info}`}>
        {icons[toast.type] || icons.info}
      </span>
      <p className="text-sm font-medium flex-1">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-current opacity-50 hover:opacity-100 transition-opacity shrink-0 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
