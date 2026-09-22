import React from 'react';
import { WifiOff, RefreshCw, ShieldAlert, Server } from 'lucide-react';
import { useConnection } from '../../contexts/ConnectionContext';

export default function OfflineBanner() {
  const { isConnected, isChecking, countdown, checkConnection, serverUrl } = useConnection();

  if (isConnected) return null;

  return (
    <div style={{
      backgroundColor: '#b91c1c',
      backgroundImage: 'linear-gradient(90deg, #991b1b 0%, #b91c1c 50%, #7f1d1d 100%)',
      color: '#fff',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px',
      fontSize: '0.88rem',
      fontWeight: '600',
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      position: 'sticky',
      top: 0,
      zIndex: 10000,
      direction: 'rtl',
      borderBottom: '1px solid rgba(255,255,255,0.2)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <WifiOff size={18} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>انقطع الاتصال بخادم المكتب الرئيسي</span>
            <span style={{
              fontSize: '0.75rem',
              background: 'rgba(0,0,0,0.3)',
              padding: '2px 8px',
              borderRadius: '4px',
              direction: 'ltr'
            }}>
              {serverUrl}
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#fecaca', fontWeight: 'normal', marginTop: '2px' }}>
            لا تقلق، صفحاتك ومدخلاتك محفوظة محلياً. ستتم المحاولة مجدداً خلال ({countdown}) ثوانٍ...
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={checkConnection}
          disabled={isChecking}
          style={{
            background: 'rgba(255,255,255,0.25)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            padding: '6px 14px',
            borderRadius: '6px',
            cursor: isChecking ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.82rem',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}
        >
          <RefreshCw size={14} style={{ animation: isChecking ? 'spin 1s linear infinite' : 'none' }} />
          <span>{isChecking ? 'جاري الفحص...' : 'إعادة المحاولة الآن'}</span>
        </button>
      </div>
    </div>
  );
}

