import React, { useState } from 'react';
import { Scale, Building2, User, Mail, Lock, Phone, MapPin, Eye, EyeOff, Laptop, Sun, Moon, ArrowRight } from 'lucide-react';
import Button from '../Shared/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { apiFetch } from '../../api/client';

export default function Register({ onNavigateToLogin, onNavigateToLanding }) {
  const { registerOffice } = useAuth();
  const { theme, cycleTheme } = useTheme();
  
  const [formData, setFormData] = useState({ 
    officeName: '', 
    slug: '', 
    adminName: '', 
    email: '', 
    phone: '', 
    city: 'طرابلس',
    password: '', 
    confirmPassword: '' 
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slugChecking, setSlugChecking] = useState(false);
  
  const update = (key, value) => {
    if (key === 'officeName' && !formData.slug) {
      const tempSlug = value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      setFormData(current => ({ ...current, [key]: value, slug: tempSlug }));
    } else {
      setFormData(current => ({ ...current, [key]: value }));
    }
  };

  const checkSlug = async () => {
    if (!formData.slug) return;
    setSlugChecking(true);
    try {
      const res = await apiFetch('/onboarding/check-slug', {
        method: 'POST',
        body: JSON.stringify({ slug: formData.slug })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'المعرف غير متاح');
    } catch(err) {
      setError(err.message);
    } finally {
      setSlugChecking(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault(); 
    setLoading(true); 
    setError('');
    try {
      if (formData.password !== formData.confirmPassword) {
        throw new Error('يرجى التأكد من تطابق كلمتي المرور');
      }
      if (formData.password.length < 8) {
        throw new Error('كلمة المرور يجب أن لا تقل عن 8 خانات');
      }
      
      await registerOffice({ 
        officeName: formData.officeName.trim(), 
        slug: (formData.slug || 'office-' + Date.now()).trim().toLowerCase(),
        adminName: formData.adminName.trim(), 
        email: formData.email.trim(), 
        phone: formData.phone.trim(), 
        city: formData.city,
        password: formData.password 
      });
    } catch (err) { 
      setError(err.message || 'حدث خطأ أثناء إنشاء الحساب'); 
    } finally { 
      setLoading(false); 
    }
  };

  const input = (label, key, type, icon, extraProps = {}) => (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label">{label} *</label>
      <div style={{ position: 'relative' }}>
        {React.cloneElement(icon, { size: 18, style: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' } })}
        <input 
          className="form-input" 
          style={{ paddingRight: 38 }} 
          type={type} 
          required 
          value={formData[key]} 
          onChange={(e) => update(key, e.target.value)} 
          {...extraProps}
        />
      </div>
    </div>
  );

  const libyanCities = [
    'طرابلس', 'بنغازي', 'مصراتة', 'الزاوية', 'البيضاء', 'طبرق', 'سبها', 
    'الخمس', 'زليتن', 'صبراتة', 'غريان', 'سرت', 'درنة', 'ترهونة', 'أجدابيا'
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-dark)', padding: '40px 16px' }}>
      <div style={{ position: 'absolute', top: 20, left: 24, right: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {onNavigateToLanding && (
          <button
            type="button"
            onClick={onNavigateToLanding}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '8px 14px', borderRadius: 'var(--radius-full)', cursor: 'pointer', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <ArrowRight size={16} />
            الرئيسية
          </button>
        )}
        <button type="button" onClick={cycleTheme} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '7px 12px', borderRadius: 'var(--radius-full)', cursor: 'pointer', color: 'var(--text-main)' }}>
          {theme === 'light' ? <Sun size={16} /> : theme === 'auto' ? <Laptop size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <div className="glass-card" style={{ width: '100%', maxWidth: 640, padding: '38px 32px', marginTop: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--primary)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <Scale size={32} color="#fff" />
          </div>
          <h1 style={{ color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 'bold' }}>سجّل مكتبك في منظومة المحامي الليبي 🇱🇾</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            احصل على 14 يوماً تجربة مجانية بكافة المميزات بدون دفع مسبق
          </p>
        </div>
        
        {error && <div style={{ background: 'var(--error-light)', color: 'var(--error)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 18, fontSize: '0.9rem' }}>⚠️ {error}</div>}
        
        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {/* Office Details */}
          <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '4px' }}>
            <h3 style={{ color: 'var(--primary)', fontSize: '1.05rem', fontWeight: 'bold' }}>بيانات المكتب القانوني</h3>
          </div>

          {input('اسم المكتب أو المحامي', 'officeName', 'text', <Building2 />, { placeholder: 'مثال: مكتب الأستاذ فلان للمحاماة' })}
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">المدينة في ليبيا *</label>
            <div style={{ position: 'relative' }}>
              <MapPin size={18} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <select
                className="form-input"
                style={{ paddingRight: 38 }}
                value={formData.city}
                onChange={(e) => update('city', e.target.value)}
              >
                {libyanCities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          
          {/* Admin Details */}
          <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '4px', marginTop: '10px' }}>
            <h3 style={{ color: 'var(--primary)', fontSize: '1.05rem', fontWeight: 'bold' }}>بيانات المحامي المسؤول (مدير الحساب)</h3>
          </div>

          {input('اسم المحامي بالكامل', 'adminName', 'text', <User />, { placeholder: 'الاسم الثلاثي' })}
          {input('رقم الهاتف (ليبيانا / مدار)', 'phone', 'tel', <Phone />, { dir: 'ltr', placeholder: '0912345678' })}
          
          <div style={{ gridColumn: '1 / -1' }}>
            {input('البريد الإلكتروني', 'email', 'email', <Mail />, { dir: 'ltr', placeholder: 'lawyer@example.ly' })}
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">كلمة المرور *</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" style={{ paddingRight: 38, paddingLeft: 38, dir: 'ltr' }} type={showPassword ? 'text' : 'password'} required value={formData.password} onChange={(e) => update('password', e.target.value)} placeholder="8 خانات على الأقل" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">تأكيد كلمة المرور *</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" style={{ paddingRight: 38, paddingLeft: 38, dir: 'ltr' }} type={showConfirmPassword ? 'text' : 'password'} required value={formData.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
          
          <div style={{ gridColumn: '1 / -1', marginTop: '14px' }}>
            <Button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', fontSize: '1.05rem', fontWeight: 'bold' }}>
              {loading ? 'جاري تجهيز المكتب...' : 'ابدأ التجربة المجانية لمكتبك (14 يوماً) 🚀'}
            </Button>
          </div>
        </form>
        
        <div style={{ textAlign: 'center', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={onNavigateToLogin}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.92rem' }}
          >
            لديك حساب مسجل بالفعل؟ تسجيل الدخول
          </button>
        </div>
      </div>
    </div>
  );
}
