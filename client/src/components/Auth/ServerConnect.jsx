import React, { useState, useEffect } from 'react';
import { Server, Scale, Radio, RefreshCw, CheckCircle2, AlertCircle, Laptop, ArrowRight } from 'lucide-react';
import Button from '../Shared/Button';
import { setServerUrl, getServerUrl } from '../../api/client';

export default function ServerConnect({ onConnected }) {
  const [url, setUrl] = useState(getServerUrl());
  const [testing, setTesting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [discoveredServer, setDiscoveredServer] = useState(null);
  const [error, setError] = useState('');
  const [showManual, setShowManual] = useState(false);

  // Run auto discovery on mount
  useEffect(() => {
    runAutoDiscovery();
  }, []);

  const runAutoDiscovery = async () => {
    setScanning(true);
    setError('');
    setDiscoveredServer(null);

    // 1. Try Electron UDP discovery if available
    if (window.electronAPI?.discoverServer) {
      try {
        const result = await window.electronAPI.discoverServer(3500);
        if (result && result.success && result.server) {
          setDiscoveredServer(result.server);
          setUrl(result.server.url);
          setScanning(false);
          return;
        }
      } catch {
        // Continue to fallback
      }
    }

    // 2. Browser fallback: probe localhost, current origin, and 127.0.0.1
    const candidates = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      ...(window.location.port !== '3000' && window.location.hostname ? [`http://${window.location.hostname}:3000`] : [])
    ];

    for (const candidate of candidates) {
      try {
        const res = await fetch(`${candidate}/api/discovery`, {
          method: 'GET',
          signal: AbortSignal.timeout(1200)
        });
        if (res.ok) {
          const data = await res.json();
          if (data.signature === 'lawyer-office-server') {
            setDiscoveredServer({
              name: data.name || 'خادم منظومة مكتب المحاماة',
              ip: data.ip || candidate.replace(/http:\/\//, '').split(':')[0],
              port: data.port || 3000,
              url: data.url || candidate,
              hostname: data.hostname || 'Office-Server'
            });
            setUrl(data.url || candidate);
            setScanning(false);
            return;
          }
        }
      } catch {
        // Probe next candidate
      }
    }

    setScanning(false);
  };

  const handleConnectUrl = async (targetUrl) => {
    setTesting(true);
    setError('');

    const formattedUrl = (targetUrl || url).trim().replace(/\/$/, '');

    try {
      const res = await fetch(`${formattedUrl}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        setServerUrl(formattedUrl);
        onConnected();
      } else {
        setError('تعذر الاتصال بالخادم الرئيسي — الخادم لا يستجيب بالشكل المطلوب');
      }
    } catch {
      setError('فشل الاتصال: يرجى التأكد من تشغيل الخادم وأن الجهاز متصل بنفس شبكة المكتب المحلية (LAN/Wi-Fi)');
    } finally {
      setTesting(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    handleConnectUrl(url);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-dark)',
      backgroundImage: 'radial-gradient(ellipse at center, rgba(200, 155, 60, 0.08) 0%, rgba(10, 15, 29, 0.95) 70%)',
      padding: '20px'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '36px', textAlign: 'center', position: 'relative' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '18px',
          background: 'linear-gradient(135deg, var(--primary) 0%, #a87f32 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto',
          boxShadow: 'var(--shadow-glow)'
        }}>
          <Scale size={34} color="#0f1729" />
        </div>

        <h2 style={{ fontSize: '1.45rem', color: 'var(--primary)', fontWeight: '800', marginBottom: '6px' }}>
          منظومة إدارة مكتب المحاماة
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          الاتصال بخادم المكتب المركزي عبر الشبكة المحلية (LAN)
        </p>

        {error && (
          <div style={{
            background: 'rgba(244,63,94,0.15)',
            border: '1px solid var(--error)',
            color: 'var(--error)',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '18px',
            textAlign: 'right',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Auto Discovery Radar / Status Card */}
        {scanning ? (
          <div style={{
            padding: '24px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px dashed var(--border)',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Radio size={36} color="var(--primary)" style={{ animation: 'spin 2s linear infinite' }} />
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                جاري البحث عن خادم المكتب على الشبكة...
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                فحص قنوات البث الذكية (UDP Broadcast & LAN Scan)
              </div>
            </div>
          </div>
        ) : discoveredServer ? (
          <div style={{
            padding: '18px',
            borderRadius: '12px',
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            marginBottom: '20px',
            textAlign: 'right'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} color="var(--success)" />
                <span style={{ fontWeight: '700', color: 'var(--success)', fontSize: '0.92rem' }}>
                  تم اكتشاف خادم المكتب تلقائياً!
                </span>
              </div>
              <button
                onClick={runAutoDiscovery}
                title="إعادة الفحص"
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <RefreshCw size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>اسم الجهاز:</span>
                <strong style={{ color: 'var(--text-main)', direction: 'ltr' }}>{discoveredServer.hostname}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>عنوان الشبكة (IP):</span>
                <strong style={{ color: 'var(--primary)', direction: 'ltr' }}>{discoveredServer.url}</strong>
              </div>
            </div>

            <Button
              onClick={() => handleConnectUrl(discoveredServer.url)}
              disabled={testing}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {testing ? 'جاري التحقق والاتصال...' : (
                <>
                  <span>الاتصال بالخادم المكتشف</span>
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </div>
        ) : (
          <div style={{
            padding: '16px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-main)' }}>لم يتم العثور على خادم تلقائياً</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>تأكد من فتح البرنامج على جهاز الخادم</div>
            </div>
            <button
              onClick={runAutoDiscovery}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={13} />
              <span>إعادة البحث</span>
            </button>
          </div>
        )}

        {/* Manual Configuration Form */}
        <div style={{ textAlign: 'right', marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
              {showManual ? 'إدخال العنوان يدوياً:' : 'أو الاتصال المباشر:'}
            </span>
            <button
              type="button"
              onClick={() => setShowManual(!showManual)}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.82rem', textDecoration: 'underline' }}
            >
              {showManual ? 'إخفاء الإدخال اليدوي' : 'إدخال IP يدوي'}
            </button>
          </div>

          {(showManual || (!discoveredServer && !scanning)) && (
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.82rem' }}>عنوان الخادم في المكتب (IP Address) *</label>
                <div style={{ position: 'relative' }}>
                  <Server size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    style={{ direction: 'ltr', paddingRight: '38px', width: '100%', fontSize: '0.9rem' }}
                    required
                    placeholder="http://192.168.1.100:3000"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  <span>مثال: http://192.168.1.50:3000</span>
                  <button
                    type="button"
                    onClick={() => setUrl('http://localhost:3000')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    استخدام localhost
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={testing}>
                {testing ? 'جاري الاتصال والتحقق...' : 'الاتصال بالعنوان المحدد'}
              </Button>
            </form>
          )}
        </div>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
          <Laptop size={14} />
          <span>يعمل بدون إنترنت بالكامل عبر شبكة المكتب المحلية (Local Offline LAN)</span>
        </div>
      </div>
    </div>
  );
}

