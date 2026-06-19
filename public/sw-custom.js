// Custom handlers imported by the workbox-generated sw.js via importScripts
// Only contains handlers NOT managed by workbox: push, notificationclick, message

// Handle incoming Web Push messages (from notify-drivers-web-push edge function)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'طلب جديد!', body: event.data.text() };
  }

  const options = {
    body: data.body || 'طلب جديد متاح للتوصيل',
    icon: '/notification-icon.svg',
    badge: '/notification-icon.svg',
    tag: 'new-order',
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 150, 300, 150, 300],
    data: {
      url: '/orders',
      order_id: data.data?.order_id,
      order_number: data.data?.order_number,
    },
    actions: [
      { action: 'view', title: 'عرض الطلب' },
      { action: 'dismiss', title: 'إغلاق' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'طلب جديد!', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          return client.navigate('/orders');
        }
      }
      return self.clients.openWindow('/orders');
    })
  );
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'BRING_TO_FOREGROUND') {
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          if (event.data.url && event.data.forceNavigate) {
            client.navigate(event.data.url);
          }
          return;
        }
      }
    });
  }

  if (event.data.type === 'NEW_ORDER_DETECTED') {
    self.registration.showNotification('طلب جديد!', {
      body: 'طلب جديد متاح للتوصيل',
      icon: '/notification-icon.svg',
      badge: '/notification-icon.svg',
      tag: 'new-order-sw',
      renotify: true,
      requireInteraction: true,
      vibrate: [500, 200, 500, 200, 500],
      data: { url: '/orders' },
      actions: [
        { action: 'view', title: 'فتح التطبيق' },
        { action: 'dismiss', title: 'إغلاق' }
      ]
    });
  }
});

// Background / periodic sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-orders') {
    event.waitUntil(Promise.resolve());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-orders-periodic') {
    event.waitUntil(Promise.resolve());
  }
});
