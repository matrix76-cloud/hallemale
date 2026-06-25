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
  // ✅ Firebase 기본 도메인 사용.
  //    구글이 자동 생성한 OAuth 클라이언트에 https://halle-bf789.firebaseapp.com/__/auth/handler 가
  //    항상 등록돼 있으므로 모든 환경(로컬/안드/iOS/운영)에서 구글 로그인 시 redirect_uri_mismatch(400) 가 발생하지 않음.
  //    (과거 커스텀 도메인 hallaemallae.com 을 쓰면 OAuth 클라이언트에 해당 handler 를 수동 등록해야 했고,
  //     누락 시 구글 로그인이 400 으로 막혔다. → Firebase 기본 도메인으로 통일.)
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

// ✅ 구장 관리자(구장주) 전용 Auth 인스턴스.
//    같은 origin이라도 별도 Firebase 앱("owner")으로 분리하면 Auth 세션 저장소가
//    독립적으로 관리되어, 사용자 앱 로그인과 구장주 로그인이 서로 섞이지 않는다.
//    (같은 브라우저에서 사용자=A계정 / 구장주=B계정 동시 로그인 가능)
//    Firestore/Storage는 같은 프로젝트(db) 공유 — 보안규칙 전면허용 상태라 동작에 무관.
export const ownerApp =
  getApps().find((a) => a.name === "owner") || initializeApp(firebaseConfig, "owner");
export const ownerAuth = getAuth(ownerApp);

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
