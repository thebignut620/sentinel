import { Link } from 'react-router-dom';

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: 29,
    label: 'up to 10 users',
    desc: 'Perfect for small IT teams',
    highlight: false,
    features: [
      { text: 'Up to 10 users', included: true },
      { text: 'ATLAS AI ticket analysis', included: true },
      { text: 'Auto-categorization & priority', included: true },
      { text: 'Employee self-service portal', included: true },
      { text: 'Knowledge base', included: true },
      { text: 'Email notifications', included: true },
      { text: 'Basic analytics & health score', included: true },
      { text: 'Custom fields', included: false },
      { text: 'API access', included: false },
      { text: 'Slack & Jira integrations', included: false },
      { text: 'Smart ticket clustering', included: false },
      { text: 'SSO / SAML', included: false },
      { text: 'Custom AI instructions', included: false },
    ],
  },
  {
    key: 'business',
    name: 'Business',
    price: 99,
    label: 'up to 50 users',
    desc: 'For growing companies',
    highlight: true,
    features: [
      { text: 'Up to 50 users', included: true },
      { text: 'ATLAS AI ticket analysis', included: true },
      { text: 'Auto-categorization & priority', included: true },
      { text: 'Employee self-service portal', included: true },
      { text: 'Knowledge base', included: true },
      { text: 'Email notifications', included: true },
      { text: 'Full analytics & health score', included: true },
      { text: 'Custom fields', included: true },
      { text: 'API access', included: true },
      { text: 'Slack & Jira integrations', included: true },
      { text: 'Smart ticket clustering', included: true },
      { text: 'SSO / SAML', included: false },
      { text: 'Custom AI instructions', included: false },
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 299,
    label: 'unlimited users',
    desc: 'Full power, no limits',
    highlight: false,
    features: [
      { text: 'Unlimited users', included: true },
      { text: 'ATLAS AI ticket analysis', included: true },
      { text: 'Auto-categorization & priority', included: true },
      { text: 'Employee self-service portal', included: true },
      { text: 'Knowledge base', included: true },
      { text: 'Email notifications', included: true },
      { text: 'Full analytics & health score', included: true },
      { text: 'Custom fields', included: true },
      { text: 'API access', included: true },
      { text: 'Slack & Jira integrations', included: true },
      { text: 'Smart ticket clustering', included: true },
      { text: 'SSO / SAML', included: true },
      { text: 'Custom AI instructions', included: true },
    ],
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800/60 px-4 h-14 flex items-center justify-between max-w-6xl mx-auto">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="font-bold text-white text-lg tracking-tight">Sentinel</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">Log in</Link>
          <Link to="/signup" className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-colors">
            Start Free Trial
          </Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-green-500 text-sm font-semibold uppercase tracking-widest mb-3">Pricing</p>
          <h1 className="text-5xl font-bold text-white mb-4">Simple, transparent pricing</h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {PLANS.map(plan => (
            <div
              key={plan.key}
              className={`relative rounded-2xl p-7 flex flex-col ${
                plan.highlight
                  ? 'bg-green-900/20 border-2 border-green-600/70 shadow-xl shadow-green-900/20'
                  : 'bg-gray-900 border border-gray-800'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full whitespace-nowrap">
                  Most Popular
                </div>
              )}
              <div className="mb-6">
                <h2 className="text-white font-bold text-xl">{plan.name}</h2>
                <p className="text-gray-500 text-sm mt-1">{plan.desc}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-white">${plan.price}</span>
                  <span className="text-gray-500 text-lg">/mo</span>
                </div>
                <p className="text-gray-500 text-xs mt-1">{plan.label}</p>
              </div>

              <Link
                to="/signup"
                className={`block text-center py-2.5 rounded-xl font-semibold text-sm transition-colors mb-6 ${
                  plan.highlight
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                }`}
              >
                Start Free Trial
              </Link>

              <ul className="space-y-2.5">
                {plan.features.map(f => (
                  <li key={f.text} className="flex items-start gap-2.5 text-sm">
                    <span className={`mt-0.5 shrink-0 ${f.included ? 'text-green-500' : 'text-gray-700'}`}>
                      {f.included ? '✓' : '✕'}
                    </span>
                    <span className={f.included ? 'text-gray-300' : 'text-gray-600'}>{f.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Feature comparison table */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-16">
          <div className="px-6 py-5 border-b border-gray-800">
            <h2 className="text-white font-bold text-xl">Full feature comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-6 py-4 text-gray-400 font-medium text-sm w-1/2">Feature</th>
                  {PLANS.map(p => (
                    <th key={p.key} className="px-4 py-4 text-center">
                      <span className={`text-sm font-semibold ${p.highlight ? 'text-green-400' : 'text-gray-300'}`}>
                        {p.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Users', '10', '50', 'Unlimited'],
                  ['ATLAS AI analysis', '✓', '✓', '✓'],
                  ['Self-service employee portal', '✓', '✓', '✓'],
                  ['Knowledge base', '✓', '✓', '✓'],
                  ['Email notifications', '✓', '✓', '✓'],
                  ['Analytics & health score', 'Basic', 'Full', 'Full'],
                  ['Custom fields', '—', '✓', '✓'],
                  ['Reply templates', '—', '✓', '✓'],
                  ['Smart ticket clustering', '—', '✓', '✓'],
                  ['API access', '—', '✓', '✓'],
                  ['Slack integration', '—', '✓', '✓'],
                  ['Jira integration', '—', '✓', '✓'],
                  ['Incident management', '—', '✓', '✓'],
                  ['Predictive analytics', '—', '—', '✓'],
                  ['Custom AI instructions', '—', '—', '✓'],
                  ['SSO / SAML', '—', '—', '✓'],
                  ['SLA management', '—', '—', '✓'],
                  ['Support', 'Email', 'Priority Email', 'Dedicated'],
                ].map(([feature, ...values]) => (
                  <tr key={feature} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/20">
                    <td className="px-6 py-3.5 text-gray-300 text-sm">{feature}</td>
                    {values.map((v, i) => (
                      <td key={i} className="px-4 py-3.5 text-center text-sm">
                        <span className={v === '✓' || (v !== '—' && v !== '') ? 'text-green-400' : 'text-gray-600'}>
                          {v}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="text-center">
          <p className="text-gray-400 mb-4">Questions about pricing?</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/#faq" className="text-green-400 hover:underline text-sm">Read the FAQ</Link>
            <span className="text-gray-700">·</span>
            <Link to="/signup" className="px-6 py-2.5 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-colors">
              Start Free Trial
            </Link>
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-800 py-8 px-4 text-center text-gray-600 text-xs">
        <Link to="/" className="text-gray-400 font-medium">Sentinel</Link>
        {' · '}
        <Link to="/privacy" className="hover:text-gray-400 transition-colors">Privacy</Link>
        {' · '}
        <Link to="/terms" className="hover:text-gray-400 transition-colors">Terms</Link>
        <p className="mt-2">© {new Date().getFullYear()} Sentinel. All rights reserved.</p>
      </footer>
    </div>
  );
}
