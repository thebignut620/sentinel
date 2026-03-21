import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Signup() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [form, setForm] = useState({ companyName: '', adminName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.companyName || !form.adminName || !form.email || !form.password) {
      return setError('All fields are required');
    }
    if (form.password.length < 8) {
      return setError('Password must be at least 8 characters');
    }
    setLoading(true);
    try {
      const r = await api.post('/auth/signup', form);
      loginWithToken(r.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-9 h-9 bg-green-700 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-base">S</span>
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Sentinel</span>
          </Link>
          <p className="text-gray-500 mt-2 text-sm">Start your 14-day free trial — no credit card required</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h1 className="text-xl font-bold text-white mb-6">Create your account</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Company Name</label>
              <input
                type="text"
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-500 transition-colors"
                placeholder="Acme Corporation"
                value={form.companyName}
                onChange={e => set('companyName', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Your Name</label>
              <input
                type="text"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-500 transition-colors"
                placeholder="John Smith"
                value={form.adminName}
                onChange={e => set('adminName', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Work Email</label>
              <input
                type="email"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-500 transition-colors"
                placeholder="you@company.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Password</label>
              <input
                type="password"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-green-500 transition-colors"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={e => set('password', e.target.value)}
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2.5 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-green-700 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? 'Creating account…' : 'Start Free Trial →'}
            </button>
          </form>

          <p className="mt-4 text-center text-gray-600 text-xs">
            By signing up you agree to our{' '}
            <Link to="/terms" className="text-green-500 hover:underline">Terms</Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-green-500 hover:underline">Privacy Policy</Link>
          </p>

          <div className="mt-5 pt-5 border-t border-gray-800 text-center">
            <p className="text-gray-500 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-green-400 hover:underline font-medium">Sign in</Link>
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-6 text-gray-600 text-xs">
          <span>✓ No credit card required</span>
          <span>✓ 14-day free trial</span>
          <span>✓ Cancel anytime</span>
        </div>
      </div>
    </div>
  );
}
