// Gannamasti Cafe Service Worker
const CACHE_NAME = 'gannamasti-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch handler (can be expanded for offline caching)
self.addEventListener('fetch', (event) => {
  // Let browser make standard network requests
  return;
});

// Background push notification listener
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Order Status Update!',
    body: 'Your delicious fresh order is ready at Gannamasti Cafe!',
    icon: '/images/logo.png',
    badge: '/images/logo.png',
    url: '/account'
  };

  if (event.data) {
    try {
      const data = event.data.json();
      payload = { ...payload, ...data };
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/images/logo.png',
    badge: payload.badge || '/images/logo.png',
    vibrate: [100, 50, 100],
    data: {
      url: payload.url || '/account'
    }
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// Handle notification banner clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/account';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If order tracking page is already open, focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window/app view
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
