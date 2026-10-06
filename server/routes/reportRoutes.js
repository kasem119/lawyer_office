import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

function getTenantId(req) {
  return req.user.tenant_id || 1;
}

// GET /api/reports/overview - Accessible to all authenticated users
router.get('/overview', authenticateToken, (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const isLawyer = req.user.role !== 'admin' && req.user.role !== 'super_admin';
    const lawyerId = req.user.id;

    let caseFilter = ` WHERE cases.tenant_id = ?`;
    let caseParams = [tenantId];
    if (isLawyer) {
      caseFilter += ` AND (lead_lawyer_id = ? OR EXISTS (SELECT 1 FROM case_lawyers cl WHERE cl.case_id = cases.id AND cl.user_id = ?))`;
      caseParams.push(lawyerId, lawyerId);
    }

    const caseStats = db.prepare(`SELECT status, COUNT(*) as count FROM cases ${caseFilter} GROUP BY status`).all(...caseParams);
    
    let totalClients = 0;
    if (isLawyer) {
      const clientRow = db.prepare(`
        SELECT COUNT(DISTINCT client_id) as count FROM cases 
        WHERE cases.tenant_id = ? AND (lead_lawyer_id = ? OR EXISTS (SELECT 1 FROM case_lawyers cl WHERE cl.case_id = cases.id AND cl.user_id = ?))
      `).get(tenantId, lawyerId, lawyerId);
      totalClients = clientRow ? clientRow.count : 0;
    } else {
      totalClients = db.prepare(`SELECT COUNT(*) as count FROM clients WHERE tenant_id = ?`).get(tenantId).count;
    }

    let taskFilter = ` WHERE tasks.tenant_id = ?`;
    let taskParams = [tenantId];
    if (isLawyer) {
      taskFilter += ` AND assigned_to = ?`;
      taskParams.push(lawyerId);
    }
    const taskStats = db.prepare(`SELECT status, COUNT(*) as count FROM tasks ${taskFilter} GROUP BY status`).all(...taskParams);
    
    const today = new Date().toISOString().split('T')[0];
    const next7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const next30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    let eventUserCondition = isLawyer ? ' AND user_id = ?' : '';
    let eventParams7 = isLawyer ? [tenantId, today, next7Days, lawyerId] : [tenantId, today, next7Days];
    let eventParams30 = isLawyer ? [tenantId, today, next30Days, lawyerId] : [tenantId, today, next30Days];

    const events7DaysRow = db.prepare(`SELECT COUNT(*) as count FROM events WHERE tenant_id = ? AND date >= ? AND date <= ?${eventUserCondition}`).get(...eventParams7);
    const events30DaysRow = db.prepare(`SELECT COUNT(*) as count FROM events WHERE tenant_id = ? AND date >= ? AND date <= ?${eventUserCondition}`).get(...eventParams30);
    const events7Days = events7DaysRow ? events7DaysRow.count : 0;
    const events30Days = events30DaysRow ? events30DaysRow.count : 0;
    
    const totalDocsRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM documents d
      JOIN cases c ON d.case_id = c.id
      WHERE c.tenant_id = ?
    `).get(tenantId);
    const totalDocuments = totalDocsRow ? totalDocsRow.count : 0;
    
    let monthCondition = isLawyer ? ` AND (lead_lawyer_id = ? OR EXISTS (SELECT 1 FROM case_lawyers cl WHERE cl.case_id = cases.id AND cl.user_id = ?))` : '';
    let monthParams = isLawyer ? [tenantId, lawyerId, lawyerId] : [tenantId];

    const casesThisMonthRow = db.prepare(`SELECT COUNT(*) as count FROM cases WHERE tenant_id = ? AND opened_at >= date('now', 'start of month')${monthCondition}`).get(...monthParams);
    const casesLastMonthRow = db.prepare(`SELECT COUNT(*) as count FROM cases WHERE tenant_id = ? AND opened_at >= date('now', 'start of month', '-1 month') AND opened_at < date('now', 'start of month')${monthCondition}`).get(...monthParams);
    const casesThisMonth = casesThisMonthRow ? casesThisMonthRow.count : 0;
    const casesLastMonth = casesLastMonthRow ? casesLastMonthRow.count : 0;

    res.json({
      success: true,
      data: {
        cases: caseStats,
        total_clients: totalClients,
        tasks: taskStats,
        upcoming_events: {
          next_7_days: events7Days,
          next_30_days: events30Days
        },
        total_documents: totalDocuments,
        cases_trend: {
          this_month: casesThisMonth,
          last_month: casesLastMonth
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/lawyer-performance - Accessible to all (Lawyer sees self, Admin sees all of this tenant)
router.get('/lawyer-performance', authenticateToken, (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    let lawyersSql = `SELECT id, name, role FROM users WHERE role = 'lawyer' AND tenant_id = ?`;
    let lawyersParams = [tenantId];

    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      lawyersSql += ` AND id = ?`;
      lawyersParams.push(req.user.id);
    }
    
    const lawyers = db.prepare(lawyersSql).all(...lawyersParams);
    
    const performance = lawyers.map(lawyer => {
      const leadCases = db.prepare(`SELECT COUNT(*) as count FROM cases WHERE lead_lawyer_id = ? AND tenant_id = ?`).get(lawyer.id, tenantId).count;
      const assignedCases = db.prepare(`SELECT COUNT(*) as count FROM case_lawyers cl JOIN cases c ON cl.case_id = c.id WHERE cl.user_id = ? AND c.tenant_id = ?`).get(lawyer.id, tenantId).count;
      
      const tasksTotal = db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE assigned_to = ? AND tenant_id = ?`).get(lawyer.id, tenantId).count;
      const tasksCompleted = db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE assigned_to = ? AND status = 'done' AND tenant_id = ?`).get(lawyer.id, tenantId).count;
      
      const completionRate = tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;
      
      return {
        id: lawyer.id,
        name: lawyer.name,
        total_cases: leadCases + assignedCases,
        tasks_total: tasksTotal,
        tasks_completed: tasksCompleted,
        completion_rate: completionRate
      };
    });
    
    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/financial-summary - Accessible to all (Scoped by tenant)
router.get('/financial-summary', authenticateToken, (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const isLawyer = req.user.role !== 'admin' && req.user.role !== 'super_admin';
    const lawyerId = req.user.id;

    let invoiceJoin = '';
    let invoiceWhere = ' WHERE i.tenant_id = ?';
    let invoiceParams = [tenantId];

    if (isLawyer) {
      invoiceJoin = ' JOIN cases c ON i.case_id = c.id';
      invoiceWhere += ' AND (c.lead_lawyer_id = ? OR EXISTS (SELECT 1 FROM case_lawyers cl2 WHERE cl2.case_id = c.id AND cl2.user_id = ?))';
      invoiceParams.push(lawyerId, lawyerId);
    }

    const invoicedAmount = db.prepare(`
      SELECT i.status, SUM(i.total_amount) as total 
      FROM invoices i ${invoiceJoin} ${invoiceWhere} 
      GROUP BY i.status
    `).all(...invoiceParams);

    let totalPaid = 0;
    let totalPending = 0;
    invoicedAmount.forEach(row => {
      if (row.status === 'paid') totalPaid += Number(row.total || 0);
      else if (row.status === 'sent' || row.status === 'overdue') totalPending += Number(row.total || 0);
    });

    let expensesWhere = ' WHERE expenses.tenant_id = ?';
    let expensesParams = [tenantId];
    if (isLawyer) {
      expensesWhere += ` AND case_id IN (SELECT id FROM cases WHERE tenant_id = ? AND (lead_lawyer_id = ? OR EXISTS (SELECT 1 FROM case_lawyers cl WHERE cl.case_id = cases.id AND cl.user_id = ?)))`;
      expensesParams.push(tenantId, lawyerId, lawyerId);
    }

    let expensesAmount = 0;
    try {
      const expRow = db.prepare(`SELECT SUM(amount) as total FROM expenses ${expensesWhere}`).get(...expensesParams);
      expensesAmount = Number(expRow?.total || 0);
    } catch (e) {
      expensesAmount = 0;
    }

    const netProfit = totalPaid - expensesAmount;

    let monthWhere = `WHERE i.tenant_id = ? AND i.status = 'paid' AND i.created_at >= date('now', '-6 months')`;
    let monthParams = [tenantId];
    if (isLawyer) {
      monthWhere += ` AND (c.lead_lawyer_id = ? OR EXISTS (SELECT 1 FROM case_lawyers cl2 WHERE cl2.case_id = c.id AND cl2.user_id = ?))`;
      monthParams.push(lawyerId, lawyerId);
    }

    const revenueByMonth = db.prepare(`
      SELECT strftime('%Y-%m', i.created_at) as month, SUM(i.total_amount) as revenue
      FROM invoices i
      ${invoiceJoin}
      ${monthWhere}
      GROUP BY month
      ORDER BY month ASC
    `).all(...monthParams);

    let topCasesWhere = `WHERE i.tenant_id = ? AND i.status = 'paid'`;
    let topCasesParams = [tenantId];
    if (isLawyer) {
      topCasesWhere += ` AND (c.lead_lawyer_id = ? OR EXISTS (SELECT 1 FROM case_lawyers cl2 WHERE cl2.case_id = c.id AND cl2.user_id = ?))`;
      topCasesParams.push(lawyerId, lawyerId);
    }

    const topCases = db.prepare(`
      SELECT c.id, c.title, c.case_number, SUM(i.total_amount) as total_revenue
      FROM cases c
      JOIN invoices i ON c.id = i.case_id
      ${topCasesWhere}
      GROUP BY c.id
      ORDER BY total_revenue DESC
      LIMIT 5
    `).all(...topCasesParams);

    res.json({
      success: true,
      data: {
        invoiced: invoicedAmount,
        total_paid: totalPaid,
        total_pending: totalPending,
        total_expenses: expensesAmount,
        net_profit: netProfit,
        revenue_by_month: revenueByMonth,
        top_cases_by_revenue: topCases
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/case-types - Accessible to all (Scoped by tenant)
router.get('/case-types', authenticateToken, (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const types = db.prepare(`SELECT case_type, COUNT(*) as count FROM cases WHERE tenant_id = ? GROUP BY case_type`).all(tenantId);
    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    next(error);
  }
});

export default router;
