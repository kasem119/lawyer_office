import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';

const CaseNoteForm = ({ caseId, note, onSaved, onCancel }) => {
  const [formData, setFormData] = useState({
    content: '',
    note_type: 'note',
    is_private: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (note) {
      setFormData({
        content: note.content || '',
        note_type: note.note_type || 'note',
        is_private: note.is_private === 1
      });
    }
  }, [note]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      let res;
      if (note && note.id) {
        res = await apiFetch(`/case-notes/${note.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            content: formData.content,
            note_type: formData.note_type
          })
        });
      } else {
        res = await apiFetch('/case-notes', {
          method: 'POST',
          body: JSON.stringify({
            case_id: caseId,
            content: formData.content,
            note_type: formData.note_type,
            is_private: formData.is_private ? 1 : 0
          })
        });
      }

      if (res.ok) {
        onSaved();
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.message || 'حدث خطأ أثناء الحفظ');
      }
    } catch (err) {
      console.error(err);
      setError('حدث خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div style={{ color: 'var(--error)', marginBottom: '12px', fontSize: '0.85rem' }}>{error}</div>}
      
      <div className="form-group">
        <label className="form-label">نوع الملاحظة</label>
        <select 
          name="note_type" 
          value={formData.note_type} 
          onChange={handleChange}
          className="form-select"
        >
          <option value="note">ملاحظة عامة</option>
          <option value="update">تحديث حالة</option>
          <option value="court_result">نتيجة جلسة</option>
          <option value="phone_call">مكالمة هاتفية</option>
          <option value="email">بريد إلكتروني</option>
          <option value="meeting">اجتماع</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">المحتوى والتفاصيل</label>
        <textarea 
          name="content" 
          value={formData.content} 
          onChange={handleChange}
          className="form-textarea"
          rows="4"
          required
          placeholder="اكتب تفاصيل الملاحظة أو التطور الحاصل في القضية..."
        />
      </div>

      {!note && (
        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
          <input 
            type="checkbox" 
            id="is_private" 
            name="is_private" 
            checked={formData.is_private} 
            onChange={handleChange}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <label htmlFor="is_private" style={{ color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.9rem' }}>
            ملاحظة خاصة (لا يراها إلا أنت وإدارة المكتب)
          </label>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? 'جاري الحفظ...' : 'حفظ الملاحظة'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          إلغاء
        </button>
      </div>
    </form>
  );
};

export default CaseNoteForm;
