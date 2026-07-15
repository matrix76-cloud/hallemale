/* eslint-disable */
// src/context/OwnerContext.jsx
// 구장주 워크스페이스 공용 상태 — 별도 ownerAuth 세션 + 내 구장 + 구장주 프로필
import React, { createContext, useContext, useCallback, useEffect, useState } from "react";
import { useOwnerAuth } from "../hooks/useOwnerAuth";
import { listMyVenues } from "../services/ownerVenueService";
import { ownerSignOut } from "../services/ownerAuthService";
import { getUserDoc } from "../services/userService";
import { registerFcmToken } from "../services/fcmService";
import { parseAppMessage, isInWebView, postToApp } from "../bridge/webviewBridge";
import { identify } from "../utils/analytics";
import { db } from "../services/firebase";
import { doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";

const OwnerContext = createContext(null);

export function OwnerProvider({ children }) {
  const { firebaseUser, uid, isLoggedIn, loading: authLoading } = useOwnerAuth();

  const [venues, setVenues] = useState([]);          // 내 구장 전체 (다구장)
  const [activeVenueId, setActiveVenueId] = useState(""); // 현재 관리 중인 구장
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  const storeKey = uid ? `owner_active_venue_${uid}` : "";

  const refresh = useCallback(async () => {
    if (!uid) {
      setVenues([]);
      setActiveVenueId("");
      setUserDoc(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [vs, u] = await Promise.all([
        listMyVenues(uid),
        getUserDoc(uid).catch(() => null),
      ]);
      const list = Array.isArray(vs) ? vs : [];
      setVenues(list);
      setUserDoc(u);
      // 활성 구장 결정: 저장된 선택(존재하면) > 첫 번째
      let stored = "";
      try { stored = localStorage.getItem(`owner_active_venue_${uid}`) || ""; } catch (e) {}
      const nextActive = stored && list.some((v) => v.id === stored) ? stored : (list[0]?.id || "");
      setActiveVenueId(nextActive);
    } catch (e) {
      console.warn("[OwnerContext] refresh failed:", e?.message || e);
      setVenues([]);
      setActiveVenueId("");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // 활성 구장 전환 (선택 영속)
  const setActiveVenue = useCallback((id) => {
    const vid = String(id || "");
    setActiveVenueId(vid);
    try { if (uid && vid) localStorage.setItem(`owner_active_venue_${uid}`, vid); } catch (e) {}
  }, [uid]);

  // 현재 관리 중인 구장 (활성 id 매칭 → 없으면 첫 번째)
  const venue = venues.find((v) => v.id === activeVenueId) || venues[0] || null;

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  // 퍼널 계측: 구장주 세션 식별 — 이후 owner_* 이벤트를 role:owner + 구장주 uid로 묶는다
  useEffect(() => {
    if (uid) identify(uid, { role: "owner" });
  }, [uid]);

  // 예약 알림 푸시 수신용 FCM 토큰 등록 (오너 uid = users 문서 id)
  useEffect(() => {
    if (!uid) return;

    // 웹(비 WebView): 브라우저 알림 권한 → users/{uid}.fcmTokens
    registerFcmToken(uid).catch(() => {});

    // RN WebView(오너 네이티브 앱): 네이티브가 토큰 전달 → users/{uid}.fcmTokens(객체형)
    const saveRnToken = async (payload) => {
      const token = String(payload?.token || "").trim();
      if (!token) return;
      const platform = String(payload?.platform || payload?.os || "").toLowerCase() || "rn";
      try {
        await updateDoc(doc(db, "users", uid), {
          fcmTokens: arrayUnion({ token, platform, updatedAt: new Date().toISOString() }),
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn("[OwnerContext] RN FCM token save failed:", e?.message || e);
      }
    };

    const handler = (event) => {
      const msg = parseAppMessage(event.data);
      if (!msg) return;
      if (msg.type !== "PUSH_TOKEN" && msg.type !== "FCM_TOKEN") return;
      saveRnToken(msg.payload);
    };

    // iOS=window / Android=document 둘 다 등록
    window.addEventListener("message", handler);
    if (typeof document !== "undefined") document.addEventListener("message", handler);

    // pull 모델 대비 토큰 명시 요청 (proactive면 no-op)
    if (isInWebView()) postToApp("GET_PUSH_TOKEN", {});

    return () => {
      window.removeEventListener("message", handler);
      if (typeof document !== "undefined") document.removeEventListener("message", handler);
    };
  }, [uid]);

  const signOut = useCallback(async () => {
    try { await ownerSignOut(); } catch {}
    setVenues([]);
    setActiveVenueId("");
    setUserDoc(null);
  }, []);

  const value = {
    uid,
    firebaseUser,
    userDoc,
    isLoggedIn: !!isLoggedIn,
    authLoading,
    venue,
    venues,
    activeVenueId,
    setActiveVenue,
    loading: authLoading || loading,
    refresh,
    signOut,
    status: venue?.status || (loading ? "loading" : "none"),
  };

  return <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>;
}

export function useOwner() {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error("useOwner must be used within OwnerProvider");
  return ctx;
}
