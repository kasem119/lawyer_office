import React, { useState } from 'react';
import Modal from '../Shared/Modal';
import Button from '../Shared/Button';
import { UserCheck, Briefcase, Calendar, Receipt, LogOut, CheckCircle2, AlertCircle, Activity } from 'lucide-react';
import { apiFetch, getServerUrl } from '../../api/client';
import './ClientPortalModal.css';

export default function ClientPortalModal({ isOpen, onClose }) {
  const [identifier, setIdentifier] = useState('');
  const [clientData, setClientData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('cases');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    try {
      setLoading(true);
      setError('');
      const res = await apiFetch('/portal/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim() })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'فشل التحقق من بيانات الموكل');
      }

      // Fetch overview using client token
      const overviewRes = await fetch(`${getServerUrl()}/api/portal/overview`, {
        headers: { 'Authorization': `Bearer ${json.token}` }
      });

      if (overviewRes.ok) {
        const overviewJson = await overviewRes.json();
        setClientData(overviewJson.data);
      } else {
        throw new Error('فشل جلب ملف الموكل');
      }
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء الدخول');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setClientData(null);
    setIdentifier('');
    setError('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={<span className="client-portal-title">بوابة الموكل الإلكترونية<bdi className="client-portal-subtitle" dir="ltr">Client Self-Service Portal</bdi></span>}
    >
      {!clientData ? (
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '440px', margin: 'auto', padding: '20px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
              <UserCheck size={28} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>مرحباً بك في بوابة الموكلين</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              أدخل رقم الهاتف أو الرقم الوطني المسجل لدى المكتب لمتابعة قضاياك وجلساتك وفواتيرك
            </p>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--error)', borderRadius: '6px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">رقم الهاتف أو الرقم الوطني المسجل *</label>
            <input
              type="text"
              className="form-input"
              placeholder="مثال: 0912345678 أو 119900123456"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
            />
          </div>

          <Button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'جاري التحقق...' : 'دخول إلى ملفي'}
          </Button>
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Client Header Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-item)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary)' }}>
                {clientData.client?.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                الهاتف: {clientData.client?.phone || '-'}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--error)' }}
            >
              <LogOut size={14} />
              خروج
            </button>
          </div>

          {/* Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
            <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--primary)' }}>{clientData.cases?.filter(c => c.status === 'active').length || 0}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>قضايا نشطة</div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--warning)' }}>{clientData.upcoming_events?.length || 0}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>جلسات قادمة</div>
            </div>
            <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--error)' }}>
                {clientData.invoices?.filter(i => i.status !== 'paid').length || 0}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>فواتير مستحقة</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="client-portal-tabs" aria-label="أقسام بوابة الموكل">
            <button
              type="button"
              className={`btn ${activeTab === 'cases' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('cases')}
            >
              <Briefcase size={16} />
              <span>قضاياي ({clientData.cases?.length || 0})</span>
            </button>
            <button
              type="button"
              className={`btn ${activeTab === 'events' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('events')}
            >
              <Calendar size={16} />
              <span>الجلسات القادمة ({clientData.upcoming_events?.length || 0})</span>
            </button>
            <button
              type="button"
              className={`btn ${activeTab === 'updates' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('updates')}
            >
              <Activity size={16} />
              <span>تحديثات القضايا ({clientData.recent_updates?.length || 0})</span>
            </button>
            <button
              type="button"
              className={`btn ${activeTab === 'invoices' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('invoices')}
            >
              <Receipt size={16} />
              <span>الفواتير والمطالبات ({clientData.invoices?.length || 0})</span>
            </button>
          </div>

          {/* Cases View */}
          {activeTab === 'cases' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {clientData.cases?.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>لا توجد قضايا مسجلة باسمك حالياً</p>
              ) : (
                clientData.cases.map(c => (
                  <div key={c.id} style={{ padding: '14px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)' }}>{c.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        رقم القضية: <strong style={{ color: 'var(--primary)' }}>{c.case_number}</strong> | المحكمة: {c.court || 'غير محدد'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        النوع: {c.case_type || 'غير محدد'} | المحامي: {c.lead_lawyer_name || 'مكتب المحاماة'} | تاريخ الفتح: {c.opened_at ? new Date(c.opened_at).toLocaleDateString('ar-EG') : '-'}
                      </div>
                    </div>
                    <span className={`badge badge-${c.status}`}>
                      {c.status === 'active' ? 'قيد النظر' : c.status === 'pending' ? 'معلقة' : 'مغلقة'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Events View */}
          {activeTab === 'events' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {clientData.upcoming_events?.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>لا توجد جلسات أو مواعيد مجدولة قريباً</p>
              ) : (
                clientData.upcoming_events.map(ev => (
                  <div key={ev.id} style={{ padding: '14px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)' }}>{ev.title} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>({ev.event_type === 'court_date' ? 'جلسة محكمة' : ev.event_type === 'meeting' ? 'اجتماع' : ev.event_type === 'deadline' ? 'موعد نهائي' : 'استشارة'})</span></div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        القضية: {ev.case_title} ({ev.case_number}) | المكان: {ev.location || 'قاعة المحكمة'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'left', fontWeight: '700', color: 'var(--warning)', fontSize: '0.9rem' }}>
                      {ev.date} {ev.time ? `- ${ev.time}` : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Updates View */}
          {activeTab === 'updates' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(!clientData.recent_updates || clientData.recent_updates.length === 0) ? (
                <p style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>لا توجد تحديثات جديدة</p>
              ) : (
                clientData.recent_updates.map(upd => (
                  <div key={upd.id} style={{ padding: '14px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                        تحديث في قضية: {upd.case_title} ({upd.case_number})
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(upd.created_at).toLocaleDateString('ar-EG')}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5', background: 'var(--bg-body)', padding: '10px', borderRadius: '6px' }}>
                      {upd.content}
                    </div>
                    <div style={{ alignSelf: 'flex-end' }}>
                      <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                        {upd.note_type === 'court_result' ? 'نتيجة جلسة' : upd.note_type === 'update' ? 'تحديث عام' : upd.note_type === 'meeting' ? 'ملخص اجتماع' : 'ملاحظة'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Invoices View */}
          {activeTab === 'invoices' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {clientData.invoices?.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>لا توجد فواتير أتعاب مسجلة</p>
              ) : (
                clientData.invoices.map(inv => (
                  <div key={inv.id} style={{ padding: '14px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)' }}>{inv.invoice_number}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        القضية: {inv.case_title} ({inv.case_number}) | الاستحقاق: {inv.due_date || 'عند الاستلام'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '1rem' }}>
                        {Number(inv.total_amount).toLocaleString()} د.ل
                      </div>
                      <span className={`badge ${inv.status === 'paid' ? 'badge-active' : 'badge-urgent'}`}>
                        {inv.status === 'paid' ? 'مدفوعة' : 'مستحقة'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
