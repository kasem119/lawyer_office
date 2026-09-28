import db from '../database/db.js';

console.log('--- Starting Database Cleanup ---');

// 1. Remove corrupted/typo task
const delTasks = db.prepare(`DELETE FROM tasks WHERE title = 'dsfdsfdsfds' OR case_id = 7`).run();
console.log('Deleted junk tasks:', delTasks.changes);

// 2. Remove corrupted invoices and their items
const delItems = db.prepare(`DELETE FROM invoice_items WHERE invoice_id IN (4, 5)`).run();
console.log('Deleted junk invoice items:', delItems.changes);

const delInvoices = db.prepare(`DELETE FROM invoices WHERE id IN (4, 5) OR case_id = 7 OR client_id = 5`).run();
console.log('Deleted junk invoices:', delInvoices.changes);

// 3. Remove case_lawyers for case 7
const delCaseLawyers = db.prepare(`DELETE FROM case_lawyers WHERE case_id = 7`).run();
console.log('Deleted case_lawyers links for case 7:', delCaseLawyers.changes);

// 4. Remove case 7 ('rqdm lo]vhj')
const delCase = db.prepare(`DELETE FROM cases WHERE id = 7 OR title = 'rqdm lo]vhj'`).run();
console.log('Deleted junk case:', delCase.changes);

// 5. Remove client 5 ('ljkljklj')
const delClient = db.prepare(`DELETE FROM clients WHERE id = 5 OR name = 'ljkljklj'`).run();
console.log('Deleted junk client:', delClient.changes);

// 6. Clean activities associated with junk
try {
  const delActivities = db.prepare(`DELETE FROM activities WHERE description LIKE '%ljkljklj%' OR description LIKE '%rqdm%'`).run();
  console.log('Cleaned activities:', delActivities.changes);
} catch (e) {
  // If activities table has different column
}

console.log('--- Database Cleanup Completed Successfully ---');
