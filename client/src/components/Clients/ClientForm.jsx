import React, { useState } from 'react';
import Button from '../Shared/Button';

export default function ClientForm({ initialValues, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: initialValues?.name || '',
    national_id: initialValues?.national_id || '',
    phone: initialValues?.phone || '',
    email: initialValues?.email || '',
    address: initialValues?.address || '',
    notes: initialValues?.notes || ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSave(formData);
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && <div style={{ background: 'rgba(244,63,94,0.2)', color: 'var(--error)', padding: '10px', borderRadius: '6px', fontSize: '0.9rem' }}>{error}</div>}

      <div className="form-group">
        <label className="form-label">اسم العميل / الشركة *</label>
        <input
          type="text"
          className="form-input"
          required
          placeholder="الاسم الثلاثي أو اسم الشركة..."
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">الرقم الوطني / السجل التجاري (مشفر)</label>
          <input
            type="text"
            className="form-input"
            placeholder="119XXXXXXXXX"
            value={formData.national_id}
            onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">رقم الجوال / الهاتف</label>
          <input
            type="text"
            className="form-input"
            placeholder="09XXXXXXXX"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">البريد الإلكتروني</label>
          <input
            type="email"
            className="form-input"
            placeholder="client@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">العنوان / المقر</label>
          <input
            type="text"
            className="form-input"
            placeholder="المدينة - الحي..."
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">ملاحظات العميل والتفاصيل</label>
        <textarea
          className="form-textarea"
          rows={3}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="ملاحظات حول طريقة التواصل، الطبيعة القانونية..."
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
        <Button variant="secondary" onClick={onCancel}>إلغاء</Button>
        <Button type="submit" disabled={loading}>{loading ? 'جاري الحفظ...' : 'حفظ العميل'}</Button>
      </div>
    </form>
  );
}
