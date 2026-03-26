import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../api/client.js';

export default function SandboxBanner() {
  const { user } = useAuth();
  const [isSandbox, setIsSandbox] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      api.get('/sandbox/status').then(r => setIsSandbox(r.data.is_sandbox)).catch(() => {});
    }
  }, [user]);

  async function exitSandbox() {
    await api.post('/sandbox/disable');
    setIsSandbox(false);
    window.location.reload();
  }

  if (!isSandbox) return null;

  return (
    <div className="bg-yellow-500 text-yellow-950 px-4 py-2 flex items-center justify-between text-sm font-semibold shrink-0">
      <span>SANDBOX MODE — This is sample data. No real tickets or users.</span>
      <button onClick={exitSandbox} className="bg-yellow-800 text-yellow-100 hover:bg-yellow-700 px-3 py-1 rounded-lg text-xs ml-4 transition-colors">Exit Sandbox</button>
    </div>
  );
}
