import React, { useState } from 'react';
import { 
  Scale, Shield, Sparkles, Calendar, FileText, CheckCircle2, 
  ArrowLeft, MessageCircle, Phone, Building2, Lock, Laptop, 
  Zap, HelpCircle, ChevronDown, ChevronUp, Star, Users, Check
} from 'lucide-react';
import Button from '../Shared/Button';

export default function Landing({ onNavigateToLogin, onNavigateToRegister }) {
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const features = [
    {
      icon: <Scale size={28} color="var(--primary)" />,
      title: 'إدارة شاملة للقضايا والموكلين',
      desc: 'أرشفة متكاملة لملفات القضايا وتصنيفها (مدني، جنائي، تجاري، شرعي، إداري، عمالي) مع سجل تفصيلي لإجراءات كل قضية.'
    },
    {
      icon: <Calendar size={28} color="#3b82f6" />,
      title: 'رول الجلسات والمفكرة القضائية',
      desc: 'متابعة مواعيد الجلسات في المحاكم الليبية وتنبيهات آلية للمحامين قبل موعد الجلسة لتفادي فوات المواعيد القانونية.'
    },
    {
      icon: <Sparkles size={28} color="#d4a853" />,
      title: 'المستشار القانوني بالذكاء الاصطناعي',
      desc: 'مساعد ذكي مدرب على صياغة الشروط التعاقدية، بنود التحكيم، مذكرات الدفاع، وتلخيص وقائع القضايا باللغة العربية الفصحى.'
    },
    {
      icon: <FileText size={28} color="#10b981" />,
      title: 'فواتير وأتعاب بالدينار الليبي (د.ل)',
      desc: 'إصدار مطالبات الأتعاب، متابعة سندات القبض والدفعات، وحساب المصاريف القضائية وكشوف حساب الموكلين بدقة متناهية.'
    },
    {
      icon: <FileText size={28} color="#8b5cf6" />,
      title: 'بنك النماذج والعقود المعتمدة',
      desc: 'نماذج جاهزة لعقود البيع والإيجار والوكالات والإنذارات العدلية وصحائف الدعوى قابلة للطباعة والتصدير الفوري PDF.'
    },
    {
      icon: <Shield size={28} color="#ef4444" />,
      title: 'فحص تعارض المصالح آلياً',
      desc: 'خوارزمية ذكية تفحص سجل الخصوم والموكلين تلقائياً عند فتح أي قضية جديدة لحماية مكتبك من أي شبهة تعارض مصالح.'
    },
    {
      icon: <Lock size={28} color="#06b6d4" />,
      title: 'تشفير وأعلى درجات السرية',
      desc: 'تشفير كامل للأرقام الوطنية وبيانات الهوية وتأمين ملفات القضايا وفق أعلى معايير الخصوصية لحفظ أسرار موكليك.'
    },
    {
      icon: <Laptop size={28} color="#f59e0b" />,
      title: 'سحابي + نسخة سطح مكتب مخصصة',
      desc: 'استخدم المنظومة من متصفحك أو هاتفك المحمول من داخل المحكمة، أو حمّل تطبيق سطح المكتب للعمل على جهازك المكتبي.'
    }
  ];

  const plans = [
    {
      id: 'trial',
      name: 'الباقة التجريبية',
      price: 'مجاناً',
      period: '14 يوم',
      desc: 'تجربة حرة لكافة خصائص المنظومة بدون أي تكلفة مسبقة',
      features: [
        'مستخدم واحد (مدير المكتب)',
        'إدارة حتى 15 قضية',
        'المساعد الذكي (20 طلب)',
        'تقويم الجلسات والمفكرة',
        'إصدار الفواتير بالدينار',
        'دعم فني عبر واتساب'
      ],
      popular: false
    },
    {
      id: 'starter',
      name: 'المكتب الفردي',
      price: '450 د.ل',
      period: 'سنوياً (~50 د.ل/شهر)',
      desc: 'مثالية للمحامي المستقل أو المكتب الفردي',
      features: [
        'حتى 2 مستخدمين (محامي + سكرتير)',
        'قضايا وموكلين غير محدود',
        'صياغة العقود بالذكاء الاصطناعي',
        'إدارة الفواتير والمالية كاملة',
        'مساحة تخزين سحابية (5 جيجابايت)',
        'تنبيهات الجلسات القضائية',
        'دعم فني مستمر'
      ],
      popular: false
    },
    {
      id: 'pro',
      name: 'المكتب المحترف ⭐',
      price: '950 د.ل',
      period: 'سنوياً (~100 د.ل/شهر)',
      desc: 'الخيار الأكثر طلباً وشعبية بين مكاتب المحاماة في ليبيا',
      features: [
        'حتى 6 مستخدمين للمكتب',
        'قضايا وموكلين غير محدود',
        'مساعد ذكي غير محدود',
        'كشف تعارض المصالح آلياً',
        'بوابة إلكترونية للموكلين',
        'مساحة تخزين (25 جيجابايت)',
        'تقارير المحاسبة والأداء الشاملة',
        'أولوية في الدعم الفني والتحديثات'
      ],
      popular: true
    },
    {
      id: 'enterprise',
      name: 'الشركات والمؤسسات',
      price: '1,800 د.ل',
      period: 'سنوياً',
      desc: 'للمكاتب الكبرى والشركات القانونية والشراكات الواسعة',
      features: [
        'عدد غير محدود من المحامين',
        'مساحة تخزين غير محدودة',
        'تخصيص كامل للهوية والترويسة',
        'نسخة سطح مكتب مخصصة للشبكة',
        'مدير حساب ومسؤول دعم مخصص',
        'تدريب كادر المكتب مجاناً'
      ],
      popular: false
    }
  ];

  const faqs = [
    {
      q: 'هل يمكنني تجربة المنظومة مجاناً قبل دفع أي مبلغ؟',
      a: 'نعم بكل تأكيد! نوفر فترة تجريبية مجانية بالكامل لمدة 14 يوماً مع كافة الميزات الفعالة. لا نطلب أي بيانات دفع مسبقة، فقط سجّل حساب مكتبك وابدأ العمل فوراً.'
    },
    {
      q: 'ما هي طرق الدفع المتاحة داخل ليبيا؟',
      a: 'نوفر جميع وسائل الدفع المعتمدة محلياً: تحويل مصرفي مباشر (مصرف الجمهورية عبر تطبيق أنا وياك، المصرف التجاري الوطني عبر موبي كاش، مصرف الأمان)، وخدمة سداد (Sadad)، أو الدفع نقداً في مكتبنا أو لمندوب مع استلام إيصال رسمي معتمد.'
    },
    {
      q: 'هل بيانات موكلي وقضاياي آمنة ومحمية بسرية تامة؟',
      a: 'نعم، السرية هي أولويتنا القصوى في العمل القانوني. كافة البيانات مشفرة، وتُخزن بيانات كل مكتب في مساحة معزولة ومحمية بأحدث بروتوكولات الأمان وشهادات SSL المشفرة، مع نسخ احتياطي آلي يومي لحماية ملفاتك من الفقدان.'
    },
    {
      q: 'هل تتوفر نسخة لسطح المكتب تعمل على أجهزة الكمبيوتر؟',
      a: 'نعم، المنظومة تعمل كسحابة عبر المتصفح والهاتف، وتتوفر أيضاً نسخة تطبيق سطح مكتب (Windows Desktop) يمكنك تثبيتها على حاسوبك لتجربة استخدام أسرع بنقرة زر واحدة من سطح المكتب.'
    },
    {
      q: 'هل يمكن للمحامين المتدربين أو السكرتارية الدخول للمنظومة؟',
      a: 'نعم، يتيح لك النظام إضافة محامين مشاركين وسكرتارية مع تحديد صلاحيات دقيقة لكل مستخدم (تحديد القضايا المسموح بمشاهدتها، منع الوصول إلى الحسابات المالية، وغيرها).'
    }
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', color: 'var(--text-main)', direction: 'rtl', fontFamily: 'inherit' }}>
      {/* Top Navbar */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(18, 24, 38, 0.88)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color)',
        padding: '12px 16px'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary)', display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0 }}>
              <Scale size={22} />
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--primary)', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
                منظومة المحامي الليبي
              </div>
              <div className="hide-on-mobile" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                إدارة مكاتب المحاماة والاستشارات القانونية
              </div>
            </div>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '0.95rem' }} className="landing-nav">
            <a href="#features" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>المميزات</a>
            <a href="#plans" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>الباقات والأسعار</a>
            <a href="#payments" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>طرق السداد</a>
            <a href="#faq" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>الأسئلة الشائعة</a>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button variant="outline" size="sm" onClick={onNavigateToLogin}>
              دخول
            </Button>
            <Button variant="primary" size="sm" onClick={onNavigateToRegister}>
              تجربة مجانية
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ padding: '48px 16px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: 20,
            background: 'rgba(212, 168, 83, 0.12)',
            border: '1px solid var(--primary)',
            color: 'var(--primary)',
            fontSize: '0.82rem',
            fontWeight: 'bold',
            marginBottom: '20px'
          }}>
            <Star size={15} />
            المنظومة السحابية الأولى للمحامي الليبي 🇱🇾
          </div>

          <h1 style={{
            fontSize: 'clamp(1.8rem, 5vw, 3.4rem)',
            fontWeight: '900',
            lineHeight: 1.25,
            color: 'var(--text-main)',
            marginBottom: '20px'
          }}>
            أدِر مكتبك القانوني باحترافية، ووفّر وقتك لكسب القضايا
          </h1>

          <p style={{
            fontSize: 'clamp(0.95rem, 2vw, 1.25rem)',
            color: 'var(--text-muted)',
            lineHeight: 1.7,
            marginBottom: '32px',
            maxWidth: 750,
            margin: '0 auto 32px'
          }}>
            منظومة ذكية تجمع إدارة القضايا، مفكرة الجلسات بالمحاكم الليبية، أتعاب المحاماة بالدينار، وصياغة المذكرات والعقود بالذكاء الاصطناعي — من حاسوبك أو هاتفك من داخل المحكمة.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '40px' }} className="landing-hero-actions">
            <button
              onClick={onNavigateToRegister}
              style={{
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                padding: '16px 36px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 'bold',
                fontSize: '1.1rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 8px 25px rgba(212, 168, 83, 0.35)',
                transition: 'transform 0.2s ease'
              }}
            >
              ابدأ تجربتك المجانية الآن (14 يوماً)
              <ArrowLeft size={20} />
            </button>

            <a
              href="https://wa.me/218910000000?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%D8%8C%20%D8%A3%D9%88%D8%AF%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%B9%D9%86%20%D9%85%D9%86%D8%B8%D9%88%D9%85%D8%A9%20%D8%A7%D9%84%D9%85%D8%AD%D8%A7%D9%85%D8%A7%D8%A9"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#25D366',
                color: '#fff',
                padding: '16px 28px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 'bold',
                fontSize: '1rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <MessageCircle size={20} />
              معاينة حية عبر واتساب
            </a>
          </div>

          {/* Trust badges */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>✓ تجربة 14 يوماً بدون دفع</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>✓ متوافقة مع القضاء الليبي</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>✓ سحابية + تطبيق سطح مكتب</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>✓ دعم فني وتدريب مجاني</span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" style={{ padding: '80px 24px', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '16px' }}>
              كل ما يحتاجه مكتب المحاماة في منصة واحدة متكاملة
            </h2>
            <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', maxWidth: 650, margin: '0 auto' }}>
              صُممت المنظومة بعناية بالتعاون مع نخبة من المحامين الليبيين لتلبي متطلبات العمل القضائي والإجرائي في ليبيا.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {features.map((f, i) => (
              <div key={i} className="glass-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--bg-dark)', display: 'grid', placeItems: 'center', border: '1px solid var(--border-color)' }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{f.title}</h3>
                <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="plans" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div style={{ display: 'inline-block', padding: '4px 16px', borderRadius: 20, background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '12px' }}>
              أسعار واضحة وشفافة بالدينار الليبي
            </div>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '16px' }}>
              باقات تناسب جميع أحجام المكاتب القانونية
            </h2>
            <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', maxWidth: 600, margin: '0 auto' }}>
              لا رسوم خفية، اشتراك سنوي شامل الاستضافة والتحديثات والدعم الفني.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
            {plans.map((p) => (
              <div key={p.id} className="glass-card" style={{
                padding: '32px 24px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                border: p.popular ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                boxShadow: p.popular ? '0 12px 30px rgba(212, 168, 83, 0.2)' : 'var(--shadow-sm)'
              }}>
                {p.popular && (
                  <div style={{
                    position: 'absolute',
                    top: '-14px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--primary)',
                    color: '#fff',
                    padding: '4px 16px',
                    borderRadius: 20,
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    الأكثر طلباً في ليبيا ⭐
                  </div>
                )}

                <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold', marginBottom: '8px' }}>{p.name}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', minHeight: 40 }}>{p.desc}</p>

                <div style={{ marginBottom: '24px' }}>
                  <span style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--text-main)' }}>{p.price}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}> / {p.period}</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                  {p.features.map((feat, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.9rem' }}>
                      <Check size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={p.popular ? 'primary' : 'outline'}
                  style={{ width: '100%', padding: '12px' }}
                  onClick={onNavigateToRegister}
                >
                  {p.id === 'trial' ? 'ابدأ مجاناً 14 يوماً' : 'اشترك في هذه الباقة'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Payment methods section */}
      <section id="payments" style={{ padding: '60px 24px', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '16px' }}>
            طرق السداد المعتمدة والميسرة في ليبيا 🏦
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '36px' }}>
            يمكنك تسديد الاشتراك بسهولة عبر أي وسيلة دفع تفضلها:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🏛️</div>
              <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>مصرف الجمهورية</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>تحويل فوري عبر تطبيق (أنا وياك)</div>
            </div>

            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🏛️</div>
              <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>المصرف التجاري الوطني</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>تحويل مباشر عبر (موبي كاش)</div>
            </div>

            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📱</div>
              <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>سداد (Sadad) / تداول</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>دفع إلكتروني مباشر عبر الهاتف</div>
            </div>

            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>💵</div>
              <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>دفع نقدي (كاش)</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>استلام مباشر وإيصال رسمي معتمد</div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 850, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '800', marginBottom: '12px' }}>
              الأسئلة الشائعة التي تهم المحامي الليبي
            </h2>
            <p style={{ color: 'var(--text-muted)' }}>
              إجابات واضحة عن كل ما ترغب بمعرفته حول المنظومة.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="glass-card"
                style={{ padding: '20px 24px', cursor: 'pointer' }}
                onClick={() => toggleFaq(i)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', margin: 0, color: 'var(--text-main)' }}>{faq.q}</h3>
                  {openFaq === i ? <ChevronUp size={20} color="var(--primary)" /> : <ChevronDown size={20} color="var(--text-muted)" />}
                </div>
                {openFaq === i && (
                  <p style={{ marginTop: '14px', fontSize: '0.92rem', color: 'var(--text-muted)', lineHeight: 1.7, borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section style={{ padding: '60px 24px 80px', textAlign: 'center' }}>
        <div className="glass-card" style={{ maxWidth: 900, margin: '0 auto', padding: '60px 32px', border: '1px solid var(--primary)', background: 'linear-gradient(135deg, rgba(212,168,83,0.15) 0%, rgba(18,24,38,0.95) 100%)' }}>
          <h2 style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '16px' }}>
            ابدأ رقمنة مكتبك القانوني اليوم
          </h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', maxWidth: 600, margin: '0 auto 32px' }}>
            انضم الآن إلى مكاتب المحاماة في طرابلس وبنغازي ومصراتة التي تستخدم المنظومة لزيادة الإنتاجية وكسب المزيد من القضايا.
          </p>
          <button
            onClick={onNavigateToRegister}
            style={{
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              padding: '16px 40px',
              borderRadius: 'var(--radius-full)',
              fontWeight: 'bold',
              fontSize: '1.15rem',
              cursor: 'pointer',
              boxShadow: '0 8px 25px rgba(212, 168, 83, 0.4)'
            }}
          >
            سجّل مكتبك الآن (14 يوماً مجاناً) 🚀
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '32px 24px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            جميع الحقوق محفوظة © {new Date().getFullYear()} منظومة المحامي الليبي
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <span>طرابلس، ليبيا</span>
            <span>هاتف: 0910000000</span>
            <span>دعم فني: contact@lawyer-system.ly</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
