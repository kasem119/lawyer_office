import express from 'express';
import os from 'os';
import { PORT } from '../config.js';
import { getLocalIpAddresses, getPrimaryLocalIp } from '../services/discoveryService.js';

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Lawyer Office Management Server'
  });
});

router.get('/discovery', (req, res) => {
  const primaryIp = getPrimaryLocalIp();
  res.json({
    signature: 'lawyer-office-server',
    name: 'خادم منظومة مكتب المحاماة',
    port: PORT,
    ip: primaryIp,
    allIps: getLocalIpAddresses(),
    hostname: os.hostname(),
    url: `http://${primaryIp}:${PORT}`,
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

export default router;

