import React from 'react';
import { CheckCheck, BellOff } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import EmptyState from '../Shared/EmptyState';

export default function NotificationList({ onClose }) {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();

  return (
    <div
      className="glass-card animate-slideDown"
      style={{
        position: 'absolute',
        left: '0',
        top: '48px',
        width: '350px',
        maxHeight: '430px',
        overflowY: 'auto',
        zIndex: 10000,
        padding: '16px',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border-color)'
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
        <h4 style={{ fontSize: '0.92rem', color: 'var(--primary)', fontWeight: '700' }}>
          الإشعارات والتنبيهات
        </h4>
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
            <CheckCheck size={14} /> تعيين الكل كـ مقروء
          </button>
        )}
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
                {new Date(n.created_at).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

