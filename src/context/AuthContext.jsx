/* eslint-disable */
// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { watchAuthState, signOutUser } from "../services/authService";
import { getUserDoc } from "../services/userService";

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

  // Auth 상태 구독 + users 문서 1회 로드
  useEffect(() => {
    const unsub = watchAuthState(async (user) => {
      setFirebaseUser(user || null);

      if (!user?.uid) {
        setUserDoc(null);
        setLoading(false);
        return;
      }

      try {
        const docData = await getUserDoc(user.uid);

        // 🔁 기존 코드 호환: userDoc.id / clubId 필드 유지
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
