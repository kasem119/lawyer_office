const CACHE_NAME = 'lawyer-office-cache-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

function appNotificationUrl(value) {
  if (typeof value !== 'string') return '/';
  try {
    const url = new URL(value, `${self.location.origin}/`);
    if (url.origin !== self.location.origin || !['http:', 'https:'].includes(url.protocol)) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// السماح للتطبيق بطلب تفعيل النسخة الجديدة فوراً (زر "تحديث الآن")
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Do not intercept API or WebSocket requests
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) {
    return;
  }

  // Network first with cache fallback for HTML/assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200 && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
        });
      })
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Always show a visible fallback. */ }

  const notifOptions = {
    body: payload.body || 'لديك إشعار جديد',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'office-notification',
    renotify: true,
    requireInteraction: false,
    data: { url: appNotificationUrl(payload.url), userId: payload.userId }
  };

  // Show the OS notification then notify any open windows.
  event.waitUntil(
    self.registration.showNotification(payload.title || 'مكتب المحاماة', notifOptions)
      .then(async () => {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clients.forEach(client =>
          client.postMessage({ type: 'PUSH_NOTIFICATION', userId: payload.userId })
        );
      })
  );
});

// Re-subscribe automatically when the browser rotates push keys.
// The SW cannot access localStorage directly, so we ask any open app window
// to perform the re-subscription using its stored auth token.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      if (clients.length > 0) {
        // Ask the app to re-subscribe
        clients.forEach(client =>
          client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' })
        );
      } else {
        // No window open — attempt a best-effort re-subscribe without a token.
        // The next time the user opens the app, restoreDeviceNotifications() will
        // detect the missing subscription and re-register it properly.
        const oldSub = event.oldSubscription;
        const appKeyRaw = oldSub?.options?.applicationServerKey;
        if (!appKeyRaw) return;
        return self.registration.pushManager
          .subscribe({ userVisibleOnly: true, applicationServerKey: appKeyRaw })
          .then(newSub =>
            // We cannot attach a Bearer token here; the request will be rejected
            // by the server middleware and the subscription stored on next login.
            fetch('/api/notifications/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ subscription: newSub.toJSON() })
            }).catch(() => {})
          ).catch(() => {});
      }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = appNotificationUrl(event.notification.data?.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find(candidate => new URL(candidate.url).origin === self.location.origin);
    if (client) {
      if (targetUrl !== '/') await client.navigate(targetUrl).catch(() => {});
      return client.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
});
