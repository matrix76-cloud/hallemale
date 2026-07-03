/* eslint-disable */
// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { watchAuthState, signOutUser, consumeRedirectResultIfAny } from "../services/authService";
import { getUserDoc, getUserProfileByUid } from "../services/userService";
import { registerFcmToken, unregisterFcmToken } from "../services/fcmService";
import { db } from "../services/firebase";
import { doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { parseAppMessage } from "../bridge/webviewBridge";

const AuthContext = createContext(null);

function logUserDocSnapshot({ stage, uid, docData, normalized }) {
  try {
    console.groupCollapsed(`[AuthProvider] userDoc snapshot · ${stage}`);

    console.log("uid:", uid);

    console.log("doc exists:", !!docData);
    console.log("doc keys:", docData ? Object.keys(docData) : []);

    console.log("SSOT activeTeamId:", docData?.activeTeamId);
    console.log("legacy clubId:", docData?.clubId);

    console.log("nickname:", docData?.nickname);
    console.log("avatarUrl:", docData?.avatarUrl);
    console.log("region:", docData?.region || `${docData?.regionSido || ""} ${docData?.regionGu || ""}`.trim());

    console.log("mainPosition:", docData?.mainPosition);
    console.log("skillLevel:", docData?.skillLevel);
    console.log("heightCm:", docData?.heightCm);
    console.log("weightKg:", docData?.weightKg);

    console.log("media len:", Array.isArray(docData?.media) ? docData.media.length : 0);

    // 최종 userDoc(호환 포함)
    console.log("normalized keys:", normalized ? Object.keys(normalized) : []);
    console.log("normalized.clubId(for legacy):", normalized?.clubId);
    console.log("normalized.activeTeamId:", normalized?.activeTeamId);

    console.groupEnd();
  } catch (e) {}
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const fcmTokenRef = React.useRef(null);
  const pendingRnTokenRef = React.useRef(null);

  // Auth 상태 구독 + users 문서 1회 로드
  useEffect(() => {
    // 구글/애플 redirect 로그인 복귀 결과 소비 (모바일 팝업 차단 시 redirect 폴백).
    // 이 호출이 있어야 redirect 복귀 후 로그인이 완료되어 onAuthStateChanged가 발화한다.
    consumeRedirectResultIfAny().catch((e) =>
      console.warn("[AuthProvider] consumeRedirectResult failed:", e?.message || e)
    );

    const unsub = watchAuthState(async (user) => {
      setFirebaseUser(user || null);

      if (!user?.uid) {
        setUserDoc(null);
        setLoading(false);
        return;
      }

      // 새 유저 로그인 시 userDoc 로드 완료까지 loading 유지
      setLoading(true);

      try {
        const docData = await getUserDoc(user.uid);

        // 🔁 기존 코드 호환: userDoc.id / clubId 필드 유지
        // 차단된 회원도 일단 userDoc은 set (BlockedAuthGate가 감지해서 오버레이 표시)
        const normalized = docData
          ? {
              ...docData,
              id: docData.id || docData.uid || user.uid,
              clubId: docData.clubId ?? docData.activeTeamId ?? null,
            }
          : {
              id: user.uid,
              uid: user.uid,
              email: user.email || "",
              nickname: "",
              clubId: null,
            };

        logUserDocSnapshot({
          stage: "watchAuthState",
          uid: user.uid,
          docData,
          normalized,
        });

        setUserDoc(normalized);

        // FCM 토큰 등록 (비동기, 실패해도 로그인 흐름 차단 안 함)
        registerFcmToken(user.uid)
          .then((token) => { fcmTokenRef.current = token; })
          .catch(() => {});
      } catch (e) {
        console.warn("[AuthProvider] getUserDoc failed:", e?.message || e);

        const fallback = {
          id: user.uid,
          uid: user.uid,
          email: user.email || "",
          nickname: "",
          clubId: null,
        };

        logUserDocSnapshot({
          stage: "watchAuthState(error-fallback)",
          uid: user.uid,
          docData: null,
          normalized: fallback,
        });

        setUserDoc(fallback);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      try {
        unsub && unsub();
      } catch (e) {}
    };
  }, []);

  // RN WebView → PUSH_TOKEN / FCM_TOKEN 수신 → users/{uid}.fcmTokens arrayUnion(객체형)
  useEffect(() => {
    const saveRnToken = async (authUid, payload) => {
      const token = String(payload?.token || "").trim();
      if (!authUid || !token) return;
      const platform = String(payload?.platform || payload?.os || "").toLowerCase() || "rn";

      // ⚠️ 카카오 등 소셜 로그인: Firebase Auth UID ≠ Firestore 문서 ID.
      // linkedSocialUid까지 해석해서 "실제 프로필 문서 ID"에 저장해야 서버 targetIds와 매칭됨.
      // (기존엔 authUid에 저장 → 서버가 타겟하는 유저 문서엔 토큰이 없어 푸시 미수신)
      let targetUid = authUid;
      try {
        const profile = await getUserProfileByUid(authUid);
        if (profile?.id) targetUid = profile.id;
      } catch (e) {
        console.warn("[AuthProvider] profile resolve for token failed:", e?.message || e);
      }

      try {
        await updateDoc(doc(db, "users", targetUid), {
          fcmTokens: arrayUnion({
            token,
            platform,
            updatedAt: new Date().toISOString(),
          }),
          updatedAt: serverTimestamp(),
        });
        console.log("[AuthProvider] RN FCM token saved:", platform, "→", targetUid);
      } catch (e) {
        console.warn("[AuthProvider] RN token save failed:", e?.message || e);
      }
    };

    const handler = (event) => {
      const msg = parseAppMessage(event.data);
      if (!msg) return;
      if (msg.type !== "PUSH_TOKEN" && msg.type !== "FCM_TOKEN") return;

      const uid = firebaseUser?.uid;
      if (!uid) {
        pendingRnTokenRef.current = msg.payload;
        return;
      }
      saveRnToken(uid, msg.payload);
    };

    window.addEventListener("message", handler);

    // 보류 토큰 처리
    if (firebaseUser?.uid && pendingRnTokenRef.current) {
      saveRnToken(firebaseUser.uid, pendingRnTokenRef.current);
      pendingRnTokenRef.current = null;
    }

    return () => window.removeEventListener("message", handler);
  }, [firebaseUser?.uid]);

  const refreshUser = async () => {
    if (!firebaseUser?.uid) return;
    const docData = await getUserDoc(firebaseUser.uid);
    if (!docData) return;

    const normalized = {
      ...docData,
      id: docData.id || docData.uid || firebaseUser.uid,
      clubId: docData.clubId ?? docData.activeTeamId ?? null,
    };

    logUserDocSnapshot({
      stage: "refreshUser",
      uid: firebaseUser.uid,
      docData,
      normalized,
    });

    setUserDoc(normalized);
  };

  const value = useMemo(() => {
    return {
      firebaseUser,
      userDoc,
      loading,
      isLoggedIn: !!firebaseUser?.uid,
      loginAsMock: async () => {
        console.warn("[Auth] loginAsMock is deprecated. Use Firebase login.");
      },
      refreshUser,
      signOut: async () => {
        // FCM 토큰 해제
        const uid = firebaseUser?.uid;
        const token = fcmTokenRef.current;
        if (uid && token) {
          await unregisterFcmToken(uid, token).catch(() => {});
          fcmTokenRef.current = null;
        }

        await signOutUser();
        setFirebaseUser(null);
        setUserDoc(null);
      },
    };
  }, [firebaseUser, userDoc, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
