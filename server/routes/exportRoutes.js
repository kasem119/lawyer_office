import express from 'express';
import { generateExcel, generatePDF } from '../services/exportService.js';
import { 
  generateListHTML, 
  generateCaseDetailsHTML, 
  generateInvoiceHTML 
} from '../templates/pdfTemplates.js';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { canAccessCase, canAccessInvoice } from '../middleware/permissions.js';
import { decryptText } from '../services/encryptionService.js';

const router = express.Router();
router.use(authenticateToken);

function getTenantId(req) {
  return req.user.tenant_id || 1;
}

// Helper to translate status
const statusMap = {
  'active': 'نشطة',
  'closed': 'مغلقة',
  'pending': 'قيد الانتظار',
  'completed': 'مكتملة',
  'draft': 'مسودة',
  'sent': 'مرسلة',
  'paid': 'مدفوعة',
  'overdue': 'متأخرة',
  'cancelled': 'ملغاة'
};

// 1. Export Cases List
router.get('/cases', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { format } = req.query; // 'pdf' or 'excel'
    let casesSql = `
      SELECT cases.*, clients.name as client_name, users.name as lawyer_name 
      FROM cases 
      LEFT JOIN clients ON cases.client_id = clients.id
      LEFT JOIN users ON cases.lead_lawyer_id = users.id
      WHERE cases.tenant_id = ?
    `;
    const casesParams = [tenantId];
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      casesSql += `
        AND (cases.lead_lawyer_id = ?
           OR EXISTS (SELECT 1 FROM case_lawyers WHERE case_lawyers.case_id = cases.id AND case_lawyers.user_id = ?))
      `;
      casesParams.push(req.user.id, req.user.id);
    }
    casesSql += ` ORDER BY cases.opened_at DESC`;
    const cases = db.prepare(casesSql).all(...casesParams);

    const data = cases.map(c => ({
      case_number: c.case_number || '-',
      title: c.title,
      client: c.client_name || '-',
      lawyer: c.lawyer_name || '-',
      status: statusMap[c.status] || c.status,
      date: c.opened_at ? new Date(c.opened_at).toLocaleDateString('ar-EG') : '-'
    }));

    const columns = [
      { header: 'رقم القضية', key: 'case_number', width: 15 },
      { header: 'عنوان القضية', key: 'title', width: 30 },
      { header: 'الموكل', key: 'client', width: 25 },
      { header: 'المحامي المسؤول', key: 'lawyer', width: 25 },
      { header: 'الحالة', key: 'status', width: 15 },
      { header: 'تاريخ الإضافة', key: 'date', width: 15 }
    ];

    if (format === 'excel') {
      const buffer = await generateExcel(columns, data, 'القضايا');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=cases.xlsx');
      return res.send(buffer);
    } 
    
    // PDF
    const html = generateListHTML('قائمة القضايا', columns, data);
    const buffer = await generatePDF(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=cases.pdf');
    return res.send(buffer);
    
  } catch (error) {
    console.error('Export Cases Error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء تصدير القضايا' });
  }
});

