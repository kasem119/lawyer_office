import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { Receipt, Plus, Eye, Clock, DollarSign, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import Button from '../Shared/Button';
import InvoiceViewModal from '../Finance/InvoiceViewModal';
import InvoiceForm from '../Finance/InvoiceForm';
import Modal from '../Shared/Modal';

export default function CaseFinancials({ caseId, clientId, caseNumber, caseTitle, clientName }) {
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active subtab: 'invoices' | 'expenses' | 'time'
  const [subTab, setSubTab] = useState('invoices');

  // Modals
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);

  // Expense form state
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    category: 'court_fees',
    date: new Date().toISOString().split('T')[0]
  });

  // Time form state
  const [timeForm, setTimeForm] = useState({
    description: '',
    duration_hours: '',
    duration_minutes: '',
    date: new Date().toISOString().split('T')[0],
    billable: true
  });

  const fetchData = async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const [invRes, expRes, timeRes] = await Promise.all([
        apiFetch(`/invoices?case_id=${caseId}`),
        apiFetch(`/expenses?case_id=${caseId}`),
        apiFetch(`/time-entries?case_id=${caseId}`)
      ]);

      if (invRes.ok) {
        const json = await invRes.json();
        setInvoices(json.data || []);
      }
      if (expRes.ok) {
        const json = await expRes.json();
        setExpenses(json.data || []);
      }
      if (timeRes.ok) {
        const json = await timeRes.json();
        setTimeEntries(json.data || []);
      }
    } catch (err) {
      console.error('Error loading case financials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [caseId]);

  // Handle submit new expense for this case
  const handleCreateExpense = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          case_id: caseId,
          ...expenseForm,
          amount: Number(expenseForm.amount)
        })
      });
      if (res.ok) {
        setIsExpenseModalOpen(false);
        setExpenseForm({
          description: '',
          amount: '',
          category: 'court_fees',
          date: new Date().toISOString().split('T')[0]
        });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle submit new time entry for this case
  const handleCreateTimeEntry = async (e) => {
    e.preventDefault();
    const h = parseInt(timeForm.duration_hours) || 0;
    const m = parseInt(timeForm.duration_minutes) || 0;
    const totalMinutes = (h * 60) + m;
    if (totalMinutes <= 0) return alert('يرجى إدخال مدة صحيحة');

    try {
      const res = await apiFetch('/time-entries', {
        method: 'POST',
        body: JSON.stringify({
          case_id: caseId,
          description: timeForm.description,
          duration_minutes: totalMinutes,
          date: timeForm.date,
          billable: timeForm.billable ? 1 : 0
        })
      });
      if (res.ok) {
        setIsTimeModalOpen(false);
        setTimeForm({
          description: '',
          duration_hours: '',
          duration_minutes: '',
          date: new Date().toISOString().split('T')[0],
          billable: true
        });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Calculations
  const totalInvoiced = invoices.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalMinutes = timeEntries.reduce((sum, t) => sum + (Number(t.duration_minutes) || 0), 0);
  const billableMinutes = timeEntries.filter(t => t.billable === 1 || t.billable === true).reduce((sum, t) => sum + (Number(t.duration_minutes) || 0), 0);

  const formatHours = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h} س ${m > 0 ? m + ' د' : ''}`;
  };

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '10px', borderRadius: '10px' }}>
            <Receipt size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>إجمالي الأتعاب المفوترة</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)' }}>{totalInvoiced.toLocaleString()} د.ل</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--success)', background: 'rgba(16, 185, 129, 0.08)' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', padding: '10px', borderRadius: '10px' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>الأتعاب المحصلة</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--success)' }}>{totalPaid.toLocaleString()} د.ل</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--warning)', background: 'rgba(245, 158, 11, 0.08)' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.2)', color: 'var(--warning)', padding: '10px', borderRadius: '10px' }}>
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>المصروفات القضائية</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--warning)' }}>{totalExpenses.toLocaleString()} د.ل</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--info)', padding: '10px', borderRadius: '10px' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ساعات العمل المسجلة</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)' }}>{formatHours(totalMinutes)}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--success)' }}>{formatHours(billableMinutes)} خاضعة للفوترة</div>
          </div>
        </div>
      </div>

      {/* Subtabs Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setSubTab('invoices')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: subTab === 'invoices' ? 'var(--primary-light)' : 'transparent',
              color: subTab === 'invoices' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: subTab === 'invoices' ? '700' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.9rem'
            }}
          >
            <Receipt size={16} />
            الفواتير ({invoices.length})
          </button>

          <button
            onClick={() => setSubTab('expenses')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: subTab === 'expenses' ? 'var(--primary-light)' : 'transparent',
              color: subTab === 'expenses' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: subTab === 'expenses' ? '700' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.9rem'
            }}
          >
            <DollarSign size={16} />
            المصروفات والرسوم ({expenses.length})
          </button>

          <button
            onClick={() => setSubTab('time')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: subTab === 'time' ? 'var(--primary-light)' : 'transparent',
              color: subTab === 'time' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: subTab === 'time' ? '700' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.9rem'
            }}
          >
            <Clock size={16} />
            تتبع الوقت ({timeEntries.length})
          </button>
        </div>

        {/* Action Button for active subtab */}
        <div>
          {subTab === 'invoices' && (
            <Button icon={Plus} onClick={() => setIsInvoiceFormOpen(true)} style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
              إنشاء فاتورة للقضية
            </Button>
          )}
          {subTab === 'expenses' && (
            <Button icon={Plus} onClick={() => setIsExpenseModalOpen(true)} style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
              تسجيل مصروف قضائي
            </Button>
          )}
          {subTab === 'time' && (
            <Button icon={Plus} onClick={() => setIsTimeModalOpen(true)} style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
              تسجيل ساعات عمل
            </Button>
          )}
        </div>
      </div>

      {/* Subtab Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>جاري تحميل البيانات المالية...</div>
      ) : (
        <div>
          {/* Invoices List */}
          {subTab === 'invoices' && (
            <div className="glass-card" style={{ overflow: 'auto' }}>
              {invoices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  لا توجد فواتير مسجلة لهذه القضية حتى الآن
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '12px' }}>رقم الفاتورة</th>
                      <th style={{ padding: '12px' }}>تاريخ الاستحقاق</th>
                      <th style={{ padding: '12px' }}>المبلغ الإجمالي</th>
                      <th style={{ padding: '12px' }}>الحالة</th>
                      <th style={{ padding: '12px' }}>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px', fontWeight: '700', color: 'var(--primary)' }}>{inv.invoice_number}</td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{inv.due_date || '-'}</td>
                        <td style={{ padding: '12px', fontWeight: '700', color: 'var(--text-main)' }}>{(Number(inv.total_amount) || 0).toLocaleString()} د.ل</td>
                        <td style={{ padding: '12px' }}>{getStatusBadge(inv.status)}</td>
                        <td style={{ padding: '12px' }}>
                          <button
                            onClick={() => { setSelectedInvoiceId(inv.id); setIsViewModalOpen(true); }}
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)' }}
                          >
                            <Eye size={13} />
                            معاينة وطباعة
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Expenses List */}
          {subTab === 'expenses' && (
            <div className="glass-card" style={{ overflow: 'auto' }}>
              {expenses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  لا توجد مصروفات مسجلة لهذه القضية
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '12px' }}>التاريخ</th>
                      <th style={{ padding: '12px' }}>البيان والتفاصيل</th>
                      <th style={{ padding: '12px' }}>التصنيف</th>
                      <th style={{ padding: '12px' }}>المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(exp => (
                      <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{exp.date}</td>
                        <td style={{ padding: '12px', fontWeight: '600', color: 'var(--text-main)' }}>{exp.description}</td>
                        <td style={{ padding: '12px' }}><span className="badge badge-medium">{exp.category}</span></td>
                        <td style={{ padding: '12px', fontWeight: '700', color: 'var(--warning)' }}>{(Number(exp.amount) || 0).toLocaleString()} د.ل</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Time Entries List */}
          {subTab === 'time' && (
            <div className="glass-card" style={{ overflow: 'auto' }}>
              {timeEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  لا توجد ساعات مسجلة لهذه القضية
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '12px' }}>التاريخ</th>
                      <th style={{ padding: '12px' }}>المحامي</th>
                      <th style={{ padding: '12px' }}>العمل المنجز</th>
                      <th style={{ padding: '12px' }}>المدة</th>
                      <th style={{ padding: '12px' }}>نوع الساعات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeEntries.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.date}</td>
                        <td style={{ padding: '12px', fontWeight: '600', color: 'var(--text-main)' }}>{t.lawyer_name || '-'}</td>
                        <td style={{ padding: '12px', color: 'var(--text-main)' }}>{t.description}</td>
                        <td style={{ padding: '12px', fontWeight: '700', color: 'var(--text-main)' }}>{formatHours(Number(t.duration_minutes) || 0)}</td>
                        <td style={{ padding: '12px' }}>
                          {t.billable ? <span className="badge badge-active">خاضع للفوترة</span> : <span className="badge badge-low">غير خاضع</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Printable Invoice Modal */}
      {isViewModalOpen && (
        <InvoiceViewModal
          invoiceId={selectedInvoiceId}
          isOpen={isViewModalOpen}
          onClose={() => { setIsViewModalOpen(false); setSelectedInvoiceId(null); }}
          onStatusUpdated={fetchData}
        />
      )}

      {/* Invoice Form Modal */}
      {isInvoiceFormOpen && (
        <Modal isOpen={isInvoiceFormOpen} onClose={() => setIsInvoiceFormOpen(false)} title={`إنشاء فاتورة للقضية ${caseNumber}`} maxWidth="750px">
          <InvoiceForm
            onSaved={() => { setIsInvoiceFormOpen(false); fetchData(); }}
            onCancel={() => setIsInvoiceFormOpen(false)}
          />
        </Modal>
      )}

      {/* Add Expense Modal */}
      {isExpenseModalOpen && (
        <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title="تسجيل مصروف قضائي" maxWidth="500px">
          <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">المبلغ (د.ل) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                className="form-input"
                placeholder="0.00"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">التصنيف *</label>
              <select
                className="form-select"
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
              >
                <option value="court_fees">رسوم محكمة</option>
                <option value="travel">سفر وتنقلات</option>
                <option value="consultation">استشارات وخبرة</option>
                <option value="printing">طباعة وتصوير</option>
                <option value="communication">اتصالات</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">التاريخ *</label>
              <input
                type="date"
                required
                className="form-input"
                value={expenseForm.date}
                onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">بيان المصروف *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="تفاصيل سداد الرسوم..."
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <Button type="submit">حفظ المصروف</Button>
              <Button type="button" variant="secondary" onClick={() => setIsExpenseModalOpen(false)}>إلغاء</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Log Time Modal */}
      {isTimeModalOpen && (
        <Modal isOpen={isTimeModalOpen} onClose={() => setIsTimeModalOpen(false)} title="تسجيل ساعات عمل على القضية" maxWidth="500px">
          <form onSubmit={handleCreateTimeEntry} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group">
                <label className="form-label">الساعات</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  className="form-input"
                  value={timeForm.duration_hours}
                  onChange={(e) => setTimeForm({ ...timeForm, duration_hours: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">الدقائق</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="0"
                  className="form-input"
                  value={timeForm.duration_minutes}
                  onChange={(e) => setTimeForm({ ...timeForm, duration_minutes: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">التاريخ *</label>
              <input
                type="date"
                required
                className="form-input"
                value={timeForm.date}
                onChange={(e) => setTimeForm({ ...timeForm, date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">بيان العمل المنجز *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="مثال: كتابة مذكرة دفاع، جلسة استماع..."
                value={timeForm.description}
                onChange={(e) => setTimeForm({ ...timeForm, description: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="billable_case"
                checked={timeForm.billable}
                onChange={(e) => setTimeForm({ ...timeForm, billable: e.target.checked })}
              />
              <label htmlFor="billable_case" style={{ color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.9rem' }}>
                ساعات خاضعة لاحتساب الأتعاب (Billable)
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <Button type="submit">حفظ الساعات</Button>
              <Button type="button" variant="secondary" onClick={() => setIsTimeModalOpen(false)}>إلغاء</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
