import React from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((reg) => reg.unregister());
        });
      }
    } catch (e) {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-dark, #0b1120)',
            color: 'var(--text-main, #f8fafc)',
            padding: '24px 16px',
            fontFamily: 'Cairo, system-ui, sans-serif'
          }}
        >
          <div
            className="glass-card"
            style={{
              maxWidth: 580,
              width: '100%',
              padding: '36px 32px',
              borderRadius: '16px',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              background: 'rgba(30, 41, 59, 0.85)',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(244, 63, 94, 0.15)',
                color: '#f43f5e',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 20px'
              }}
            >
              <AlertTriangle size={36} />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '10px', color: '#f8fafc' }}>
              عذراً، حدث خطأ غير متوقع أثناء تحميل المنظومة
            </h2>

            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted, #94a3b8)', marginBottom: '24px', lineHeight: 1.6 }}>
              تم رصد هذا الاستثناء. يمكنك إعادة تحميل الصفحة، أو مسح الذاكرة المؤقتة وإعادة المحاولة.
            </p>

            {this.state.error && (
              <div
                dir="ltr"
                style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  fontSize: '0.8rem',
                  color: '#fb7185',
                  textAlign: 'left',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  marginBottom: '28px',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {this.state.error?.toString()}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  background: 'var(--primary, #d4a853)',
                  color: '#000',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <RefreshCw size={18} />
                إعادة تحميل الصفحة
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  background: 'rgba(244, 63, 94, 0.15)',
                  color: '#fb7185',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Trash2 size={18} />
                مسح التخزين المؤقت
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