// 2. Export Single Case Details (PDF only usually)
router.get('/cases/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const caseId = req.params.id;
    const caseData = db.prepare(`
      SELECT cases.*, clients.name as client_name 
      FROM cases 
      LEFT JOIN clients ON cases.client_id = clients.id
      WHERE cases.id = ? AND cases.tenant_id = ?
    `).get(caseId, tenantId);

    if (!caseData) return res.status(404).json({ success: false, message: 'القضية غير موجودة' });
    if (!canAccessCase(req.user, caseId)) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية تصدير هذه القضية' });
    }
    caseData.status = statusMap[caseData.status] || caseData.status;

    const notes = db.prepare(`
      SELECT case_notes.*, users.name as created_by_name 
      FROM case_notes 
      LEFT JOIN users ON case_notes.created_by = users.id 
      WHERE case_id = ?
      ${req.user.role === 'admin' ? '' : 'AND (is_private = 0 OR created_by = ?)'}
      ORDER BY created_at DESC
    `).all(...(req.user.role === 'admin' ? [caseId] : [caseId, req.user.id]));

    const events = db.prepare(`SELECT * FROM events WHERE case_id = ? AND tenant_id = ? ORDER BY date DESC`).all(caseId, tenantId);
    
    const tasks = db.prepare(`SELECT * FROM tasks WHERE case_id = ? AND tenant_id = ? ORDER BY due_date DESC`).all(caseId, tenantId);

    const html = generateCaseDetailsHTML(caseData, notes, events, tasks);
    const buffer = await generatePDF(html);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=case_${caseId}.pdf`);
    return res.send(buffer);
  } catch (error) {
    console.error('Export Case Details Error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء تصدير تفاصيل القضية' });
  }
});

// 3. Export Clients List
router.get('/clients', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { format } = req.query;
    let clientsSql = `SELECT * FROM clients WHERE tenant_id = ?`;
    const clientsParams = [tenantId];
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      clientsSql += `
        AND id IN (
          SELECT DISTINCT c.id FROM clients c
          JOIN cases ca ON ca.client_id = c.id
          LEFT JOIN case_lawyers cl ON cl.case_id = ca.id
          WHERE ca.lead_lawyer_id = ? OR cl.user_id = ?
        )
      `;
      clientsParams.push(req.user.id, req.user.id);
    }
    clientsSql += ` ORDER BY created_at DESC`;
    const clients = db.prepare(clientsSql).all(...clientsParams);

    const data = clients.map(c => ({
      name: c.name,
      id_number: decryptText(c.national_id_encrypted) || '-',
      phone: c.phone || '-',
      email: c.email || '-',
      type: c.client_type === 'individual' ? 'فرد' : 'شركة',
      date: c.created_at ? new Date(c.created_at).toLocaleDateString('ar-EG') : '-'
    }));

    const columns = [
      { header: 'الاسم', key: 'name', width: 30 },
      { header: 'رقم الهوية/السجل', key: 'id_number', width: 20 },
      { header: 'رقم الهاتف', key: 'phone', width: 20 },
      { header: 'البريد الإلكتروني', key: 'email', width: 25 },
      { header: 'النوع', key: 'type', width: 15 },
      { header: 'تاريخ الإضافة', key: 'date', width: 15 }
    ];

    if (format === 'excel') {
      const buffer = await generateExcel(columns, data, 'العملاء');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=clients.xlsx');
      return res.send(buffer);
    } 
    
    const html = generateListHTML('قائمة العملاء والموكلين', columns, data);
    const buffer = await generatePDF(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=clients.pdf');
    return res.send(buffer);
  } catch (error) {
    console.error('Export Clients Error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء تصدير العملاء' });
  }
});

// 4. Export Tasks List
router.get('/tasks', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { format } = req.query;
    let tasksSql = `
      SELECT tasks.*, cases.title as case_title, users.name as assigned_name 
      FROM tasks 
      LEFT JOIN cases ON tasks.case_id = cases.id
      LEFT JOIN users ON tasks.assigned_to = users.id
      WHERE tasks.tenant_id = ?
    `;
    const tasksParams = [tenantId];
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      tasksSql += `
        AND (tasks.assigned_to = ? OR tasks.created_by = ? OR cases.lead_lawyer_id = ?
           OR EXISTS (SELECT 1 FROM case_lawyers cl WHERE cl.case_id = cases.id AND cl.user_id = ?))
      `;
      tasksParams.push(req.user.id, req.user.id, req.user.id, req.user.id);
    }
    tasksSql += ` ORDER BY tasks.due_date ASC`;
    const tasks = db.prepare(tasksSql).all(...tasksParams);

    const data = tasks.map(t => ({
      title: t.title,
      case: t.case_title || '-',
      assigned: t.assigned_name || '-',
      status: statusMap[t.status] || t.status,
      priority: t.priority === 'high' ? 'عالية' : t.priority === 'medium' ? 'متوسطة' : 'منخفضة',
      due_date: t.due_date ? new Date(t.due_date).toLocaleDateString('ar-EG') : '-'
    }));

    const columns = [
      { header: 'المهمة', key: 'title', width: 30 },
      { header: 'القضية المرتبطة', key: 'case', width: 25 },
      { header: 'المكلف بها', key: 'assigned', width: 20 },
      { header: 'الحالة', key: 'status', width: 15 },
      { header: 'الأولوية', key: 'priority', width: 15 },
      { header: 'تاريخ الاستحقاق', key: 'due_date', width: 15 }
    ];

    if (format === 'excel') {
      const buffer = await generateExcel(columns, data, 'المهام');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=tasks.xlsx');
      return res.send(buffer);
    } 
    
    const html = generateListHTML('سجل المهام', columns, data);
    const buffer = await generatePDF(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=tasks.pdf');
    return res.send(buffer);
  } catch (error) {
    console.error('Export Tasks Error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء تصدير المهام' });
  }
});

// 5. Export Single Invoice
router.get('/invoices/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const invoiceId = req.params.id;
    const invoice = db.prepare(`
      SELECT invoices.*, clients.name as client_name, cases.title as case_title 
      FROM invoices 
      LEFT JOIN clients ON invoices.client_id = clients.id
      LEFT JOIN cases ON invoices.case_id = cases.id
      WHERE invoices.id = ? AND invoices.tenant_id = ?
    `).get(invoiceId, tenantId);

    if (!invoice) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    if (!canAccessInvoice(req.user, invoice)) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية تصدير هذه الفاتورة' });
    }

    const items = db.prepare(`SELECT * FROM invoice_items WHERE invoice_id = ?`).all(invoiceId);

    const html = generateInvoiceHTML(invoice, items);
    const buffer = await generatePDF(html);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoice.invoice_number}.pdf`);
    return res.send(buffer);
  } catch (error) {
    console.error('Export Invoice Error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء تصدير الفاتورة' });
  }
});

