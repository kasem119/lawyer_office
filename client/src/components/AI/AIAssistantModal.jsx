import React, { useState, useEffect } from 'react';
import Modal from '../Shared/Modal';
import Button from '../Shared/Button';
import { Sparkles, Copy, Check, FileText, BookOpen, Send, Lightbulb } from 'lucide-react';
import { apiFetch } from '../../api/client';

export default function AIAssistantModal({ isOpen, onClose, defaultCaseId = null }) {
  const [mode, setMode] = useState('draft_clause');
  const [prompt, setPrompt] = useState('');
  const [caseId, setCaseId] = useState(defaultCaseId || '');
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      apiFetch('/cases')
        .then(res => res.json())
        .then(data => setCases(data.cases || []))
        .catch(console.error);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() && mode !== 'summarize_case') return;

    try {
      setLoading(true);
      setResponse(null);
      const res = await apiFetch('/ai/assist', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          prompt,
          case_id: caseId ? Number(caseId) : null
        })
      });

      if (res.ok) {
        const json = await res.json();
        setResponse(json.data);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'حدث خطأ أثناء معالجة الطلب');
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!response?.content) return;
    navigator.clipboard.writeText(response.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="المساعد القانوني الذكي (AI Legal Assistant)"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Mode Selector Tabs */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${mode === 'draft_clause' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setMode('draft_clause'); setResponse(null); }}
            style={{ fontSize: '0.85rem' }}
          >
            <Sparkles size={16} />
            صياغة بنود العقود
          </button>
          <button
            type="button"
            className={`btn ${mode === 'legal_advice' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setMode('legal_advice'); setResponse(null); }}
            style={{ fontSize: '0.85rem' }}
          >
            <BookOpen size={16} />
            تأصيل واستشارة قانونية
          </button>
          <button
            type="button"
            className={`btn ${mode === 'summarize_case' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setMode('summarize_case'); setResponse(null); }}
            style={{ fontSize: '0.85rem' }}
          >
            <FileText size={16} />
            تلخيص قضية واستراتيجية دفاع
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mode === 'summarize_case' ? (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">اختر القضية المراد تلخيصها وتحليلها:</label>
              <select
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
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
          ) : (
            <>
              {mode === 'legal_advice' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">القضية المرتبطة (اختياري):</label>
                  <select
                    value={caseId}
                    onChange={(e) => setCaseId(e.target.value)}
                    className="form-select"
                  >
                    <option value="">-- استشارة عامة مستقلة --</option>
                    {cases.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.case_number} - {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  {mode === 'draft_clause'
                    ? 'ما نوع البند أو الالتزام المراد صياغته؟ (مثال: شرط التحكيم، سرية البيانات، الشرط الجزائي، القوة القاهرة)'
                    : 'اكتب تفاصيل الواقعة أو السؤال القانوني:'}
                </label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder={
                    mode === 'draft_clause'
                      ? 'مثال: صياغة بند تحكيم ثلاثي ملزم مع تحديد مدينة طرابلس مقراً للتحكيم...'
                      : 'مثال: ما هو الإجراء القانوني في حال تأخر المستأجر عن سداد الأجرة وتنازل عن العين للغير دون إذن؟'
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Button type="submit" icon={Send} disabled={loading}>
              {loading ? 'جاري التحليل والصياغة...' : 'توليد الصياغة القانونية'}
            </Button>
          </div>
        </form>

        {/* AI Response Output */}
        {response && (
          <div className="glass-card" style={{ padding: '20px', background: 'var(--bg-item)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} />
                {response.title}
              </h3>
              <button
                type="button"
                onClick={handleCopy}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                {copied ? 'تم النسخ!' : 'نسخ النص'}
              </button>
            </div>

            <div style={{
              whiteSpace: 'pre-line',
              fontSize: '0.92rem',
              lineHeight: 1.6,
              color: 'var(--text-main)',
              background: 'var(--bg-card)',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'inherit'
            }}>
              {response.content}
            </div>

            {response.advice && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(212, 168, 83, 0.1)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                <Lightbulb size={16} color="var(--primary)" />
                <span><strong>توجيه مهني:</strong> {response.advice}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
