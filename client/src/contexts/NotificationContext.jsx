import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch, getServerUrl } from '../api/client';
import { useAuth } from './AuthContext';
import { deviceNotificationSupport, enableDeviceNotifications, restoreDeviceNotifications, disableDeviceNotifications, testDeviceNotification } from '../utils/deviceNotifications';

const NotificationContext = createContext();

function playChimeSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12); // A5
    gain2.gain.setValueAtTime(0.12, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
    setTimeout(() => { void ctx.close(); }, 700);
  } catch (e) {
    // Audio context may be restricted before user interaction
  }
}

function triggerNativeAlert(notification, enabled) {
  // Mobile vibration
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate([200, 100, 200]); } catch (e) {}
  }

  // Audio chime
  playChimeSound();

  // Browser notifications arrive through Web Push, avoiding duplicate WS alerts.
  if (enabled && window.electronAPI?.showNotification) {
    void window.electronAPI.showNotification({ title: notification.title, body: notification.message }).catch(() => {});
  }
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [deviceError, setDeviceError] = useState('');
  const enabledRef = useRef(false);
  const seenRef = useRef(new Set());
  const initializedRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;
  enabledRef.current = deviceEnabled;
  const deviceSupport = deviceNotificationSupport();

  // Restore only this account's explicit device preference; never prompt on load.
  useEffect(() => {
    let cancelled = false;
    setDeviceEnabled(false);
    setDeviceError('');
    if (user && user.role !== 'super_admin') {
      restoreDeviceNotifications(user.id).then(enabled => {
        if (!cancelled) setDeviceEnabled(enabled);
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user || user.role === 'super_admin') return;
    try {
      const res = await apiFetch('/notifications');
      if (res.ok) {
        const data = await res.json();
        if (userRef.current?.id !== user.id) return;
        const incoming = data.notifications || [];
        for (const notification of incoming) {
          if (initializedRef.current && !notification.is_read && !seenRef.current.has(notification.id)) {
            triggerNativeAlert(notification, enabledRef.current);
          }
          seenRef.current.add(notification.id);
        }
        initializedRef.current = true;
        setNotifications(data.notifications || []);
        setUnreadCount((data.notifications || []).filter(n => n.is_read === 0).length);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, [user]);

  useEffect(() => {
    seenRef.current = new Set();
    initializedRef.current = false;
    setNotifications([]);
    setUnreadCount(0);
    if (!user || user.role === 'super_admin') return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // reduced polling as backup

    // WebSocket Real-time Connection
    if (!user) return () => clearInterval(interval);

    let ws = null;
    let reconnectTimeout = null;
    let disposed = false;

    function connectWS() {
      if (disposed) return;
      try {
        const apiBase = new URL(getServerUrl() || window.location.origin);
        const protocol = apiBase.protocol === 'https:' ? 'wss:' : 'ws:';
        const token = localStorage.getItem('access_token') || '';

        ws = new WebSocket(`${protocol}//${apiBase.host}/ws?token=${encodeURIComponent(token)}`);

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'NEW_NOTIFICATION' && msg.data) {
              if (disposed || seenRef.current.has(msg.data.id)) return;
              seenRef.current.add(msg.data.id);
              setNotifications(prev => [msg.data, ...prev.filter(n => n.id !== msg.data.id)].slice(0, 50));
              setUnreadCount(prev => prev + 1);
              triggerNativeAlert(msg.data, enabledRef.current);
            }
          } catch (e) {
            console.warn('WS message parse error:', e);
          }
        };

        ws.onclose = () => {
          // Reconnect after 5 seconds if disconnected
          if (!disposed) reconnectTimeout = setTimeout(connectWS, 5000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch (err) {
        console.warn('WebSocket init failed:', err);
      }
    }

    connectWS();
    const resume = () => { if (document.visibilityState === 'visible') fetchNotifications(); };
    const pushReceived = (event) => {
      if (!event.data) return;
      if (event.data.type === 'PUSH_NOTIFICATION' && event.data.userId === user.id) {
        fetchNotifications();
      }
      // Service worker asks us to re-subscribe after key rotation
      if (event.data.type === 'PUSH_SUBSCRIPTION_CHANGED' && !disposed) {
        restoreDeviceNotifications(user.id).catch(err =>
          console.warn('[Push] Re-subscription after key change failed:', err.message)
        );
      }
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    navigator.serviceWorker?.addEventListener('message', pushReceived);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
      navigator.serviceWorker?.removeEventListener('message', pushReceived);
      clearInterval(interval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [user, fetchNotifications]);

  const changeDeviceNotifications = async () => {
    if (!user || user.role === 'super_admin' || deviceBusy) return;
    setDeviceBusy(true);
    setDeviceError('');
    try {
      if (deviceEnabled) {
        await disableDeviceNotifications();
        setDeviceEnabled(false);
      } else {
        await enableDeviceNotifications(user.id);
        setDeviceEnabled(true);
      }
    } catch (err) { setDeviceError(err.message); }
    finally { setDeviceBusy(false); }
  };

  const testNotification = async () => {
    setDeviceBusy(true);
    setDeviceError('');
    try { await testDeviceNotification(); }
    catch (err) { setDeviceError(err.message); }
    finally { setDeviceBusy(false); }
  };

  const markAsRead = async (id) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PUT' });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'PUT' });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, refreshNotifications: fetchNotifications,
      deviceSupport, deviceEnabled, deviceBusy, deviceError, changeDeviceNotifications, testNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
