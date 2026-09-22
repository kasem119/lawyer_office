import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { Clock, Plus, Trash2 } from 'lucide-react';
import Button from '../Shared/Button';

export default function TimeTracker() {
  const [entries, setEntries] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    case_id: '',
    description: '',
    duration_hours: '',
    duration_minutes: '',
    date: new Date().toISOString().split('T')[0],
    billable: true
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [entriesRes, casesRes] = await Promise.all([
        apiFetch('/time-entries'),
        apiFetch('/cases')
      ]);
      
      if (entriesRes.ok) {
        const json = await entriesRes.json();
        setEntries(json.data || []);
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
    if (!window.confirm('هل أنت متأكد من حذف هذا السجل؟')) return;
    try {
      const res = await apiFetch(`/time-entries/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.case_id) {
      alert('يرجى اختيار قضية');
      return;
    }
    
    const h = parseInt(formData.duration_hours) || 0;
    const m = parseInt(formData.duration_minutes) || 0;
    const totalMinutes = (h * 60) + m;
    
    if (totalMinutes <= 0) {
      alert('يرجى إدخال مدة صحيحة (بالساعات أو الدقائق)');
      return;
    }
    
    try {
      const payload = {
        case_id: formData.case_id,
        description: formData.description,
        duration_minutes: totalMinutes,
        date: formData.date,
        billable: formData.billable ? 1 : 0
      };
      
      const res = await apiFetch('/time-entries', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setShowForm(false);
        setFormData({
          case_id: '',
          description: '',
          duration_hours: '',
          duration_minutes: '',
          date: new Date().toISOString().split('T')[0],
          billable: true
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

  const totalMinutesAll = entries.reduce((sum, e) => sum + (Number(e.duration_minutes) || 0), 0);
  const totalBillableMinutes = entries.filter(e => e.billable === 1 || e.billable === true).reduce((sum, e) => sum + (Number(e.duration_minutes) || 0), 0);

  const formatHours = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h} س ${m > 0 ? m + ' د' : ''}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="glass-card" style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>إجمالي ساعات العمل:</span>
            <span style={{ color: 'var(--primary)', fontWeight: '800', fontSize: '1.1rem' }}>{formatHours(totalMinutesAll)}</span>
          </div>
          <div className="glass-card" style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>الساعات الخاضعة للفوترة:</span>
            <span style={{ color: 'var(--success)', fontWeight: '800', fontSize: '1.1rem' }}>{formatHours(totalBillableMinutes)}</span>
          </div>
        </div>
        <Button icon={Plus} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'إخفاء النموذج' : 'تسجيل ساعات عمل'}
        </Button>
      </div>

      {showForm && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '16px' }}>تسجيل وقت وساعات عمل على قضية</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">القضية المرتبطة *</label>
                <select 
                  value={formData.case_id} 
                  onChange={(e) => setFormData({ ...formData, case_id: e.target.value })}
                  required
                  className="form-select"
                >
                  <option value="">-- اختر القضية --</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>{c.case_number} - {c.title}</option>
                  ))}
                </select>
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

              <div className="form-group">
                <label className="form-label">الساعات</label>
                <input 
                  type="number" 
                  min="0" 
                  placeholder="0"
                  value={formData.duration_hours} 
                  onChange={(e) => setFormData({ ...formData, duration_hours: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">الدقائق</label>
                <input 
                  type="number" 
                  min="0" 
                  max="59"
                  placeholder="0"
                  value={formData.duration_minutes} 
                  onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">وصف العمل المنجز *</label>
              <input 
                type="text" 
                required
                placeholder="تفاصيل العمل (مثال: دراسة ملف القضية، صياغة لائحة جوابية، جلسة استماع)..."
                value={formData.description} 
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="billable" 
                checked={formData.billable} 
                onChange={(e) => setFormData({ ...formData, billable: e.target.checked })}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="billable" style={{ color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.9rem' }}>
                ساعات خاضعة لاحتساب الأتعاب (Billable Hours)
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button type="submit">تسجيل الوقت</Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>إلغاء</Button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card" style={{ overflow: 'auto' }}>
        {loading ? (
          <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>جاري تحميل السجلات...</p>
        ) : entries.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>لا توجد سجلات وقت مسجلة</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '14px' }}>التاريخ</th>
                <th style={{ padding: '14px' }}>المحامي</th>
                <th style={{ padding: '14px' }}>القضية</th>
                <th style={{ padding: '14px' }}>البيان والعمل المنجز</th>
                <th style={{ padding: '14px' }}>المدة</th>
                <th style={{ padding: '14px' }}>نوع الساعات</th>
                <th style={{ padding: '14px' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(ent => (
                <tr key={ent.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="table-row-hover">
                  <td style={{ padding: '14px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{ent.date}</td>
                  <td style={{ padding: '14px', fontWeight: '600', color: 'var(--text-main)' }}>{ent.user_name || ent.lawyer_name || '-'}</td>
                  <td style={{ padding: '14px', color: 'var(--primary)' }}>{ent.case_title || ent.case_number || '-'}</td>
                  <td style={{ padding: '14px', color: 'var(--text-main)' }}>{ent.description}</td>
                  <td style={{ padding: '14px', fontWeight: '700', color: 'var(--text-main)' }}>{formatHours(Number(ent.duration_minutes) || 0)}</td>
                  <td style={{ padding: '14px' }}>
                    {ent.billable === 1 || ent.billable === true ? (
                      <span className="badge badge-active">خاضع للفوترة</span>
                    ) : (
                      <span className="badge badge-low">غير خاضع</span>
                    )}
                  </td>
                  <td style={{ padding: '14px' }}>
                    <button 
                      onClick={() => handleDelete(ent.id)}
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
