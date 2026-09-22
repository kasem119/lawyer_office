import React, { useState, useEffect } from 'react';
import Button from '../Shared/Button';
import { apiFetch } from '../../api/client';

export default function EventForm({ initialValues, defaultCaseId, defaultDate, onSaved, onCancel }) {
  const [formData, setFormData] = useState({
    title: initialValues?.title || '',
    description: initialValues?.description || '',
    event_type: initialValues?.event_type || 'court_date',
    date: initialValues?.date || defaultDate || new Date().toISOString().split('T')[0],
    time: initialValues?.time || '09:00',
    end_time: initialValues?.end_time || '10:00',
    location: initialValues?.location || 'محكمة شمال طرابلس الابتدائية - القاعة 3',
    case_id: initialValues?.case_id || defaultCaseId || '',
    reminder_minutes: initialValues?.reminder_minutes || 60
  });

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const res = await apiFetch('/cases');
        if (res.ok) {
          const data = await res.json();
          setCases(data.cases || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchCases();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const isEdit = Boolean(initialValues?.id);
    const url = isEdit ? `/events/${initialValues.id}` : '/events';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'فشل حفظ الموعد');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && <div style={{ background: 'rgba(244,63,94,0.2)', color: 'var(--error)', padding: '10px', borderRadius: '6px', fontSize: '0.9rem' }}>{error}</div>}

      <div className="form-group">
        <label className="form-label">عنوان الموعد / الجلسة *</label>
        <input
          type="text"
          className="form-input"
          required
          placeholder="مثال: جلسة المرافعة الختامية / اجتماع تقديم البيانات"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">نوع الحدث</label>
          <select className="form-select" value={formData.event_type} onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}>
            <option value="court_date">جلسة محكمة (Court Date)</option>
            <option value="meeting">اجتماع عميل / مكتب (Meeting)</option>
            <option value="deadline">موعد أخير / مهلة قانونية (Deadline)</option>
            <option value="consultation">استشارة قانونية (Consultation)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">القضية المرتبطة</label>
          <select className="form-select" value={formData.case_id} onChange={(e) => setFormData({ ...formData, case_id: e.target.value })}>
            <option value="">-- موعد عام (غير مرتبط بقضية) --</option>
            {cases.map(c => (
              <option key={c.id} value={c.id}>{c.case_number} - {c.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">التاريخ *</label>
          <input type="date" className="form-input" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
        </div>

        <div className="form-group">
          <label className="form-label">وقت البدء</label>
          <input type="time" className="form-input" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} />
        </div>

        <div className="form-group">
          <label className="form-label">وقت الانتهاء</label>
          <input type="time" className="form-input" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">الموقع / قاعة المحكمة</label>
        <input type="text" className="form-input" placeholder="اسم المحكمة، القاعة، أو رابط الاجتماع..." value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
      </div>

      <div className="form-group">
        <label className="form-label">ملاحظات والتفاصيل</label>
        <textarea className="form-textarea" rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="ملاحظات الموعد المطلوب إعدادها..." />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        {onCancel && <Button variant="secondary" onClick={onCancel}>إلغاء</Button>}
        <Button type="submit" disabled={loading}>
          {loading ? 'جاري الحفظ...' : initialValues?.id ? 'تحديث الموعد' : 'إضافة الموعد'}
        </Button>
      </div>
    </form>
  );
}
