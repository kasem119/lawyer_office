import React, { useState } from 'react';
import { Scale, Lock, Mail, User, Phone, Server, UserPlus, LogIn, Eye, EyeOff, Sun, Moon, Laptop } from 'lucide-react';
import Button from '../Shared/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getServerUrl } from '../../api/client';

export default function Login({ onChangeServer }) {
  const { login, register } = useAuth();
  const { theme, cycleTheme } = useTheme();
  const [mode, setMode] = useState('login');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => setFormData(current => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setError('');
    try {
      if (mode === 'login') await login(formData.email, formData.password);
      else {
        if (!formData.name.trim() || formData.password !== formData.confirmPassword) throw new Error('يرجى إدخال البيانات بشكل صحيح والتأكد من تطابق كلمتي المرور');
        if (formData.password.length < 12) throw new Error('كلمة المرور يجب أن لا تقل عن 12 خانة');
        await register({ name: formData.name.trim(), email: formData.email, phone: formData.phone, password: formData.password });
      }
    } catch (err) { setError(err.message || 'حدث خطأ أثناء العملية'); }
    finally { setLoading(false); }
  };

  const input = (label, key, type, icon) => <div className="form-group" style={{ marginBottom: 0 }}>
    <label className="form-label">{label} *</label><div style={{ position: 'relative' }}>
      {React.cloneElement(icon, { size: 18, style: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' } })}
      <input className="form-input" style={{ paddingRight: 38 }} type={type} required value={formData[key]} onChange={(e) => update(key, e.target.value)} />
    </div></div>;

  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-dark)', padding: '24px 16px' }}>
    <div style={{ position: 'absolute', top: 20, left: 24, right: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-card)', padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem' }}><Server size={14} color="var(--primary)" />الخادم: <span style={{ direction: 'ltr' }}>{getServerUrl()}</span><button type="button" onClick={onChangeServer} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>تغيير</button></div>
      <button type="button" onClick={cycleTheme} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '7px 12px', borderRadius: 'var(--radius-full)', cursor: 'pointer' }}>{theme === 'light' ? <Sun size={16} /> : theme === 'auto' ? <Laptop size={16} /> : <Moon size={16} />}</button>
    </div>
    <div className="glass-card" style={{ width: '100%', maxWidth: 470, padding: '38px 32px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}><div style={{ width: 68, height: 68, borderRadius: 20, background: 'var(--primary)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}><Scale size={36} color="#fff" /></div><h1 style={{ color: 'var(--primary)' }}>{mode === 'login' ? 'منظومة إدارة مكتب المحاماة' : 'الإعداد الأولي للنظام'}</h1><p style={{ color: 'var(--text-muted)' }}>{mode === 'login' ? 'سجّل الدخول للوصول إلى بيانات المكتب' : 'ينشئ هذا الإجراء مدير المكتب الأول فقط'}</p></div>
      <div style={{ display: 'flex', gap: 4, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: 4, marginBottom: 22 }}><button type="button" onClick={() => { setMode('login'); setError(''); }} style={{ flex: 1, padding: 9, border: 'none', borderRadius: 6, background: mode === 'login' ? 'var(--primary)' : 'transparent', color: mode === 'login' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}><LogIn size={16} /> تسجيل الدخول</button><button type="button" onClick={() => { setMode('register'); setError(''); }} style={{ flex: 1, padding: 9, border: 'none', borderRadius: 6, background: mode === 'register' ? 'var(--primary)' : 'transparent', color: mode === 'register' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}><UserPlus size={16} /> الإعداد الأولي</button></div>
      {error && <div style={{ background: 'var(--error-light)', color: 'var(--error)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 18 }}>⚠️ {error}</div>}
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {mode === 'register' && <>{input('اسم مدير المكتب', 'name', 'text', <User />)}{input('رقم الهاتف', 'phone', 'tel', <Phone />)}</>}{input('البريد الإلكتروني', 'email', 'email', <Mail />)}
        <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">كلمة المرور *</label><div style={{ position: 'relative' }}><Lock size={18} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} /><input className="form-input" style={{ paddingRight: 38, paddingLeft: 38 }} type={showPassword ? 'text' : 'password'} required value={formData.password} onChange={(e) => update('password', e.target.value)} /><button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer' }}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
        {mode === 'register' && <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">تأكيد كلمة المرور *</label><div style={{ position: 'relative' }}><input className="form-input" type={showConfirmPassword ? 'text' : 'password'} required value={formData.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer' }}>{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>}
        <Button type="submit" disabled={loading} style={{ marginTop: 8, padding: 12 }}>{loading ? 'جاري التحقق...' : mode === 'login' ? 'دخول المنظومة' : 'إعداد مدير المكتب'}</Button>
      </form>
    </div>
  </div>;
}
