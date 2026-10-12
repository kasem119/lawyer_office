import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import db from '../database/db.js';

let wss = null;
const staffConnections = new Map(); // staff:<tenantId>:<userId> -> Set<WebSocket>

function authenticateStaffToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!['admin', 'lawyer'].includes(decoded.role) || !Number.isInteger(Number(decoded.id)) || !Number.isInteger(Number(decoded.tenant_id)) || !Number.isFinite(decoded.exp)) {
      return null;
    }

    const user = db.prepare(`
      SELECT u.id, u.role, u.tenant_id
      FROM users u JOIN tenants t ON t.id = u.tenant_id
      WHERE u.id = ? AND u.tenant_id = ? AND u.is_active = 1
        AND u.role IN ('admin', 'lawyer') AND t.is_active = 1 AND t.status != 'suspended'
    `).get(Number(decoded.id), Number(decoded.tenant_id));
    if (!user || user.role !== decoded.role) return null;
    return { ...user, tokenExpiresAt: decoded.exp };
  } catch {
    return null;
  }
}

function connectionKey(user) {
  return `staff:${user.id}`;
}

function registerStaffSocket(ws, user) {
  ws.userId = user.id;
  ws.userRole = user.role;
  ws.tenantId = user.tenant_id;
  ws.tokenExpiresAt = user.tokenExpiresAt;
  ws.connectionKey = connectionKey(user);
  ws.isAuthenticatedStaff = true;
  if (!staffConnections.has(ws.connectionKey)) staffConnections.set(ws.connectionKey, new Set());
  staffConnections.get(ws.connectionKey).add(ws);
}

function removeStaffSocket(ws) {
  if (!ws.connectionKey) return;
  const sockets = staffConnections.get(ws.connectionKey);
  if (!sockets) return;
  sockets.delete(ws);
  if (sockets.size === 0) staffConnections.delete(ws.connectionKey);
  ws.connectionKey = null;
  ws.isAuthenticatedStaff = false;
}

// An open socket is not a permanent authorization grant. Recheck the current
// office/account and token lifetime before delivering sensitive notifications.
function isAuthorizedSocket(ws) {
  if (!ws.isAuthenticatedStaff || ws.readyState !== WebSocket.OPEN) return false;
  const user = db.prepare(`SELECT u.role FROM users u JOIN tenants t ON t.id = u.tenant_id
    WHERE u.id = ? AND u.tenant_id = ? AND u.is_active = 1
      AND t.is_active = 1 AND t.status != 'suspended'`).get(ws.userId, ws.tenantId);
  if (!user || user.role !== ws.userRole || !['admin', 'lawyer'].includes(user.role)
      || !Number.isFinite(ws.tokenExpiresAt) || ws.tokenExpiresAt <= Date.now() / 1000) {
    removeStaffSocket(ws);
    ws.close(1008, 'انتهت صلاحية الوصول');
    return false;
  }
  return true;
}

/**
 * Initialize WebSocket server on the shared HTTP server
 */
export function initWebSocketServer(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: 16 * 1024 });

  wss.on('connection', (ws, req) => {
    try {
      // Parse token from query string: /ws?token=...
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');

      const staffUser = token ? authenticateStaffToken(token) : null;
      if (!staffUser) {
        ws.close(1008, 'مصادقة الموظف مطلوبة');
        return;
      }

      registerStaffSocket(ws, staffUser);
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          // Permit staff re-authentication without allowing account-type changes.
          if (data.type === 'AUTH' && data.token) {
            const reauthenticatedUser = authenticateStaffToken(data.token);
            if (!reauthenticatedUser) {
              ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'رمز الدخول غير صالح' }));
              ws.close(1008, 'مصادقة الموظف مطلوبة');
              return;
            }
            removeStaffSocket(ws);
            registerStaffSocket(ws, reauthenticatedUser);
            ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', userId: ws.userId }));
          }
        } catch (e) {
          // ignore malformed client payloads
        }
      });

      ws.on('close', () => {
        removeStaffSocket(ws);
      });

      // Send initial welcome
      ws.send(JSON.stringify({ type: 'CONNECTED', message: 'متصل بخادم الإشعارات اللحظية' }));
    } catch (err) {
      console.error('WebSocket connection error:', err);
    }
  });

  // Heartbeat ping interval to clean dead sockets
  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (!isAuthorizedSocket(ws)) return;
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  console.log('⚡ خادم الاتصال اللحظي WebSockets جاهز على المسار /ws');
  return wss;
}

/**
 * Broadcast event to all connected clients
 */
export function broadcastEvent(eventType, payload, tenantId) {
  // Require an explicit office scope; a global staff broadcast would cross tenants.
  if (!wss || !Number.isSafeInteger(Number(tenantId)) || Number(tenantId) <= 0) return;
  const message = JSON.stringify({ type: eventType, data: payload, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (Number(client.tenantId) === Number(tenantId) && isAuthorizedSocket(client)) {
      client.send(message);
    }
  });
}

/**
 * Send real-time event to a specific user
 */
export function sendToUser(userId, eventType, payload) {
  if (!wss) return;
  const userSockets = staffConnections.get(`staff:${userId}`);
  if (!userSockets || userSockets.size === 0) return;

  const message = JSON.stringify({ type: eventType, data: payload, timestamp: new Date().toISOString() });
  userSockets.forEach((ws) => {
    if (isAuthorizedSocket(ws)) {
      ws.send(message);
    }
  });
}

export function disconnectUser(userId, reason = 'تم إيقاف دخول الحساب') {
  const userSockets = staffConnections.get(`staff:${userId}`);
  if (!userSockets) return;
  userSockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.close(1008, reason);
  });
}
