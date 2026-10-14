import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = '650px' }) {
  const titleId = useId();
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-overlay animate-fadeIn"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(11, 17, 32, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? '0' : '20px'
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`glass-card modal-panel ${isMobile ? 'animate-slideUp' : 'animate-fadeInScale'}`}
        style={{
          width: '100%',
          maxWidth: isMobile ? '100%' : maxWidth,
          maxHeight: isMobile ? '92vh' : '90vh',
          overflowY: 'auto',
          padding: isMobile ? '16px 18px calc(24px + var(--safe-area-bottom, 0px)) 18px' : '26px',
          position: 'relative',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-color)',
          borderRadius: isMobile ? '20px 20px 0 0' : 'var(--radius-md)',
          WebkitOverflowScrolling: 'touch'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator Handle */}
        {isMobile && (
          <div
            style={{
              width: '42px',
              height: '4px',
              borderRadius: '2px',
              backgroundColor: 'var(--border-subtle)',
              margin: '0 auto 14px',
              opacity: 0.8
            }}
          />
        )}

        <div
          className="modal-heading"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '12px',
            position: 'sticky',
            top: 0,
            background: 'inherit',
            zIndex: 10
          }}
        >
          <h3 id={titleId} style={{ fontSize: isMobile ? '1.1rem' : '1.2rem', color: 'var(--primary)', fontWeight: '700', margin: 0 }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            title="إغلاق"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-main)'}
            onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
          >
            <X size={18} />
          </button>
        </div>

        <div>
          {children}
        </div>
      </div>
    </div>, document.body
  );
}

