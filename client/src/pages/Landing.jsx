import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// Scroll-reveal hook
function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

const FEATURES = [
  {
    icon: '🤖',
    title: 'AI-Powered Triage',
    desc: 'ATLAS automatically categorizes, prioritizes, and assigns every ticket the moment it arrives — no manual sorting.',
  },
  {
    icon: '⚡',
    title: 'Instant Self-Service',
    desc: 'Employees get answers in seconds. ATLAS resolves 60% of tickets before IT staff ever sees them.',
  },
  {
    icon: '🔍',
    title: 'Incident Detection',
    desc: 'ATLAS spots spikes and patterns in real-time, creates incidents, and alerts your team before users start complaining.',
  },
  {
    icon: '🔗',
    title: 'Smart Clustering',
    desc: 'Related tickets are automatically grouped. Resolve 20 tickets with one action instead of twenty.',
  },
  {
    icon: '📚',
    title: 'Self-Building Knowledge Base',
    desc: 'Every resolved ticket adds to your KB. ATLAS writes the article, staff never has to.',
  },
  {
    icon: '📊',
    title: 'Deep Analytics',
    desc: 'Health score, category trends, ATLAS learning stats, and resolution time — all in one dashboard.',
  },
];

const FAQS = [
  {
    q: 'How does the 14-day free trial work?',
    a: 'Sign up with your company email and get full access to Sentinel for 14 days. No credit card required. At the end of your trial, choose a plan to continue.',
  },
  {
    q: 'Do I need a credit card to start?',
    a: 'No. Your trial starts immediately with no payment information required. You only enter billing details when you upgrade to a paid plan.',
  },
  {
    q: 'What happens when my trial expires?',
    a: "Your account is locked but your data is preserved. You'll see an upgrade prompt when you log in. Upgrade at any time to restore full access instantly.",
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes. Upgrade or downgrade at any time from the billing page. Changes take effect on your next billing cycle. Pro-rated credits are applied automatically.',
  },
  {
    q: 'How does ATLAS AI resolve tickets?',
    a: 'ATLAS uses Claude (Anthropic) to analyze ticket content, match against your knowledge base and past resolutions, and provide step-by-step solutions to employees directly in the help flow.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. All data is encrypted in transit (TLS) and at rest. Your ticket data is isolated per company. We never use your data to train AI models.',
  },
  {
    q: 'What integrations does Sentinel support?',
    a: 'Sentinel integrates with Slack, Jira, Microsoft 365, Google Workspace, PagerDuty, and supports custom webhooks and a full REST API.',
  },
  {
    q: 'What kind of support is included?',
    a: 'Starter and Business plans include email support. Enterprise includes priority support and a dedicated onboarding session.',
  },
];

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: 29,
    label: 'up to 10 users',
    desc: 'Perfect for small IT teams',
    features: [
      'ATLAS AI ticket analysis',
      'Auto-categorization & priority',
      'Employee self-service portal',
      'Knowledge base',
      'Email notifications',
      'Basic analytics',
      'Email support',
    ],
    highlight: false,
  },
  {
    key: 'business',
    name: 'Business',
    price: 99,
    label: 'up to 50 users',
    desc: 'For growing companies',
    features: [
      'Everything in Starter',
      'Smart ticket clustering',
      'Reply templates',
      'Custom fields',
      'API access',
      'Slack & Jira integrations',
      'Priority support',
    ],
    highlight: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 299,
    label: 'unlimited users',
    desc: 'Full power, no limits',
    features: [
      'Everything in Business',
      'Custom AI instructions',
      'SSO / SAML',
      'Predictive analytics',
      'SLA management',
      'Incident management',
      'Dedicated support',
    ],
    highlight: false,
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-900/60 transition-colors"
      >
        <span className="text-white font-medium text-sm pr-4">{q}</span>
        <span className={`text-green-500 text-xl font-light shrink-0 transition-transform duration-200 ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && (
        <div className="px-5 pb-4 text-gray-400 text-sm leading-relaxed border-t border-gray-800/60 pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

export default function Landing() {
  useReveal();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <style>{`
        .reveal { opacity: 0; transform: translateY(28px); transition: opacity 0.65s ease, transform 0.65s ease; }
        .reveal.revealed { opacity: 1; transform: translateY(0); }
        .reveal-delay-1 { transition-delay: 0.1s; }
        .reveal-delay-2 { transition-delay: 0.2s; }
        .reveal-delay-3 { transition-delay: 0.3s; }
        .reveal-delay-4 { transition-delay: 0.4s; }
        .glow { box-shadow: 0 0 40px rgba(34,197,94,0.15); }
      `}</style>

      {/* ─── Nav ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/90 backdrop-blur border-b border-gray-800/60">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-bold text-white text-lg tracking-tight">Sentinel</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">
              Log in
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4 pt-14">
        {/* Background glows */}
        <div className="absolute inset-0 bg-gradient-to-b from-green-950/20 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-700/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-green-900/30 border border-green-700/40 rounded-full text-green-400 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            Powered by ATLAS AI — Built on Claude
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-white mb-6 leading-[1.08] tracking-tight">
            IT Support That{' '}
            <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
              Runs Itself
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            ATLAS handles tier-1 tickets automatically, spots incidents before they escalate,
            and keeps your IT team focused on work that matters.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="px-8 py-3.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold text-base transition-all duration-200 hover:shadow-xl hover:shadow-green-900/40"
            >
              Start Free Trial →
            </Link>
            <a
              href="#how-it-works"
              className="px-8 py-3.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl font-semibold text-base transition-colors border border-gray-700"
            >
              See How It Works
            </a>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-sm mx-auto">
            {[
              { stat: '60%', label: 'tickets auto-resolved' },
              { stat: '14', label: 'day free trial' },
              { stat: '5min', label: 'to set up' },
            ].map(({ stat, label }) => (
              <div key={stat}>
                <p className="text-3xl font-bold text-white">{stat}</p>
                <p className="text-gray-500 text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 reveal">
            <p className="text-green-500 text-sm font-semibold uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl font-bold text-white">Everything your IT team needs</h2>
            <p className="text-gray-400 mt-4 max-w-xl mx-auto">ATLAS handles the grunt work so your team can focus on complex problems.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={`reveal reveal-delay-${(i % 3) + 1} bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-green-800/60 transition-colors`}
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-white font-semibold mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="py-24 px-4 bg-gray-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 reveal">
            <p className="text-green-500 text-sm font-semibold uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-4xl font-bold text-white">Simple for everyone</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-12 left-1/3 right-1/3 h-px bg-gradient-to-r from-green-700/50 to-green-700/50" />
            {[
              {
                num: '01',
                title: 'Employee asks for help',
                desc: 'Type a question or submit a ticket. ATLAS analyzes it instantly — no waiting.',
              },
              {
                num: '02',
                title: 'ATLAS handles it',
                desc: 'ATLAS resolves it directly, or categorizes, prioritizes, and routes it to the right IT staff member.',
              },
              {
                num: '03',
                title: 'IT staff resolves fast',
                desc: 'Staff sees a prioritized queue with ATLAS suggestions, templates, and similar past tickets.',
              },
            ].map((step, i) => (
              <div key={step.num} className={`reveal reveal-delay-${i + 1} text-center`}>
                <div className="w-24 h-24 mx-auto bg-green-900/30 border-2 border-green-700/50 rounded-2xl flex items-center justify-center mb-6">
                  <span className="text-green-400 text-2xl font-bold">{step.num}</span>
                </div>
                <h3 className="text-white font-semibold text-lg mb-3">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 reveal">
            <p className="text-green-500 text-sm font-semibold uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-4xl font-bold text-white">Simple, transparent pricing</h2>
            <p className="text-gray-400 mt-4">All plans include a 14-day free trial. No credit card required.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => (
              <div
                key={plan.key}
                className={`reveal reveal-delay-${i + 1} relative rounded-2xl p-7 flex flex-col ${
                  plan.highlight
                    ? 'bg-green-900/20 border-2 border-green-600/70 glow'
                    : 'bg-gray-900 border border-gray-800'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-white font-bold text-xl">{plan.name}</h3>
                  <p className="text-gray-500 text-sm mt-1">{plan.desc}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">${plan.price}</span>
                    <span className="text-gray-500">/month</span>
                  </div>
                  <p className="text-gray-600 text-xs mt-1">{plan.label}</p>
                </div>
                <ul className="space-y-2.5 flex-1 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                      <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className={`block text-center py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                    plan.highlight
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                  }`}
                >
                  Start Free Trial
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-24 px-4 bg-gray-900/30">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14 reveal">
            <p className="text-green-500 text-sm font-semibold uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-4xl font-bold text-white">Common questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((item, i) => (
              <div key={i} className="reveal">
                <FaqItem {...item} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center reveal">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to put IT on autopilot?
          </h2>
          <p className="text-gray-400 mb-8">
            Join teams using ATLAS to resolve tickets automatically and keep employees unblocked.
          </p>
          <Link
            to="/signup"
            className="inline-block px-10 py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-lg transition-all hover:shadow-xl hover:shadow-green-900/40"
          >
            Start Your Free Trial →
          </Link>
          <p className="text-gray-600 text-sm mt-4">14 days free · No credit card · Cancel anytime</p>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-gray-800 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-green-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">S</span>
              </div>
              <span className="font-bold text-gray-300">Sentinel</span>
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <a href="#features" className="hover:text-gray-300 transition-colors">Features</a>
              <Link to="/pricing" className="hover:text-gray-300 transition-colors">Pricing</Link>
              <a href="#faq" className="hover:text-gray-300 transition-colors">FAQ</a>
              <Link to="/privacy" className="hover:text-gray-300 transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-gray-300 transition-colors">Terms of Service</Link>
              <Link to="/login" className="hover:text-gray-300 transition-colors">Log In</Link>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-800/60 text-center text-gray-600 text-xs">
            © {new Date().getFullYear()} Sentinel. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
