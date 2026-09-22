import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

let wss = null;
const clientConnections = new Map(); // userId -> Set<WebSocket>

/**
 * Initialize WebSocket server on the shared HTTP server
 */
export function initWebSocketServer(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    try {
      // Parse token from query string: /ws?token=...
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');

      let userId = null;
      let userRole = null;

      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          userId = decoded.id;
          userRole = decoded.role;
        } catch (e) {
          // Allow connection but unauthenticated
        }
      }

      ws.userId = userId;
      ws.userRole = userRole;
      ws.isAlive = true;

      if (userId) {
        if (!clientConnections.has(userId)) {
          clientConnections.set(userId, new Set());
        }
        clientConnections.get(userId).add(ws);
      }

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          // Handle client-side authentication message
          if (data.type === 'AUTH' && data.token) {
            try {
              const decoded = jwt.verify(data.token, JWT_SECRET);
              ws.userId = decoded.id;
              ws.userRole = decoded.role;
              if (!clientConnections.has(ws.userId)) {
                clientConnections.set(ws.userId, new Set());
              }
              clientConnections.get(ws.userId).add(ws);
              ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', userId: ws.userId }));
            } catch (err) {
              ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'رمز الدخول غير صالح' }));
            }
          }
        } catch (e) {
          // ignore malformed client payloads
        }
      });

      ws.on('close', () => {
        if (ws.userId && clientConnections.has(ws.userId)) {
          const userSet = clientConnections.get(ws.userId);
          userSet.delete(ws);
          if (userSet.size === 0) {
            clientConnections.delete(ws.userId);
          }
        }
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
export function broadcastEvent(eventType, payload) {
  if (!wss) return;
  const message = JSON.stringify({ type: eventType, data: payload, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Send real-time event to a specific user
 */
export function sendToUser(userId, eventType, payload) {
  if (!wss) return;
  const userSockets = clientConnections.get(userId);
  if (!userSockets || userSockets.size === 0) return;

  const message = JSON.stringify({ type: eventType, data: payload, timestamp: new Date().toISOString() });
  userSockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}
