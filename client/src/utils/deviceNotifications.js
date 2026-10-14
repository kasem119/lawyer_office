import { apiFetch } from '../api/client';

const preferenceKey = 'device_notification_user';
export function deviceNotificationSupport() {
  if (window.electronAPI?.showNotification) return 'native';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone) return 'install';
  if (!window.isSecureContext) return 'https';
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window ? 'push' : 'unsupported';
}

async function post(path, body) {
  const res = await apiFetch(`/notifications/push/${path}`, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'تعذر حفظ إعدادات الإشعارات');
}

export async function enableDeviceNotifications(userId) {
  if (deviceNotificationSupport() === 'native') {
    localStorage.setItem(preferenceKey, String(userId));
    return;
  }
  // This must execute before any network await to retain the tap's user activation.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('اسمح بالإشعارات من إعدادات المتصفح ثم حاول مجدداً');

  await registerPushSubscription(userId);
}

// Automatic recovery is allowed only by restoreDeviceNotifications after checking
// this account's saved preference and existing browser permission.
async function registerPushSubscription(userId) {
  // Register SW relative to the server origin (works for PWA and LAN access)
  const swUrl = new URL('/sw.js', window.location.origin).href;
  await navigator.serviceWorker.register(swUrl, { scope: '/' });
  const registration = await navigator.serviceWorker.ready;

  const res = await apiFetch('/notifications/push/public-key');
  if (!res.ok) throw new Error('تعذر إعداد إشعارات الخادم');
  const { publicKey } = await res.json();
  const padded = publicKey + '='.repeat((4 - publicKey.length % 4) % 4);
  const key = Uint8Array.from(atob(padded.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && subscription.options?.applicationServerKey &&
      String(new Uint8Array(subscription.options.applicationServerKey)) !== String(key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await post('subscribe', { subscription: subscription.toJSON() });
  localStorage.setItem(preferenceKey, String(userId));
}

export async function restoreDeviceNotifications(userId) {
  if (localStorage.getItem(preferenceKey) !== String(userId)) return false;
  if (deviceNotificationSupport() === 'native') return true;
  if (deviceNotificationSupport() !== 'push' || Notification.permission !== 'granted') return false;
  await registerPushSubscription(userId);
  return true;
}

export async function disableDeviceNotifications() {
  localStorage.removeItem(preferenceKey);
  if (!('serviceWorker' in navigator) || window.electronAPI?.showNotification) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription) {
    // Invalidate at the browser even if the office server is unreachable.
    if (!await subscription.unsubscribe()) throw new Error('تعذر إيقاف الإشعارات على هذا الجهاز');
    await post('unsubscribe', { endpoint: subscription.endpoint });
  }
  const alerts = await registration?.getNotifications();
  alerts?.forEach(alert => alert.close());
}

export async function testDeviceNotification() {
  if (window.electronAPI?.showNotification) {
    const result = await window.electronAPI.showNotification({ title: 'اختبار الإشعارات', body: 'تم تفعيل إشعارات مكتب المحاماة على هذا الجهاز' });
    if (!result.success) throw new Error('تعذر عرض التنبيه؛ تحقق من إعدادات إشعارات Windows');
  } else {
    await post('test', {});
  }
}
