import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { Plus, Trash2, ArrowRight } from 'lucide-react';
import Button from '../Shared/Button';

export default function InvoiceForm({ onSaved, onCancel, initialData = null }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(initialData && initialData.id);
  const [formData, setFormData] = useState({
    case_id: initialData?.case_id ? String(initialData.case_id) : '',
    client_id: initialData?.client_id || '',
    due_date: initialData?.due_date || '',
    notes: initialData?.notes || '',
    status: initialData?.status || 'draft',
    items: initialData?.items && initialData.items.length > 0 
      ? initialData.items.map(it => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price }))
      : [{ description: '', quantity: 1, unit_price: 0 }]
  });

  useEffect(() => {
    // If initialData didn't have items loaded, fetch full invoice details
    if (initialData?.id && (!initialData.items || initialData.items.length === 0)) {
      apiFetch(`/invoices/${initialData.id}`)
        .then(res => res.json())
        .then(json => {
          if (json.data) {
            const d = json.data;
            setFormData({
              case_id: d.case_id ? String(d.case_id) : '',
              client_id: d.client_id || '',
              due_date: d.due_date || '',
              notes: d.notes || '',
              status: d.status || 'draft',
              items: d.items && d.items.length > 0
                ? d.items.map(it => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price }))
                : [{ description: '', quantity: 1, unit_price: 0 }]
            });
          }
        })
        .catch(console.error);
    }
  }, [initialData]);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const res = await apiFetch('/cases');
        if (res.ok) {
          const json = await res.json();
          setCases(json.cases || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchCases();
  }, []);

  const handleCaseChange = (e) => {
    const caseId = e.target.value;
    const selectedCase = cases.find(c => c.id.toString() === caseId);
    setFormData({
      ...formData,
      case_id: caseId,
      client_id: selectedCase ? selectedCase.client_id : ''
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, unit_price: 0 }]
    });
  };

  const removeItem = (index) => {
    if (formData.items.length === 1) return;
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.case_id) {
      alert('يرجى اختيار قضية');
      return;
    }
    try {
      setLoading(true);
      const url = isEdit ? `/invoices/${initialData.id}` : '/invoices';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        onSaved();
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.message || 'حدث خطأ أثناء حفظ الفاتورة');
      }
    } catch (err) {
      console.error(err);
      alert('حدث خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: 'var(--primary)', margin: 0, fontSize: '1.3rem', fontWeight: '800' }}>
          {isEdit ? `تعديل الفاتورة (${initialData.invoice_number || ''})` : 'إنشاء فاتورة أتعاب جديدة'}
        </h2>
        <button 
          type="button" 
          onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ArrowRight size={18} />
          إلغاء والعودة
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">القضية المرتبطة *</label>
          <select 
            value={formData.case_id} 
            onChange={handleCaseChange}
            required
            className="form-select"
          >
            <option value="">-- اختر القضية --</option>
            {cases.map(c => (
              <option key={c.id} value={c.id}>
                {c.case_number} - {c.title} ({c.client_name})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">تاريخ الاستحقاق</label>
          <input 
            type="date" 
            value={formData.due_date} 
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            className="form-input"
          />
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)' }}>بنود الفاتورة والخدمات المقدمة</h3>
          <Button type="button" variant="secondary" icon={Plus} onClick={addItem} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            إضافة بند
          </Button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {formData.items.map((item, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1.5fr auto', gap: '10px', alignItems: 'center', background: 'var(--bg-item)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <input 
                type="text" 
                placeholder="وصف الخدمة / البند (مثال: أتعاب الترافع وكتابة المذكرة)"
                value={item.description}
                onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                required
                className="form-input"
                style={{ margin: 0 }}
              />
              <input 
                type="number" 
                placeholder="العدد"
                value={item.quantity}
                min="1"
                onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                required
                className="form-input"
                style={{ margin: 0 }}
              />
              <input 
                type="number" 
                placeholder="السعر (د.ل)"
                value={item.unit_price}
                min="0"
                onChange={(e) => handleItemChange(index, 'unit_price', Number(e.target.value))}
                required
                className="form-input"
                style={{ margin: 0 }}
              />
              <button 
                type="button" 
                onClick={() => removeItem(index)}
                disabled={formData.items.length === 1}
                style={{ background: 'transparent', border: 'none', color: formData.items.length === 1 ? 'var(--text-dim)' : 'var(--error)', cursor: formData.items.length === 1 ? 'not-allowed' : 'pointer', padding: '6px' }}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px', background: 'rgba(212, 168, 83, 0.1)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)' }}>
          المجموع الإجمالي: {calculateTotal().toLocaleString()} د.ل
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">ملاحظات وشروط الدفع</label>
        <textarea 
          placeholder="شروط السداد أو بيانات الحساب البنكي..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="form-textarea"
          rows="3"
        />
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start' }}>
        <Button type="submit" disabled={loading}>
          {loading ? 'جاري الحفظ...' : (isEdit ? 'تحديث الفاتورة' : 'إصدار الفاتورة')}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}
