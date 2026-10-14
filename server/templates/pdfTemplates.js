import fs from 'fs';
import path from 'path';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

const getBaseStyles = () => `
  <style>
    body {
      font-family: Arial, 'DejaVu Sans', sans-serif;
      direction: rtl;
      margin: 0;
      padding: 0;
      color: #333;
    }
    .container {
      padding: 20px;
    }
    h1, h2, h3 {
      color: #1e3a8a;
      margin-bottom: 15px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: right;
      overflow-wrap: anywhere;
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    h1, h2, h3 { break-after: avoid; }
    th {
      background-color: #f3f4f6;
      font-weight: bold;
      color: #111827;
    }
    .badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10px;
      background: #e5e7eb;
      display: inline-block;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .mt-4 { margin-top: 1.5rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .text-gray { color: #6b7280; }
  </style>
`;

export const generateListHTML = (title, columns, data) => {
  const headers = columns.map(col => `<th>${escapeHtml(col.header)}</th>`).join('');
  const rows = data.map(item => {
    const cells = columns.map(col => `<td>${escapeHtml(item[col.key])}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      ${getBaseStyles()}
    </head>
    <body>
      <div class="container">
        <h1 class="text-center mb-2">${escapeHtml(title)}</h1>
        <p class="text-center text-gray mb-2">تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}</p>
        
        <table class="mt-4">
          <thead>
            <tr>${headers}</tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;
};

export const generateCaseDetailsHTML = (caseData, notes, events, tasks) => {
  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      ${getBaseStyles()}
      <style>
        .section { margin-bottom: 20px; padding: 15px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; }
        .row { display: flex; flex-wrap: wrap; margin-bottom: 10px; }
        .col { flex: 1; min-width: 200px; }
        .label { font-weight: bold; color: #4b5563; font-size: 12px; }
        .value { font-size: 14px; margin-top: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="text-center">ملف القضية: ${escapeHtml(caseData.title || '')}</h1>
        <p class="text-center text-gray">رقم القضية: ${escapeHtml(caseData.case_number || 'غير محدد')}</p>
        
        <div class="section mt-4">
          <h3>البيانات الأساسية</h3>
          <div class="row">
            <div class="col"><div class="label">الموكل</div><div class="value">${escapeHtml(caseData.client_name || '')}</div></div>
            <div class="col"><div class="label">الخصم</div><div class="value">${escapeHtml(caseData.opponent_name || 'غير محدد')}</div></div>
          </div>
          <div class="row">
            <div class="col"><div class="label">المحكمة</div><div class="value">${escapeHtml(caseData.court_name || 'غير محدد')}</div></div>
            <div class="col"><div class="label">الحالة</div><div class="value">${escapeHtml(caseData.status || '')}</div></div>
          </div>
          <div class="row">
            <div class="col"><div class="label">تاريخ فتح الملف</div><div class="value">${caseData.opened_at ? new Date(caseData.opened_at).toLocaleDateString('ar-EG') : '-'}</div></div>
          </div>
        </div>

        ${events && events.length > 0 ? `
        <div class="section">
          <h3>الجلسات القادمة والسابقة</h3>
          <table>
            <thead><tr><th>العنوان</th><th>التاريخ</th><th>الوقت</th><th>النوع</th></tr></thead>
            <tbody>
              ${events.map(e => `
                <tr>
                  <td>${escapeHtml(e.title)}</td>
                  <td>${e.date ? new Date(e.date).toLocaleDateString('ar-EG') : '-'}</td>
                  <td>${escapeHtml(e.time || '-')}</td>
                  <td>${escapeHtml(e.event_type === 'court_date' ? 'جلسة محكمة' : 'موعد')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${notes && notes.length > 0 ? `
        <div class="section">
          <h3>سجل الملاحظات والتطورات</h3>
          <table>
            <thead><tr><th>تاريخ الإضافة</th><th>النوع</th><th>المحتوى</th><th>أضيف بواسطة</th></tr></thead>
            <tbody>
              ${notes.map(n => `
                <tr>
                  <td>${new Date(n.created_at).toLocaleDateString('ar-EG')}</td>
                  <td>${escapeHtml(n.note_type)}</td>
                  <td>${escapeHtml(n.content)}</td>
                  <td>${escapeHtml(n.created_by_name || 'النظام')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;
};

export const generateInvoiceHTML = (invoice, items) => {
  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      ${getBaseStyles()}
      <style>
        .invoice-header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; }
        .total-box { background: #f3f4f6; padding: 15px; border-radius: 8px; width: 250px; text-align: left; float: left; }
        .total-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
        .total-final { font-size: 18px; font-weight: bold; color: #1e3a8a; border-top: 1px solid #ddd; padding-top: 5px; margin-top: 5px; }
        .clearfix::after { content: ""; clear: both; display: table; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="invoice-header">
          <div>
            <h1>فاتورة أتعاب ومصروفات</h1>
            <p>رقم الفاتورة: <strong>${escapeHtml(invoice.invoice_number)}</strong></p>
            <p>تاريخ الإصدار: ${new Date(invoice.created_at).toLocaleDateString('ar-EG')}</p>
            ${invoice.due_date ? `<p>تاريخ الاستحقاق: ${new Date(invoice.due_date).toLocaleDateString('ar-EG')}</p>` : ''}
          </div>
          <div style="text-align: left">
            <h3>موجهة إلى:</h3>
            <p><strong>${escapeHtml(invoice.client_name || '')}</strong></p>
            <p>القضية: ${escapeHtml(invoice.case_title || '')}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>الوصف</th>
              <th width="10%">الكمية</th>
              <th width="20%">سعر الوحدة</th>
              <th width="20%">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>${escapeHtml(item.description)}</td>
                <td>${escapeHtml(item.quantity)}</td>
                <td>${escapeHtml(item.unit_price)} ${escapeHtml(invoice.currency || 'SAR')}</td>
                <td>${escapeHtml(item.total)} ${escapeHtml(invoice.currency || 'SAR')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="clearfix mt-4">
          <div class="total-box">
            <div class="total-row"><span>الإجمالي:</span> <span>${escapeHtml(invoice.total_amount)} ${escapeHtml(invoice.currency || 'SAR')}</span></div>
            <div class="total-final"><span>الصافي المطلوب:</span> <span>${escapeHtml(invoice.total_amount)} ${escapeHtml(invoice.currency || 'SAR')}</span></div>
          </div>
        </div>
        
        ${invoice.notes ? `
        <div class="clearfix" style="margin-top: 100px;">
          <strong>ملاحظات:</strong>
          <p>${escapeHtml(invoice.notes)}</p>
        </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;
};
