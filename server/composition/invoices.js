import db from '../database/db.js';
import { canAccessCase, canAccessInvoice } from '../middleware/permissions.js';
import { sendInvoiceEmail } from '../services/emailService.js';
import { logActivity } from '../services/auditService.js';
import { createInvoiceRepository } from '../infrastructure/repositories/invoiceRepository.js';
import { createInvoiceService } from '../application/invoiceService.js';
export const invoices = createInvoiceService({
  repository: createInvoiceRepository(db), canAccessCase, canAccessInvoice,
  sendEmail: sendInvoiceEmail, logActivity
});
