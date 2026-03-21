import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../../api/client.js';

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: 29,
    label: 'up to 10 users',
    features: ['ATLAS AI analysis', 'Self-service portal', 'Knowledge base', 'Basic analytics', 'Email support'],
  },
  {
    key: 'business',
    name: 'Business',
    price: 99,
    label: 'up to 50 users',
    highlight: true,
    features: ['Everything in Starter', 'Smart clustering', 'Custom fields', 'API + integrations', 'Priority support'],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 299,
    label: 'unlimited users',
    features: ['Everything in Business', 'Custom AI instructions', 'SSO / SAML', 'Predictive analytics', 'Dedicated support'],
  },
];

const STATUS_LABELS = {
  trialing:  { label: 'Free Trial',    color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-700/50' },
  active:    { label: 'Active',         color: 'text-green-400',  bg: 'bg-green-900/30 border-green-700/50' },
  past_due:  { label: 'Payment Failed', color: 'text-red-400',    bg: 'bg-red-900/30 border-red-700/50' },
  canceled:  { label: 'Canceled',       color: 'text-gray-400',   bg: 'bg-gray-800 border-gray-700' },
};

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] || STATUS_LABELS.active;
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.bg} ${s.color}`}>
      {s.label}
    </span>
  );
}

export default function Billing() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();

  const successMsg = new URLSearchParams(location.search).get('success');

  useEffect(() => {
    api.get('/billing/status')
      .then(r => setStatus(r.data))
      .catch(() => setError('Failed to load billing status'))
      .finally(() => setLoading(false));
  }, []);

  async function startCheckout(plan) {
    setCheckoutLoading(plan);
    setError('');
    try {
      const r = await api.post('/billing/checkout', { plan });
      window.location.href = r.data.url;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start checkout');
      setCheckoutLoading('');
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    setError('');
    try {
      const r = await api.post('/billing/portal');
      window.location.href = r.data.url;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to open billing portal');
      setPortalLoading(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-500 text-center">Loading billing information…</div>;

  const isTrialing = status?.status === 'trialing';
  const isActive   = status?.status === 'active';
  const isExpired  = status?.isExpired;
  const planName   = PLANS.find(p => p.key === status?.plan)?.name || status?.plan || 'Trial';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing & Subscription</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your plan and payment information.</p>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="bg-green-900/30 border border-green-700/50 rounded-xl px-4 py-3 text-green-300 text-sm flex items-center gap-2">
          <span>✓</span> Subscription activated successfully! Your account is now on the {planName} plan.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Current plan card */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h2 className="text-gray-300 font-semibold text-sm mb-4">Current Plan</h2>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-white text-xl font-bold capitalize">{planName} Plan</span>
              <StatusBadge status={status?.status} />
            </div>

            {isTrialing && status?.trialDaysLeft !== null && (
              <div className="space-y-2">
                <p className="text-gray-400 text-sm">
                  {isExpired
                    ? 'Your trial has expired. Upgrade to continue using Sentinel.'
                    : `Trial ends in ${status.trialDaysLeft} day${status.trialDaysLeft !== 1 ? 's' : ''}`}
                </p>
                {!isExpired && (
                  <div className="w-48 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 rounded-full transition-all"
                      style={{ width: `${Math.max(5, (status.trialDaysLeft / 14) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {isActive && status?.billingPeriodEnd && (
              <p className="text-gray-400 text-sm">
                Next billing date: {new Date(status.billingPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}

            {status?.userLimit && (
              <p className="text-gray-500 text-xs mt-1">
                {status.userCount} / {status.userLimit} users
              </p>
            )}
            {status?.userLimit === null && isActive && (
              <p className="text-gray-500 text-xs mt-1">{status.userCount} users · unlimited</p>
            )}
          </div>

          {isActive && status?.hasStripeCustomer && (
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
            >
              {portalLoading ? 'Opening…' : 'Manage Subscription'}
            </button>
          )}
        </div>
      </div>

      {/* Plan cards — show when trialing/expired/past_due or if they want to upgrade */}
      {(!isActive || isExpired) && (
        <div>
          <h2 className="text-gray-300 font-semibold text-sm mb-4">
            {isExpired ? 'Choose a plan to continue' : 'Upgrade your plan'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map(plan => {
              const isCurrent = status?.plan === plan.key && isActive;
              return (
                <div
                  key={plan.key}
                  className={`relative rounded-xl p-5 flex flex-col ${
                    plan.highlight
                      ? 'bg-green-900/20 border-2 border-green-600/60'
                      : 'bg-gray-800 border border-gray-700'
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-green-600 text-white text-[10px] font-bold rounded-full whitespace-nowrap">
                      Most Popular
                    </div>
                  )}
                  <div className="mb-4">
                    <h3 className="text-white font-semibold">{plan.name}</h3>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-bold text-white">${plan.price}</span>
                      <span className="text-gray-500 text-xs">/month</span>
                    </div>
                    <p className="text-gray-600 text-xs">{plan.label}</p>
                  </div>
                  <ul className="space-y-1.5 flex-1 mb-4">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs text-gray-300">
                        <span className="text-green-500 shrink-0 mt-0.5">✓</span>{f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => startCheckout(plan.key)}
                    disabled={!!checkoutLoading || isCurrent}
                    className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                      plan.highlight
                        ? 'bg-green-700 hover:bg-green-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    }`}
                  >
                    {checkoutLoading === plan.key ? 'Loading…' : isCurrent ? 'Current Plan' : 'Upgrade →'}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-gray-600 text-xs mt-3 text-center">
            You'll be redirected to Stripe to complete payment securely. No credit card stored on our servers.
          </p>
        </div>
      )}

      {/* Active plan — show upgrade option */}
      {isActive && !isExpired && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 text-sm font-medium">Need more users or features?</p>
              <p className="text-gray-500 text-xs mt-0.5">Upgrade or change your plan anytime from the billing portal.</p>
            </div>
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shrink-0 ml-4"
            >
              {portalLoading ? 'Opening…' : 'Change Plan'}
            </button>
          </div>
        </div>
      )}

      {/* Pricing link */}
      <p className="text-center text-gray-600 text-xs">
        <Link to="/pricing" className="hover:text-gray-400 transition-colors">View full pricing & feature comparison →</Link>
      </p>
    </div>
  );
}
