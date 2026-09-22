import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Printer, 
  Copy, 
  Check, 
  RefreshCw, 
  User, 
  Briefcase, 
  Calendar, 
  Scale, 
  Sparkles,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import Button from '../Shared/Button';
import { apiFetch } from '../../api/client';

const PLACEHOLDER_LABELS = {
  client_name: 'اسم العميل / الموكل',
  client_id_number: 'الرقم الوطني / السجل التجاري',
  client_phone: 'رقم هاتف العميل',
  client_address: 'عنوان العميل / الإقامة',
  lawyer_name: 'اسم المحامي الوكيل',
  office_address: 'عنوان مكتب المحاماة',
  case_number: 'رقم القضية / الملف',
  case_description: 'وصف أو ملخص القضية',
  court_name: 'اسم المحكمة المختصة',
  court_circuit: 'الدائرة القضائية',
  hearing_date: 'تاريخ الجلسة',
  opponent_name: 'اسم الخصم / المنذر إليه',
  opponent_role: 'صفة الخصم (مدعى عليه / مستأنف ضد)',
  opponent_address: 'عنوان الخصم',
  client_role: 'صفة الموكل (مدعي / مستأنف)',
  case_facts: 'وقائع الدعوى',
  legal_defenses: 'الأسانيد والدفوع القانونية',
  final_requests: 'الطلبات الختامية',
  contract_subject: 'موضوع العقد / الاتفاق',
  total_fees: 'إجمالي الأتعاب (أرقام)',
  fees_written: 'إجمالي الأتعاب (كتابة)',
  advance_payment: 'المقدم المدفوع',
  remaining_payment: 'المبلغ المتبقي',
  debt_amount: 'مبلغ الدين المطالب به',
  debt_reason: 'سبب المديونية (عقد / شيك)',
  due_date: 'تاريخ الاستحقاق',
  grace_period_days: 'مهلة السداد (بالأيام)',
  date: 'تاريخ اليوم'
};

