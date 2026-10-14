import React from 'react';
import { CheckCheck, BellOff, X } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import EmptyState from '../Shared/EmptyState';
import { formatLibyaTime } from '../../utils/dateTime';

export default function NotificationList({ onClose }) {
  const { notifications, markAsRead, markAllAsRead, deviceSupport, deviceEnabled, deviceBusy,
    deviceError, changeDeviceNotifications, testNotification } = useNotifications();
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  return (
    <div
      className="glass-card animate-slideDown"
      style={{
        position: isMobile ? 'fixed' : 'absolute',
        left: isMobile ? '12px' : '0',
        right: isMobile ? '12px' : 'auto',
        top: isMobile ? '66px' : '48px',
        width: isMobile ? 'auto' : '350px',
        maxWidth: isMobile ? 'calc(100vw - 24px)' : '350px',
        maxHeight: isMobile ? '70vh' : '430px',
        overflowY: 'auto',
        zIndex: 10000,
        padding: '16px',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h4 style={{ fontSize: '0.92rem', color: 'var(--primary)', fontWeight: '700', margin: 0 }}>
            الإشعارات والتنبيهات
          </h4>
          {notifications.length > 0 && (
            <span className="badge badge-active" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
              {notifications.length}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {notifications.length > 0 && (
            <button
              onClick={markAllAsRead}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'color 0.15s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--primary)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <CheckCheck size={14} /> مقروء
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px'
              }}
              title="إغلاق"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        {deviceSupport === 'install' ? <p>على iPhone: أضف التطبيق للشاشة الرئيسية من Safari ثم افتحه منها لتفعيل الإشعارات.</p>
          : deviceSupport === 'https' ? <p>إشعارات الهاتف تحتاج فتح التطبيق عبر رابط HTTPS آمن.</p>
          : deviceSupport === 'unsupported' ? <p>هذا المتصفح لا يدعم إشعارات الجهاز. استخدم متصفحاً حديثاً.</p>
          : <>
            <button className="btn btn-primary" type="button" disabled={deviceBusy} onClick={changeDeviceNotifications}>
              {deviceBusy ? 'جارٍ الإعداد…' : deviceEnabled ? 'إيقاف إشعارات هذا الجهاز' : 'تفعيل إشعارات هذا الجهاز'}
            </button>
            {deviceEnabled && <button className="btn" type="button" disabled={deviceBusy} onClick={testNotification}>اختبار الإشعارات</button>}
            <p>{deviceEnabled ? 'إشعارات الجهاز مفعّلة.' : 'فعّل الإشعارات واسمح بها عند ظهور طلب المتصفح.'}</p>
          </>}
        {deviceError && <p role="alert" style={{ color: 'var(--error)' }}>{deviceError}</p>}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="لا توجد إشعارات"
          description="جميع التنبيهات والمواعيد تم الاطلاع عليها."
          compact
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => markAsRead(n.id)}
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: n.is_read ? 'var(--bg-item)' : 'var(--primary-light)',
                border: '1px solid var(--border-subtle)',
                borderRight: `3px solid var(--${n.type === 'urgent' ? 'error' : n.type === 'warning' ? 'warning' : 'primary'})`,
                cursor: 'pointer',
                transition: 'all 0.18s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateX(-2px)';
                e.currentTarget.style.borderColor = 'var(--border-hover)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              <div style={{ fontWeight: '700', fontSize: '0.88rem', color: n.is_read ? 'var(--text-main)' : 'var(--primary)' }}>
                {n.title}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.4' }}>
                {n.message}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                {formatLibyaTime(n.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

