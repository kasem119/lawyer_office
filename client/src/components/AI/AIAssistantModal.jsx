import React, { useState, useEffect, useRef } from 'react';
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
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [downloading, setDownloading] = useState(null);
  const downloadUrls = useRef(new Set());
  const timers = useRef(new Set());
  const requestController = useRef(null);
  const downloadController = useRef(null);

  useEffect(() => () => {
    requestController.current?.abort();
    downloadController.current?.abort();
    timers.current.forEach(clearTimeout);
    downloadUrls.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (isOpen) {
      const controller = new AbortController();
      setError('');
      setStatus(null);
      setStatusError('');
      setStatusLoading(true);
      setCaseId(defaultCaseId || '');
      setLoading(false);
      setDownloading(null);
      apiFetch('/cases', { signal: controller.signal })
        .then(res => {
          if (!res.ok) throw new Error('تعذر تحميل القضايا.');
          return res.json();
        })
        .then(data => { if (!controller.signal.aborted) setCases(data.cases || []); })
        .catch(err => { if (err.name !== 'AbortError') setError('تعذر تحميل قائمة القضايا. يمكنك إعادة فتح المساعد للمحاولة.'); });
      apiFetch('/ai/status', { signal: controller.signal })
        .then(async res => {
          if (!res.ok) throw new Error('تعذر التحقق من جاهزية المساعد.');
          const json = await res.json();
          if (!controller.signal.aborted) setStatus(json.data || json);
        })
        .catch(err => {
          if (err.name !== 'AbortError') setStatusError('تعذر التحقق من جاهزية المساعد.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setStatusLoading(false);
        });
      return () => {
        controller.abort();
        requestController.current?.abort();
        downloadController.current?.abort();
      };
    }
  }, [isOpen, defaultCaseId]);

  const changeMode = (nextMode) => {
    requestController.current?.abort();
    setLoading(false);
    setMode(nextMode);
    setResponse(null);
    setError('');
    setCopied(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!prompt.trim() && mode !== 'summarize_case') return;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    try {
      setLoading(true);
      setResponse(null);
      setError('');
      setCopied(false);
      const res = await apiFetch('/ai/assist', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          mode,
          prompt,
          case_id: mode !== 'draft_clause' && caseId ? Number(caseId) : null
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (!controller.signal.aborted) setResponse(json.data);
      } else {
        const err = await res.json().catch(() => ({}));
        if (!controller.signal.aborted) setError(err.message || 'حدث خطأ أثناء معالجة الطلب');
      }
    } catch (err) {
      if (!controller.signal.aborted) setError('خطأ في الاتصال بالخادم. حاول مرة أخرى.');
    } finally {
      if (requestController.current === controller && !controller.signal.aborted) setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!response?.content) return;
    try {
      await navigator.clipboard.writeText(response.content);
      setCopied(true);
      const timer = setTimeout(() => { setCopied(false); timers.current.delete(timer); }, 2000);
      timers.current.add(timer);
    } catch {
      setError('تعذر نسخ النص. يمكنك تحديده ونسخه يدوياً.');
    }
  };

  const downloadLaw = async (source) => {
    const controller = new AbortController();
    downloadController.current = controller;
    setDownloading(source.law_id);
    setError('');
    try {
      const res = await apiFetch(`/ai/laws/${encodeURIComponent(source.law_id)}/pdf`, { signal: controller.signal });
      if (!res.ok) throw new Error('تعذر تحميل نسخة القانون. حاول مرة أخرى.');
      const blob = await res.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      downloadUrls.current.add(url);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(source.law_title || 'القانون').replace(/[\\/:*?"<>|]/g, '_')}.pdf`;
      link.click();
      const timer = setTimeout(() => {
        URL.revokeObjectURL(url);
        downloadUrls.current.delete(url);
        timers.current.delete(timer);
      }, 60000);
      timers.current.add(timer);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || 'تعذر تحميل نسخة القانون.');
    } finally {
      if (!controller.signal.aborted) setDownloading(null);
    }
  };

  const lawCount = status?.corpus?.law_count ?? status?.law_count;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="المساعد القانوني الذكي (AI Legal Assistant)"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div aria-live="polite" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
          {statusLoading ? 'جاري التحقق من جاهزية المساعد...' : statusError || (status && (
            <>
              <strong style={{ color: 'var(--text-main)' }}>{status.enabled === false ? 'خدمة المستشار غير مفعلة' : status.ready ? 'محرك البحث جاهز ومزود التوليد مضبوط' : 'خدمة المستشار غير جاهزة حالياً'}</strong>
              {status.enabled !== false && <> · بحث نصي في القوانين الليبية{Number.isInteger(lawCount) ? ` (${lawCount} قانوناً ووثيقة)` : ''} · {status.provider_configured ? 'إعداد المزود موجود؛ نجاح التوليد يتحقق عند إرسال الطلب' : 'مزود التوليد غير مضبوط'}</>}
            </>
          ))}
          <div>المجموعة المتاحة لا تغطي بالضرورة كل القوانين وتعديلاتها. راجع نص المصدر ودقة استخراج النص قبل اعتماد المسودة.</div>
        </div>
        {/* Mode Selector Tabs */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${mode === 'draft_clause' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => changeMode('draft_clause')}
            disabled={loading}
            style={{ fontSize: '0.85rem' }}
          >
            <Sparkles size={16} />
            صياغة بنود العقود
          </button>
          <button
            type="button"
            className={`btn ${mode === 'legal_advice' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => changeMode('legal_advice')}
            disabled={loading}
            style={{ fontSize: '0.85rem' }}
          >
            <BookOpen size={16} />
            تأصيل واستشارة قانونية
          </button>
          <button
            type="button"
            className={`btn ${mode === 'summarize_case' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => changeMode('summarize_case')}
            disabled={loading}
            style={{ fontSize: '0.85rem' }}
          >
            <FileText size={16} />
            تلخيص قضية واستراتيجية دفاع
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} aria-busy={loading} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mode === 'summarize_case' ? (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="ai-summary-case">اختر القضية المراد تلخيصها وتحليلها:</label>
              <select
                id="ai-summary-case"
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
                  <label className="form-label" htmlFor="ai-advice-case">القضية المرتبطة (اختياري):</label>
                  <select
                    id="ai-advice-case"
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
                <label className="form-label" htmlFor="ai-prompt">
                  {mode === 'draft_clause'
                    ? 'ما نوع البند أو الالتزام المراد صياغته؟ (مثال: شرط التحكيم، سرية البيانات، الشرط الجزائي، القوة القاهرة)'
                    : 'اكتب تفاصيل الواقعة أو السؤال القانوني:'}
                </label>
                <textarea
                  id="ai-prompt"
                  maxLength={status?.enabled ? 4000 : undefined}
                  aria-describedby={status?.enabled ? 'ai-prompt-limit' : undefined}
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
                {status?.enabled && <small id="ai-prompt-limit" style={{ color: 'var(--text-muted)' }}>حد الطلب 4000 حرف، مع إجابة موجزة لتقليل استهلاك التوكنات. {prompt.length}/4000</small>}
              </div>
            </>
          )}

          {mode !== 'draft_clause' && caseId && <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>اختيار القضية يتيح إرسال سياقها المصرح لك به إلى مزود الذكاء الاصطناعي للتحليل.</p>}

          {error && <div role="alert" style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</div>}

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

            {response.no_evidence && <div role="status" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>لم تُعثر على مقتطفات كافية للإجابة من القوانين المتاحة. هذه النتيجة ليست تأصيلاً موثقاً.</div>}

            {response.source === 'mustashar' && Array.isArray(response.sources) && response.sources.length > 0 && (
              <section aria-label="المصادر القانونية" style={{ display: 'grid', gap: '10px' }}>
                <h4 style={{ margin: 0 }}>المقتطفات القانونية المستخدمة</h4>
                {response.sources.map((source, index) => (
                  <details key={source.id || `${source.law_id}-${source.page}-${index}`} style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <summary style={{ cursor: 'pointer', lineHeight: 1.7 }}>[{index + 1}] {source.law_title} {source.article ? ` · المادة ${source.article}` : ''}{source.page ? ` · صفحة ${source.page}` : ''}</summary>
                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{source.excerpt}</p>
                    {source.law_id && <button type="button" className="btn btn-secondary" disabled={downloading !== null} onClick={() => downloadLaw(source)}>{downloading === source.law_id ? 'جاري التحميل...' : 'تحميل القانون PDF'}</button>}
                  </details>
                ))}
              </section>
            )}

            {response.advice && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(212, 168, 83, 0.1)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                <Lightbulb size={16} color="var(--primary)" />
                <span><strong>توجيه مهني:</strong> {response.advice}</span>
              </div>
            )}

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {response.source === 'mustashar'
                ? `مصدر الإجابة: المستشار، اعتماداً على مقتطفات المجموعة القانونية${response.model ? ` · ${response.model}` : ''}. للمراجعة المهنية قبل الاعتماد.`
                : response.source === 'llm'
                ? `مصدر الإجابة: نموذج لغوي (${response.model || 'LLM'}) — للمراجعة المهنية قبل الاعتماد.`
                : 'مصدر الإجابة: قالب محلي للمساعدة في الصياغة؛ لا يمثل إجابة موثقة من قاعدة القوانين.'}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