// 6. Export Events / Court Dates
router.get('/events', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { format, week } = req.query;
    
    let eventsSql = `
      SELECT e.*, c.case_number, c.title as case_title, u.name as lawyer_name
      FROM events e
      LEFT JOIN cases c ON e.case_id = c.id
      JOIN users u ON e.user_id = u.id
      WHERE e.tenant_id = ?
    `;
    const eventsParams = [tenantId];
    
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      eventsSql += `
        AND (e.user_id = ? OR c.lead_lawyer_id = ? 
             OR EXISTS (SELECT 1 FROM case_lawyers cl WHERE cl.case_id = c.id AND cl.user_id = ?))
      `;
      eventsParams.push(req.user.id, req.user.id, req.user.id);
    }

    if (week === 'current' || week === 'next') {
      const today = new Date();
      const currentDay = today.getDay(); // 0 is Sunday
      const diffToSunday = currentDay; 
      
      const currentWeekStart = new Date(today);
      currentWeekStart.setDate(today.getDate() - diffToSunday);
      
      let startDate, endDate;
      if (week === 'current') {
        startDate = new Date(currentWeekStart);
        endDate = new Date(currentWeekStart);
        endDate.setDate(endDate.getDate() + 6);
      } else if (week === 'next') {
        startDate = new Date(currentWeekStart);
        startDate.setDate(startDate.getDate() + 7);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
      }
      
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      
      eventsSql += ` AND e.date >= ? AND e.date <= ?`;
      eventsParams.push(startStr, endStr);
    }
    
    eventsSql += ` ORDER BY e.date ASC, e.time ASC`;
    const events = db.prepare(eventsSql).all(...eventsParams);

    const data = events.map(e => ({
      title: e.title,
      event_type: e.event_type === 'court_date' ? 'جلسة محكمة' : 'موعد',
      case_title: e.case_title || '-',
      date: e.date ? new Date(e.date).toLocaleDateString('ar-EG') : '-',
      time: e.time || '-',
      location: e.location || '-'
    }));

    const columns = [
      { header: 'الحدث', key: 'title', width: 30 },
      { header: 'النوع', key: 'event_type', width: 15 },
      { header: 'القضية', key: 'case_title', width: 25 },
      { header: 'التاريخ', key: 'date', width: 15 },
      { header: 'الوقت', key: 'time', width: 15 },
      { header: 'المكان', key: 'location', width: 20 }
    ];

    if (format === 'excel') {
      const buffer = await generateExcel(columns, data, 'المواعيد');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=events.xlsx');
      return res.send(buffer);
    } 
    
    const html = generateListHTML('جدول مواعيد المحكمة والاجتماعات', columns, data);
    const buffer = await generatePDF(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=events.pdf');
    return res.send(buffer);
  } catch (error) {
    console.error('Export Events Error:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء تصدير المواعيد' });
  }
});

export default router;
