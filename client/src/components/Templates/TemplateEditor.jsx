import React, { useState, useEffect, useRef } from 'react';
import { FileText, Plus, Eye, Code, Save, X, Sparkles, Tag, Check, AlertCircle } from 'lucide-react';
import Button from '../Shared/Button';
import { apiFetch } from '../../api/client';

const CATEGORY_OPTIONS = [
  { value: 'contract', label: 'عقد' },
  { value: 'power_of_attorney', label: 'توكيل' },
  { value: 'letter', label: 'خطاب / إنذار' },
  { value: 'motion', label: 'مذكرة دفاع' },
  { value: 'memo', label: 'مذكرة داخلية' },
  { value: 'other', label: 'أخرى' }
];

const SUGGESTED_PLACEHOLDERS = [
  { tag: 'client_name', label: 'اسم العميل' },
  { tag: 'client_id_number', label: 'الرقم الوطني/الهوية' },
  { tag: 'client_phone', label: 'هاتف العميل' },
  { tag: 'client_address', label: 'عنوان العميل' },
  { tag: 'lawyer_name', label: 'اسم المحامي' },
  { tag: 'office_address', label: 'عنوان المكتب' },
  { tag: 'case_number', label: 'رقم القضية' },
  { tag: 'court_name', label: 'اسم المحكمة' },
  { tag: 'opponent_name', label: 'اسم الخصم' },
  { tag: 'date', label: 'التاريخ' },
  { tag: 'total_fees', label: 'المبلغ الإجمالي' },
  { tag: 'contract_subject', label: 'موضوع العقد' }
];

