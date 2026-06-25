/* eslint-disable */
// src/context/OwnerContext.jsx
// 구장주 워크스페이스 공용 상태 — 별도 ownerAuth 세션 + 내 구장 + 구장주 프로필
import React, { createContext, useContext, useCallback, useEffect, useState } from "react";
import { useOwnerAuth } from "../hooks/useOwnerAuth";
import { getMyVenue } from "../services/ownerVenueService";
import { ownerSignOut } from "../services/ownerAuthService";
import { getUserDoc } from "../services/userService";

const OwnerContext = createContext(null);

export function OwnerProvider({ children }) {
  const { firebaseUser, uid, isLoggedIn, loading: authLoading } = useOwnerAuth();

  const [venue, setVenue] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!uid) {
      setVenue(null);
      setUserDoc(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [v, u] = await Promise.all([
        getMyVenue(uid),
        getUserDoc(uid).catch(() => null),
      ]);
      setVenue(v);
      setUserDoc(u);
    } catch (e) {
      console.warn("[OwnerContext] refresh failed:", e?.message || e);
      setVenue(null);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  const signOut = useCallback(async () => {
    try { await ownerSignOut(); } catch {}
    setVenue(null);
    setUserDoc(null);
  }, []);

  const value = {
    uid,
    firebaseUser,
    userDoc,
    isLoggedIn: !!isLoggedIn,
    authLoading,
    venue,
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
