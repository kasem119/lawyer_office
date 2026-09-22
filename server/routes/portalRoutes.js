import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../database/db.js';
import { JWT_SECRET } from '../config.js';
import { hashSearchTerm } from '../services/encryptionService.js';

const router = express.Router();

// Client Portal Authentication Middleware
function authenticateClientToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول إلى بوابة الموكل' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err || user.role !== 'client') {
      return res.status(403).json({ success: false, message: 'جلسة الموكل غير صالحة أو منتهية' });
    }
    req.clientUser = user;
    next();
  });
}

// POST /api/portal/login - Authenticate client by phone / national_id
router.post('/login', (req, res, next) => {
  try {
    const { identifier } = req.body;
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال رقم الهاتف أو الرقم الوطني' });
    }

    const trimmed = identifier.trim();
    const idHash = hashSearchTerm(trimmed);

    // Look up client by phone or national_id_hash
    const client = db.prepare(`
      SELECT id, name, phone, email 
      FROM clients 
      WHERE phone = ? OR national_id_hash = ?
    `).get(trimmed, idHash);

    if (!client) {
      return res.status(404).json({ success: false, message: 'لم يتم العثور على ملف موكل مسجل بهذه البيانات' });
    }

    // Generate client token valid for 7 days
    const clientToken = jwt.sign(
      { id: client.id, name: client.name, role: 'client' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: `مرحباً بك ${client.name}`,
      token: clientToken,
      client: {
        id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/portal/overview - Client dashboard summary
router.get('/overview', authenticateClientToken, (req, res, next) => {
  try {
    const clientId = req.clientUser.id;

    // Cases
    const cases = db.prepare(`
      SELECT c.id, c.case_number, c.title, c.case_type, c.status, c.court, c.opened_at,
             u.name as lead_lawyer_name
      FROM cases c
      LEFT JOIN users u ON c.lead_lawyer_id = u.id
      WHERE c.client_id = ?
      ORDER BY c.opened_at DESC
    `).all(clientId);

    // Upcoming events / sessions
    const events = db.prepare(`
      SELECT e.id, e.title, e.date, e.time, e.location, e.event_type, c.case_number, c.title as case_title
      FROM events e
      JOIN cases c ON e.case_id = c.id
      WHERE c.client_id = ? AND e.date >= date('now')
      ORDER BY e.date ASC
      LIMIT 10
    `).all(clientId);

    // Invoices
    const invoices = db.prepare(`
      SELECT i.id, i.invoice_number, i.total_amount, i.status, i.due_date, i.paid_date, c.case_number, c.title as case_title
      FROM invoices i
      JOIN cases c ON i.case_id = c.id
      WHERE i.client_id = ?
      ORDER BY i.created_at DESC
    `).all(clientId);

    res.json({
      success: true,
      data: {
        client: req.clientUser,
        cases,
        upcoming_events: events,
        invoices
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/portal/invoices/:id - Detailed invoice for client
router.get('/invoices/:id', authenticateClientToken, (req, res, next) => {
  try {
    const clientId = req.clientUser.id;
    const invoiceId = req.params.id;

    const invoice = db.prepare(`
      SELECT i.*, c.case_number, c.title as case_title
      FROM invoices i
      JOIN cases c ON i.case_id = c.id
      WHERE i.id = ? AND i.client_id = ?
    `).get(invoiceId, clientId);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    }

    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId);
    invoice.items = items;

    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
});

export default router;
