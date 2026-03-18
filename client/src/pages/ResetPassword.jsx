import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import sentinelLogo from '../assets/sentinel_logo.png';
import api from '../api/client.js';

function StrengthBar({ password }) {
  const checks = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)];
  const score = checks.filter(Boolean).length;
  const colors = ['', 'bg-red-500', 'bg-amber-500', 'bg-pine-500', 'bg-pine-400'];
  return (
    <div className="flex gap-1 mt-1.5">
      {[1,2,3,4].map(i => (
        <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-gray-700'}`} />
      ))}
    </div>
  );
}

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-950">
      <div className="w-full max-w-sm animate-fadeIn">
        <div className="flex justify-center mb-8">
          <img src={sentinelLogo} alt="Sentinel" className="h-24 w-auto" />
        </div>

        <div className="card p-8">
          {done ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">✅</div>
              <h2 className="text-lg font-semibold text-white">Password Reset!</h2>
              <p className="text-sm text-gray-400">Your password has been updated successfully.</p>
              <button onClick={() => navigate('/login')} className="btn-primary w-full py-2.5 text-sm">
                Back to Login
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white mb-6">Set New Password</h1>

              {error && (
                <div className="bg-red-900/40 border border-red-800/50 text-red-300 px-4 py-3 rounded-lg text-sm mb-5">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input w-full"
                    placeholder="••••••••"
                    required
                    autoFocus
                  />
                  {password && <StrengthBar password={password} />}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="input w-full"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2">
                  {loading ? (
                    <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Resetting…</>
                  ) : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
