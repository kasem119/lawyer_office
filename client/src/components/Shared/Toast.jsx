import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export default function Toast({ message, type = 'info', onClose, duration = 4000 }) {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef(Date.now());
  const remainingTimeRef = useRef(duration);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!duration || duration <= 0) return;

    const intervalTime = 20;
    const step = (intervalTime / duration) * 100;

    const interval = setInterval(() => {
      if (!isPaused) {
        setProgress((prev) => {
          if (prev <= 0) {
            clearInterval(interval);
            if (onClose) onClose();
            return 0;
          }
          return Math.max(0, prev - step);
        });
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [duration, isPaused, onClose]);

  const typeConfig = {
    success: {
      icon: <CheckCircle2 color="var(--success)" size={20} />,
      borderColor: 'var(--success)',
      progressColor: 'var(--success)',
      bgColor: 'var(--success-light)'
    },
    error: {
      icon: <XCircle color="var(--error)" size={20} />,
      borderColor: 'var(--error)',
      progressColor: 'var(--error)',
      bgColor: 'var(--error-light)'
    },
    warning: {
      icon: <AlertTriangle color="var(--warning)" size={20} />,
      borderColor: 'var(--warning)',
      progressColor: 'var(--warning)',
      bgColor: 'var(--warning-light)'
    },
    info: {
      icon: <Info color="var(--info)" size={20} />,
      borderColor: 'var(--info)',
      progressColor: 'var(--info)',
      bgColor: 'var(--info-light)'
    }
  };

  const current = typeConfig[type] || typeConfig.info;

  return (
    <div
      className="glass-card animate-slideUp"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        minWidth: '320px',
        maxWidth: '420px',
        padding: '14px 18px',
        borderRight: `4px solid ${current.borderColor}`,
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        cursor: 'default'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {current.icon}
          </div>
          <span style={{ fontSize: '0.92rem', fontWeight: '600', color: 'var(--text-main)', lineHeight: '1.4' }}>
            {message}
          </span>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            title="إغلاق"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: '2px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-main)'}
            onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {duration > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            backgroundColor: 'var(--border-subtle)'
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              backgroundColor: current.progressColor,
              transition: isPaused ? 'none' : 'width 0.03s linear'
            }}
          />
        </div>
      )}
    </div>
  );
}

