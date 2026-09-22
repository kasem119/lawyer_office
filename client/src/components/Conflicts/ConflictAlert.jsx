import React, { useState } from 'react';
import { ShieldAlert, Search } from 'lucide-react';
import Button from '../Shared/Button';
import { apiFetch } from '../../api/client';

export default function ConflictAlert() {
  const [clientName, setClientName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [title, setTitle] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch('/conflict/check', {
        method: 'POST',
        body: JSON.stringify({ clientName, nationalId, title })
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '850px', margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldAlert size={28} />
          أداة الاستعلام الذكي وتعارض المصالح
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>أدخل اسم الخصم أو العميل المرتقب للتحقق من عدم وجود قضايا سابقة أو تضارب مصالح مع محامي المكتب</p>
      </div>

      {/* Query Form */}
      <form onSubmit={handleCheck} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">اسم الطرف / العميل / الخصم المراد الاستعلام عنه</label>
          <input type="text" className="form-input" placeholder="اسم الشخص أو اسم الشركة..." value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">الرقم الوطني / السجل التجاري</label>
            <input type="text" className="form-input" placeholder="119XXXXXXXXX" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">موضوع الدعوى / القضية</label>
            <input type="text" className="form-input" placeholder="كلمة مفتاحية من الموضوع..." value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>

        <Button type="submit" disabled={loading || (!clientName && !nationalId && !title)} icon={Search}>
          {loading ? 'جاري الفحص بالقواعد...' : 'إجراء فحص التعارض الان'}
        </Button>
      </form>

      {/* Result Display */}
      {result && (
        <div className="glass-card" style={{ padding: '24px', borderRight: `6px solid ${result.hasConflict ? 'var(--error)' : 'var(--success)'}` }}>
          {result.hasConflict ? (
            <div>
              <h3 style={{ color: 'var(--error)', fontWeight: '800', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={22} />
                تنبيه: تم اكتشاف احتمال تعارض مصالح أو بيانات مسجلة مسبقاً!
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {result.conflicts.map((c, idx) => (
                  <div key={idx} style={{ background: 'rgba(244,63,94,0.1)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(244,63,94,0.3)', fontSize: '0.9rem' }}>
                    <div style={{ fontWeight: '700' }}>{c.message}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--success)', fontWeight: '700', fontSize: '1.05rem', textAlign: 'center', padding: '10px' }}>
              ✅ لم يتم العثور على أي تعارض مصالح أو بيانات مكررة في سجلات المكتب. البيانات آمنة للتسجيل.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
