import { invoiceStatuses, invoiceTotal, nextInvoiceNumber, validateInvoiceInput } from '../domain/billing/invoice.js';
import { ApplicationError } from './ApplicationError.js';

export function createInvoiceService({ repository, canAccessCase, canAccessInvoice, sendEmail, logActivity, clock = () => new Date() }) {
  const fail = (code, message) => { throw new ApplicationError(code, message); };
  const tenant = user => user.tenant_id || 1;
  function input(body) {
    const error = validateInvoiceInput(body);
    if (error) fail('INVALID_INPUT', error);
  }
  function existing(user, id, byNumber = false) {
    const invoice = repository.find(id, tenant(user), byNumber);
    if (!invoice) fail('NOT_FOUND', 'الفاتورة غير موجودة');
    return invoice;
  }
  function links(user, caseId, clientId) {
    if (!canAccessCase(user, caseId)) fail('FORBIDDEN', 'ليس لديك صلاحية الوصول لهذه القضية');
    if (!repository.matchesClient(caseId, clientId, tenant(user))) fail('INVALID_INPUT', 'الموكل يجب أن ينتمي إلى المكتب وأن يكون مرتبطًا بالقضية المحددة');
  }
  return {
    list(user, caseId) { return repository.list(user, caseId); },
    get(user, id) {
      const invoice = existing(user, id, true);
      if (!canAccessInvoice(user, invoice)) fail('FORBIDDEN', 'ليس لديك صلاحية عرض هذه الفاتورة');
      const { client_email, ...details } = invoice;
      return { ...details, items: repository.items(invoice.id) };
    },
    create(user, body) {
      links(user, body.case_id, body.client_id);
      input(body);
      return repository.transaction(() => {
        const year = clock().getFullYear();
        const number = nextInvoiceNumber(repository.numbers(year), year);
        return repository.insert(user, body, number, invoiceTotal(body.items));
      });
    },
    update(user, id, body) {
      const invoice = existing(user, id);
      if (user.role !== 'admin' && invoice.created_by !== user.id) fail('FORBIDDEN', 'غير مصرح لك بتعديل هذه الفاتورة');
      links(user, body.case_id ?? invoice.case_id, body.client_id ?? invoice.client_id);
      input(body);
      repository.transaction(() => repository.update(id, tenant(user), body, body.items ? invoiceTotal(body.items) : invoice.total_amount));
    },
    setStatus(user, id, status) {
      const invoice = existing(user, id);
      if (!canAccessInvoice(user, invoice)) fail('FORBIDDEN', 'ليس لديك صلاحية تغيير حالة هذه الفاتورة');
      if (!invoiceStatuses.includes(status)) fail('INVALID_INPUT', 'حالة الفاتورة غير صالحة');
      repository.setStatus(id, tenant(user), status, status === 'paid' ? clock().toISOString().slice(0, 10) : null);
    },
    remove(user, id) {
      if (!['admin', 'super_admin'].includes(user.role)) fail('FORBIDDEN', 'غير مصرح لك');
      if (!repository.remove(id, tenant(user))) fail('NOT_FOUND', 'الفاتورة غير موجودة');
    },
    async send(user, id) {
      const invoice = existing(user, id);
      if (!canAccessInvoice(user, invoice)) fail('FORBIDDEN', 'ليس لديك صلاحية إرسال هذه الفاتورة');
      const result = await sendEmail({ invoice, client: { name: invoice.client_name, email: invoice.client_email }, items: repository.items(invoice.id) });
      if (invoice.status === 'draft') repository.markSent(invoice.id, tenant(user));
      logActivity(user.id, 'SEND_EMAIL', 'invoices', id, `تم إرسال الفاتورة ${invoice.invoice_number} بالبريد الإلكتروني إلى ${result.recipient}`, tenant(user));
      return result;
    }
  };
}
