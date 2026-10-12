import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { generatePDF } from '../services/exportService.js';
import { generateListHTML, generateCaseDetailsHTML } from '../templates/pdfTemplates.js';

// Render synthetic records with real Chromium; never access an office database.
const event = { title: 'جلسة اختبار <script>alert(1)</script>', date: '2026-10-11', time: '09:30', event_type: 'court_date' };
const columns = [{ header: 'الموعد', key: 'title' }, { header: 'التاريخ', key: 'date' }];
const caseHTML = generateCaseDetailsHTML({ title: 'قضية اختبار', opened_at: '2026-10-01' }, [], [event], []);
assert.ok(caseHTML.includes('09:30'));
assert.ok(caseHTML.includes(new Date(event.date).toLocaleDateString('ar-EG')));
assert.ok(caseHTML.includes(new Date('2026-10-01').toLocaleDateString('ar-EG')));
assert.ok(!caseHTML.includes('Invalid Date'));
assert.ok(caseHTML.includes('&lt;script&gt;'));

for (const [name, html] of [
  ['events', generateListHTML('جدول المواعيد', columns, Array.from({ length: 100 }, () => event))],
  ['case', caseHTML]
]) {
  const buffer = await generatePDF(html);
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
  assert.ok(buffer.length > 1000);
  const app = express();
  app.get('/export', (req, res) => res.type('pdf').send(buffer));
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/export`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/pdf/);
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(body.subarray(0, 5).toString(), '%PDF-');
    assert.equal(body.length, buffer.length);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  console.log(`PASS ${name}: real PDF rendering and HTTP binary download (${buffer.length} bytes)`);
}
