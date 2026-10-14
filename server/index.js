// Process entrypoint. HTTP configuration lives in app.js; importing it never listens.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';
import { PORT, HOST } from './config.js';
import { seedDatabase } from './database/seed.js';
import { initBackupCron } from './services/backupService.js';
import { initReminderCron } from './services/reminderCron.js';
import { initWebSocketServer } from './services/websocketService.js';
import { initDiscoveryService, getLocalIpAddresses } from './services/discoveryService.js';

// Preserve initialization for existing scripts/tests importing the default app.
seedDatabase();
export default app;

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun && process.env.NODE_ENV !== 'test') {
  initBackupCron();
  initReminderCron();
  const server = http.createServer(app);
  initWebSocketServer(server);
  server.listen(PORT, HOST, () => {
    console.log(`⚖️ خادم منظومة مكتب المحاماة: http://localhost:${PORT}`);
    for (const net of getLocalIpAddresses()) console.log(`🌐 [${net.interface}] http://${net.ip}:${PORT}`);
    initDiscoveryService();
  });
}
