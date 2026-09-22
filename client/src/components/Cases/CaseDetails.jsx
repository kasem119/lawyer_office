import React, { useState, useEffect } from 'react';
import { ArrowRight, FileText, Calendar, CheckSquare, Users, Upload, Plus, Download, History, Share2, StickyNote, CheckCircle2, RotateCcw, Edit, Trash2, Printer, Receipt } from 'lucide-react';
import Button from '../Shared/Button';
import CaseStatusBadge from './CaseStatusBadge';
import Modal from '../Shared/Modal';
import CaseForm from './CaseForm';
import DocumentUpload from '../Documents/DocumentUpload';
import DocumentVersions from '../Documents/DocumentVersions';
import DocumentShare from '../Documents/DocumentShare';
import EventForm from '../Calendar/EventForm';
import TaskForm from '../Tasks/TaskForm';
import CaseNotesList from '../CaseNotes/CaseNotesList';
import CaseFinancials from './CaseFinancials';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch, getServerUrl } from '../../api/client';

export default function CaseDetails({ caseId, onBack }) {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('documents'); // documents | events | tasks | lawyers

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDocForVersions, setSelectedDocForVersions] = useState(null);
  const [selectedDocForShare, setSelectedDocForShare] = useState(null);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/cases/${caseId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [caseId]);

  if (loading || !data) {
    return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '50px' }}>جاري تحميل تفاصيل القضية...</div>;
  }

  const { case: caseItem, assignedLawyers, documents, events, tasks } = data;

  const handleDownloadDoc = (docId) => {
    window.open(`${getServerUrl()}/api/documents/download/${docId}`, '_blank');
  };

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await apiFetch(`/cases/${caseId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchDetails();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'فشل تحديث حالة القضية');
      }
    } catch (err) {
      alert(err.message || 'فشل تحديث حالة القضية');
    }
  };

  const handleToggleDone = async () => {
    const nextStatus = caseItem.status === 'closed' ? 'active' : 'closed';
    const msg = nextStatus === 'closed' ? 'إغلاق القضية واعتبارها مكتملة ومنتهية' : 'إعادة تنشيط وفتح القضية';
    if (!window.confirm(`هل ترغب في ${msg}؟`)) return;
    await handleStatusChange(nextStatus);
  };

  const handleEditSave = async (formData) => {
    const res = await apiFetch(`/cases/${caseId}`, {
      method: 'PUT',
      body: JSON.stringify(formData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'فشل تحديث بيانات القضية');
    }
    setIsEditModalOpen(false);
    fetchDetails();
  };

  const handleDeleteCase = async () => {
    if (!window.confirm(`⚠️ تحذير نهائي:\nهل أنت متأكد من حذف القضية "${caseItem.title}" بشكل كامل؟\nسيتم مسح كافة الجلسات والمستندات والمهام المسجلة بها!`)) return;

    try {
      const res = await apiFetch(`/cases/${caseId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert('تم حذف القضية بنجاح.');
        onBack();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'فشل حذف القضية');
      }
    } catch (err) {
      alert(err.message || 'فشل حذف القضية');
    }
  };

  const [exporting, setExporting] = useState(false);

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const res = await apiFetch(`/exports/cases/${caseId}?format=pdf`);
      if (res.ok) {
        // use dynamic import to avoid altering the top-level imports directly if we didn't add it there
        // Actually I'll just use the fetch/blob directly inline since I might not have imported downloadBlob
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `case_${caseItem.case_number || caseId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert('فشل التصدير');
      }
    } catch (err) {
      alert('خطأ في التصدير');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Back & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '1rem' }}
        >
          <ArrowRight size={20} />
          العودة لقائمة القضايا
        </button>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button icon={Upload} onClick={() => setIsUploadModalOpen(true)}>إرفاق مستند</Button>
          <Button icon={Plus} variant="secondary" onClick={() => setIsEventModalOpen(true)}>إضافة موعد جلسة</Button>
          <Button icon={Plus} variant="secondary" onClick={() => setIsTaskModalOpen(true)}>إضافة مهمة</Button>
          <Button icon={Printer} variant="secondary" onClick={handleExportPdf} disabled={exporting} title="تصدير ملف القضية كـ PDF">
            {exporting ? 'جاري التصدير...' : 'تصدير PDF'}
          </Button>
        </div>
      </div>

      {/* Case Overview Banner Card */}
      <div className="glass-card" style={{ padding: '24px', borderRight: '6px solid var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: '800' }}>{caseItem.title}</h1>
              <CaseStatusBadge status={caseItem.status} />
              <span className={`badge badge-${caseItem.priority}`} style={{ fontSize: '0.75rem' }}>
                أولوية: {caseItem.priority === 'urgent' ? 'عاجلة جداً' : caseItem.priority === 'high' ? 'عالية' : caseItem.priority === 'low' ? 'عادية' : 'متوسطة'}
              </span>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span>رقم القضية: <strong style={{ direction: 'ltr', display: 'inline-block', color: 'var(--primary)' }}>{caseItem.case_number}</strong></span>
              <span>العميل: <strong>{caseItem.client_name}</strong> {caseItem.client_phone ? `(${caseItem.client_phone})` : ''}</span>
              <span>المحكمة: <strong>{caseItem.court_name}</strong></span>
              <span>النوع: <strong>{caseItem.case_type}</strong></span>
              <span>المحامي المسؤول: <strong>{caseItem.lead_lawyer_name}</strong></span>
            </div>

            {caseItem.opponent_name && (
              <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--error)', fontWeight: '700' }}>الطرف الخصم: </span>
                <strong>{caseItem.opponent_name}</strong>
                {caseItem.opponent_id_number && <span style={{ color: 'var(--text-muted)' }}> (الرقم/السجل: {caseItem.opponent_id_number})</span>}
                {caseItem.opponent_lawyer && <span> • محامي الخصم: <strong>{caseItem.opponent_lawyer}</strong></span>}
                {caseItem.opponent_phone && <span> • هاتف: {caseItem.opponent_phone}</span>}
              </div>
            )}
          </div>

          {/* Quick Management Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Status Dropdown */}
            <select
              className="form-select"
              style={{ padding: '6px 12px', fontSize: '0.85rem', fontWeight: '600' }}
              value={caseItem.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              title="تغيير حالة القضية مباشرة"
            >
              <option value="active">🟢 قضية نشطة (Active)</option>
              <option value="pending">🟡 قضية معلقة (Pending)</option>
              <option value="closed">⚪ منتهية / مغلقة (Closed)</option>
              <option value="archived">📦 مؤرشفة (Archived)</option>
            </select>

            {/* Quick Mark Done / Reopen button */}
            <Button
              variant="secondary"
              icon={caseItem.status === 'closed' ? RotateCcw : CheckCircle2}
              onClick={handleToggleDone}
              style={{
                fontSize: '0.85rem',
                color: caseItem.status === 'closed' ? 'var(--info)' : 'var(--success)',
                borderColor: caseItem.status === 'closed' ? 'var(--info)' : 'var(--success)'
              }}
            >
              {caseItem.status === 'closed' ? 'إعادة فتح القضية' : 'إغلاق القضية'}
            </Button>

            {/* Edit Case Button */}
            <Button variant="secondary" icon={Edit} onClick={() => setIsEditModalOpen(true)} style={{ fontSize: '0.85rem' }}>
              تعديل البيانات
            </Button>

            {/* Admin Delete Button */}
            {isAdmin && (
              <Button variant="danger" icon={Trash2} onClick={handleDeleteCase} style={{ fontSize: '0.85rem' }} title="حذف القضية نهائياً">
                حذف
              </Button>
            )}
          </div>
        </div>

        {caseItem.description && (
          <div style={{ background: 'var(--bg-item)', padding: '14px', borderRadius: '8px', fontSize: '0.92rem', marginTop: '12px', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', lineHeight: '1.6' }}>
            <strong style={{ color: 'var(--primary)' }}>الوقائع والوصف القانوني: </strong> {caseItem.description}
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('documents')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'documents' ? 'var(--primary-light)' : 'transparent',
            color: activeTab === 'documents' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'documents' ? '700' : '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FileText size={18} />
          المستندات والملفات ({documents.length})
        </button>

        <button
          onClick={() => setActiveTab('events')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'events' ? 'var(--primary-light)' : 'transparent',
            color: activeTab === 'events' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'events' ? '700' : '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Calendar size={18} />
          المواعيد والجلسات ({events.length})
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'tasks' ? 'var(--primary-light)' : 'transparent',
            color: activeTab === 'tasks' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'tasks' ? '700' : '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <CheckSquare size={18} />
          المهام والتكليفات ({tasks.length})
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'notes' ? 'var(--primary-light)' : 'transparent',
            color: activeTab === 'notes' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'notes' ? '700' : '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <StickyNote size={18} />
          ملاحظات وتطورات
        </button>

        <button
          onClick={() => setActiveTab('finance')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'finance' ? 'var(--primary-light)' : 'transparent',
            color: activeTab === 'finance' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'finance' ? '700' : '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Receipt size={18} />
          المالية والأتعاب
        </button>

        <button
          onClick={() => setActiveTab('lawyers')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'lawyers' ? 'var(--primary-light)' : 'transparent',
            color: activeTab === 'lawyers' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'lawyers' ? '700' : '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Users size={18} />
          المحامون المكلفون ({assignedLawyers.length})
        </button>
      </div>

      {/* Tab Content Panels */}
      {activeTab === 'documents' && (
        <div className="glass-card" style={{ padding: '20px' }}>
          {documents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>لا توجد مستندات مرفقة بهذه القضية</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {documents.map((doc) => (
                <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', background: 'var(--bg-item)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileText size={24} color="var(--primary)" />
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{doc.original_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        الإصدار: v{doc.current_version} | بواسطة: {doc.uploader_name} | التاريخ: {new Date(doc.created_at).toLocaleDateString('ar-LY')}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="secondary" icon={Download} onClick={() => handleDownloadDoc(doc.id)} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>تحميل</Button>
                    <Button variant="secondary" icon={History} onClick={() => setSelectedDocForVersions(doc)} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>الإصدارات</Button>
                    <Button variant="secondary" icon={Share2} onClick={() => setSelectedDocForShare(doc)} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>مشاركة</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="glass-card" style={{ padding: '20px' }}>
          {events.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>لا توجد جلسات أو مواعيد مسجلة لهذه القضية</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {events.map((evt) => (
                <div key={evt.id} style={{ padding: '14px', background: 'var(--bg-item)', borderRadius: '8px', border: '1px solid var(--border-subtle)', borderRight: '4px solid var(--warning)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
                    <span>{evt.title}</span>
                    <span style={{ color: 'var(--primary)' }}>{evt.date} {evt.time}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    الموقع: {evt.location || 'غير محدد'} | {evt.description}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="glass-card" style={{ padding: '20px' }}>
          {tasks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>لا توجد مهام محددة لهذه القضية</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tasks.map((tsk) => (
                <div key={tsk.id} style={{ padding: '14px', background: 'var(--bg-item)', borderRadius: '8px', border: '1px solid var(--border-subtle)', borderRight: '4px solid var(--info)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
                    <span>{tsk.title}</span>
                    <span className={`badge badge-${tsk.status}`}>{tsk.status}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    المكلف: {tsk.assigned_to_name} | تاريخ الاستحقاق: {tsk.due_date || 'غير محدد'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <CaseNotesList caseId={caseId} />
      )}

      {activeTab === 'finance' && (
        <CaseFinancials
          caseId={caseItem.id}
          clientId={caseItem.client_id}
          caseNumber={caseItem.case_number}
          caseTitle={caseItem.title}
          clientName={caseItem.client_name}
        />
      )}

      {activeTab === 'lawyers' && (
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            {assignedLawyers.map((l) => (
              <div key={l.id} style={{ padding: '16px', background: 'var(--bg-item)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: '700', color: 'var(--primary)' }}>{l.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{l.email}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{l.phone}</div>
                <span className="badge badge-active" style={{ marginTop: '8px' }}>{l.role_in_case === 'lead' ? 'محامي رئيسي' : 'محامي مساعد'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`تعديل بيانات القضية (${caseItem.case_number})`}>
        <CaseForm initialValues={caseItem} onSave={handleEditSave} onCancel={() => setIsEditModalOpen(false)} />
      </Modal>

      <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="إرفاق مستند جديد للقضية">
        <DocumentUpload caseId={caseId} onUploaded={() => { setIsUploadModalOpen(false); fetchDetails(); }} />
      </Modal>

      <Modal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} title="إضافة موعد جلسة / اجتماع">
        <EventForm defaultCaseId={caseId} onSaved={() => { setIsEventModalOpen(false); fetchDetails(); }} />
      </Modal>

      <Modal isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} title="إضافة مهمة جديدة للقضية">
        <TaskForm defaultCaseId={caseId} onSaved={() => { setIsTaskModalOpen(false); fetchDetails(); }} />
      </Modal>

      <Modal isOpen={!!selectedDocForVersions} onClose={() => setSelectedDocForVersions(null)} title="تاريخ إصدارات المستند">
        {selectedDocForVersions && <DocumentVersions document={selectedDocForVersions} onUpdated={fetchDetails} />}
      </Modal>

      <Modal isOpen={!!selectedDocForShare} onClose={() => setSelectedDocForShare(null)} title="مشاركة المستند مع محامي">
        {selectedDocForShare && <DocumentShare document={selectedDocForShare} onShared={() => setSelectedDocForShare(null)} />}
      </Modal>
    </div>
  );
}
