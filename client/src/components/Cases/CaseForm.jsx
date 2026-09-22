import React, { useState, useEffect } from 'react';
import Button from '../Shared/Button';
import { apiFetch } from '../../api/client';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

export default function CaseForm({ initialValues, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    case_number: initialValues?.case_number || `CASE-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    title: initialValues?.title || '',
    description: initialValues?.description || '',
    court_name: initialValues?.court_name || 'محكمة شمال طرابلس الابتدائية',
    case_type: initialValues?.case_type || 'تجاري',
    status: initialValues?.status || 'active',
    priority: initialValues?.priority || 'medium',
    client_id: initialValues?.client_id || '',
    lead_lawyer_id: initialValues?.lead_lawyer_id || '',
    assigned_lawyer_ids: initialValues?.assigned_lawyer_ids || [],
    opponent_name: initialValues?.opponent_name || '',
    opponent_id_number: initialValues?.opponent_id_number || '',
    opponent_lawyer: initialValues?.opponent_lawyer || '',
    opponent_phone: initialValues?.opponent_phone || ''
  });

  const [clients, setClients] = useState([]);
  const [lawyers, setLawyers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [conflictWarning, setConflictWarning] = useState(null);

  useEffect(() => {
    const loadDropdowns = async () => {
      try {
        const [clientsRes, usersRes] = await Promise.all([
          apiFetch('/clients'),
          apiFetch('/users')
        ]);
        if (clientsRes.ok) {
          const data = await clientsRes.json();
          setClients(data.clients || []);
          if (!formData.client_id && data.clients.length > 0) {
            setFormData(prev => ({ ...prev, client_id: data.clients[0].id }));
          }
        }
        if (usersRes.ok) {
          const data = await usersRes.json();
          setLawyers(data.users || []);
          if (!formData.lead_lawyer_id && data.users.length > 0) {
            setFormData(prev => ({ ...prev, lead_lawyer_id: data.users[0].id }));
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadDropdowns();
  }, []);

  // Real-time conflict of interest check on opponent or title
  const checkConflictRealtime = async () => {
    if (!formData.opponent_name && !formData.opponent_id_number && !formData.title) return;
    try {
      const res = await apiFetch('/conflict/check', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.title,
          opponentName: formData.opponent_name,
          opponentId: formData.opponent_id_number,
          excludeCaseId: initialValues?.id
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.hasConflict) {
          setConflictWarning(data);
        } else {
          setConflictWarning(null);
        }
      }
    } catch (e) {
      console.error('Conflict check error:', e);
    }
  };

  const handleSubmit = async (e, force = false) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSave({ ...formData, force });
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && <div style={{ background: 'rgba(244,63,94,0.2)', color: 'var(--error)', padding: '10px', borderRadius: '6px', fontSize: '0.9rem' }}>{error}</div>}

      {/* Conflict Warning Box */}
      {conflictWarning && (
        <div style={{
          background: conflictWarning.hasCriticalConflict ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
          border: `1px solid ${conflictWarning.hasCriticalConflict ? 'var(--error)' : 'var(--warning)'}`,
          borderRadius: '8px',
          padding: '12px 16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: conflictWarning.hasCriticalConflict ? 'var(--error)' : 'var(--warning)', fontWeight: '700', marginBottom: '6px' }}>
            <ShieldAlert size={20} />
            <span>{conflictWarning.hasCriticalConflict ? '⚠️ تحذير تعارض مصالح قانوني حرج!' : 'تنبيه تشابه أو تعارض محتمل'}</span>
          </div>
          {conflictWarning.conflicts.map((c, i) => (
            <p key={i} style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: '4px 0' }}>
              • {c.message}
            </p>
          ))}
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => handleSubmit(null, true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              متابعة الحفظ رغم التنبيه على مسؤوليتي
            </button>
          </div>
        </div>
      )}

      {/* Basic Case Data */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">رقم القضية *</label>
          <input
            type="text"
            className="form-input"
            required
            value={formData.case_number}
            onChange={(e) => setFormData({ ...formData, case_number: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">العميل الأصيل *</label>
          <select
            className="form-select"
            required
            value={formData.client_id}
            onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
          >
            <option value="">-- اختر العميل --</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">عنوان القضية / موضوع الدعوى *</label>
        <input
          type="text"
          className="form-input"
          required
          placeholder="مثال: دعوى مطالبات مالية بموجب عقد توريد"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          onBlur={checkConflictRealtime}
        />
      </div>

      {/* Opponent Details Section (الخصم) */}
      <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>بيانات الطرف الخصم (المدعى عليه / الخصم)</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>(هام جداً لضبط تعارض المصالح)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label">اسم الخصم (شخص / شركة)</label>
            <input
              type="text"
              className="form-input"
              placeholder="الاسم الثلاثي أو اسم الشركة الخصم"
              value={formData.opponent_name}
              onChange={(e) => setFormData({ ...formData, opponent_name: e.target.value })}
              onBlur={checkConflictRealtime}
            />
          </div>
          <div className="form-group">
            <label className="form-label">الرقم الوطني / السجل التجاري للخصم</label>
            <input
              type="text"
              className="form-input"
              placeholder="الرقم الوطني أو قيد السجل"
              value={formData.opponent_id_number}
              onChange={(e) => setFormData({ ...formData, opponent_id_number: e.target.value })}
              onBlur={checkConflictRealtime}
            />
          </div>
          <div className="form-group">
            <label className="form-label">محامي الخصم (إن وجد)</label>
            <input
              type="text"
              className="form-input"
              placeholder="اسم محامي الخصم المكلف"
              value={formData.opponent_lawyer}
              onChange={(e) => setFormData({ ...formData, opponent_lawyer: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">هاتف / وسيلة اتصال الخصم</label>
            <input
              type="text"
              className="form-input"
              placeholder="رقم الهاتف أو العنوان"
              value={formData.opponent_phone}
              onChange={(e) => setFormData({ ...formData, opponent_phone: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: initialValues ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">اسم المحكمة / الدائرة</label>
          <input
            type="text"
            className="form-input"
            value={formData.court_name}
            onChange={(e) => setFormData({ ...formData, court_name: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">نوع القضية</label>
          <select
            className="form-select"
            value={formData.case_type}
            onChange={(e) => setFormData({ ...formData, case_type: e.target.value })}
          >
            <option value="تجاري">تجاري</option>
            <option value="مدني">مدني</option>
            <option value="جنائي">جنائي</option>
            <option value="أحوال شخصية">أحوال شخصية</option>
            <option value="عمالي">عمالي</option>
            <option value="إداري">إداري</option>
            <option value="عقاري">عقاري</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">درجة الأهمية / الأولوية</label>
          <select
            className="form-select"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
          >
            <option value="low">عادي (Low)</option>
            <option value="medium">متوسط (Medium)</option>
            <option value="high">عالي (High)</option>
            <option value="urgent">عاجل (Urgent)</option>
          </select>
        </div>

        {initialValues && (
          <div className="form-group">
            <label className="form-label">حالة القضية</label>
            <select
              className="form-select"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="active">نشطة (Active)</option>
              <option value="pending">معلقة (Pending)</option>
              <option value="closed">مغلقة / منتهية (Closed)</option>
              <option value="archived">مؤرشفة (Archived)</option>
            </select>
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">المحامي المسؤول الرئيسي</label>
        <select
          className="form-select"
          value={formData.lead_lawyer_id}
          onChange={(e) => setFormData({ ...formData, lead_lawyer_id: e.target.value })}
        >
          {lawyers.map(l => (
            <option key={l.id} value={l.id}>{l.name} ({l.role === 'admin' ? 'مدير' : 'محامي'})</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">ملخص الوقائع والوصف القانوني</label>
        <textarea
          className="form-textarea"
          rows={3}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="تفاصيل وقائع القضية وطلبات العميل..."
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
        <Button variant="secondary" onClick={onCancel}>إلغاء</Button>
        <Button type="submit" disabled={loading}>{loading ? 'جاري الحفظ...' : 'حفظ القضية'}</Button>
      </div>
    </form>
  );
}
