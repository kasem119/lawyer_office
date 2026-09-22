import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { Plus, Trash2, Receipt } from 'lucide-react';
import Button from '../Shared/Button';

export default function ExpenseTracker() {
  const [expenses, setExpenses] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    case_id: '',
    description: '',
    amount: '',
    category: 'other',
    date: new Date().toISOString().split('T')[0]
  });

  const categories = {
    court_fees: 'رسوم ومصاريف محكمة',
    travel: 'سفر وتنقلات',
    consultation: 'استشارات وخبرة',
    printing: 'طباعة وتصوير مستندات',
    communication: 'اتصالات ومراسلات',
    other: 'مصروفات أخرى'
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [expRes, casesRes] = await Promise.all([
        apiFetch('/expenses'),
        apiFetch('/cases')
      ]);
      
      if (expRes.ok) {
        const json = await expRes.json();
        const data = json.data || [];
        setExpenses(data);
        setTotalExpenses(data.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0));
      }
      if (casesRes.ok) {
        const json = await casesRes.json();
        setCases(json.cases || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
    try {
      const res = await apiFetch(`/expenses/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          amount: Number(formData.amount)
        })
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({
          case_id: '',
          description: '',
          amount: '',
          category: 'other',
          date: new Date().toISOString().split('T')[0]
        });
        fetchData();
      } else {
        const json = await res.json().catch(() => ({}));
        alert(json.message || 'حدث خطأ أثناء الحفظ');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="glass-card" style={{ padding: '10px 18px', border: '1px solid var(--warning)', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>إجمالي المصروفات المسجلة:</span>
          <span style={{ color: 'var(--warning)', fontWeight: '800', fontSize: '1.2rem' }}>{totalExpenses.toLocaleString()} د.ل</span>
        </div>
        <Button icon={Plus} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'إخفاء النموذج' : 'تسجيل مصروف جديد'}
        </Button>
      </div>

      {showForm && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '16px' }}>تسجيل مصروفات قضية أو مكتب</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">القضية المرتبطة (اختياري)</label>
                <select 
                  value={formData.case_id} 
                  onChange={(e) => setFormData({ ...formData, case_id: e.target.value })}
                  className="form-select"
                >
                  <option value="">-- مصروف عام للمكتب --</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>{c.case_number} - {c.title}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">تصنيف المصروف *</label>
                <select 
                  value={formData.category} 
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="form-select"
                >
                  {Object.entries(categories).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">المبلغ (د.ل) *</label>
                <input 
                  type="number" 
                  min="0.01" 
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={formData.amount} 
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">التاريخ *</label>
                <input 
                  type="date" 
                  required
                  value={formData.date} 
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">بيان ووصف المصروف *</label>
              <input 
                type="text" 
                required
                placeholder="تفاصيل المصروف، الفاتورة أو الجهة المستفيدة..."
                value={formData.description} 
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="form-input"
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button type="submit">حفظ المصروف</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card" style={{ overflow: 'auto' }}>
        {loading ? (
          <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>جاري تحميل المصروفات...</p>
        ) : expenses.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>لا توجد مصروفات مسجلة</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '14px' }}>التاريخ</th>
                <th style={{ padding: '14px' }}>البيان</th>
                <th style={{ padding: '14px' }}>التصنيف</th>
                <th style={{ padding: '14px' }}>القضية</th>
                <th style={{ padding: '14px' }}>المسجل بواسطة</th>
                <th style={{ padding: '14px' }}>المبلغ</th>
                <th style={{ padding: '14px' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="table-row-hover">
                  <td style={{ padding: '14px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{exp.date}</td>
                  <td style={{ padding: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{exp.description}</td>
                  <td style={{ padding: '14px' }}>
                    <span className="badge badge-medium">{categories[exp.category] || exp.category}</span>
                  </td>
                  <td style={{ padding: '14px', color: 'var(--text-muted)' }}>{exp.case_title || exp.case_number || 'مصروف عام'}</td>
                  <td style={{ padding: '14px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{exp.created_by_name || '-'}</td>
                  <td style={{ padding: '14px', fontWeight: '700', color: 'var(--warning)' }}>{(Number(exp.amount) || 0).toLocaleString()} د.ل</td>
                  <td style={{ padding: '14px' }}>
                    <button 
                      onClick={() => handleDelete(exp.id)}
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
    </div>
  );
}
