import React, { useState } from 'react';
import { Scale, Lock, Mail, Eye, EyeOff, Sun, Moon, Laptop, Building2 } from 'lucide-react';
import Button from '../Shared/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function Login({ onChangeServer, onNavigateToRegister, onNavigateToLanding }) {
  const { login, accessError } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const [formData, setFormData] = useState({ email: '', password: '', tenantSlug: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const update = (key, value) => setFormData(current => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    // Read the live form values as well as React state so mobile browser autofill is not lost.
    const email = String(fields.get('email') ?? formData.email).trim();
    const password = String(fields.get('password') ?? formData.password);
    setLoading(true); 
    setError('');
    try {
      if (!email) throw new Error('أدخل البريد الإلكتروني في الحقل أعلاه.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('تحقق من صيغة البريد الإلكتروني.');
      if (!password) throw new Error('أدخل كلمة المرور.');
      await login(email, password, String(fields.get('tenantSlug') ?? formData.tenantSlug).trim());
    } catch (err) { 
      setError(err.message || 'حدث خطأ أثناء العملية'); 
    } finally { 
      setLoading(false); 
    }
  };

  const input = (label, key, type, icon, extraProps = {}) => (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label">{label}</label>
      <div style={{ position: 'relative' }}>
        {React.cloneElement(icon, { size: 18, style: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' } })}
        <input 
          className="form-input" 
          style={{ paddingRight: 38 }} 
          type={type} 
          name={key}
          autoComplete={key === 'email' ? 'email' : key === 'tenantSlug' ? 'organization' : undefined}
          autoCapitalize={key === 'email' ? 'none' : undefined}
          spellCheck={key === 'email' ? false : undefined}
          required 
          value={formData[key]} 
          onChange={(e) => update(key, e.target.value)} 
          {...extraProps}
        />
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-dark)', padding: '24px 16px' }}>
      <div style={{ position: 'absolute', top: 20, left: 24, right: 24, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button type="button" onClick={cycleTheme} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '7px 12px', borderRadius: 'var(--radius-full)', cursor: 'pointer', color: 'var(--text-main)' }}>
          {theme === 'light' ? <Sun size={16} /> : theme === 'auto' ? <Laptop size={16} /> : <Moon size={16} />}
        </button>
      </div>
      <div className="glass-card" style={{ width: '100%', maxWidth: 470, padding: '38px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 68, height: 68, borderRadius: 20, background: 'var(--primary)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <Scale size={36} color="#fff" />
          </div>
          <h1 style={{ color: 'var(--primary)' }}>منظومة إدارة مكتب المحاماة</h1>
          <p style={{ color: 'var(--text-muted)' }}>سجّل الدخول للوصول إلى بيانات المكتب</p>
        </div>
        
        {(error || accessError) && <div role="alert" style={{ background: 'var(--error-light)', color: 'var(--error)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 18 }}>⚠️ {error || accessError}</div>}
        
        <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {input('معرف المكتب (اختياري)', 'tenantSlug', 'text', <Building2 />, { dir: 'ltr', placeholder: 'my-office' })}
          {input('البريد الإلكتروني', 'email', 'email', <Mail />, { dir: 'ltr' })}
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">كلمة المرور</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" style={{ paddingRight: 38, paddingLeft: 38, dir: 'ltr' }} type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" required value={formData.password} onChange={(e) => update('password', e.target.value)} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
          
          <Button type="submit" disabled={loading} style={{ marginTop: 8, padding: 12 }}>
            {loading ? 'جاري التحقق...' : 'دخول المنظومة'}
          </Button>
        </form>

        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          {onNavigateToRegister && (
            <button
              type="button"
              onClick={onNavigateToRegister}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ليس لديك حساب؟ سجّل مكتبك الآن (30 يوماً مجاناً) 🚀
            </button>
          )}

          {onNavigateToLanding && (
            <button
              type="button"
              onClick={onNavigateToLanding}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              ← العودة إلى الصفحة الرئيسية للمنظومة
            </button>
          )}

          {onChangeServer && (
            <button
              type="button"
              onClick={onChangeServer}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', marginTop: '4px' }}
            >
              تغيير عنوان الخادم المحلي
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
