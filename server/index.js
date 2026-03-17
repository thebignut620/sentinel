import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { runMigrations } from './db/migrate.js';
import authRoutes from './routes/auth.js';
import aiRoutes from './routes/ai.js';
import ticketRoutes from './routes/tickets.js';
import userRoutes from './routes/users.js';
import settingsRoutes from './routes/settings.js';
import { authenticate } from './middleware/auth.js';

// Run DB migrations at startup
await runMigrations();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes (all require auth)
app.use('/api/ai', authenticate, aiRoutes);
app.use('/api/tickets', authenticate, ticketRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/settings', authenticate, settingsRoutes);

// Error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🛡  Sentinel server running on http://localhost:${PORT}\n`);
});
