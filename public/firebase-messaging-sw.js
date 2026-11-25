/* Service Worker for QLite queue milestone alerts & background push notifications */
// Standard Service Worker for QLite queue milestone alerts & Firebase Cloud Messaging
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { title: 'QLite Queue Update', body: event.data.text() } };
  }

  const title = payload?.notification?.title || payload?.data?.title || 'QLite Queue Update';
  const body =
    payload?.notification?.body ||
    payload?.data?.body ||
    'Your digital queue status has updated.';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: payload?.data?.tokenId || 'qlite-push-alert',
      data: payload?.data || {},
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
      return undefined;
    })
  );
});
