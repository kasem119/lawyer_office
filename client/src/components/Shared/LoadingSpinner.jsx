import React from 'react';
import { Scale } from 'lucide-react';

export default function LoadingSpinner({
  size = 'md',
  text = 'جاري التحميل...',
  fullScreen = false,
  inline = false,
  withIcon = false,
  variant = 'primary',
  className = ''
}) {
  const sizeMap = {
    sm: { icon: 16, ring: 20, font: '0.8rem', gap: 6 },
    md: { icon: 24, ring: 36, font: '0.92rem', gap: 10 },
    lg: { icon: 36, ring: 52, font: '1.05rem', gap: 14 },
    xl: { icon: 48, ring: 68, font: '1.2rem', gap: 18 }
  };

  const currentSize = typeof size === 'string' ? (sizeMap[size] || sizeMap.md) : { icon: size, ring: size * 1.5, font: '0.9rem', gap: 8 };

  const spinnerContent = (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: inline ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: `${currentSize.gap}px`
      }}
      className={`animate-fadeIn ${className}`}
    >
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {withIcon ? (
          <div
            style={{
              width: `${currentSize.ring}px`,
              height: `${currentSize.ring}px`,
              borderRadius: '50%',
              background: 'var(--primary-light)',
              border: '2px solid var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-glow)'
            }}
            className="animate-pulse"
          >
            <Scale size={currentSize.icon} color="var(--primary)" />
          </div>
        ) : (
          <div
            style={{
              width: `${currentSize.ring}px`,
              height: `${currentSize.ring}px`,
              border: `3px solid var(--border-subtle)`,
              borderTopColor: 'var(--primary)',
              borderRightColor: 'var(--primary-hover)',
              borderRadius: '50%'
            }}
            className="animate-spin"
          />
        )}
      </div>

      {text && (
        <span
          style={{
            fontSize: currentSize.font,
            fontWeight: '600',
            color: variant === 'light' ? '#ffffff' : 'var(--text-muted)',
            letterSpacing: '0.2px'
          }}
        >
          {text}
        </span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'var(--bg-dark)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          flexDirection: 'column'
        }}
      >
        <div
          className="glass-card"
          style={{
            padding: '36px 48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          {spinnerContent}
        </div>
      </div>
    );
  }

  return spinnerContent;
}
