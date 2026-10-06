import React from 'react';
import { Check, Star, Shield, Zap } from 'lucide-react';
import Button from '../Shared/Button';

export default function PricingCards({ currentPlan = 'trial', onSelectPlan }) {
  const plans = [
    {
      id: 'trial',
      name: 'الباقة التجريبية',
      price: 'مجاناً',
      period: '14 يوم',
      icon: <Star size={24} />,
      color: 'var(--text-muted)',
      features: [
        'مستخدم واحد (مدير المكتب)',
        'إدارة حتى 15 قضية',
        'المساعد القانوني الذكي (20 طلب)',
        'التقويم ورول الجلسات',
        'إصدار الفواتير وسندات القبض بالدينار',
        'دعم فني عبر واتساب'
      ],
      buttonText: 'الخطة الحالية',
      buttonAction: 'current'
    },
    {
      id: 'starter',
      name: 'المكتب الفردي',
      price: '450 د.ل',
      period: 'سنوياً (~50 د.ل/شهر)',
      icon: <Zap size={24} />,
      color: '#3b82f6',
      features: [
        'حتى 2 مستخدمين (محامي + سكرتير)',
        'قضايا وموكلين غير محدود',
        'مساعد ذكي لصياغة العقود (100 طلب/شهر)',
        'إدارة فواتير وأتعاب كاملة بالدينار الليبي',
        'أرشفة المستندات والملفات (5 جيجابايت)',
        'تنبيهات الجلسات القضائية عبر البريد',
        'دعم فني مستمر'
      ],
      buttonText: 'ترقية للمكتب الفردي',
      buttonAction: 'upgrade'
    },
    {
      id: 'pro',
      name: 'المكتب المحترف',
      price: '950 د.ل',
      period: 'سنوياً (~100 د.ل/شهر)',
      icon: <Star size={24} />,
      color: '#d4a853',
      popular: true,
      features: [
        'حتى 6 مستخدمين للمكتب',
        'قضايا وموكلين غير محدود',
        'المساعد القانوني الذكي غير محدود',
        'كشف تعارض المصالح آلياً',
        'بوابة إلكترونية لمتابعة قضايا الموكلين',
        'أرشفة مستندات متقدمة (25 جيجابايت)',
        'تقارير أداء ومحاسبة شاملة للمكتب',
        'أولوية في الدعم الفني والتحديثات'
      ],
      buttonText: 'ترقية للمكتب المحترف ⭐',
      buttonAction: 'upgrade'
    },
    {
      id: 'enterprise',
      name: 'الشركات والمؤسسات',
      price: '1,800 د.ل',
      period: 'سنوياً',
      icon: <Shield size={24} />,
      color: '#8b5cf6',
      features: [
        'عدد غير محدود من المحامين والمستخدمين',
        'مساحة تخزين غير محدودة (100 جيجابايت)',
        'تخصيص كامل للهوية البصرية والترويسة',
        'نسخة سطح مكتب مخصصة للشبكة الداخلية',
        'مدير حساب ومسؤول دعم فني مخصص',
        'تدريب كادر المكتب مجاناً'
      ],
      buttonText: 'ترقية للباقة المؤسسية',
      buttonAction: 'upgrade'
    }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginTop: '20px' }}>
      {plans.map(plan => {
        const isCurrent = currentPlan === plan.id;
        
        return (
          <div key={plan.id} className="glass-card" style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            border: isCurrent ? `2px solid ${plan.color}` : '1px solid var(--border-color)',
            transform: plan.popular ? 'scale(1.02)' : 'none',
            zIndex: plan.popular ? 1 : 0,
            boxShadow: plan.popular ? '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' : 'var(--shadow-sm)'
          }}>
            {plan.popular && (
              <div style={{
                position: 'absolute',
                top: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: plan.color,
                color: '#fff',
                padding: '4px 14px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 'bold'
              }}>
                الأكثر طلباً في ليبيا ⭐
              </div>
            )}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: plan.color, marginBottom: '16px' }}>
              {plan.icon}
              <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{plan.name}</h3>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{plan.price}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}> / {plan.period}</span>
            </div>
            
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {plan.features.map((feature, idx) => (
                <li key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.88rem' }}>
                  <Check size={16} color={plan.color} style={{ flexShrink: 0, marginTop: '3px' }} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            
            <Button
              variant={isCurrent ? 'outline' : 'primary'}
              style={{
                width: '100%',
                background: isCurrent ? 'transparent' : plan.color,
                borderColor: isCurrent ? 'var(--text-muted)' : plan.color,
                color: isCurrent ? 'var(--text-main)' : '#fff'
              }}
              disabled={isCurrent}
              onClick={() => onSelectPlan && onSelectPlan(plan.id)}
            >
              {isCurrent ? 'باقتك الحالية' : plan.buttonText}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
