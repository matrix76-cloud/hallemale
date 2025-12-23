/* eslint-disable */
// src/services/firebase.js
// Firebase Client (CRA) — env 기반 단일 진입점
// ✅ DEV(임시) / PROD(고객) 프로젝트 전환은 .env.* 교체로만 처리

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

let analytics = null;

const firebaseConfig = {
  apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
  authDomain: "halle-bf789.firebaseapp.com",
  projectId: "halle-bf789",
  storageBucket: "halle-bf789.firebasestorage.app",
  messagingSenderId: "939913723928",
  appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
  measurementId: "G-XGV59SNLME"
};

// 필수 키 체크 (초기 개발 단계에서 실수 방지)
const requiredKeys = ["apiKey", "authDomain", "projectId", "appId"];
requiredKeys.forEach((k) => {
  if (!firebaseConfig[k]) {
    // eslint-disable-next-line no-console
    console.warn(
      `[firebase] Missing firebaseConfig.${k}. Check your .env.development / .env.production`
    );
  }
});

// CRA HMR / 재렌더 환경에서 중복 초기화 방지
export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Analytics는 브라우저에서만 + measurementId 있을 때만 안전하게 활성화
export const getAnalyticsIfAvailable = async () => {
  if (analytics) return analytics;
  if (!firebaseConfig.measurementId) return null;
  if (typeof window === "undefined") return null;

  try {
    const mod = await import("firebase/analytics");
    analytics = mod.getAnalytics(app);
    return analytics;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[firebase] Analytics not available:", e?.message || e);
    return null;
  }
};

// 디버그 로그(원하면 나중에 제거)
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line no-console
  console.log("[firebase] connected =", {
    env: process.env.REACT_APP_ENV_NAME || "dev",
    projectId: firebaseConfig.projectId,
  });
}
