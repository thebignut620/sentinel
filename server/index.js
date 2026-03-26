import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './db/migrate.js';
import authRoutes from './routes/auth.js';
import aiRoutes from './routes/ai.js';
import ticketRoutes from './routes/tickets.js';
import userRoutes from './routes/users.js';
import settingsRoutes from './routes/settings.js';
import uploadRoutes from './routes/uploads.js';
import dashboardRoutes from './routes/dashboard.js';
import kbRoutes from './routes/knowledge-base.js';
import companyProfileRoutes from './routes/company-profile.js';
import employeeProfileRoutes from './routes/employee-profiles.js';
import integrationRoutes from './routes/integrations.js';
import twoFactorRoutes from './routes/two-factor.js';
import ssoRoutes from './routes/sso.js';
import departmentRoutes from './routes/departments.js';
import assetRoutes from './routes/assets.js';
import maintenanceRoutes from './routes/maintenance.js';
import customFieldRoutes from './routes/custom-fields.js';
import auditLogRoutes from './routes/audit-log.js';
import permissionsRoutes from './routes/permissions.js';
import slackRoutes from './routes/slack.js';
import emailIngestionRoutes from './routes/email-ingestion.js';
import webhookRoutes from './routes/webhooks.js';
import zapierRoutes from './routes/zapier.js';
import apiKeysRoutes from './routes/api-keys.js';
import publicApiRoutes from './routes/public-api.js';
import jiraRoutes from './routes/jira.js';
import analyticsRoutes from './routes/analytics.js';
import incidentRoutes from './routes/incidents.js';
import notificationRoutes from './routes/notifications.js';
import ticketTemplateRoutes from './routes/ticket-templates.js';
import clusterRoutes from './routes/clusters.js';
import billingRoutes from './routes/billing.js';
import statusRoutes from './routes/status.js';
import chatRoutes from './routes/chat.js';
import automationRoutes from './routes/automations.js';
import sandboxRoutes from './routes/sandbox.js';
import timeTrackingRoutes from './routes/time-tracking.js';
import ticketRelationsRoutes from './routes/ticket-relations.js';
import sessionsRoutes from './routes/sessions.js';
import { authenticate } from './middleware/auth.js';
import { sanitizeBody } from './middleware/sanitize.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { startCronJobs } from './services/cron.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await runMigrations();
startCronJobs();

const app = express();
app.set('trust proxy', 1); // Required for Railway — correctly reads X-Forwarded-For
const PORT = process.env.PORT || 3001;

// ─── Security headers (helmet) ────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow uploaded file serving
  contentSecurityPolicy: false, // API server — no CSP needed
}));

// ─── CORS — hardened to known origins ─────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'https://sentinelaiapp.com',
  'https://www.sentinelaiapp.com',
  'https://sentinel-eta-woad.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ─── Stripe webhook needs raw body — BEFORE express.json() ────────────────────
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// ─── Body parsing + global sanitization ───────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(sanitizeBody);

// ─── Global rate limiter (100 req/min per IP) ─────────────────────────────────
app.use('/api', apiLimiter);

// ─── Serve uploaded files ──────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Keep-alive ping — no DB, no auth, instant 200 ───────────────────────────
app.get('/api/ping', (_req, res) => res.json({ ok: true, t: Date.now() }));

// ─── Public routes ─────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/sso', ssoRoutes);
app.use('/api/status', statusRoutes);
// Public KB endpoints — no auth required
app.use('/api/knowledge-base', kbRoutes);

// ─── Protected routes ──────────────────────────────────────────────────────────
app.use('/api/ai', authenticate, aiRoutes);
app.use('/api/tickets', authenticate, ticketRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/settings', authenticate, settingsRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/company-profile', companyProfileRoutes);
app.use('/api/employee-profiles', authenticate, employeeProfileRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/assets', authenticate, assetRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/custom-fields', authenticate, customFieldRoutes);
app.use('/api/audit-log', authenticate, auditLogRoutes);
app.use('/api/permissions', authenticate, permissionsRoutes);
app.use('/api', authenticate, uploadRoutes);

// Phase 4 routes
app.use('/api/slack', slackRoutes);
app.use('/api/email-ingestion', emailIngestionRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/zapier', zapierRoutes);
app.use('/api/api-keys', apiKeysRoutes);
app.use('/v1', publicApiRoutes);
app.use('/api/jira', jiraRoutes);

// Phase 5 — Analytics
app.use('/api/analytics', analyticsRoutes);

// Billing
app.use('/api/billing', billingRoutes);

// Phase 6 routes
app.use('/api/incidents', incidentRoutes);
app.use('/api/notifications', authenticate, notificationRoutes);
app.use('/api/ticket-templates', ticketTemplateRoutes);
app.use('/api/clusters', authenticate, clusterRoutes);

// Phase 7 routes
app.use('/api/chat', authenticate, chatRoutes);
app.use('/api/automations', authenticate, automationRoutes);
app.use('/api/sandbox', authenticate, sandboxRoutes);
app.use('/api', authenticate, timeTrackingRoutes);
app.use('/api', authenticate, ticketRelationsRoutes);
app.use('/api/sessions', authenticate, sessionsRoutes);

// ─── Global error handler — never expose internals ────────────────────────────
app.use((err, req, res, _next) => {
  // Log the full error on the server
  console.error(`[error] ${req.method} ${req.path}:`, err.message || err);

  // CORS errors get a 403, everything else 500
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Never expose stack traces, DB errors, or file paths to the client
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🛡  Sentinel server running on http://localhost:${PORT}\n`);
});
