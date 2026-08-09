/* eslint-disable */
// src/services/firebase.js
// Firebase Client (CRA) — env 기반 단일 진입점
// ✅ DEV(임시) / PROD(고객) 프로젝트 전환은 .env.* 교체로만 처리

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
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

/**
 * Firestore 로컬 영속 캐시(IndexedDB).
 *
 * 기본값은 메모리 캐시라 앱을 껐다 켜면 캐시가 통째로 사라지고, 네트워크가 끊기면
 * 읽기가 그냥 실패한다. 영속 캐시를 켜면 다시 켰을 때도 이전 데이터가 남아 있어
 * 지하철·엘리베이터처럼 신호가 나쁜 곳에서 화면이 비지 않는다.
 *
 * ⚠️ IndexedDB 를 못 쓰는 환경(시크릿 모드, 일부 웹뷰)에서는 초기화가 실패할 수 있어
 *    메모리 캐시로 조용히 되돌린다 — 캐시 때문에 앱이 안 뜨는 일은 없어야 한다.
 * ⚠️ 여러 탭을 동시에 여는 경우가 있어 multi-tab 매니저를 쓴다(단일 탭 매니저는
 *    두 번째 탭에서 영속 캐시가 아예 꺼진다).
 */
function createDb(targetApp) {
  try {
    return initializeFirestore(targetApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (e) {
    console.warn("[firebase] 영속 캐시 초기화 실패 → 메모리 캐시로 진행:", e?.message || e);
    return getFirestore(targetApp);
  }
}

export const db = createDb(app);
export const storage = getStorage(app);

// ✅ 구장 관리자(구장주) 전용 Auth 인스턴스.
//    같은 origin이라도 별도 Firebase 앱("owner")으로 분리하면 Auth 세션 저장소가
//    독립적으로 관리되어, 사용자 앱 로그인과 구장주 로그인이 서로 섞이지 않는다.
//    (같은 브라우저에서 사용자=A계정 / 구장주=B계정 동시 로그인 가능)
export const ownerApp =
  getApps().find((a) => a.name === "owner") || initializeApp(firebaseConfig, "owner");
export const ownerAuth = getAuth(ownerApp);

// ⚠️ Firestore/Storage 요청에 실리는 request.auth 는 "그 핸들이 어느 앱에 묶였는가"로 정해진다.
//    위 db/storage 는 기본 앱(=사용자 앱 세션)에 묶여 있어서, 구장주가 그걸로 쓰면
//    보안규칙에는 구장주가 아니라 사용자 앱 세션(로그아웃이면 null)으로 보인다.
//    → isVenueOwner()(venues.ownerUid == request.auth.uid)·payments.ownerUid 판정이 전부 빗나가고,
//      users/{구장주uid} 쓰기와 Storage 업로드(storage.rules: request.auth != null)도 막힌다.
//    구장주 세션으로 하는 읽기/쓰기는 반드시 아래 핸들을 쓴다.
//    (예전엔 "보안규칙 전면허용이라 무관"이라 적혀 있었는데, 규칙을 잠근 순간 그 전제가 깨졌다)
export const ownerDb = createDb(ownerApp);
export const ownerStorage = getStorage(ownerApp);

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
