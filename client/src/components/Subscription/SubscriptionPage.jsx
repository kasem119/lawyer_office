import React, { useState, useEffect } from 'react';
import { CreditCard, History, Building2, Upload, CheckCircle2, Clock, AlertTriangle, MessageCircle, Phone, ArrowUpRight } from 'lucide-react';
import PricingCards from './PricingCards';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../Shared/Button';
import { apiFetch } from '../../api/client';

export default function SubscriptionPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('plan');
  const [subData, setSubData] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState('pro');

  // Payment form state
  const [payForm, setPayForm] = useState({
    amount: '950',
    method: 'bank_transfer',
    reference_number: '',
    notes: ''
  });
  const [submittingPay, setSubmittingPay] = useState(false);
  const [paySuccessMessage, setPaySuccessMessage] = useState('');
  const [payError, setPayError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [currentRes, plansRes, paymentsRes] = await Promise.all([
        apiFetch('/subscriptions/current'),
        apiFetch('/subscriptions/plans'),
        apiFetch('/subscriptions/payments')
      ]);

      if (currentRes.ok) {
        const cur = await currentRes.json();
        setSubData(cur);
      }
      if (plansRes.ok) {
        const p = await plansRes.json();
        setPaymentInfo(p.paymentInfo);
      }
      if (paymentsRes.ok) {
        const payList = await paymentsRes.json();
        setPayments(payList.payments || []);
      }
    } catch (err) {
      console.error('Error loading subscription info:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectPlan = (planId) => {
    setSelectedPlan(planId);
    if (planId === 'starter') setPayForm(f => ({ ...f, amount: '450' }));
    else if (planId === 'pro') setPayForm(f => ({ ...f, amount: '950' }));
    else if (planId === 'enterprise') setPayForm(f => ({ ...f, amount: '1800' }));
    setActiveTab('payment');
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setSubmittingPay(true);
    setPaySuccessMessage('');
    setPayError('');

    try {
      const res = await apiFetch('/subscriptions/payment', {
        method: 'POST',
        body: JSON.stringify({
          amount: payForm.amount,
          method: payForm.method,
          reference_number: payForm.reference_number,
          notes: `ترقية إلى باقة: ${selectedPlan} | ${payForm.notes}`
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'فشل إرسال إشعار السداد');

      setPaySuccessMessage(data.message);
      setPayForm({ amount: '950', method: 'bank_transfer', reference_number: '', notes: '' });
      loadData();
    } catch (err) {
      setPayError(err.message);
    } finally {
      setSubmittingPay(false);
    }
  };

  const tabs = [
    { id: 'plan', label: 'الخطة والباقات', icon: CreditCard },
    { id: 'payment', label: 'طرق الدفع والترقية', icon: Building2 },
    { id: 'history', label: 'سجل المدفوعات', icon: History }
  ];

  const tenant = subData?.tenant;
  const daysRemaining = subData?.daysRemaining ?? 14;
  const isTrial = tenant?.plan === 'trial';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--primary)' }}>إدارة الاشتراك والباقات 🇱🇾</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          إدارة باقة الاشتراك السحابية لمكتب ({tenant?.name || 'مكتب المحاماة'})
        </p>
      </div>

      {/* Trial / Expiry Banner */}
      {isTrial && (
        <div style={{
          background: 'rgba(212, 168, 83, 0.12)',
          border: '1px solid var(--primary)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={24} color="var(--primary)" />
            <div>
              <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>أنت حالياً في الفترة التجريبية المجانية</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                متبقي لديك <strong style={{ color: 'var(--text-main)' }}>{daysRemaining} يوماً</strong>. يمكنك ترقية باقتك في أي وقت لمواصلة استخدام المنظومة دون انقطاع.
              </div>
            </div>
          </div>
          <Button variant="primary" onClick={() => setActiveTab('payment')}>
            ترقية باقة المكتب الآن
          </Button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '8px'
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: isActive ? 'var(--primary-light)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                padding: '10px 18px',
                borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: isActive ? '700' : '500',
                fontSize: '0.95rem',
                transition: 'all 0.2s ease'
              }}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Plans */}
      {activeTab === 'plan' && (
        <div>
          <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>تفاصيل الاستخدام الحالي للمكتب</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '0.85rem' }}>المحامين والمستخدمين</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>
                  {subData?.usage?.users || 1} / {subData?.usage?.maxUsers || 3}
                </div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '0.85rem' }}>القضايا المسجلة</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>
                  {subData?.usage?.cases || 0} {isTrial ? '/ 15' : '(غير محدود)'}
                </div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '0.85rem' }}>الموكلين والملفات</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{subData?.usage?.clients || 0} موكل</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '0.85rem' }}>حالة الاشتراك</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: isTrial ? 'var(--primary)' : '#10b981' }}>
                  {isTrial ? 'فترة تجريبية' : 'اشتراك سنوي نشط'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  ينتهي: {new Date(tenant?.subscription_ends_at || tenant?.trial_ends_at || Date.now()).toLocaleDateString('ar-LY')}
                </div>
              </div>
            </div>
          </div>

          <PricingCards currentPlan={tenant?.plan || 'trial'} onSelectPlan={handleSelectPlan} />
        </div>
      )}

      {/* Tab 2: Payment & Bank Transfer */}
      {activeTab === 'payment' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Bank details card */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h2 style={{ marginBottom: '16px', color: 'var(--primary)', fontSize: '1.2rem' }}>
              طرق السداد المعتمدة في ليبيا 🏦
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              يمكنك سداد الاشتراك عبر أي من المصارف الليبية أو الخدمات الإلكترونية أو الدفع نقداً:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Bank 1 */}
              <div style={{ padding: '14px', background: 'var(--bg-dark)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '6px' }}>🏛️ مصرف الجمهورية</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>اسم الحساب: <strong>إدارة منظومة المحاماة</strong></div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>رقم الحساب: <strong style={{ direction: 'ltr' }}>018-XXXXXX</strong></div>
                <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '4px' }}>✓ يدعم تطبيق أنا وياك للتحويل الفوري</div>
              </div>

              {/* Bank 2 */}
              <div style={{ padding: '14px', background: 'var(--bg-dark)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '6px' }}>🏛️ المصرف التجاري الوطني</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>اسم الحساب: <strong>إدارة منظومة المحاماة</strong></div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>رقم الحساب: <strong style={{ direction: 'ltr' }}>012-XXXXXX</strong></div>
                <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '4px' }}>✓ يدعم تطبيق موبي كاش (MobiCash)</div>
              </div>

              {/* Electronic */}
              <div style={{ padding: '14px', background: 'var(--bg-dark)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '6px' }}>📱 سداد (Sadad) / تداول</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>رقم الهاتف المعتمد للدفع: <strong>0910000000</strong></div>
              </div>

              {/* Cash option */}
              <div style={{ padding: '14px', background: 'var(--bg-dark)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '6px' }}>💵 الدفع نقداً (كاش)</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>يمكن السداد نقداً في مكتبنا أو لمندوب مع استلام إيصال رسمي معتمد.</div>
              </div>

              {/* WhatsApp instant verification */}
              <div style={{
                padding: '16px',
                background: 'rgba(37, 211, 102, 0.1)',
                border: '1px solid #25D366',
                borderRadius: 'var(--radius-sm)',
                textAlign: 'center'
              }}>
                <div style={{ fontWeight: 'bold', color: '#25D366', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <MessageCircle size={20} />
                  تأكيد الاشتراك الفوري عبر واتساب
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  أرسل صورة إشعار التحويل أو تفاصيل الدفع عبر واتساب ليتم تفعيل حسابك في دقائق:
                </div>
                <a
                  href={`https://wa.me/218910000000?text=${encodeURIComponent(`السلام عليكم، قمت بسداد اشتراك المنظومة لمكتب: ${tenant?.name || ''}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#25D366',
                    color: '#fff',
                    padding: '10px 20px',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 'bold',
                    textDecoration: 'none',
                    fontSize: '0.9rem'
                  }}
                >
                  <MessageCircle size={18} />
                  تواصل عبر واتساب للتفعيل الآن
                </a>
              </div>
            </div>
          </div>

          {/* Payment submission form */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h2 style={{ marginBottom: '16px', color: 'var(--text-main)', fontSize: '1.2rem' }}>
              إرسال إشعار السداد للنظام
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              بعد إتمام التحويل أو الدفع، أدخل بيانات العملية هنا ليتم مراجعتها وتفعيل اشتراكك:
            </p>

            {paySuccessMessage && (
              <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.9rem' }}>
                ✓ {paySuccessMessage}
              </div>
            )}

            {payError && (
              <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '0.9rem' }}>
                {payError}
              </div>
            )}

            <form onSubmit={handlePaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">الباقة المطلوبة</label>
                <select
                  className="form-input"
                  value={selectedPlan}
                  onChange={(e) => handleSelectPlan(e.target.value)}
                >
                  <option value="starter">باقة المكتب الفردي (450 د.ل سنوياً)</option>
                  <option value="pro">باقة المكتب المحترف (950 د.ل سنوياً) ⭐</option>
                  <option value="enterprise">باقة الشركات والمؤسسات (1,800 د.ل سنوياً)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">طريقة السداد</label>
                <select
                  className="form-input"
                  value={payForm.method}
                  onChange={(e) => setPayForm(f => ({ ...f, method: e.target.value }))}
                >
                  <option value="bank_transfer">تحويل مصرفي (الجمهورية / التجاري / الأمان)</option>
                  <option value="sadad">خدمة سداد (Sadad)</option>
                  <option value="mobicash">خدمة موبي كاش (MobiCash)</option>
                  <option value="cash">دفع نقدي (كاش) / لمندوب</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">المبلغ المدفوع (دينار ليبي)</label>
                <input
                  type="number"
                  className="form-input"
                  required
                  value={payForm.amount}
                  onChange={(e) => setPayForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">رقم الإشعار / المرجع أو رقم الإيصال</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="مثال: رقم الحوالة أو رقم إيصال الإيداع"
                  value={payForm.reference_number}
                  onChange={(e) => setPayForm(f => ({ ...f, reference_number: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">ملاحظات إضافية</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="أي تفاصيل تود توضيحها بخصوص التحويل أو اسم المودع..."
                  value={payForm.notes}
                  onChange={(e) => setPayForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                style={{ width: '100%', marginTop: '8px' }}
                disabled={submittingPay}
              >
                {submittingPay ? 'جاري الإرسال...' : 'إرسال إشعار السداد للإدارة'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: Payment History */}
      {activeTab === 'history' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <h2 style={{ marginBottom: '20px', color: 'var(--text-main)', fontSize: '1.2rem' }}>سجل المدفوعات والاشتراكات</h2>
          {payments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              لا توجد مدفوعات مسجلة بعد. عند إرسال أي دفعة ستظهر هنا مع حالتها.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>التاريخ</th>
                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>طريقة الدفع</th>
                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>رقم المرجع</th>
                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>المبلغ</th>
                    <th style={{ padding: '12px', color: 'var(--text-muted)' }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px' }}>{new Date(p.created_at).toLocaleDateString('ar-LY')}</td>
                      <td style={{ padding: '12px' }}>
                        {p.payment_method === 'bank_transfer' ? 'تحويل مصرفي' :
                         p.payment_method === 'sadad' ? 'سداد' :
                         p.payment_method === 'mobicash' ? 'موبي كاش' : 'نقداً'}
                      </td>
                      <td style={{ padding: '12px', direction: 'ltr', textAlign: 'right' }}>{p.reference_number || '-'}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{p.amount} د.ل</td>
                      <td style={{ padding: '12px' }}>
                        {p.status === 'confirmed' ? (
                          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={16} /> تم التأكيد
                          </span>
                        ) : p.status === 'rejected' ? (
                          <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={16} /> مرفوض
                          </span>
                        ) : (
                          <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={16} /> قيد المراجعة
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
