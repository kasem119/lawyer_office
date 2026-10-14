import assert from 'node:assert/strict';
import test from 'node:test';
import { invoiceTotal, nextInvoiceNumber, validateInvoiceInput } from '../../domain/billing/invoice.js';
import { createInvoiceService } from '../../application/invoiceService.js';

test('Invoice numbering uses the highest suffix in its year despite gaps and unrelated records', () => {
  assert.equal(nextInvoiceNumber(['INV-2026-001', 'INV-2026-003', 'INV-2025-999', 'INV-2026-invalid'], 2026), 'INV-2026-004');
});
test('Billing rejects malformed or overflowing totals and accepts a free valid item', () => {
  assert.equal(invoiceTotal([{ quantity: 2, unit_price: 15 }]), 30);
  assert.equal(validateInvoiceInput({ items: [{ description: 'Free work', quantity: 1, unit_price: 0 }] }), null);
  for (const items of [null, [null], [{ description: 'Bad', quantity: 0, unit_price: 1 }], [{ description: 'Bad', quantity: 2, unit_price: Number.MAX_VALUE }]]) assert.ok(validateInvoiceInput({ items }));
});
test('Use case rejects inaccessible cases before invoking persistence', () => {
  const service = createInvoiceService({ repository: { insert() { assert.fail('Must not write'); } }, canAccessCase: () => false });
  assert.throws(() => service.create({ id: 1, tenant_id: 1 }, { case_id: 2, client_id: 3 }), error => error.code === 'FORBIDDEN');
});
test('Failed email delivery leaves invoice draft and does not record a success audit', async () => {
  const service = createInvoiceService({
    repository: { find: () => ({ id: 1, status: 'draft' }), items: () => [], markSent() { assert.fail('Must remain draft'); } },
    canAccessInvoice: () => true, sendEmail: async () => { throw new Error('Delivery unavailable'); },
    logActivity() { assert.fail('Must not record success'); }
  });
  await assert.rejects(service.send({ id: 1, tenant_id: 1 }, 1), /Delivery unavailable/);
});
