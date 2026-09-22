import React, { useState, useEffect } from 'react';
import { User, Lock, Save, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import Modal from '../Shared/Modal';
import Button from '../Shared/Button';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

export default function UserProfileModal({ isOpen, onClose }) {
  const { user, login } = useAuth();
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'password'

  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    role: user?.role || ''
  });

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setError('');
      // Fetch fresh profile
      apiFetch('/users/profile')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            setProfileData({
              name: data.user.name || '',
              phone: data.user.phone || '',
              email: data.user.email || '',
              role: data.user.role || ''
            });
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await apiFetch('/users/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: profileData.name,
          phone: profileData.phone
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ تم تحديث بيانات الملف الشخصي بنجاح');
        // Update user in localStorage/context
        const stored = JSON.parse(localStorage.getItem('user_data') || '{}');
        stored.name = profileData.name;
        stored.phone = profileData.phone;
        localStorage.setItem('user_data', JSON.stringify(stored));
      } else {
        setError(data.message || 'فشل تحديث الملف الشخصي');
      }
    } catch (err) {
      setError('حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('كلمة المرور الجديدة غير متطابقة مع تأكيد كلمة المرور');
      return;
    }

    if (passwordData.new_password.length < 8) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 8 خانات');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/users/change-password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ تم تغيير كلمة المرور بنجاح');
        setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      } else {
        setError(data.message || 'فشل تغيير كلمة المرور');
      }
    } catch (err) {
      setError('حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="الملف الشخصي وإعدادات الحساب">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Sub-tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '10px' }}>
          <button
            type="button"
            onClick={() => { setActiveTab('info'); setMessage(''); setError(''); }}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'info' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'info' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'info' ? '700' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <User size={16} />
            البيانات الشخصية
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('password'); setMessage(''); setError(''); }}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'password' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'password' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'password' ? '700' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Lock size={16} />
            تغيير كلمة المرور
          </button>
        </div>

        {message && (
          <div style={{ padding: '10px 14px', borderRadius: '6px', background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid var(--success)', fontSize: '0.85rem' }}>
            {message}
          </div>
        )}

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '6px', background: 'rgba(244,63,94,0.1)', color: 'var(--error)', border: '1px solid var(--error)', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {activeTab === 'info' ? (
          <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">الاسم الكامل *</label>
              <input
                type="text"
                className="form-input"
                required
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">البريد الإلكتروني (اسم المستخدم)</label>
              <input
                type="email"
                className="form-input"
                disabled
                value={profileData.email}
                style={{ opacity: 0.7, cursor: 'not-allowed' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>البريد الإلكتروني يُعدل فقط عبر إدارة النظام</span>
            </div>

            <div className="form-group">
              <label className="form-label">رقم الهاتف</label>
              <input
                type="text"
                className="form-input"
                placeholder="مثال: 0910000000"
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">الدور الوظيفي والصلاحية</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`badge ${profileData.role === 'admin' ? 'badge-urgent' : 'badge-active'}`}>
                  {profileData.role === 'admin' ? 'مدير المكتب (Administrator)' : 'محامي ممارس (Lawyer)'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <Button variant="secondary" onClick={onClose}>إغلاق</Button>
              <Button type="submit" disabled={loading} icon={Save}>
                {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">كلمة المرور الحالية *</label>
              <input
                type="password"
                className="form-input"
                required
                value={passwordData.current_password}
                onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                placeholder="أدخل كلمة مرورك الحالية"
              />
            </div>

            <div className="form-group">
              <label className="form-label">كلمة المرور الجديدة *</label>
              <input
                type="password"
                className="form-input"
                required
                minLength={8}
                value={passwordData.new_password}
                onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                placeholder="8 خانات على الأقل"
              />
            </div>

            <div className="form-group">
              <label className="form-label">تأكيد كلمة المرور الجديدة *</label>
              <input
                type="password"
                className="form-input"
                required
                value={passwordData.confirm_password}
                onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                placeholder="أعد إدخال كلمة المرور الجديدة"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <Button variant="secondary" onClick={onClose}>إلغاء</Button>
              <Button type="submit" disabled={loading} icon={Lock}>
                {loading ? 'جاري التغيير...' : 'تحديث كلمة المرور'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
