import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { PORT, HOST } from './config.js';
import { seedDatabase } from './database/seed.js';
import { initBackupCron } from './services/backupService.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter, loginLimiter } from './middleware/rateLimiter.js';

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
import { initReminderCron } from './services/reminderCron.js';

import { initDiscoveryService, getLocalIpAddresses } from './services/discoveryService.js';

const app = express();

// Middlewares
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Electron, mobile, curl, file://)
    if (!origin) return callback(null, true);
    // Allow localhost and local LAN IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    const isLocalOrLan = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin);
    if (isLocalOrLan || origin.startsWith('file://')) {
      return callback(null, true);
    }
    // Allow in local office environment
    return callback(null, true);
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
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/conflict', conflictRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/case-notes', caseNoteRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/portal', portalRoutes);

// Serve built frontend if available
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.join(__dirname, '../client/dist');

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
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
