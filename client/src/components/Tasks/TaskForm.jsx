import React, { useState, useEffect } from 'react';
import Button from '../Shared/Button';
import { apiFetch } from '../../api/client';

export default function TaskForm({ initialValues, defaultCaseId, onSaved, onCancel }) {
  const [formData, setFormData] = useState({
    title: initialValues?.title || '',
    description: initialValues?.description || '',
    priority: initialValues?.priority || 'medium',
    due_date: initialValues?.due_date || new Date().toISOString().split('T')[0],
    case_id: initialValues?.case_id || defaultCaseId || '',
    assigned_to: initialValues?.assigned_to || ''
  });

  const [lawyers, setLawyers] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [usersRes, casesRes] = await Promise.all([
          apiFetch('/users'),
          apiFetch('/cases')
        ]);
        if (usersRes.ok) {
          const data = await usersRes.json();
          setLawyers(data.users || []);
          if (!formData.assigned_to && data.users.length > 0) {
            setFormData(prev => ({ ...prev, assigned_to: data.users[0].id }));
          }
        }
        if (casesRes.ok) {
          const data = await casesRes.json();
          setCases(data.cases || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchOptions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const isEdit = Boolean(initialValues?.id);
    const url = isEdit ? `/tasks/${initialValues.id}` : '/tasks';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'فشل حفظ المهمة');
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
        <label className="form-label">عنوان المهمة *</label>
        <input
          type="text"
          className="form-input"
          required
          placeholder="مثال: إعداد لائحة الاعتراض / صياغة مذكرة..."
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">المكلف بالمهمة *</label>
          <select className="form-select" required value={formData.assigned_to} onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}>
            {lawyers.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">الأولوية</label>
          <select className="form-select" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}>
            <option value="low">عادي (Low)</option>
            <option value="medium">متوسط (Medium)</option>
            <option value="high">عالي (High)</option>
            <option value="urgent">عاجل (Urgent)</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">تاريخ الاستحقاق</label>
          <input type="date" className="form-input" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} />
        </div>

        <div className="form-group">
          <label className="form-label">القضية المرتبطة</label>
          <select className="form-select" value={formData.case_id} onChange={(e) => setFormData({ ...formData, case_id: e.target.value })}>
            <option value="">-- مهمة عامة بالمكتب --</option>
            {cases.map(c => (
              <option key={c.id} value={c.id}>{c.case_number} - {c.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">وصف وتفاصيل المهمة</label>
        <textarea className="form-textarea" rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="تفاصيل الإجراءات المطلوب اتخاذها..." />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        {onCancel && <Button variant="secondary" onClick={onCancel}>إلغاء</Button>}
        <Button type="submit" disabled={loading}>
          {loading ? 'جاري الحفظ...' : initialValues?.id ? 'تحديث المهمة' : 'إسناد المهمة'}
        </Button>
      </div>
    </form>
  );
}
