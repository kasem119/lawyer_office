import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendInvoiceEmail } from '../services/emailService.js';
import { logActivity } from '../services/auditService.js';
import { canAccessInvoice } from '../middleware/permissions.js';

const router = express.Router();
router.use(authenticateToken);

// GET /api/invoices
router.get('/', (req, res, next) => {
  try {
    let sql = `
      SELECT i.*, c.case_number, c.title as case_title, cl.name as client_name 
      FROM invoices i
      LEFT JOIN cases c ON i.case_id = c.id
      LEFT JOIN clients cl ON i.client_id = cl.id
    `;
    let params = [];
    const conditions = [];
    
    if (req.user.role !== 'admin') {
      // Lawyer sees invoices for their cases
      conditions.push(`(c.lead_lawyer_id = ? OR EXISTS (SELECT 1 FROM case_lawyers cl2 WHERE cl2.case_id = c.id AND cl2.user_id = ?))`);
      params.push(req.user.id, req.user.id);
    }

    if (req.query.case_id) {
      conditions.push(`i.case_id = ?`);
      params.push(req.query.case_id);
    }
    
    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }
    
    sql += ` ORDER BY i.created_at DESC`;
    
    const stmt = db.prepare(sql);
    const invoices = stmt.all(...params);
    
    res.json({ success: true, data: invoices });
  } catch (err) {
    next(err);
  }
});

// GET /api/invoices/:id
router.get('/:id', (req, res, next) => {
  try {
    const invoiceStmt = db.prepare(`
      SELECT i.*, c.case_number, c.title as case_title, cl.name as client_name 
      FROM invoices i
      LEFT JOIN cases c ON i.case_id = c.id
      LEFT JOIN clients cl ON i.client_id = cl.id
      WHERE i.id = ? OR i.invoice_number = ?
    `);
    const invoice = invoiceStmt.get(req.params.id, req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    }

    if (!canAccessInvoice(req.user, invoice)) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية عرض هذه الفاتورة' });
    }
    
    const itemsStmt = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC');
    const items = itemsStmt.all(invoice.id);
    
    invoice.items = items;
    
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
});

// POST /api/invoices
router.post('/', (req, res, next) => {
  try {
    const { case_id, client_id, due_date, notes, items } = req.body;
    
    // Auto-generate invoice_number
    const year = new Date().getFullYear();
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM invoices WHERE invoice_number LIKE ?');
    const { count } = countStmt.get(`INV-${year}-%`);
    const nnn = String(count + 1).padStart(3, '0');
    const invoice_number = `INV-${year}-${nnn}`;
    
    let total_amount = 0;
    if (items && Array.isArray(items)) {
      items.forEach(item => {
        total_amount += (item.quantity * item.unit_price);
      });
    }
    
    const insertInvoice = db.prepare(`
      INSERT INTO invoices (invoice_number, case_id, client_id, total_amount, status, due_date, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = insertInvoice.run(invoice_number, case_id, client_id, total_amount, 'draft', due_date, notes || '', req.user.id);
    const invoice_id = info.lastInsertRowid;
    
    if (items && Array.isArray(items)) {
      const insertItem = db.prepare(`
        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      items.forEach(item => {
        const item_total = item.quantity * item.unit_price;
        insertItem.run(invoice_id, item.description, item.quantity, item.unit_price, item_total);
      });
    }
    
    res.json({ success: true, message: 'تم إنشاء الفاتورة بنجاح', data: { id: invoice_id } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/invoices/:id/status
router.put('/:id/status', (req, res, next) => {
  try {
    const { status } = req.body;
    const invoice_id = req.params.id;
    
    let paid_date = null;
    if (status === 'paid') {
      paid_date = new Date().toISOString().split('T')[0];
    }
    
    const updateStmt = db.prepare(`
      UPDATE invoices SET status = ?, paid_date = ? WHERE id = ?
    `);
    updateStmt.run(status, paid_date, invoice_id);
    
    res.json({ success: true, message: 'تم تحديث حالة الفاتورة بنجاح' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/invoices/:id - Edit invoice details and line items
router.put('/:id', (req, res, next) => {
  try {
    const invoice_id = req.params.id;
    const { case_id, client_id, due_date, notes, items, status } = req.body;

    const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    }

    if (req.user.role !== 'admin' && existing.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بتعديل هذه الفاتورة' });
    }

    let total_amount = existing.total_amount;
    if (items && Array.isArray(items)) {
      total_amount = items.reduce((sum, it) => sum + (Number(it.quantity || 1) * Number(it.unit_price || 0)), 0);
    }

    // Execute within transaction
    const updateTx = db.transaction(() => {
      db.prepare(`
        UPDATE invoices
        SET case_id = COALESCE(?, case_id),
            client_id = COALESCE(?, client_id),
            total_amount = ?,
            due_date = COALESCE(?, due_date),
            notes = COALESCE(?, notes),
            status = COALESCE(?, status)
        WHERE id = ?
      `).run(case_id, client_id, total_amount, due_date, notes, status, invoice_id);

      if (items && Array.isArray(items)) {
        db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoice_id);
        const insertItem = db.prepare(`
          INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const it of items) {
          const itemTotal = Number(it.quantity || 1) * Number(it.unit_price || 0);
          insertItem.run(invoice_id, it.description, it.quantity || 1, it.unit_price, itemTotal);
        }
      }
    });

    updateTx();

    res.json({ success: true, message: 'تم تحديث بيانات الفاتورة بنجاح' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'غير مصرح لك' });
    }
    
    const invoice_id = req.params.id;
    
    const delInvoice = db.prepare('DELETE FROM invoices WHERE id = ?');
    delInvoice.run(invoice_id);
    // invoice_items will be cascade deleted
    
    res.json({ success: true, message: 'تم حذف الفاتورة بنجاح' });
  } catch (err) {
    next(err);
  }
});

// POST /api/invoices/:id/send-email - Dispatch invoice via email
router.post('/:id/send-email', async (req, res, next) => {
  try {
    const invoice_id = req.params.id;
    const invoiceStmt = db.prepare(`
      SELECT i.*, c.case_number, c.title as case_title, cl.name as client_name, cl.email as client_email 
      FROM invoices i
      LEFT JOIN cases c ON i.case_id = c.id
      LEFT JOIN clients cl ON i.client_id = cl.id
      WHERE i.id = ?
    `);
    const invoice = invoiceStmt.get(invoice_id);

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    }

    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoice_id);

    const client = {
      name: invoice.client_name,
      email: invoice.client_email
    };

    const result = await sendInvoiceEmail({ invoice, client, items });

    // Update status to 'sent' if currently 'draft'
    if (invoice.status === 'draft') {
      db.prepare("UPDATE invoices SET status = 'sent' WHERE id = ?").run(invoice_id);
    }

    logActivity(
      req.user.id,
      'SEND_EMAIL',
      'invoices',
      invoice_id,
      `تم إرسال الفاتورة ${invoice.invoice_number} بالبريد الإلكتروني إلى ${result.recipient}`
    );

    res.json({
      success: true,
      message: `تم إرسال الفاتورة بنجاح إلى ${result.recipient}`,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
