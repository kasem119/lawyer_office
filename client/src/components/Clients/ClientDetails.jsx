import React, { useState, useEffect } from 'react';
import { ArrowRight, Briefcase, Phone, Mail, MapPin, Shield, Edit, Trash2, Plus, Printer } from 'lucide-react';
import Button from '../Shared/Button';
import CaseStatusBadge from '../Cases/CaseStatusBadge';
import Modal from '../Shared/Modal';
import ClientForm from './ClientForm';
import CaseForm from '../Cases/CaseForm';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../api/client';

export default function ClientDetails({ clientId, onBack, onViewCase }) {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddCaseModalOpen, setIsAddCaseModalOpen] = useState(false);

  const fetchClient = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/clients/${clientId}`);
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
    fetchClient();
  }, [clientId]);

  if (loading || !data) {
    return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '50px' }}>جاري تحميل ملف العميل...</div>;
  }

  const { client, cases } = data;

  const handleEditSave = async (formData) => {
    const res = await apiFetch(`/clients/${clientId}`, {
      method: 'PUT',
      body: JSON.stringify(formData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'فشل تحديث بيانات العميل');
    }
    setIsEditModalOpen(false);
    fetchClient();
  };

  const handleAddCaseSave = async (formData) => {
    const res = await apiFetch('/cases', {
      method: 'POST',
      body: JSON.stringify({ ...formData, client_id: clientId })
    });
    const resData = await res.json();
    if (!res.ok) {
      if (resData.isConflict) {
        const confirmForce = window.confirm(`تنبيه تعارض مصالح: ${resData.message}\nهل ترغب في إنشاء القضية؟`);
        if (confirmForce) {
          return handleAddCaseSave({ ...formData, force: true });
        }
      }
      throw new Error(resData.message || 'فشل إنشاء القضية');
    }
    setIsAddCaseModalOpen(false);
    fetchClient();
  };

  const handleDeleteClient = async () => {
    if (!window.confirm(`هل أنت متأكد من حذف العميل "${client.name}"؟`)) return;

    try {
      const res = await apiFetch(`/clients/${clientId}`, { method: 'DELETE' });
      const resData = await res.json();
      if (res.ok) {
        alert(resData.message || 'تم حذف العميل بنجاح');
        onBack();
      } else {
        if (resData.hasLinkedCases) {
          const forceConfirm = window.confirm(`${resData.message}\n\nهل ترغب في الحذف الإجباري للعميل مع كافة قضاياه؟`);
          if (forceConfirm) {
            const forceRes = await apiFetch(`/clients/${clientId}?force=true`, { method: 'DELETE' });
            if (forceRes.ok) {
              alert('تم الحذف بنجاح');
              onBack();
            } else {
              const err = await forceRes.json();
              alert(err.message || 'فشل الحذف');
            }
          }
        } else {
          alert(resData.message || 'فشل حذف العميل');
        }
      }
    } catch (err) {
      alert(err.message || 'فشل حذف العميل');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '1rem', width: 'fit-content' }}
        >
          <ArrowRight size={20} />
          العودة لـ دليل العملاء
        </button>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button icon={Plus} onClick={() => setIsAddCaseModalOpen(true)}>فتح قضية جديدة للعميل</Button>
          <Button icon={Edit} variant="secondary" onClick={() => setIsEditModalOpen(true)}>تعديل بيانات العميل</Button>
          <Button icon={Printer} variant="secondary" onClick={handlePrint} title="طباعة كشف العميل">طباعة</Button>
          {isAdmin && (
            <Button icon={Trash2} variant="danger" onClick={handleDeleteClient}>حذف العميل</Button>
          )}
        </div>
      </div>

      {/* Client Information Header */}
      <div className="glass-card" style={{ padding: '24px', borderRight: '6px solid var(--primary)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '16px' }}>{client.name}</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} color="var(--primary)" />
            <span>الرقم الوطني/السجل (مشفر): <strong style={{ direction: 'ltr', display: 'inline-block', color: 'var(--text-main)' }}>{client.national_id || 'غير مدخل'}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Phone size={18} color="var(--primary)" />
            <span>الهاتف: <strong style={{ direction: 'ltr', display: 'inline-block', color: 'var(--text-main)' }}>{client.phone || 'غير مدخل'}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mail size={18} color="var(--primary)" />
            <span>البريد: <strong style={{ color: 'var(--text-main)' }}>{client.email || 'غير مدخل'}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={18} color="var(--primary)" />
            <span>العنوان: <strong style={{ color: 'var(--text-main)' }}>{client.address || 'غير مدخل'}</strong></span>
          </div>
        </div>

        {client.notes && (
          <div style={{ marginTop: '16px', background: 'var(--bg-item)', padding: '14px', borderRadius: '8px', fontSize: '0.9rem', border: '1px solid var(--border-subtle)', lineHeight: '1.6' }}>
            <strong style={{ color: 'var(--primary)' }}>ملاحظات وتفاصيل العميل: </strong> {client.notes}
          </div>
        )}
      </div>

      {/* Linked Cases Section */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Briefcase size={20} />
            قضايا العميل المسجلة بالمكتب ({cases.length})
          </h3>
          <Button icon={Plus} variant="secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }} onClick={() => setIsAddCaseModalOpen(true)}>
            إضافة قضية
          </Button>
        </div>

        {cases.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>لا توجد قضايا مسجلة باسم هذا العميل حتى الآن</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {cases.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', background: 'var(--bg-item)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{c.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    رقم القضية: <span style={{ direction: 'ltr', display: 'inline-block', color: 'var(--primary)' }}>{c.case_number}</span> | المحكمة: {c.court_name} | المحامي المسؤول: {c.lead_lawyer_name}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CaseStatusBadge status={c.status} />
                  <Button variant="secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => onViewCase(c.id)}>عرض القضية</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Client Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`تعديل بيانات العميل (${client.name})`}>
        <ClientForm initialValues={client} onSave={handleEditSave} onCancel={() => setIsEditModalOpen(false)} />
      </Modal>

      {/* Quick Add Case for this Client Modal */}
      <Modal isOpen={isAddCaseModalOpen} onClose={() => setIsAddCaseModalOpen(false)} title={`فتح قضية جديدة لـ (${client.name})`}>
        <CaseForm initialValues={{ client_id: client.id }} onSave={handleAddCaseSave} onCancel={() => setIsAddCaseModalOpen(false)} />
      </Modal>
    </div>
  );
}
