import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import Modal from '../Shared/Modal';
import { Printer, CheckCircle2, AlertCircle, Scale, Building2, Phone, Calendar, Hash, FileText } from 'lucide-react';
import Button from '../Shared/Button';

export default function InvoiceViewModal({ invoiceId, isOpen, onClose, onStatusUpdated }) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (invoiceId && isOpen) {
      fetchInvoice();
    }
  }, [invoiceId, isOpen]);

  const fetchInvoice = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/invoices/${invoiceId}`);
      if (res.ok) {
        const json = await res.json();
        setInvoice(json.data);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || 'تعذر تحميل بيانات الفاتورة');
      }
    } catch (err) {
      console.error(err);
      setError('حدث خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async () => {
    try {
      const res = await apiFetch(`/invoices/${invoiceId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'paid' })
      });
      if (res.ok) {
        fetchInvoice();
        if (onStatusUpdated) onStatusUpdated();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = () => {
    if (!invoice) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
      return;
    }

    const itemsRows = (invoice.items || []).map((item, idx) => `
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${item.description || '-'}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${(Number(item.unit_price) || 0).toLocaleString()} د.ل</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${(Number(item.total) || 0).toLocaleString()} د.ل</td>
      </tr>
    `).join('');

    const statusLabel = {
      paid: 'مدفوعة بالكامل',
      sent: 'مرسلة للعميل',
      overdue: 'متأخرة عن السداد',
      draft: 'مسودة',
      cancelled: 'ملغاة'
    }[invoice.status] || invoice.status;

    const statusColor = invoice.status === 'paid' ? '#10b981' : invoice.status === 'overdue' ? '#ef4444' : '#d4a853';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>فاتورة أتعاب - ${invoice.invoice_number}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
          body {
            font-family: 'Cairo', Tahoma, Arial, sans-serif;
            margin: 0;
            padding: 30px;
            color: #1e293b;
            background: #fff;
            line-height: 1.6;
          }
          .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid #d4a853;
            padding-bottom: 20px;
            margin-bottom: 25px;
          }
          .title {
            color: #0f172a;
            font-size: 22px;
            font-weight: 800;
            margin: 0 0 6px 0;
          }
          .badge {
            display: inline-block;
            padding: 4px 14px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 13px;
            color: #fff;
            background: ${statusColor};
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px 20px;
            margin-bottom: 25px;
          }
          .info-item {
            font-size: 14px;
            margin-bottom: 6px;
          }
          .info-item strong {
            color: #475569;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          th {
            background: #0f172a;
            color: #f8fafc;
            padding: 10px;
            border: 1px solid #0f172a;
            font-size: 13px;
          }
          .total-box {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 30px;
          }
          .total-table {
            width: 280px;
            border: 1px solid #d4a853;
            background: #fffbeb;
            border-radius: 8px;
            padding: 14px;
            font-size: 16px;
            font-weight: 800;
            color: #92400e;
            text-align: center;
          }
          .notes-box {
            background: #f1f5f9;
            padding: 14px;
            border-radius: 6px;
            font-size: 13px;
            border-right: 4px solid #d4a853;
            margin-bottom: 40px;
          }
          .footer-sign {
            display: flex;
            justify-content: space-between;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px dashed #cbd5e1;
          }
          @media print {
            body { padding: 10px; }
            @page { margin: 15mm; size: A4; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-header">
          <div>
            <h1 class="title">مكتب المحاماة والاستشارات القانونية</h1>
            <div style="font-size: 13px; color: #64748b;">منظومة إدارة الشؤون القانونية والمرافعات</div>
            <div style="margin-top: 8px;">
              <span class="badge">${statusLabel}</span>
            </div>
          </div>
          <div style="text-align: left; direction: ltr;">
            <div style="font-size: 20px; font-weight: 800; color: #d4a853;">${invoice.invoice_number}</div>
            <div style="font-size: 13px; color: #64748b;">تاريخ الفاتورة: ${invoice.created_at ? invoice.created_at.split(' ')[0] : '-'}</div>
            <div style="font-size: 13px; color: #64748b;">تاريخ الاستحقاق: ${invoice.due_date || '-'}</div>
          </div>
        </div>

        <div class="info-grid">
          <div>
            <div class="info-item"><strong>الموكل / العميل:</strong> ${invoice.client_name || '-'}</div>
            <div class="info-item"><strong>رقم القضية:</strong> ${invoice.case_number || '-'}</div>
          </div>
          <div>
            <div class="info-item"><strong>موضوع القضية:</strong> ${invoice.case_title || '-'}</div>
            <div class="info-item"><strong>حالة السداد:</strong> ${statusLabel} ${invoice.paid_date ? `(سُددت في ${invoice.paid_date})` : ''}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>بيان الخدمة / الاستشارة / أتعاب الترافع</th>
              <th style="width: 70px;">الكمية</th>
              <th style="width: 110px;">سعر الوحدة</th>
              <th style="width: 120px;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="total-box">
          <div class="total-table">
            المجموع الإجمالي المطلوب:<br />
            <span style="font-size: 22px; color: #b45309;">${(Number(invoice.total_amount) || 0).toLocaleString()} د.ل</span>
          </div>
        </div>

        ${invoice.notes ? `
          <div class="notes-box">
            <strong>ملاحظات وشروط الدفع:</strong><br />
            ${invoice.notes}
          </div>
        ` : ''}

        <div class="footer-sign">
          <div style="text-align: center; width: 220px;">
            <strong>توقيع وختم الإدارة المالية للمكتب</strong><br /><br /><br />
            ..........................................
          </div>
          <div style="text-align: center; width: 220px;">
            <strong>استلام وتوقيع الموكل</strong><br /><br /><br />
            ..........................................
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return <span className="badge badge-active"><CheckCircle2 size={13} /> مدفوعة بالكامل</span>;
      case 'sent':
        return <span className="badge badge-medium">مرسلة للعميل</span>;
      case 'overdue':
        return <span className="badge badge-urgent"><AlertCircle size={13} /> متأخرة عن السداد</span>;
      case 'draft':
        return <span className="badge badge-low">مسودة</span>;
      case 'cancelled':
        return <span className="badge badge-closed">ملغاة</span>;
      default:
        return <span className="badge badge-low">{status}</span>;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="معاينة تفاصيل الفاتورة الرسمية" maxWidth="750px">
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>جاري تحميل الفاتورة...</div>
      ) : error ? (
        <div style={{ color: 'var(--error)', padding: '20px', textAlign: 'center' }}>{error}</div>
      ) : !invoice ? null : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '16px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ background: 'var(--primary-light)', padding: '10px', borderRadius: '50%', color: 'var(--primary)' }}>
                <FileText size={24} />
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)' }}>{invoice.invoice_number}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  تاريخ الإنشاء: {invoice.created_at ? invoice.created_at.split(' ')[0] : '-'}
                </div>
              </div>
            </div>
            <div>
              {getStatusBadge(invoice.status)}
            </div>
          </div>

          {/* Info Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', background: 'rgba(15,23,41,0.5)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>الموكل / العميل:</span>
              <div style={{ fontWeight: '700', color: 'var(--text-main)', marginTop: '2px' }}>{invoice.client_name || '-'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>القضية المرتبطة:</span>
              <div style={{ fontWeight: '700', color: 'var(--primary)', marginTop: '2px' }}>
                {invoice.case_number ? `${invoice.case_number} - ${invoice.case_title || ''}` : 'أتعاب عامة'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>تاريخ الاستحقاق:</span>
              <div style={{ fontWeight: '600', color: 'var(--text-main)', marginTop: '2px' }}>{invoice.due_date || 'غير محدد'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>تاريخ السداد:</span>
              <div style={{ fontWeight: '600', color: invoice.paid_date ? 'var(--success)' : 'var(--text-dim)', marginTop: '2px' }}>
                {invoice.paid_date || 'لم تسدد بعد'}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'var(--bg-table-header)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '12px' }}>#</th>
                  <th style={{ padding: '12px' }}>بيان الخدمة / أتعاب الترافع</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>الكمية</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>سعر الوحدة</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>المجموع</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.items || []).map((item, index) => (
                  <tr key={item.id || index} style={{ borderBottom: '1px solid var(--border-subtle)', background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '12px', color: 'var(--text-dim)' }}>{index + 1}</td>
                    <td style={{ padding: '12px', fontWeight: '600', color: 'var(--text-main)' }}>{item.description}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>{item.quantity}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>{(Number(item.unit_price) || 0).toLocaleString()} د.ل</td>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: '700', color: 'var(--text-main)' }}>{(Number(item.total) || 0).toLocaleString()} د.ل</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total Box */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ background: 'var(--primary-light)', padding: '14px 24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center', minWidth: '220px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>المبلغ الإجمالي المستحق</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--primary)' }}>
                {(Number(invoice.total_amount) || 0).toLocaleString()} د.ل
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', borderRight: '4px solid var(--primary)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-main)' }}>ملاحظات: </strong> {invoice.notes}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button icon={Printer} onClick={handlePrint}>
                طباعة / تصدير PDF
              </Button>
              {invoice.status !== 'paid' && (
                <Button variant="secondary" icon={CheckCircle2} onClick={handleMarkAsPaid} style={{ color: 'var(--success)' }}>
                  تحديد كمدفوعة الآن
                </Button>
              )}
            </div>
            <Button variant="secondary" onClick={onClose}>
              إغلاق
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
