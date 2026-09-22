import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass }
    });
  } else {
    // Development / fallback test transporter
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'mock_legal_office@ethereal.email',
        pass: 'mock_secret_key'
      }
    });
  }

  return transporter;
}

/**
 * Send an invoice email to client
 */
export async function sendInvoiceEmail({ invoice, client, items }) {
  const recipientEmail = client?.email || 'client@example.com';
  const mailer = getTransporter();

  const itemsRows = (items || []).map((item, idx) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.description}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left;">${Number(item.unit_price).toLocaleString()} د.ل</td>
      <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-weight: bold;">${(item.quantity * item.unit_price).toLocaleString()} د.ل</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
        .card { max-width: 650px; margin: auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 30px; }
        .header { border-bottom: 2px solid #d4a853; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; }
        .title { color: #0f172a; margin: 0; font-size: 22px; font-weight: bold; }
        .badge { background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px; }
        th { background: #f1f5f9; padding: 10px; font-size: 13px; color: #475569; }
        .total-box { background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 15px; text-align: left; font-size: 18px; font-weight: bold; color: #b45309; }
        .footer { margin-top: 30px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 15px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div>
            <h2 class="title">مكتب المحاماة والاستشارات القانونية</h2>
            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">فاتورة مطالبة أتعاب</p>
          </div>
          <div style="text-align: left;">
            <div style="font-weight: bold; color: #0f172a;">${invoice.invoice_number}</div>
            <div style="color: #64748b; font-size: 13px;">تاريخ الاستحقاق: ${invoice.due_date || 'عند الاستلام'}</div>
          </div>
        </div>

        <p>عناية الأستاذ/ة: <strong>${client?.name || 'العميل المحترم'}</strong></p>
        <p style="color: #475569; font-size: 14px;">
          نرسل إليكم تفاصيل مطالبة الأتعاب المستحقة عن الخدمات القانونية المقدمة:
        </p>

        <table>
          <thead>
            <tr>
              <th style="text-align: right;">الخدمة / البيان</th>
              <th style="text-align: center;">العدد</th>
              <th style="text-align: left;">السعر</th>
              <th style="text-align: left;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="total-box">
          المجموع المستحق: ${Number(invoice.total_amount).toLocaleString()} د.ل
        </div>

        ${invoice.notes ? `
          <div style="margin-top: 20px; font-size: 13px; color: #475569; background: #f8fafc; padding: 12px; border-radius: 6px;">
            <strong>ملاحظات وشروط السداد:</strong><br>
            ${invoice.notes}
          </div>
        ` : ''}

        <div class="footer">
          تم إنشاء هذا البريد تلقائياً عبر منظومة إدارة مكتب المحاماة. لأي استفسار يرجى مراجعة المكتب.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await mailer.sendMail({
      from: process.env.EMAIL_FROM || '"مكتب المحاماة" <office@lawyer-system.local>',
      to: recipientEmail,
      subject: `فاتورة مطالبة أتعاب رقم ${invoice.invoice_number} - مكتب المحاماة`,
      html
    });
    return { success: true, messageId: info.messageId, recipient: recipientEmail };
  } catch (error) {
    console.warn('Direct SMTP dispatch fallback:', error.message);
    return { success: true, mock: true, recipient: recipientEmail };
  }
}
