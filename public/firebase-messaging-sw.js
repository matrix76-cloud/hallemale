/* eslint-disable no-undef */
// public/firebase-messaging-sw.js
// Firebase Cloud Messaging 백그라운드 수신 서비스 워커

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
  authDomain: "halle-bf789.firebaseapp.com",
  projectId: "halle-bf789",
  storageBucket: "halle-bf789.firebasestorage.app",
  messagingSenderId: "939913723928",
  appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[sw] background message:", payload);

  const title = payload.notification?.title || "할라매알라";
  const body = payload.notification?.body || "";
  const icon = "/logo192.png";
  const deepLink = payload.data?.deepLink || "/";

  self.registration.showNotification(title, {
    body,
    icon,
    data: { deepLink },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const deepLink = event.notification.data?.deepLink || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(deepLink);
          return;
        }
      }
      return clients.openWindow(deepLink);
    })
  );
});
