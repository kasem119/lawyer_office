import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { Plus, Trash2, CheckCircle2, AlertCircle, FileText, Eye, Printer, FileSpreadsheet, Edit2, Mail } from 'lucide-react';
import InvoiceForm from './InvoiceForm';
import InvoiceViewModal from './InvoiceViewModal';
import Button from '../Shared/Button';
import { downloadBlob } from '../../utils/exportUtils';

export default function InvoiceList() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [exportingList, setExportingList] = useState(false);
  const [exportingId, setExportingId] = useState(null);
  const [sendingEmailId, setSendingEmailId] = useState(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/invoices');
      if (res.ok) {
        const json = await res.json();
        const data = json.data || [];
        setInvoices(data);
        const revenue = data
          .filter(i => i.status === 'paid')
          .reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
        setTotalRevenue(revenue);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportList = async () => {
    setExportingList(true);
    try {
      const res = await apiFetch('/exports/finance?format=excel');
      if (res.ok) {
        const blob = await res.blob();
        downloadBlob(blob, 'finance_report.xlsx');
      } else {
        alert('فشل التصدير');
      }
    } catch (err) {
      alert('خطأ في التصدير');
    } finally {
      setExportingList(false);
    }
  };

  const handleExportInvoice = async (id, number) => {
    setExportingId(id);
    try {
      const res = await apiFetch(`/exports/invoices/${id}`);
      if (res.ok) {
        const blob = await res.blob();
        downloadBlob(blob, `invoice_${number}.pdf`);
      } else {
        alert('فشل التصدير');
      }
    } catch (err) {
      alert('خطأ في التصدير');
    } finally {
      setExportingId(null);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return;
    try {
      const res = await apiFetch(`/invoices/${id}`, { method: 'DELETE' });
      if (res.ok) fetchInvoices();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const res = await apiFetch(`/invoices/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) fetchInvoices();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendEmail = async (id, number) => {
    setSendingEmailId(id);
    try {
      const res = await apiFetch(`/invoices/${id}/send-email`, { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        alert(json.message || 'تم إرسال الفاتورة بنجاح عبر البريد الإلكتروني');
      } else {
        alert(json.message || 'فشل إرسال الفاتورة بالبريد');
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم أثناء إرسال البريد');
    } finally {
      setSendingEmailId(null);
    }
  };

  const filteredInvoices = filterStatus === 'all' 
    ? invoices 
    : invoices.filter(i => i.status === filterStatus);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return <span className="badge badge-active"><CheckCircle2 size={12} /> مدفوعة</span>;
      case 'sent':
        return <span className="badge badge-medium">مرسلة</span>;
      case 'overdue':
        return <span className="badge badge-urgent"><AlertCircle size={12} /> متأخرة</span>;
      case 'draft':
        return <span className="badge badge-low">مسودة</span>;
      case 'cancelled':
        return <span className="badge badge-closed">ملغاة</span>;
      default:
        return <span className="badge badge-low">{status}</span>;
    }
  };

  if (showForm) {
    return (
      <div className="glass-card" style={{ padding: '24px' }}>
        <InvoiceForm 
          initialData={editingInvoice}
          onSaved={() => { setShowForm(false); setEditingInvoice(null); fetchInvoices(); }}
          onCancel={() => { setShowForm(false); setEditingInvoice(null); }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div className="glass-card" style={{ padding: '10px 18px', border: '1px solid var(--success)', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>إجمالي المبالغ المحصلة:</span>
            <span style={{ color: 'var(--success)', fontWeight: '800', fontSize: '1.2rem' }}>{totalRevenue.toLocaleString()} د.ل</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button icon={FileSpreadsheet} variant="secondary" onClick={handleExportList} disabled={exportingList}>
            {exportingList ? 'جاري التصدير...' : 'تصدير التقرير المالي (Excel)'}
          </Button>
          <Button icon={Plus} onClick={() => setShowForm(true)}>إنشاء فاتورة جديدة</Button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '600' }}>تصفية حسب الحالة:</label>
        <select 
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="form-select"
          style={{ width: 'auto', minWidth: '160px', padding: '6px 12px' }}
        >
          <option value="all">جميع الحالات</option>
          <option value="draft">مسودة</option>
          <option value="sent">مرسلة للعميل</option>
          <option value="paid">مدفوعة</option>
          <option value="overdue">متأخرة عن السداد</option>
          <option value="cancelled">ملغاة</option>
        </select>
      </div>

      <div className="glass-card" style={{ overflow: 'auto' }}>
        {loading ? (
          <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>جاري تحميل الفواتير...</p>
        ) : filteredInvoices.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>لا توجد فواتير مسجلة</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '14px' }}>رقم الفاتورة</th>
                <th style={{ padding: '14px' }}>الموكل</th>
                <th style={{ padding: '14px' }}>القضية</th>
                <th style={{ padding: '14px' }}>المبلغ الإجمالي</th>
                <th style={{ padding: '14px' }}>تاريخ الاستحقاق</th>
                <th style={{ padding: '14px' }}>الحالة</th>
                <th style={{ padding: '14px' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map(inv => (
                <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="table-row-hover">
                  <td style={{ padding: '14px', fontWeight: '700', color: 'var(--primary)' }}>{inv.invoice_number}</td>
                  <td style={{ padding: '14px', color: 'var(--text-main)' }}>{inv.client_name || '-'}</td>
                  <td style={{ padding: '14px', color: 'var(--text-main)' }}>{inv.case_title || inv.case_number || '-'}</td>
                  <td style={{ padding: '14px', fontWeight: '700', color: 'var(--text-main)' }}>{(Number(inv.total_amount) || 0).toLocaleString()} د.ل</td>
                  <td style={{ padding: '14px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{inv.due_date || 'غير محدد'}</td>
                  <td style={{ padding: '14px' }}>
                    {getStatusBadge(inv.status)}
                  </td>
                  <td style={{ padding: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button 
                      onClick={() => handleExportInvoice(inv.id, inv.invoice_number)}
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)' }}
                      title="تصدير PDF"
                      disabled={exportingId === inv.id}
                    >
                      <Printer size={14} />
                      {exportingId === inv.id ? '...' : 'PDF'}
                    </button>
                    <button 
                      onClick={() => { setSelectedInvoiceId(inv.id); setIsViewModalOpen(true); }}
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)' }}
                      title="معاينة الفاتورة"
                    >
                      <Eye size={14} />
                      معاينة
                    </button>
                    <button 
                      onClick={() => { setEditingInvoice(inv); setShowForm(true); }}
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title="تعديل الفاتورة"
                    >
                      <Edit2 size={14} />
                      تعديل
                    </button>
                    <button 
                      onClick={() => handleSendEmail(inv.id, inv.invoice_number)}
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      title="إرسال الفاتورة بالبريد"
                      disabled={sendingEmailId === inv.id}
                    >
                      <Mail size={14} />
                      {sendingEmailId === inv.id ? '...' : 'إرسال'}
                    </button>
                    {inv.status !== 'paid' && (
                      <button 
                        onClick={() => handleUpdateStatus(inv.id, 'paid')}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--success)' }}
                        title="تحديد كمدفوعة"
                      >
                        تحصيل
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(inv.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
                      title="حذف"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isViewModalOpen && (
        <InvoiceViewModal
          invoiceId={selectedInvoiceId}
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedInvoiceId(null);
          }}
          onStatusUpdated={fetchInvoices}
        />
      )}
    </div>
  );
}
