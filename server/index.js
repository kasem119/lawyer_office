import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { PORT, HOST } from './config.js';
import { seedDatabase } from './database/seed.js';
import { initBackupCron } from './services/backupService.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter, loginLimiter } from './middleware/rateLimiter.js';
import { authenticateToken } from './middleware/auth.js';
import { requireOfficeAccount } from './middleware/permissions.js';

import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import clientRoutes from './routes/clientRoutes.js';
import caseRoutes from './routes/caseRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import conflictRoutes from './routes/conflictRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import timeEntryRoutes from './routes/timeEntryRoutes.js';
import caseNoteRoutes from './routes/caseNoteRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import templateRoutes from './routes/templateRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import portalRoutes from './routes/portalRoutes.js';
import onboardingRoutes from './routes/onboardingRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import platformAdminRoutes from './routes/platformAdminRoutes.js';
import { initReminderCron } from './services/reminderCron.js';

import { initDiscoveryService, getLocalIpAddresses } from './services/discoveryService.js';

const app = express();

// Middlewares
const rawAllowedOrigin = process.env.ALLOWED_ORIGIN || '';
const configuredOrigins = new Set(
  rawAllowedOrigin
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(origin => {
      try {
        return new URL(origin).origin.toLowerCase();
      } catch {
        return null;
      }
    })
    .filter(Boolean)
);

app.use(cors({
  origin: (origin, callback) => {
    // 1. Allow requests with no origin (Electron desktop app, curl, server-to-server, file://)
    if (!origin) return callback(null, true);

    const normOrigin = origin.toLowerCase();

    // 2. Localhost and loopback IPs
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normOrigin)) {
      return callback(null, true);
    }

    // 3. VPS server IP (102.203.202.104)
    if (/^https?:\/\/102\.203\.202\.104(:\d+)?$/.test(normOrigin)) {
      return callback(null, true);
    }

    // 4. Local office LAN IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(normOrigin)) {
      return callback(null, true);
    }

    // 5. Configured origins from environment (.env)
    if (configuredOrigins.has(normOrigin)) {
      return callback(null, true);
    }

    // 6. SaaS platform domains and tenant subdomains (*.muhami.ly, *.lawyer.ly)
    if (/^https?:\/\/([a-zA-Z0-9-]+\.)*(muhami\.ly|lawyer\.ly)(:\d+)?$/.test(normOrigin)) {
      return callback(null, true);
    }

    if (normOrigin.startsWith('file://')) {
      return callback(null, true);
    }

    // 7. If no specific restriction or same-site, allow
    if (!rawAllowedOrigin || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // 8. For unlisted external origins: reject gracefully WITHOUT throwing an Error
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Seed initial database records
seedDatabase();

import { fileURLToPath } from 'url';

const isDirectRun = process.argv[1] && (
  fileURLToPath(import.meta.url) === process.argv[1] ||
  process.argv[1].endsWith('index.js')
);

// Initialize automated daily backups and reminders (only when running server directly)
if (isDirectRun && process.env.NODE_ENV !== 'test') {
  initBackupCron();
  initReminderCron();
}

// Register Routes
app.use('/api', apiLimiter);
app.post('/api/auth/login', loginLimiter);
app.post('/api/auth/register', loginLimiter);
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/platform', platformAdminRoutes);

// All routes below operate on one office's data. Authenticate and reject the
// platform owner here so this boundary cannot depend on individual handlers.
const officeApi = express.Router();
officeApi.use(authenticateToken, requireOfficeAccount);
officeApi.use('/users', userRoutes);
officeApi.use('/clients', clientRoutes);
officeApi.use('/cases', caseRoutes);
officeApi.use('/documents', documentRoutes);
officeApi.use('/events', eventRoutes);
officeApi.use('/tasks', taskRoutes);
officeApi.use('/notifications', notificationRoutes);
officeApi.use('/conflict', conflictRoutes);
officeApi.use('/backups', backupRoutes);
officeApi.use('/invoices', invoiceRoutes);
officeApi.use('/expenses', expenseRoutes);
officeApi.use('/time-entries', timeEntryRoutes);
officeApi.use('/case-notes', caseNoteRoutes);
officeApi.use('/reports', reportRoutes);
officeApi.use('/search', searchRoutes);
officeApi.use('/templates', templateRoutes);
officeApi.use('/activities', activityRoutes);
officeApi.use('/exports', exportRoutes);
officeApi.use('/ai', aiRoutes);
app.use('/api', officeApi);

// Serve built frontend if available
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.join(__dirname, '../client/dist');

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, {
    setHeaders: (res, filePath) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

import http from 'http';
import { initWebSocketServer } from './services/websocketService.js';

// Error Handler
app.use(errorHandler);

// Start listening
export default app;
if (isDirectRun && process.env.NODE_ENV !== 'test') {
  const server = http.createServer(app);
  initWebSocketServer(server);

  server.listen(PORT, HOST, () => {
    const localIps = getLocalIpAddresses();
    console.log(`====================================================`);
    console.log(`⚖️  خادم منظومة مكتب المحاماة يعمل الآن!`);
    console.log(`📡 المنفذ المحلي: http://localhost:${PORT}`);
    if (localIps.length > 0) {
      console.log(`🌐 عناوين الشبكة المحلية (LAN) لأجهزة المكتب:`);
      localIps.forEach(net => {
        console.log(`   - [${net.interface}] http://${net.ip}:${PORT}`);
      });
    }
    console.log(`====================================================`);

    // Launch UDP auto-discovery responder
    initDiscoveryService();
  });
}
