import { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../api/client.js';

// ── Particle canvas ──────────────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const NUM = 60;
    const MAX_DIST = 140;
    const PINE = '74,170,74';

    const dots = Array.from({ length: NUM }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dots.forEach(d => {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > canvas.width)  d.vx *= -1;
        if (d.y < 0 || d.y > canvas.height) d.vy *= -1;
      });
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${PINE},${(1 - dist / MAX_DIST) * 0.35})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.stroke();
          }
        }
      }
      dots.forEach(d => {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${PINE},0.7)`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// ── Password strength meter ───────────────────────────────────────────────────
function PasswordStrength({ password }) {
  if (!password) return null;
  const checks = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)];
  const score = checks.filter(Boolean).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', 'bg-red-500', 'bg-amber-500', 'bg-pine-500', 'bg-pine-400'];
  const textColors = ['', 'text-red-400', 'text-amber-400', 'text-pine-400', 'text-pine-300'];
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1">
        {[1,2,3,4].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-gray-700'}`} />
        ))}
      </div>
      {score > 0 && <p className={`text-xs ${textColors[score]}`}>{labels[score]}</p>}
    </div>
  );
}

// ── Forgot password modal ─────────────────────────────────────────────────────
function ForgotPassword({ onClose }) {
  const [email, setEmail] = useState('');
  const [sent, setSent]   = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await api.post('/auth/forgot-password', { email }); setSent(true); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="card w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-white mb-4">Reset Password</h2>
        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-pine-300">If that email exists, a reset link has been sent. Check your inbox.</p>
            <button onClick={onClose} className="btn-primary w-full py-2.5 text-sm">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input w-full" placeholder="you@company.com" required autoFocus />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary flex-1 py-2.5 text-sm">
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
              <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── IT facts ticker ───────────────────────────────────────────────────────────
const FACTS = [
  'The first computer bug was a real insect — a moth found trapped in a Harvard Mark II relay in 1947 by Grace Hopper\'s team.',
  'A modern smartphone contains more processing power than all of NASA\'s combined computing capacity during the Apollo moon missions.',
  'The first 1 GB hard drive, the IBM 3380, was released in 1980 — it weighed 550 lbs and cost $40,000.',
  'Python is named after Monty Python\'s Flying Circus, not the snake. Guido van Rossum was reading Monty Python scripts when he created it.',
  'Linux powers 96.3% of the world\'s top one million web servers and runs on everything from smart fridges to the International Space Station.',
  'The QWERTY keyboard layout was originally designed to slow typists down to prevent mechanical typewriter jams in 1873.',
  'There are over 1.13 billion websites on the internet, but fewer than 200 million of them are actively maintained.',
  'The first domain name ever registered was Symbolics.com on March 15, 1985 — it\'s still online today.',
  'Email predates the World Wide Web by over 20 years. The first email was sent by Ray Tomlinson in 1971 on ARPANET.',
  'Approximately 90% of all the world\'s data has been generated in just the last two years.',
  'The average enterprise loses $5,600 per minute during an unplanned IT outage, according to Gartner research.',
  '"Wi-Fi" doesn\'t stand for anything. The name was invented by a branding agency and was never a technical acronym.',
  'The first computer virus, Creeper, appeared in 1971 on ARPANET — it displayed: "I\'m the creeper, catch me if you can!"',
  'SHA-256, used in Bitcoin and TLS certificates, produces 2⁵⁶ possible hashes — more than the estimated atoms in the observable universe.',
  'The term "bug" in software predates computers — engineers used it to mean any fault or defect as far back as Thomas Edison in 1878.',
];

function Ticker() {
  // Duplicate items to create a seamless loop
  const items = [...FACTS, ...FACTS];

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 overflow-hidden"
      style={{
        background: 'linear-gradient(to right, #0a0a0a 0%, transparent 4%, transparent 96%, #0a0a0a 100%), #0d1210',
        borderTop: '1px solid rgba(74,170,74,0.2)',
      }}
    >
      {/* Top edge glow line */}
      <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, rgba(74,170,74,0.5), transparent)' }} />

      <div className="flex items-center h-10">
        {/* Label tag */}
        <div
          className="shrink-0 flex items-center gap-2 px-4 h-full z-10"
          style={{
            background: 'rgba(74,170,74,0.12)',
            borderRight: '1px solid rgba(74,170,74,0.25)',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4aaa4a', boxShadow: '0 0 6px #4aaa4a', animation: 'glowPulse 2s ease-in-out infinite', display: 'inline-block' }} />
          <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: '#4aaa4a', fontFamily: 'monospace', textTransform: 'uppercase' }}>
            IT INTEL
          </span>
        </div>

        {/* Scrolling track */}
        <div className="flex-1 overflow-hidden relative">
          <div
            style={{
              display: 'flex',
              whiteSpace: 'nowrap',
              animation: 'tickerScroll 120s linear infinite',
              willChange: 'transform',
            }}
          >
            {items.map((fact, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: '12px',
                    color: 'rgba(74,170,74,0.85)',
                    fontFamily: '"Titillium Web", monospace',
                    letterSpacing: '0.01em',
                    padding: '0 48px',
                  }}
                >
                  {fact}
                </span>
                {/* Separator dot */}
                <span style={{ color: 'rgba(74,170,74,0.3)', fontSize: '18px', marginRight: '4px' }}>◆</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Login page ───────────────────────────────────────────────────────────
export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [shaking, setShaking]   = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Inject ticker keyframe */}
      <style>{`
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 4px #4aaa4a; opacity: 0.7; }
          50%       { box-shadow: 0 0 10px #4aaa4a; opacity: 1; }
        }
      `}</style>

      <div className="relative min-h-screen flex items-center justify-center p-6 pb-14 overflow-hidden bg-gray-950">
        <ParticleCanvas />

        {/* Radial glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] rounded-full bg-pine-900/20 blur-3xl" />
        </div>

        {/* Login card */}
        <div className={`relative z-10 w-full max-w-md animate-fadeIn ${shaking ? 'animate-shake' : ''}`}>
          <div className="backdrop-blur-xl bg-gray-900/80 border border-gray-700/60 rounded-2xl shadow-2xl shadow-black/60 p-8">

            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-white tracking-wide">Sign in to Sentinel</h1>
              <p className="text-xs text-gray-500 mt-1">IT Help Desk Platform</p>
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-700/60 text-red-300 px-4 py-3 rounded-lg text-sm mb-5">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email address</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="input w-full" placeholder="you@company.com" required autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="input w-full" placeholder="••••••••" required
                />
                <PasswordStrength password={password} />
              </div>
              <button
                type="submit" disabled={loading}
                className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</>
                ) : 'Sign In'}
              </button>
            </form>

            <div className="mt-5 flex items-center justify-between">
              <button onClick={() => setShowForgot(true)} className="text-xs text-pine-400 hover:text-pine-300 transition-colors">
                Forgot password?
              </button>
              <p className="text-xs text-gray-600">Admin creates accounts</p>
            </div>
          </div>
        </div>

        {/* Ticker pinned to bottom */}
        <Ticker />
      </div>

      {showForgot && <ForgotPassword onClose={() => setShowForgot(false)} />}
    </>
  );
}
