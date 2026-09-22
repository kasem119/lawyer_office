import React from 'react';
import Modal from '../Shared/Modal';
import {
  Clock,
  PlusCircle,
  Edit3,
  Trash2,
  LogIn,
  LogOut,
  AlertCircle,
  Eye,
  Activity,
  Mail,
  Database
} from 'lucide-react';

export function getActionBadge(action) {
  const upper = (action || '').toUpperCase();

  if (upper.startsWith('CREATE') || upper === 'REGISTER') {
    return {
      label: 'إنشاء',
      icon: PlusCircle,
      className: 'badge badge-active',
      style: { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }
    };
  }
  if (upper.startsWith('UPDATE') || upper.startsWith('CHANGE') || upper.startsWith('EDIT')) {
    return {
      label: 'تعديل',
      icon: Edit3,
      className: 'badge badge-medium',
      style: { backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.3)' }
    };
  }
  if (upper.startsWith('DELETE') || upper.startsWith('REMOVE')) {
    return {
      label: 'حذف',
      icon: Trash2,
      className: 'badge badge-urgent',
      style: { backgroundColor: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', borderColor: 'rgba(244, 63, 94, 0.3)' }
    };
  }
  if (upper === 'LOGIN') {
    return {
      label: 'تسجيل دخول',
      icon: LogIn,
      className: 'badge',
      style: { backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', borderColor: 'rgba(139, 92, 246, 0.3)' }
    };
  }
  if (upper === 'LOGOUT') {
    return {
      label: 'تسجيل خروج',
      icon: LogOut,
      className: 'badge badge-low',
      style: { backgroundColor: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', borderColor: 'rgba(100, 116, 139, 0.3)' }
    };
  }
  if (upper.includes('EMAIL') || upper.includes('MAIL')) {
    return {
      label: 'إرسال بريد',
      icon: Mail,
      className: 'badge badge-medium',
      style: { backgroundColor: 'rgba(212, 168, 83, 0.15)', color: 'var(--primary)', borderColor: 'rgba(212, 168, 83, 0.3)' }
    };
  }
  if (upper.includes('BACKUP') || upper.includes('RESTORE')) {
    return {
      label: 'نسخ احتياطي',
      icon: Database,
      className: 'badge badge-medium',
      style: { backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.3)' }
    };
  }
  if (upper.includes('FAILED')) {
    return {
      label: 'فشل دخول',
      icon: AlertCircle,
      className: 'badge badge-urgent',
      style: { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }
    };
  }
  if (upper.startsWith('VIEW') || upper.startsWith('DOWNLOAD')) {
    return {
      label: 'عرض',
      icon: Eye,
      className: 'badge badge-low',
      style: { backgroundColor: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', borderColor: 'rgba(148, 163, 184, 0.3)' }
    };
  }

  return {
    label: action,
    icon: Activity,
    className: 'badge badge-low',
    style: { backgroundColor: 'rgba(212, 168, 83, 0.15)', color: 'var(--primary)', borderColor: 'var(--border-color)' }
  };
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('ar-LY', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch {
    return dateStr;
  }
}

export function parseDetails(jsonStr) {
  if (!jsonStr) return null;
  if (typeof jsonStr === 'object') return jsonStr;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return { text: jsonStr };
  }
}

export function DetailsSnippet({ details }) {
  if (!details) return <span style={{ color: 'var(--text-muted)' }}>-</span>;

  const parts = [];
  if (details.title) parts.push(`العنوان: ${details.title}`);
  if (details.name) parts.push(`الاسم: ${details.name}`);
  if (details.case_number) parts.push(`رقم القضية: ${details.case_number}`);
  if (details.email) parts.push(`البريد: ${details.email}`);
  if (details.newStatus) parts.push(`الحالة الجديدة: ${details.newStatus}`);
  if (details.status) parts.push(`الحالة: ${details.status}`);
  if (details.reason) parts.push(`السبب: ${details.reason}`);
  if (details.date) parts.push(`التاريخ: ${details.date}`);
  if (details.text) parts.push(details.text);

  if (parts.length > 0) {
    return (
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>
        {parts.join(' | ')}
      </div>
    );
  }

  const keys = Object.keys(details);
  if (keys.length > 0) {
    return (
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px', color: 'var(--text-muted)' }}>
        {keys.slice(0, 3).map(k => `${k}: ${JSON.stringify(details[k])}`).join(', ')}
      </div>
    );
  }

  return <span style={{ color: 'var(--text-muted)' }}>-</span>;
}

export default function ActivityDetailModal({ item, onClose }) {
  if (!item) return null;

  const details = parseDetails(item.details_json);
  const actionBadge = getActionBadge(item.action);
  const ActionIcon = actionBadge.icon;

  return (
    <Modal
      isOpen={!!item}
      onClose={onClose}
      title={`تفاصيل سجل النشاط #${item.id}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* General Meta Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', background: 'var(--bg-item)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>رقم السجل:</div>
            <div style={{ fontWeight: '700', color: 'var(--primary)' }}>#{item.id}</div>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>الوقت والتاريخ:</div>
            <div style={{ fontWeight: '600', color: 'var(--text-main)', direction: 'ltr', textAlign: 'right' }}>{formatDateTime(item.created_at)}</div>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>المستخدم المنفذ:</div>
            <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{item.user_name || `مستخدم #${item.user_id}`} ({item.user_role === 'admin' ? 'مدير' : 'محامي'})</div>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>العملية:</div>
            <div style={{ marginTop: '4px' }}>
              <span
                className={actionBadge.className}
                style={{
                  ...actionBadge.style,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: '600'
                }}
              >
                <ActionIcon size={14} />
                <span>{actionBadge.label} ({item.action})</span>
              </span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>الكيان المتأثر:</div>
            <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>
              {item.entity_type} {item.entity_id ? `(#${item.entity_id})` : ''}
            </div>
          </div>
        </div>

        {/* Parsed Details Table */}
        {details && typeof details === 'object' && Object.keys(details).length > 0 && (
          <div>
            <h4 style={{ color: 'var(--primary)', marginBottom: '10px', fontSize: '0.95rem' }}>بيانات وحقول العملية:</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(details).map(([key, val]) => (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.88rem'
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>{key}:</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: '700', wordBreak: 'break-word', maxWidth: '70%' }}>
                    {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw JSON */}
        <div>
          <h4 style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '0.85rem' }}>البيانات الخام (JSON Data):</h4>
          <pre
            style={{
              background: 'var(--bg-input)',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.82rem',
              color: 'var(--primary)',
              direction: 'ltr',
              overflowX: 'auto',
              maxHeight: '180px'
            }}
          >
            {item.details_json ? JSON.stringify(parseDetails(item.details_json), null, 2) : '{}'}
          </pre>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button onClick={onClose} className="btn btn-secondary">
            إغلاق النافذة
          </button>
        </div>
      </div>
    </Modal>
  );
}
