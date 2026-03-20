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
import { authenticate } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await runMigrations();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/ai', authenticate, aiRoutes);
app.use('/api/tickets', authenticate, ticketRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/settings', authenticate, settingsRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/knowledge-base', authenticate, kbRoutes);
app.use('/api/company-profile', companyProfileRoutes);
app.use('/api/employee-profiles', authenticate, employeeProfileRoutes);
app.use('/api', authenticate, uploadRoutes);

// Error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🛡  Sentinel server running on http://localhost:${PORT}\n`);
});
