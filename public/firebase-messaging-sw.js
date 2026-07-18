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

// 알림 deepLink ↔ 실제 라우트 불일치 보정 (인앱 NotificationsPage와 동일 규칙)
// 빈값이면 "" 반환(폴백에서 처리).
function normalizeDeepLink(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  const s = v.startsWith("/") ? v : `/${v}`;
  if (s === "/chat" || s === "/chats") return "/chats";
  if (s.startsWith("/chat/") || s.startsWith("/chats/")) {
    const cid = s.slice(s.startsWith("/chats/") ? "/chats/".length : "/chat/".length);
    if (cid.startsWith("match_")) return `/match-roomdetail/${cid.slice("match_".length)}`;
    return `/chats/${cid}`;
  }
  if (s.startsWith("/matchroom/")) return `/match-roomdetail/${s.slice("/matchroom/".length)}`;
  if (s.startsWith("/community/")) return `/communitypost/${s.slice("/community/".length)}`;
  // 팀 초대/참여요청 → 내정보 요청 화면
  if (s.startsWith("/clubs/")) {
    const rest = s.slice("/clubs/".length);
    const clubId = rest.split("/")[0];
    if (rest.endsWith("/manage")) return "/my/team-invites";
    return clubId ? `/team/${clubId}/join-requests` : "/my/team-invites";
  }
  return s;
}

// deepLink 없을 때 종류(kind)별 폴백 (푸시 data엔 식별자가 없어 일반 화면으로)
function fallbackByKind(kind) {
  const k = String(kind || "").trim().toLowerCase();
  if (k === "chat") return "/chats";
  if (k === "match") return "/matchingmanage";
  if (k === "team") return "/my";
  if (k === "notice") return "/notifications";
  return "/";
}

function resolveRoute(data) {
  return normalizeDeepLink(data?.deepLink) || fallbackByKind(data?.kind || data?.type) || "/";
}

messaging.onBackgroundMessage((payload) => {
  console.log("[sw] background message:", payload);

  const title = payload.notification?.title || "할라매알라";
  const body = payload.notification?.body || "";
  const icon = "/logo192.png";
  const deepLink = resolveRoute(payload.data);

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