export default function TemplateGenerator({ initialTemplate, templates = [], onBack, onClose }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplate?.id || (templates[0]?.id || ''));
  const [currentTemplate, setCurrentTemplate] = useState(initialTemplate || null);
  const [values, setValues] = useState({});
  const [clients, setClients] = useState([]);
  const [cases, setCases] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const documentPreviewRef = useRef(null);

  // Fetch all templates if not passed
  useEffect(() => {
    if (!initialTemplate && templates.length > 0) {
      const first = templates[0];
      setSelectedTemplateId(first.id);
      setCurrentTemplate(first);
    } else if (initialTemplate) {
      setCurrentTemplate(initialTemplate);
      setSelectedTemplateId(initialTemplate.id);
    }
  }, [initialTemplate, templates]);

  // Fetch clients and cases for auto-fill
  useEffect(() => {
    const fetchContextData = async () => {
      try {
        const [clientsRes, casesRes] = await Promise.all([
          apiFetch('/clients'),
          apiFetch('/cases')
        ]);
        if (clientsRes.ok) {
          const clientsData = await clientsRes.json();
          setClients(clientsData.clients || clientsData.data || []);
        }
        if (casesRes.ok) {
          const casesData = await casesRes.json();
          setCases(casesData.cases || casesData.data || []);
        }
      } catch (err) {
        console.error('Error fetching clients or cases:', err);
      }
    };
    fetchContextData();
  }, []);

  // When template changes, fetch full template details and initialize default values
  useEffect(() => {
    if (!selectedTemplateId) return;
    const fetchTemplateDetails = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/templates/${selectedTemplateId}`);
        if (res.ok) {
          const data = await res.json();
          const t = data.template;
          setCurrentTemplate(t);

          // Initialize default values for common placeholders
          const todayStr = new Date().toLocaleDateString('ar-LY', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

          const initialVals = {
            date: todayStr,
            office_address: 'طرابلس - ليبيا',
            lawyer_name: 'أ. أحمد المحامي'
          };

          (t.placeholders || []).forEach(p => {
            if (initialVals[p] === undefined) {
              initialVals[p] = '';
            }
          });

          setValues(prev => ({ ...initialVals, ...prev }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplateDetails();
  }, [selectedTemplateId]);

  // Handle Client Auto-fill
  const handleClientSelect = (clientId) => {
    setSelectedClientId(clientId);
    if (!clientId) return;
    const client = clients.find(c => String(c.id) === String(clientId));
    if (client) {
      setValues(prev => ({
        ...prev,
        client_name: client.name || prev.client_name || '',
        client_phone: client.phone || prev.client_phone || '',
        client_address: client.address || prev.client_address || '',
        client_id_number: client.national_id_encrypted || client.national_id || prev.client_id_number || ''
      }));
    }
  };

  // Handle Case Auto-fill
  const handleCaseSelect = (caseId) => {
    setSelectedCaseId(caseId);
    if (!caseId) return;
    const caseItem = cases.find(c => String(c.id) === String(caseId));
    if (caseItem) {
      setValues(prev => ({
        ...prev,
        case_number: caseItem.case_number || prev.case_number || '',
        court_name: caseItem.court_name || prev.court_name || '',
        contract_subject: caseItem.title || prev.contract_subject || '',
        case_description: caseItem.description || prev.case_description || '',
        client_name: caseItem.client_name || prev.client_name || '',
        lawyer_name: caseItem.lead_lawyer_name || prev.lawyer_name || ''
      }));
    }
  };

  const handleValueChange = (placeholder, val) => {
    setValues(prev => ({
      ...prev,
      [placeholder]: val
    }));
  };

  // Compute rendered HTML locally for instantaneous live preview
  const getRenderedHtml = () => {
    if (!currentTemplate?.content_html) return '';
    let html = currentTemplate.content_html;
    html = html.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      const val = values[trimmedKey];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return `<span style="color: #0f172a; font-weight: 600;">${val}</span>`;
      }
      return `<span style="background-color: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px; font-size: 0.85em;">[${PLACEHOLDER_LABELS[trimmedKey] || trimmedKey}]</span>`;
    });
    return html;
  };

  // Printable HTML (clean without highlighting background)
  const getCleanPrintHtml = () => {
    if (!currentTemplate?.content_html) return '';
    let html = currentTemplate.content_html;
    html = html.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      const val = values[trimmedKey];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val);
      }
      return `.................`;
    });
    return html;
  };

  // Print Document Action
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const cleanHtml = getCleanPrintHtml();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>${currentTemplate?.name || 'مستند قانوني'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4;
            margin: 20mm 18mm 20mm 18mm;
          }
          * {
            box-sizing: border-box;
            font-family: 'Cairo', system-ui, -apple-system, sans-serif;
          }
          body {
            background-color: #ffffff;
            color: #1e293b;
            margin: 0;
            padding: 0;
            line-height: 1.8;
            font-size: 14pt;
            direction: rtl;
          }
          .doc-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 24px;
          }
          .doc-header h1 {
            font-size: 16pt;
            margin: 0;
            color: #0f172a;
          }
          .doc-header p {
            font-size: 10pt;
            margin: 2px 0 0 0;
            color: #64748b;
          }
          .doc-title {
            text-align: center;
            font-size: 18pt;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 20px;
          }
          .doc-body {
            text-align: justify;
            font-size: 13pt;
          }
          .doc-body h2, .doc-body h3 {
            color: #0f172a;
            margin-top: 18px;
            margin-bottom: 10px;
          }
          .doc-body p {
            margin-bottom: 12px;
          }
          .doc-body ul, .doc-body ol {
            margin-right: 24px;
            margin-bottom: 14px;
          }
          .doc-footer {
            margin-top: 40px;
            border-top: 1px solid #cbd5e1;
            padding-top: 14px;
            display: flex;
            justify-content: space-between;
            font-size: 10pt;
            color: #64748b;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
          }
          td, th {
            padding: 8px;
          }
        </style>
      </head>
      <body>
        <div class="doc-header">
          <div>
            <h1>مكتب المحاماة للاستشارات والتقاضي</h1>
            <p>شؤون المحاماة والترافع أمام جميع الهيئات القضائية</p>
          </div>
          <div style="text-align: left; font-size: 10pt; color: #475569;">
            <p><strong>التاريخ:</strong> ${values.date || new Date().toLocaleDateString('ar-LY')}</p>
            <p><strong>الرقم المرجعي:</strong> DOC-${Date.now().toString().slice(-6)}</p>
          </div>
        </div>

        <div class="doc-body">
          ${cleanHtml}
        </div>

        <div class="doc-footer">
          <span>حرر بمعرفة المنظومة القانونية</span>
          <span>صفحة 1 من 1</span>
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.close();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Copy HTML/Text to clipboard
  const handleCopy = () => {
    const cleanHtml = getCleanPrintHtml();
    // Create temporary element to copy formatted plain text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cleanHtml;
    const plainText = tempDiv.innerText || tempDiv.textContent;
    navigator.clipboard.writeText(plainText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const placeholdersList = currentTemplate?.placeholders || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Bar / Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: 'var(--bg-card)',
        padding: '16px 20px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'var(--primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileText size={22} color="var(--primary)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
              توليد مستند من القالب
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              املأ الحقول المتغيرة لتوليد مستند رسمي جاهز للطباعة
            </p>
          </div>
        </div>

        {/* Template Selector if multiple templates */}
        {templates.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>اختر القالب:</label>
            <select
              className="form-select"
              style={{ width: '220px', padding: '6px 10px' }}
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" icon={copied ? Check : Copy} onClick={handleCopy}>
            {copied ? 'تم النسخ!' : 'نسخ النص'}
          </Button>
          <Button variant="primary" icon={Printer} onClick={handlePrint}>
            طباعة المستند
          </Button>
          {onClose && (
            <Button variant="secondary" onClick={onClose}>
              إغلاق
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid: Form on Left/Right & Live Document on other */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '20px', alignItems: 'start' }}>
        
        {/* Fill Form Pane */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Smart Auto-Fill Box */}
          <div style={{
            backgroundColor: 'var(--bg-item)',
            padding: '14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '700' }}>
              <Sparkles size={16} />
              <span>تعبئة ذكية تلقائية (اختياري):</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  جلب بيانات عميل:
                </label>
                <select
                  className="form-select"
                  style={{ width: '100%', fontSize: '0.85rem', padding: '6px 8px' }}
                  value={selectedClientId}
                  onChange={(e) => handleClientSelect(e.target.value)}
                >
                  <option value="">-- اختر عميلاً --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  جلب بيانات قضية:
                </label>
                <select
                  className="form-select"
                  style={{ width: '100%', fontSize: '0.85rem', padding: '6px 8px' }}
                  value={selectedCaseId}
                  onChange={(e) => handleCaseSelect(e.target.value)}
                >
                  <option value="">-- اختر قضية --</option>
                  {cases.map(cs => (
                    <option key={cs.id} value={cs.id}>{cs.case_number} - {cs.title}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px', margin: 0 }}>
            بيانات ومتغيرات المستند ({placeholdersList.length})
          </h4>

          {/* Placeholders Inputs */}
          {placeholdersList.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              هذا القالب لا يحتوي على متغيرات إضافية. يمكنك طباعته مباشرة.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '550px', overflowY: 'auto', paddingLeft: '4px' }}>
              {placeholdersList.map((tag) => {
                const label = PLACEHOLDER_LABELS[tag] || tag;
                const isLongText = ['case_facts', 'legal_defenses', 'final_requests', 'case_description'].includes(tag);

                return (
                  <div key={tag} className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{label}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', direction: 'ltr' }}>{`{{${tag}}}`}</span>
                    </label>
                    {isLongText ? (
                      <textarea
                        className="form-textarea"
                        style={{ minHeight: '70px', fontSize: '0.9rem' }}
                        value={values[tag] || ''}
                        onChange={(e) => handleValueChange(tag, e.target.value)}
                        placeholder={`أدخل ${label}...`}
                      />
                    ) : (
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontSize: '0.9rem' }}
                        value={values[tag] || ''}
                        onChange={(e) => handleValueChange(tag, e.target.value)}
                        placeholder={`أدخل ${label}...`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Document Preview Container (Official A4 Sheet layout) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--primary)' }}>
              المعاينة الحية للمستند الرسمي:
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              مقياس الورق A4 - جاهز للطباعة
            </span>
          </div>

          <div
            ref={documentPreviewRef}
            style={{
              backgroundColor: '#ffffff',
              color: '#0f172a',
              borderRadius: 'var(--radius-md)',
              padding: '36px 32px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
              border: '1px solid #cbd5e1',
              minHeight: '650px',
              maxHeight: '750px',
              overflowY: 'auto',
              direction: 'rtl',
              position: 'relative'
            }}
          >
            {/* Document Formal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid #0f172a',
              paddingBottom: '14px',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Scale size={20} color="#d4a853" />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#0f172a' }}>
                    مكتب المحاماة للاستشارات والتقاضي
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                    قسم الصياغة والعقود القانونية
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>
                <div><strong>التاريخ:</strong> {values.date || new Date().toLocaleDateString('ar-LY')}</div>
                <div><strong>الحالة:</strong> وثيقة رسمية معتمدة</div>
              </div>
            </div>

            {/* Document Body Content */}
            <iframe
              title="محتوى المستند"
              sandbox=""
              srcDoc={getRenderedHtml()}
              style={{
                width: '100%',
                minHeight: '350px',
                border: 'none',
                fontSize: '1rem',
                lineHeight: '1.8',
                color: '#1e293b',
                textAlign: 'justify'
              }}
            />

            {/* Document Stamp / Signature Placeholder */}
            <div style={{
              marginTop: '40px',
              borderTop: '1px dashed #cbd5e1',
              paddingTop: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.85rem',
              color: '#64748b'
            }}>
              <div>
                <span>ختم وتصديق مكتب المحاماة:</span>
                <div style={{
                  width: '80px',
                  height: '80px',
                  border: '1px dashed #94a3b8',
                  borderRadius: '50%',
                  marginTop: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  color: '#94a3b8'
                }}>
                  [موضع الختم]
                </div>
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ margin: '0 0 30px 0' }}><strong>توقيع المستلم / المعتمد:</strong></p>
                <p style={{ margin: 0, color: '#94a3b8' }}>................................................</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
