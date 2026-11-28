/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCzIvGmQ_H01nlnooN77d2ml76YqHyGQkQ',
  authDomain: 'gen-lang-client-0179420211.firebaseapp.com',
  projectId: 'gen-lang-client-0179420211',
  storageBucket: 'gen-lang-client-0179420211.firebasestorage.app',
  messagingSenderId: '657936855795',
  appId: '1:657936855795:web:0899f76c4f1fca9b33bd86',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title =
    payload?.notification?.title ||
    payload?.data?.title ||
    'سُفرة QR — تنبيه تشغيل';
  const body =
    payload?.notification?.body ||
    payload?.data?.body ||
    'يوجد تحديث جديد في طلبات المطعم.';
  const targetUrl = payload?.data?.url || '/';
  const tag = payload?.data?.tag || 'sufra-staff-alert';

  self.registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    badge: '/favicon-32x32.png',
    dir: 'rtl',
    lang: 'ar',
    tag,
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: targetUrl,
      stationId: payload?.data?.stationId || '',
      restaurantId: payload?.data?.restaurantId || '',
    },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification && event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl && client.url !== targetUrl) {
            return client.navigate(targetUrl);
          }
          return client;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
