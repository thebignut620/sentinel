import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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
import { authenticate } from './middleware/auth.js';
import { startCronJobs } from './services/cron.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await runMigrations();
startCronJobs();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/sso', ssoRoutes);

// Protected routes
app.use('/api/ai', authenticate, aiRoutes);
app.use('/api/tickets', authenticate, ticketRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/settings', authenticate, settingsRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/knowledge-base', authenticate, kbRoutes);
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

// Error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🛡  Sentinel server running on http://localhost:${PORT}\n`);
});
