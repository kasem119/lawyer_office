import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  CreditCard, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  Search, 
  Filter, 
  Calendar, 
  ShieldCheck, 
  Clock, 
  AlertCircle,
  MoreVertical,
  ArrowUpRight,
  ShieldAlert,
  ChevronDown,
  Phone,
  MapPin
} from 'lucide-react';
import Button from '../Shared/Button';
import LoadingSpinner from '../Shared/LoadingSpinner';
import { apiFetch } from '../../api/client';

export default function PlatformAdmin() {
  const [stats, setStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Feedback
  const [actionMessage, setActionMessage] = useState('');

  // Selected office for modal action
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [extendMonths, setExtendMonths] = useState(12);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, tenantsRes, paymentsRes] = await Promise.all([
        apiFetch('/platform/stats'),
        apiFetch('/platform/tenants'),
        apiFetch('/platform/payments/pending')
      ]);

      if (statsRes.ok) {
        const s = await statsRes.json();
        setStats(s.stats);
      }
      if (tenantsRes.ok) {
        const t = await tenantsRes.json();
        setTenants(t.tenants || []);
      }
      if (paymentsRes.ok) {
        const p = await paymentsRes.json();
        setPendingPayments(p.payments || []);
      }
    } catch (err) {
      console.error('Error loading platform admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Clear message after 5 seconds
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  const handleActivateTenant = async (tenantId) => {
    setActionLoading(true);
    setActionMessage('');
    try {
      const res = await apiFetch(`/platform/tenants/${tenantId}/activate`, {
        method: 'POST',
        body: JSON.stringify({
          plan: 'pro',
          durationMonths: extendMonths,
          notes: 'تفعيل مباشر من لوحة إدارة المنظومة'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'فشل التفعيل');
      
      setActionMessage(data.message);
      setSelectedTenant(null);
      loadData();
    } catch (err) {
      alert(`خطأ: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmPayment = async (paymentId) => {
    if (!confirm('هل أنت متأكد من تأكيد استلام هذا المبلغ وتفعيل اشتراك المكتب لمدة سنة؟')) return;
    try {
      const res = await apiFetch(`/platform/payments/${paymentId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ durationMonths: 12 })
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage(data.message);
        loadData();
      } else {
        throw new Error(data.message || 'حدث خطأ غير معروف');
      }
    } catch (err) {
      alert(`خطأ: ${err.message}`);
    }
  };

  const handleRejectPayment = async (paymentId) => {
    const reason = prompt('سبب رفض الدفعة (سيتم إرساله للمكتب):');
    if (!reason) return;
    try {
      const res = await apiFetch(`/platform/payments/${paymentId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage(data.message);
        loadData();
      } else {
        throw new Error(data.message || 'حدث خطأ غير معروف');
      }
    } catch (err) {
      alert(`خطأ: ${err.message}`);
    }
  };

  const filteredTenants = tenants.filter(t => {
    const term = searchTerm.toLowerCase();
    const matchSearch = (t.name || '').toLowerCase().includes(term) ||
                        (t.owner_name || '').toLowerCase().includes(term) ||
                        (t.city || '').toLowerCase().includes(term) ||
                        (t.phone || '').includes(term);
    if (!matchSearch) return false;
    
    if (filterStatus === 'all') return true;
    if (filterStatus === 'trial') return t.plan === 'trial';
    if (filterStatus === 'active') return t.status === 'active' && t.plan !== 'trial';
    
    const isExpired = t.subscription_ends_at ? new Date(t.subscription_ends_at) < new Date() : false;
    if (filterStatus === 'expired') return t.status === 'expired' || isExpired;
    
    return true;
  });

  if (loading && !stats) {
    return <LoadingSpinner text="جاري تحميل الإحصائيات وبيانات المنصة..." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '40px' }}>
      
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={28} />
            لوحة الإدارة المركزية
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '6px' }}>
            مرحباً بك في مركز التحكم الخاص بمالك المنظومة. يمكنك إدارة المكاتب، الاشتراكات، والمدفوعات من هنا.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="outline" onClick={loadData} style={{ gap: '8px' }}>
            <Clock size={16} />
            تحديث البيانات
          </Button>
        </div>
      </div>

      {/* Global Feedback Message */}
      {actionMessage && (
        <div style={{ 
          padding: '16px 24px', 
          background: 'rgba(16, 185, 129, 0.1)', 
          border: '1px solid rgba(16, 185, 129, 0.3)', 
          color: '#10b981', 
          borderRadius: 'var(--radius-md)', 
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <CheckCircle size={20} />
          {actionMessage}
        </div>
      )}

      {/* Statistics Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: '20px' 
      }}>
        {/* Total Offices */}
        <div className="glass-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-15px', right: '-15px', opacity: 0.05, color: '#3b82f6' }}>
            <Building2 size={120} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', zIndex: 1 }}>
            <div style={{ width: 56, height: 56, borderRadius: '16px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', display: 'grid', placeItems: 'center', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.1)' }}>
              <Building2 size={28} />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>إجمالي المكاتب</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-main)', lineHeight: 1 }}>
                {stats?.totalTenants || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Paid Offices */}
        <div className="glass-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-15px', right: '-15px', opacity: 0.05, color: '#10b981' }}>
            <ShieldCheck size={120} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', zIndex: 1 }}>
            <div style={{ width: 56, height: 56, borderRadius: '16px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'grid', placeItems: 'center', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.1)' }}>
              <CheckCircle size={28} />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>مكاتب نشطة (مدفوعة)</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#10b981', lineHeight: 1 }}>
                {stats?.paidTenants || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Trial Offices */}
        <div className="glass-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-15px', right: '-15px', opacity: 0.05, color: '#f59e0b' }}>
            <Clock size={120} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', zIndex: 1 }}>
            <div style={{ width: 56, height: 56, borderRadius: '16px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'grid', placeItems: 'center', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.1)' }}>
              <Clock size={28} />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>فترة تجريبية</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-main)', lineHeight: 1 }}>
                {stats?.trialTenants || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="glass-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(212, 168, 83, 0.3)' }}>
          <div style={{ position: 'absolute', top: '-15px', left: '-15px', opacity: 0.05, color: 'var(--primary)' }}>
            <DollarSign size={120} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', zIndex: 1 }}>
            <div style={{ width: 56, height: 56, borderRadius: '16px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-glow)' }}>
              <DollarSign size={28} />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>الإيرادات المعتمدة</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--primary)', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                {stats?.totalRevenue || 0} <span style={{ fontSize: '0.9rem', fontWeight: 'normal' }}>د.ل</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Required: Pending Payments */}
      {pendingPayments.length > 0 && (
        <div className="glass-card" style={{ 
          border: '1px solid rgba(245, 158, 11, 0.4)', 
          boxShadow: '0 8px 30px rgba(245, 158, 11, 0.08)',
          overflow: 'hidden'
        }}>
          <div style={{ 
            background: 'rgba(245, 158, 11, 0.1)', 
            padding: '16px 24px', 
            borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ background: '#f59e0b', color: '#fff', borderRadius: '50%', width: 32, height: 32, display: 'grid', placeItems: 'center' }}>
              <ShieldAlert size={18} />
            </div>
            <h2 style={{ fontSize: '1.2rem', color: '#f59e0b', fontWeight: '700', margin: 0 }}>
              إجراء مطلوب: مراجعة الدفعات ({pendingPayments.length})
            </h2>
          </div>
          
          <div style={{ overflowX: 'auto', padding: '0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>المكتب / المحامي</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>طريقة الدفع</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>المرجع</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>المبلغ</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>التاريخ / ملاحظات</th>
                  <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem', textAlign: 'center' }}>القرار</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayments.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-subtle">
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>{p.tenant_name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={12} /> {p.tenant_phone || 'غير متوفر'}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        fontSize: '0.8rem', 
                        background: 'rgba(59, 130, 246, 0.1)', 
                        color: '#3b82f6',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <CreditCard size={14} />
                        {p.payment_method === 'bank_transfer' ? 'تحويل مصرفي' :
                         p.payment_method === 'sadad' ? 'خدمة سداد' :
                         p.payment_method === 'mobicash' ? 'موبي كاش' : 'نقداً'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', direction: 'ltr', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-dim)' }}>
                      {p.reference_number || 'بدون مرجع'}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                        {p.amount} د.ل
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <div style={{ marginBottom: '4px' }}>{new Date(p.created_at).toLocaleDateString('ar-LY')}</div>
                      {p.notes && <div style={{ fontStyle: 'italic', color: 'var(--text-dim)' }}>"{p.notes}"</div>}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <Button 
                          onClick={() => handleConfirmPayment(p.id)} 
                          style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 14px', height: 'auto', borderRadius: '6px', fontSize: '0.85rem' }}
                        >
                          تأكيد وتفعيل
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => handleRejectPayment(p.id)}
                          style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', padding: '6px 14px', height: 'auto', borderRadius: '6px', fontSize: '0.85rem' }}
                        >
                          رفض
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Offices Directory */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Directory Header & Filters */}
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', color: 'var(--text-main)', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={22} color="var(--primary)" />
              سجل المكاتب القانونية
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px', margin: 0 }}>
              يوجد {filteredTenants.length} مكتب مطابق لشروط البحث
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={18} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ 
                  paddingRight: '40px', 
                  borderRadius: 'var(--radius-full)', 
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)'
                }}
                placeholder="ابحث باسم المكتب، المحامي، المدينة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ position: 'relative' }}>
              <select
                className="form-input"
                style={{ 
                  paddingRight: '16px', 
                  paddingLeft: '40px', 
                  borderRadius: 'var(--radius-full)',
                  appearance: 'none',
                  background: 'var(--bg-input)',
                  minWidth: '160px',
                  cursor: 'pointer'
                }}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">جميع الحالات</option>
                <option value="trial">تجريبية فقط</option>
                <option value="active">مدفوعة نشطة</option>
                <option value="expired">منتهية الصلاحية</option>
              </select>
              <Filter size={16} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        {/* Directory Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ background: 'var(--bg-table-header)' }}>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>المكتب / المالك</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>المدينة / التواصل</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>حالة الاشتراك</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>تاريخ الانتهاء</th>
                <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem', textAlign: 'center' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <Search size={40} opacity={0.2} />
                      <p>لا توجد مكاتب تطابق معايير البحث الحالية.</p>
                      <Button variant="outline" size="sm" onClick={() => { setSearchTerm(''); setFilterStatus('all'); }}>مسح الفلاتر</Button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTenants.map(t => {
                  const endsAt = new Date(t.subscription_ends_at || t.trial_ends_at);
                  const isExpired = endsAt < new Date();
                  const isTrial = t.plan === 'trial';
                  
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} className="hover-bg-subtle">
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
                            {t.name ? t.name.charAt(0) : 'م'}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {t.name}
                              {t.status === 'active' && !isExpired && <CheckCircle size={14} color="#10b981" />}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              المالك: {t.owner_name} <span style={{ opacity: 0.5 }}>#{t.id}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={14} color="var(--text-muted)" /> {t.city || 'غير محدد'}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', direction: 'ltr', justifyContent: 'flex-end' }}>
                            {t.phone || 'لا يوجد هاتف'} <Phone size={14} />
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: isExpired ? 'rgba(239, 68, 68, 0.1)' : isTrial ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          color: isExpired ? '#ef4444' : isTrial ? '#f59e0b' : '#10b981',
                        }}>
                          {isExpired ? <XCircle size={14} /> : isTrial ? <Clock size={14} /> : <ShieldCheck size={14} />}
                          {isExpired ? 'منتهي' : isTrial ? 'تجريبي' : t.plan === 'starter' ? 'مبتدئ' : t.plan === 'pro' ? 'احترافي' : 'مؤسسي'}
                        </span>
                      </td>

                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isExpired ? '#ef4444' : 'var(--text-main)' }}>
                          <Calendar size={16} opacity={isExpired ? 1 : 0.5} />
                          <span style={{ fontWeight: isExpired ? '600' : 'normal' }}>
                            {endsAt.toLocaleDateString('ar-LY')}
                          </span>
                        </div>
                        {isExpired && (
                          <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px', opacity: 0.8 }}>
                            تجاوز المدة المسموحة
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                        <Button
                          variant={isExpired ? "primary" : "outline"}
                          size="sm"
                          onClick={() => setSelectedTenant(t)}
                          style={{ 
                            borderRadius: '8px',
                            padding: '6px 14px',
                            height: 'auto',
                            fontSize: '0.85rem'
                          }}
                        >
                          إدارة الاشتراك
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modern Activation Modal */}
      {selectedTenant && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(11, 17, 32, 0.75)', 
          backdropFilter: 'blur(8px)',
          display: 'grid', 
          placeItems: 'center', 
          zIndex: 1000, 
          padding: '20px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="glass-card" style={{ 
            width: '100%', 
            maxWidth: '500px', 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-color)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden'
          }}>
            
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-sidebar)' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={24} />
                تحديث اشتراك المكتب
              </h3>
            </div>

            <div style={{ padding: '24px' }}>
              
              {/* Tenant Info Summary */}
              <div style={{ 
                background: 'var(--bg-item)', 
                padding: '16px', 
                borderRadius: 'var(--radius-md)', 
                marginBottom: '24px',
                display: 'flex',
                gap: '16px',
                alignItems: 'center'
              }}>
                <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontSize: '1.4rem', fontWeight: 'bold' }}>
                  {selectedTenant.name ? selectedTenant.name.charAt(0) : 'م'}
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '2px' }}>
                    {selectedTenant.name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    بإدارة: {selectedTenant.owner_name} • {selectedTenant.city}
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                  خطة التمديد الجديدة
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    className="form-input"
                    style={{ 
                      width: '100%', 
                      padding: '14px', 
                      appearance: 'none',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.95rem',
                      color: 'var(--text-main)'
                    }}
                    value={extendMonths}
                    onChange={(e) => setExtendMonths(parseInt(e.target.value))}
                  >
                    <option value={1}>تمديد تجريبي / استثنائي (شهر واحد)</option>
                    <option value={3}>اشتراك ربع سنوي (3 أشهر)</option>
                    <option value={6}>اشتراك نصف سنوي (6 أشهر)</option>
                    <option value={12}>اشتراك سنوي كامل (12 شهراً)</option>
                    <option value={24}>باقة السنتين (24 شهراً)</option>
                  </select>
                  <ChevronDown size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} />
                  سيتم تفعيل الباقة بشكل مباشر وإشعار المكتب.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                <Button
                  variant="primary"
                  style={{ flex: 2, padding: '12px', fontSize: '1rem' }}
                  disabled={actionLoading}
                  onClick={() => handleActivateTenant(selectedTenant.id)}
                >
                  {actionLoading ? <LoadingSpinner text="جاري التفعيل..." size="sm" /> : 'تأكيد التفعيل'}
                </Button>
                <Button
                  variant="outline"
                  style={{ flex: 1, padding: '12px', fontSize: '1rem' }}
                  onClick={() => setSelectedTenant(null)}
                >
                  إلغاء
                </Button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Additional CSS specifically for this component to keep animations clean */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hover-bg-subtle:hover {
          background-color: rgba(255, 255, 255, 0.02) !important;
        }
        [data-theme="light"] .hover-bg-subtle:hover {
          background-color: rgba(0, 0, 0, 0.02) !important;
        }
      `}</style>
    </div>
  );
}
