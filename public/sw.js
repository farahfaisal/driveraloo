// Service worker for PWA and enhanced notifications
// self.__WB_MANIFEST is injected by vite-plugin-pwa at build time
const WB_MANIFEST = typeof self.__WB_MANIFEST !== 'undefined' ? self.__WB_MANIFEST : [];
const CACHE_NAME = 'captain-driver-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/notification-icon.svg',
  '/app-icon-192.png',
  '/notification.wav',
  '/order.wav'
];

self.addEventListener('install', (event) => {
  console.log('Service worker installed');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Handle fetch events for offline functionality
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip Supabase API requests (they should always be fresh)
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }

        // Clone the request
        return fetch(event.request.clone())
          .then((response) => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the fetched response
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Return offline page if available
            return caches.match('/index.html');
          });
      })
  );
});

// Background sync for checking orders
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-orders') {
    event.waitUntil(checkForNewOrders());
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-orders-periodic') {
    event.waitUntil(checkForNewOrders());
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.notification);
  
  event.notification.close();
  
  // إذا كان الإشعار يحتوي على بيانات فتح تلقائي
  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/orders';
  
  // Focus or open the app window
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Check if there's already a window/tab open
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          // فقط التركيز بدون تغيير الصفحة إذا كان المستخدم في صفحة أخرى
          if (client.url.includes('/orders')) {
            return client.navigate('/orders');
          } else {
            return Promise.resolve();
          }
        }
      }
      
      // لا تفتح نافذة جديدة، فقط سجل الحدث
      console.log('لا توجد نوافذ مفتوحة للتطبيق');
      return Promise.resolve();
    })
  );
});

// Handle notification action clicks
self.addEventListener('notificationactionclick', (event) => {
  console.log('Notification action clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open' || event.action === 'view') {
    // Open the app
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            return client.navigate('/orders');
          }
        }
        return self.clients.openWindow('/orders');
      })
    );
  }
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'BRING_TO_FOREGROUND') {
    // محاولة إحضار التطبيق للمقدمة
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          // التوجه فقط إذا كان الطلب صريحاً
          if (event.data.url && event.data.forceNavigate) {
            return client.navigate(event.data.url);
          }
          return Promise.resolve();
        }
      }
      
      // لا تفتح نافذة جديدة تلقائياً
      console.log('لا توجد نوافذ مفتوحة للتطبيق');
    });
  }
  
  // Handle new order detection from background sync
  if (event.data && event.data.type === 'NEW_ORDER_DETECTED') {
    console.log('New order detected by service worker');
    
    // Show notification
    const options = {
      body: 'طلب جديد متاح للتوصيل',
      icon: '/notification-icon.svg',
      badge: '/notification-icon.svg',
      tag: 'new-order-sw',
      renotify: true,
      requireInteraction: true,
      vibrate: [500, 200, 500, 200, 500],
      data: {
        autoOpen: true,
        url: '/orders'
      },
      actions: [
        {
          action: 'open',
          title: 'فتح التطبيق'
        },
        {
          action: 'dismiss',
          title: 'إغلاق'
        }
      ]
    };
    
    self.registration.showNotification('طلب جديد!', options);
    
    // Try to bring app to foreground
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          // التوجه لصفحة الطلبات فقط إذا لم يكن المستخدم مشغولاً
          if (!client.url.includes('/settings') && !client.url.includes('/wallet')) {
            return client.navigate('/orders');
          }
          // التوجه لصفحة الطلبات فقط إذا كان في الصفحة الرئيسية
          if (client.url.includes('/dashboard') || client.url.endsWith('/')) {
            return client.navigate('/orders');
          }
          return Promise.resolve();
        }
      }
      
      // لا تفتح نافذة جديدة
      console.log('لا توجد نوافذ مفتوحة');
      console.log('لا توجد نوافذ مفتوحة');
      return Promise.resolve();
    });
  }
});

// Handle push messages
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