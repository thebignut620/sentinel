import express from 'express';
import Stripe from 'stripe';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

export const PLANS = {
  starter:    { name: 'Starter',    price: 2900,  userLimit: 10,   label: 'up to 10 users' },
  business:   { name: 'Business',   price: 9900,  userLimit: 50,   label: 'up to 50 users' },
  enterprise: { name: 'Enterprise', price: 29900, userLimit: null, label: 'unlimited users' },
};

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '');
}

async function setSetting(key, value) {
  await db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    key, String(value)
  );
}

// GET /api/billing/status
router.get('/status', authenticate, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT key, value FROM settings WHERE key IN ('subscription_plan','subscription_status','trial_ends_at','billing_period_end','stripe_customer_id')`
    );
    const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
    const userCount = (await db.get(`SELECT COUNT(*) as count FROM users WHERE is_active = 1`))?.count || 0;

    const plan = s.subscription_plan || 'trial';
    const status = s.subscription_status || 'trialing';
    const trialEndsAt = s.trial_ends_at ? new Date(s.trial_ends_at) : null;
    const now = new Date();

    let isExpired = false;
    let trialDaysLeft = null;

    if (status === 'trialing') {
      if (trialEndsAt) {
        trialDaysLeft = Math.ceil((trialEndsAt - now) / 86400000);
        if (trialDaysLeft <= 0) isExpired = true;
      }
      // No trial_ends_at = existing deploy treated as active trial
    } else if (status === 'canceled' || status === 'past_due') {
      isExpired = true;
    }

    res.json({
      plan,
      status,
      isExpired,
      trialDaysLeft: trialDaysLeft !== null ? Math.max(0, trialDaysLeft) : null,
      trialEndsAt: s.trial_ends_at || null,
      billingPeriodEnd: s.billing_period_end || null,
      userCount,
      userLimit: PLANS[plan]?.userLimit ?? null,
      hasStripeCustomer: !!s.stripe_customer_id,
    });
  } catch (err) {
    console.error('[Billing] status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch billing status' });
  }
});

// POST /api/billing/checkout — create Stripe Checkout session
router.post('/checkout', authenticate, requireRole('admin'), async (req, res) => {
  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });

  const priceId = process.env[`STRIPE_PRICE_${plan.toUpperCase()}`];
  if (!priceId) {
    return res.status(500).json({
      error: `Stripe price not configured. Add STRIPE_PRICE_${plan.toUpperCase()} to your environment variables.`,
    });
  }

  try {
    const s = getStripe();

    let custRow = await db.get(`SELECT value FROM settings WHERE key = 'stripe_customer_id'`);
    let customerId = custRow?.value;
    if (!customerId) {
      const nameRow = await db.get(`SELECT value FROM settings WHERE key = 'company_name'`);
      const customer = await s.customers.create({
        email: req.user.email,
        name: nameRow?.value || req.user.name,
        metadata: { user_id: String(req.user.id) },
      });
      customerId = customer.id;
      await setSetting('stripe_customer_id', customerId);
    }

    const baseUrl = process.env.CLIENT_URL || 'https://sentinelaiapp.com';
    const session = await s.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/admin/billing?success=1`,
      cancel_url: `${baseUrl}/admin/billing`,
      subscription_data: { metadata: { plan } },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Billing] checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/portal — Stripe Customer Portal
router.post('/portal', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const custRow = await db.get(`SELECT value FROM settings WHERE key = 'stripe_customer_id'`);
    if (!custRow?.value) {
      return res.status(400).json({ error: 'No billing account found. Subscribe to a plan first.' });
    }
    const s = getStripe();
    const baseUrl = process.env.CLIENT_URL || 'https://sentinelaiapp.com';
    const session = await s.billingPortal.sessions.create({
      customer: custRow.value,
      return_url: `${baseUrl}/admin/billing`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[Billing] portal error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/webhook — raw body, must be registered before express.json() in index.js
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[Billing] STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('[Billing] webhook sig error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const obj = event.data.object;
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const planKey = obj.metadata?.plan;
        await setSetting('subscription_status', obj.status);
        await setSetting('stripe_subscription_id', obj.id);
        if (obj.current_period_end) {
          await setSetting('billing_period_end', new Date(obj.current_period_end * 1000).toISOString());
        }
        if (planKey && PLANS[planKey]) await setSetting('subscription_plan', planKey);
        console.log('[Billing] subscription updated:', obj.status, planKey || '');
        break;
      }
      case 'customer.subscription.deleted':
        await setSetting('subscription_status', 'canceled');
        console.log('[Billing] subscription canceled');
        break;
      case 'invoice.payment_failed':
        await setSetting('subscription_status', 'past_due');
        console.log('[Billing] payment failed');
        break;
      case 'invoice.payment_succeeded':
        await setSetting('subscription_status', 'active');
        if (obj.lines?.data?.[0]?.period?.end) {
          await setSetting('billing_period_end', new Date(obj.lines.data[0].period.end * 1000).toISOString());
        }
        console.log('[Billing] payment succeeded');
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[Billing] webhook handler error:', err.message);
    res.status(500).json({ error: 'Handler failed' });
  }
});

export default router;
