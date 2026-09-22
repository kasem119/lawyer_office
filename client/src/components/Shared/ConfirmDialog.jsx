import React from 'react';
import { AlertTriangle, Trash2, HelpCircle, X } from 'lucide-react';
import Button from './Button';

export default function ConfirmDialog({
  isOpen,
  title = 'تأكيد الإجراء',
  message = 'هل أنت متأكد من رغبتك في متابعة هذا الإجراء؟ لا يمكن التراجع عن هذه العملية لاحقاً.',
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  onConfirm,
  onCancel,
  variant = 'danger',
  icon: CustomIcon,
  loading = false
}) {
  if (!isOpen) return null;

  const getIcon = () => {
    if (CustomIcon) return <CustomIcon size={24} />;
    if (variant === 'danger') return <Trash2 size={24} />;
    if (variant === 'warning') return <AlertTriangle size={24} />;
    return <HelpCircle size={24} />;
  };

  const getColor = () => {
    if (variant === 'danger') return 'var(--error)';
    if (variant === 'warning') return 'var(--warning)';
    return 'var(--primary)';
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(11, 17, 32, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      className="animate-fadeIn"
      onClick={onCancel}
    >
      <div
        className="glass-card animate-fadeInScale"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '28px',
          position: 'relative',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
          border: `1px solid ${variant === 'danger' ? 'rgba(244, 63, 94, 0.35)' : 'var(--border-color)'}`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: variant === 'danger' ? 'var(--error-light)' : variant === 'warning' ? 'var(--warning-light)' : 'var(--primary-light)',
              color: getColor(),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: `1px solid ${getColor()}`
            }}
          >
            {getIcon()}
          </div>

          <div style={{ flex: 1 }}>
            <h3
              style={{
                fontSize: '1.2rem',
                fontWeight: '700',
                color: 'var(--text-main)',
                marginBottom: '6px'
              }}
            >
              {title}
            </h3>
            <p
              style={{
                fontSize: '0.9rem',
                color: 'var(--text-muted)',
                lineHeight: '1.6'
              }}
            >
              {message}
            </p>
          </div>

          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)'
          }}
        >
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </Button>

          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'جاري التنفيذ...' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
