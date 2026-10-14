// SQLite adapter: queries and atomic persistence stay outside the application.
export function createInvoiceRepository(db) {
  const select = `SELECT i.*, c.case_number, c.title as case_title, cl.name as client_name, cl.email as client_email
    FROM invoices i LEFT JOIN cases c ON i.case_id=c.id LEFT JOIN clients cl ON i.client_id=cl.id`;
  function insertItems(id, items) {
    const statement = db.prepare('INSERT INTO invoice_items(invoice_id,description,quantity,unit_price,total) VALUES(?,?,?,?,?)');
    for (const item of items) statement.run(id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price);
  }
  return {
    transaction(fn) { return db.transaction(fn)(); },
    list(user, caseId) {
      let sql = select + ' WHERE i.tenant_id=?';
      const params = [user.tenant_id || 1];
      if (!['admin', 'super_admin'].includes(user.role)) {
        sql += ' AND (c.lead_lawyer_id=? OR EXISTS(SELECT 1 FROM case_lawyers cl2 WHERE cl2.case_id=c.id AND cl2.user_id=?) OR i.created_by=?)';
        params.push(user.id, user.id, user.id);
      }
      if (caseId) { sql += ' AND i.case_id=?'; params.push(caseId); }
      return db.prepare(sql + ' ORDER BY i.created_at DESC').all(...params).map(({ client_email, ...invoice }) => invoice);
    },
    find(id, tenantId, byNumber = false) {
      return byNumber
        ? db.prepare(select + ' WHERE (i.id=? OR i.invoice_number=?) AND i.tenant_id=?').get(id, id, tenantId)
        : db.prepare(select + ' WHERE i.id=? AND i.tenant_id=?').get(id, tenantId);
    },
    items(id) { return db.prepare('SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id ASC').all(id); },
    matchesClient(caseId, clientId, tenantId) {
      return Boolean(db.prepare('SELECT 1 FROM cases c JOIN clients cl ON cl.id=c.client_id WHERE c.id=? AND cl.id=? AND c.tenant_id=? AND cl.tenant_id=?').get(caseId, clientId, tenantId, tenantId));
    },
    numbers(year) { return db.prepare('SELECT invoice_number FROM invoices WHERE invoice_number LIKE ?').all(`INV-${year}-%`).map(row => row.invoice_number); },
    insert(user, body, number, total) {
      const { case_id, client_id, due_date, notes, items = [] } = body;
      const result = db.prepare(`INSERT INTO invoices(invoice_number,case_id,client_id,total_amount,status,due_date,notes,created_by,tenant_id)
        VALUES(?,?,?,?,'draft',?,?,?,?)`).run(number, case_id, client_id, total, due_date, notes || '', user.id, user.tenant_id || 1);
      insertItems(result.lastInsertRowid, items);
      return result.lastInsertRowid;
    },
    update(id, tenantId, body, total) {
      const { case_id, client_id, due_date, notes, status, items } = body;
      db.prepare(`UPDATE invoices SET case_id=COALESCE(?,case_id),client_id=COALESCE(?,client_id),total_amount=?,
        due_date=COALESCE(?,due_date),notes=COALESCE(?,notes),status=COALESCE(?,status),
        paid_date=CASE WHEN ? IS NULL THEN paid_date WHEN ?='paid' THEN COALESCE(paid_date,date('now')) ELSE NULL END
        WHERE id=? AND tenant_id=?`).run(case_id, client_id, total, due_date, notes, status, status, status, id, tenantId);
      if (items) { db.prepare('DELETE FROM invoice_items WHERE invoice_id=?').run(id); insertItems(id, items); }
    },
    setStatus(id, tenantId, status, paidDate) { db.prepare('UPDATE invoices SET status=?,paid_date=? WHERE id=? AND tenant_id=?').run(status, paidDate, id, tenantId); },
    remove(id, tenantId) { return db.prepare('DELETE FROM invoices WHERE id=? AND tenant_id=?').run(id, tenantId).changes; },
    markSent(id, tenantId) { db.prepare("UPDATE invoices SET status='sent' WHERE id=? AND tenant_id=?").run(id, tenantId); }
  };
}
