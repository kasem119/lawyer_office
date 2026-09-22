import dgram from 'dgram';
import os from 'os';
import { PORT } from '../config.js';

const DISCOVERY_PORT = 41234;
const DISCOVERY_QUERY = 'DISCOVER_LAWYER_SERVER';
const SERVICE_SIGNATURE = 'lawyer-office-server';

let serverSocket = null;

// Get local IPv4 addresses of the server machine
export function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Skip internal (127.0.0.1) and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({
          interface: name,
          ip: net.address
        });
      }
    }
  }

  return addresses;
}

// Get the primary local IP address
export function getPrimaryLocalIp() {
  const addrs = getLocalIpAddresses();
  if (addrs.length > 0) {
    return addrs[0].ip;
  }
  return '127.0.0.1';
}

/**
 * Initialize the UDP broadcast discovery responder.
 * When client workstations broadcast a DISCOVERY_QUERY,
 * the server replies with its IP address, port, and service details.
 */
export function initDiscoveryService() {
  if (serverSocket) return;

  try {
    serverSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    serverSocket.on('error', (err) => {
      console.warn('[Discovery Service] Warning:', err.message);
    });

    serverSocket.on('message', (msg, rinfo) => {
      const messageText = msg.toString().trim();

      if (messageText === DISCOVERY_QUERY || messageText.includes(DISCOVERY_QUERY)) {
        const primaryIp = getPrimaryLocalIp();
        const responseData = JSON.stringify({
          signature: SERVICE_SIGNATURE,
          name: 'خادم منظومة مكتب المحاماة',
          port: PORT,
          ip: primaryIp,
          allIps: getLocalIpAddresses(),
          url: `http://${primaryIp}:${PORT}`,
          hostname: os.hostname(),
          timestamp: new Date().toISOString()
        });

        serverSocket.send(responseData, rinfo.port, rinfo.address, (err) => {
          if (!err) {
            console.log(`[Discovery Service] 📡 تم الرد على طلب اكتشاف من جهاز: ${rinfo.address}:${rinfo.port}`);
          }
        });
      }
    });

    serverSocket.bind(DISCOVERY_PORT, '0.0.0.0', () => {
      serverSocket.setBroadcast(true);
      console.log(`[Discovery Service] 📡 خدمة الاستكشاف الشبكي التلقائي مفعلة على المنفذ UDP:${DISCOVERY_PORT}`);
    });
  } catch (err) {
    console.error('[Discovery Service] Failed to initialize:', err.message);
  }
}

export function closeDiscoveryService() {
  if (serverSocket) {
    try {
      serverSocket.close();
    } catch {}
    serverSocket = null;
  }
}
