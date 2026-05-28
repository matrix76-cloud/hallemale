/* eslint-disable */
// src/services/fcmService.js
// FCM 토큰 관리 + 포그라운드 메시지 수신

import { db, app } from "./firebase";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { isInWebView } from "../bridge/webviewBridge";

const VAPID_KEY = process.env.REACT_APP_FCM_VAPID_KEY || "";

let _messaging = null;

/**
 * firebase/messaging 동적 import (브라우저 미지원 환경 안전)
 */
async function getMessaging() {
  if (_messaging) return _messaging;

  if (typeof window === "undefined" || !("Notification" in window)) {
    console.warn("[fcm] messaging not supported in this environment");
    return null;
  }

  try {
    const mod = await import("firebase/messaging");
    _messaging = mod.getMessaging(app);
    return _messaging;
  } catch (e) {
    console.warn("[fcm] failed to load firebase/messaging:", e?.message || e);
    return null;
  }
}

/**
 * FCM 토큰 등록
 * - 알림 권한 요청 → getToken() → users/{uid}.fcmTokens에 arrayUnion
 */
export async function registerFcmToken(uid) {
  if (!uid) return null;

  // RN WebView 안에서는 웹 FCM 등록 스킵 (RN 네이티브 토큰 사용)
  if (isInWebView()) {
    console.log("[fcm] skip web token registration in RN WebView");
    return null;
  }

  const messaging = await getMessaging();
  if (!messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("[fcm] notification permission denied");
      return null;
    }

    const { getToken } = await import("firebase/messaging");

    const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (!token) {
      console.warn("[fcm] getToken returned empty");
      return null;
    }

    await updateDoc(doc(db, "users", uid), {
      fcmTokens: arrayUnion(token),
    });

    console.log("[fcm] token registered for uid:", uid);
    return token;
  } catch (e) {
    console.warn("[fcm] registerFcmToken error:", e?.message || e);
    return null;
  }
}

/**
 * FCM 토큰 해제 (로그아웃 시)
 */
export async function unregisterFcmToken(uid, token) {
  if (!uid || !token) return;

  try {
    await updateDoc(doc(db, "users", uid), {
      fcmTokens: arrayRemove(token),
    });
    console.log("[fcm] token unregistered for uid:", uid);
  } catch (e) {
    console.warn("[fcm] unregisterFcmToken error:", e?.message || e);
  }
}

/**
 * 포그라운드 메시지 수신 리스너
 */
export async function onForegroundMessage(callback) {
  const messaging = await getMessaging();
  if (!messaging) return () => {};

  try {
    const { onMessage } = await import("firebase/messaging");
    return onMessage(messaging, (payload) => {
      console.log("[fcm] foreground message:", payload);
      if (typeof callback === "function") callback(payload);
    });
  } catch (e) {
    console.warn("[fcm] onForegroundMessage error:", e?.message || e);
    return () => {};
  }
}
