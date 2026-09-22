import React from 'react';
import { FolderOpen, Plus } from 'lucide-react';
import Button from './Button';

export default function EmptyState({
  icon: Icon = FolderOpen,
  title = 'لا توجد بيانات متاحة',
  description = 'لم يتم العثور على أي عناصر مسجلة حتى الآن.',
  actionLabel,
  onAction,
  actionIcon: ActionIcon = Plus,
  actionVariant = 'primary',
  compact = false,
  style = {}
}) {
  return (
    <div
      className="glass-card animate-fadeIn"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: compact ? '24px 16px' : '48px 24px',
        width: '100%',
        margin: '12px 0',
        borderStyle: 'dashed',
        ...style
      }}
    >
      <div
        style={{
          width: compact ? '48px' : '64px',
          height: compact ? '48px' : '64px',
          borderRadius: '50%',
          backgroundColor: 'var(--primary-light)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: compact ? '12px' : '16px',
          color: 'var(--primary)'
        }}
      >
        <Icon size={compact ? 24 : 32} />
      </div>

      <h4
        style={{
          fontSize: compact ? '1rem' : '1.15rem',
          fontWeight: '700',
          color: 'var(--text-main)',
          marginBottom: '6px'
        }}
      >
        {title}
      </h4>

      {description && (
        <p
          style={{
            fontSize: compact ? '0.82rem' : '0.9rem',
            color: 'var(--text-muted)',
            maxWidth: '420px',
            lineHeight: '1.6',
            marginBottom: actionLabel && onAction ? '20px' : '0'
          }}
        >
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <Button
          variant={actionVariant}
          icon={ActionIcon}
          onClick={onAction}
          style={{ marginTop: '8px' }}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
