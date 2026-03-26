import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import api from '../api/client.js';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const { user } = useAuth();
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionStart, setSessionStart]     = useState(null);
  // Employees never have sessions; skip the fetch entirely for them
  const [sessionLoaded, setSessionLoaded]   = useState(!user || user.role === 'employee');

  useEffect(() => {
    if (!user || user.role === 'employee') {
      setSessionLoaded(true);
      return;
    }
    api.get('/sessions')
      .then(r => {
        if (r.data?.length > 0) {
          console.log('[SessionContext] active session:', r.data[0].name, '| started_at:', r.data[0].started_at);
          setCurrentSession(r.data[0]);
          setSessionStart(r.data[0].started_at);
        } else {
          console.log('[SessionContext] no active session — all-time data');
        }
      })
      .catch(() => {})
      .finally(() => setSessionLoaded(true));
  }, [user?.id]); // re-run if the logged-in user changes

  // Called after a new session is created — updates context for ALL consumers
  const startSession = useCallback((session) => {
    console.log('[SessionContext] new session started:', session.name, '| started_at:', session.started_at);
    setCurrentSession(session);
    setSessionStart(session.started_at);
  }, []);

  return (
    <SessionContext.Provider value={{ currentSession, sessionStart, sessionLoaded, startSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
