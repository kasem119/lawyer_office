import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * يعرض شريطاً للمستخدم عند توفر نسخة جديدة من التطبيق (Service Worker جديد).
 * عند الضغط على "تحديث الآن" يُفعّل العامل الجديد ويعاد تحميل الصفحة.
 */
export default function UpdateBanner() {
  const [waitingWorker, setWaitingWorker] = useState(null);

  const onServiceWorkerChange = useCallback(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;

    sw.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        if (reg.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(reg.waiting);
          return;
        }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    if (window.location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      // Service Worker يعمل فقط عبر HTTPS أو localhost
      return undefined;
    }

    onServiceWorkerChange();

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
          }
          if (newWorker.state === 'activated') {
            setWaitingWorker(null);
          }
        });
        onServiceWorkerChange();
      });
    }).catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [onServiceWorkerChange]);

  const handleUpdate = () => {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  };

  if (!waitingWorker) return null;

  return (
    <div
      className="animate-fadeIn"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '8px 16px',
        backgroundColor: 'var(--info-light, rgba(59,130,246,0.15))',
        borderBottom: '1px solid var(--border-color)',
        fontSize: '0.85rem',
        color: 'var(--text-main)'
      }}
    >
      <RefreshCw size={15} color="var(--info)" />
      <span>يوجد إصدار جديد من المنظومة</span>
      <button
        onClick={handleUpdate}
        style={{
          background: 'var(--info)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-xs, 4px)',
          padding: '4px 14px',
          fontSize: '0.8rem',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        تحديث الآن
      </button>
    </div>
  );
}
