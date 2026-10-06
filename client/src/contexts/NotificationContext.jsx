import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch, getServerUrl } from '../api/client';
import { useAuth } from './AuthContext';

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
  } catch (e) {
    // Audio context may be restricted before user interaction
  }
}

function triggerNativeAlert(title, message) {
  // Mobile vibration
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate([200, 100, 200]); } catch (e) {}
  }

  // Audio chime
  playChimeSound();

  // Native desktop/phone push notification
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: message,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png'
      });
    } catch (e) {
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body: message,
            icon: '/icons/icon-192.png'
          });
        }).catch(() => {});
      }
    }
  }
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Request browser notification permission once user is logged in
  useEffect(() => {
    if (user && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user || user.role === 'super_admin') return;
    try {
      const res = await apiFetch('/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount((data.notifications || []).filter(n => n.is_read === 0).length);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    if (user?.role === 'super_admin') return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // reduced polling as backup

    // WebSocket Real-time Connection
    if (!user) return () => clearInterval(interval);

    let ws = null;
    let reconnectTimeout = null;

    function connectWS() {
      try {
        const apiBase = new URL(getServerUrl() || window.location.origin);
        const protocol = apiBase.protocol === 'https:' ? 'wss:' : 'ws:';
        const token = localStorage.getItem('access_token') || '';

        ws = new WebSocket(`${protocol}//${apiBase.host}/ws?token=${encodeURIComponent(token)}`);

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'NEW_NOTIFICATION' && msg.data) {
              setNotifications(prev => [msg.data, ...prev]);
              setUnreadCount(prev => prev + 1);
              triggerNativeAlert(msg.data.title, msg.data.message);
            }
          } catch (e) {
            console.warn('WS message parse error:', e);
          }
        };

        ws.onclose = () => {
          // Reconnect after 5 seconds if disconnected
          reconnectTimeout = setTimeout(connectWS, 5000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch (err) {
        console.warn('WebSocket init failed:', err);
      }
    }

    connectWS();

    return () => {
      clearInterval(interval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [user]);

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
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, refreshNotifications: fetchNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