export default function TemplateEditor({ template, onSave, onCancel }) {
  const [name, setName] = useState(template?.name || '');
  const [category, setCategory] = useState(template?.category || 'contract');
  const [contentHtml, setContentHtml] = useState(template?.content_html || '');
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' or 'preview'
  const [customPlaceholder, setCustomPlaceholder] = useState('');
  const [detectedPlaceholders, setDetectedPlaceholders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);

  // Auto-extract placeholders from contentHtml whenever it changes
  useEffect(() => {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = new Set();
    let match;
    while ((match = regex.exec(contentHtml)) !== null) {
      const key = match[1].trim();
      if (key) {
        matches.add(key);
      }
    }
    setDetectedPlaceholders(Array.from(matches));
  }, [contentHtml]);

  // Insert placeholder at cursor position in textarea
  const insertPlaceholder = (tag) => {
    const placeholderText = `{{${tag}}}`;
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const newContent = contentHtml.substring(0, start) + placeholderText + contentHtml.substring(end);
      setContentHtml(newContent);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + placeholderText.length, start + placeholderText.length);
      }, 50);
    } else {
      setContentHtml(prev => prev + placeholderText);
    }
  };

  const handleAddCustomPlaceholder = (e) => {
    e.preventDefault();
    if (!customPlaceholder.trim()) return;
    const cleanTag = customPlaceholder.trim().replace(/\s+/g, '_');
    insertPlaceholder(cleanTag);
    setCustomPlaceholder('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('يرجى إدخال اسم القالب');
      return;
    }

    if (!contentHtml.trim()) {
      setError('يرجى إدخال محتوى القالب');
      return;
    }

    setSaving(true);
    try {
      const isEdit = !!template?.id;
      const url = isEdit ? `/templates/${template.id}` : '/templates';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        name: name.trim(),
        category,
        content_html: contentHtml,
        placeholders_json: JSON.stringify(detectedPlaceholders)
      };

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'حدث خطأ أثناء حفظ القالب');
      }

      onSave(data.template);
    } catch (err) {
      console.error(err);
      setError(err.message || 'فشل حفظ القالب');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {error && (
        <div style={{
          backgroundColor: 'rgba(244, 63, 94, 0.15)',
          color: 'var(--error)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.9rem'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Name and Category Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">اسم القالب <span style={{ color: 'var(--error)' }}>*</span></label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: عقد تقديم خدمات قانونية، توكيل خاص بالتقاضي..."
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">فئة القالب</label>
            <select
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Placeholders Toolbar */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '700' }}>
              <Sparkles size={16} />
              <span>إدراج متغير سريع (انقر للإضافة داخل المحتوى):</span>
            </div>

            {/* Custom placeholder input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="text"
                className="form-input"
                style={{ padding: '4px 8px', fontSize: '0.8rem', width: '150px' }}
                placeholder="متغير مخصص..."
                value={customPlaceholder}
                onChange={(e) => setCustomPlaceholder(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { handleAddCustomPlaceholder(e); } }}
              />
              <button
                type="button"
                onClick={handleAddCustomPlaceholder}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              >
                <Plus size={14} /> إضافة
              </button>
            </div>
          </div>

          {/* Chips list */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {SUGGESTED_PLACEHOLDERS.map((p) => (
              <button
                key={p.tag}
                type="button"
                onClick={() => insertPlaceholder(p.tag)}
                style={{
                  background: 'var(--bg-item)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '16px',
                  padding: '4px 10px',
                  color: 'var(--text-main)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.color = 'var(--text-main)';
                }}
                title={`إدراج {{${p.tag}}}`}
              >
                <span>{p.label}</span>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', direction: 'ltr' }}>{`{{${p.tag}}}`}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Edit / Preview Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'edit' ? 'var(--primary-light)' : 'transparent',
              color: activeTab === 'edit' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'edit' ? '700' : '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Code size={16} /> تحرير المحتوى (HTML / نص)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'preview' ? 'var(--primary-light)' : 'transparent',
              color: activeTab === 'preview' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'preview' ? '700' : '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Eye size={16} /> معاينة القالب
          </button>
        </div>

        {/* Editor or Preview Pane */}
        {activeTab === 'edit' ? (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <textarea
              ref={textareaRef}
              className="form-textarea"
              style={{
                minHeight: '300px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '0.95rem',
                lineHeight: '1.6',
                direction: 'rtl'
              }}
              value={contentHtml}
              onChange={(e) => setContentHtml(e.target.value)}
              placeholder="اكتب هنا محتوى القالب أو كود HTML مع المتغيرات مثل {{client_name}}..."
              required
            />
          </div>
        ) : (
          <div style={{
            minHeight: '300px',
            maxHeight: '400px',
            overflowY: 'auto',
            padding: '20px',
            backgroundColor: '#ffffff',
            color: '#1e293b',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            direction: 'rtl'
          }}>
            <iframe
              title="معاينة القالب"
              sandbox=""
              srcDoc={contentHtml || '<p style="color: #94a3b8; text-align: center;">لا يوجد محتوى للمعاينة</p>'}
              style={{ width: '100%', minHeight: '260px', border: 'none', background: '#fff' }}
            />
          </div>
        )}

        {/* Detected Placeholders Summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <Tag size={15} color="var(--primary)" />
          <span>المتغيرات المكتشفة بالقالب ({detectedPlaceholders.length}):</span>
          {detectedPlaceholders.length === 0 ? (
            <span style={{ color: 'var(--text-dim)' }}>لم يتم إدراج متغيرات بعد</span>
          ) : (
            detectedPlaceholders.map(tag => (
              <span key={tag} style={{
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: '600',
                direction: 'ltr'
              }}>
                {`{{${tag}}}`}
              </span>
            ))
          )}
        </div>

        {/* Actions Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
          <Button variant="secondary" onClick={onCancel}>
            إلغاء
          </Button>
          <Button type="submit" variant="primary" icon={Save} disabled={saving}>
            {saving ? 'جاري الحفظ...' : (template?.id ? 'حفظ التعديلات' : 'إنشاء القالب')}
          </Button>
        </div>
      </form>
    </div>
  );
}
