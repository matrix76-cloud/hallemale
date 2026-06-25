/* eslint-disable */
// src/context/OwnerContext.jsx
// 구장주 워크스페이스 공용 상태: 내 구장(venue) 1개 로드 + 새로고침
import React, { createContext, useContext, useCallback, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { getMyVenue } from "../services/ownerVenueService";

const OwnerContext = createContext(null);

export function OwnerProvider({ children }) {
  const { firebaseUser, isLoggedIn } = useAuth();
  const uid = firebaseUser?.uid || "";

  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!uid) {
      setVenue(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const v = await getMyVenue(uid);
      setVenue(v);
    } catch (e) {
      console.warn("[OwnerContext] getMyVenue failed:", e?.message || e);
      setVenue(null);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = {
    uid,
    isLoggedIn: !!isLoggedIn,
    venue,
    loading,
    refresh,
    status: venue?.status || (loading ? "loading" : "none"),
  };

  return <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>;
}

export function useOwner() {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error("useOwner must be used within OwnerProvider");
  return ctx;
}
