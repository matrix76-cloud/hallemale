// src/context/HomeDataContext.jsx
/* eslint-disable */
import React, { createContext, useCallback, useMemo, useRef, useState } from "react";

import { loadHomePageData, loadHomeFavorites } from "../services/homeService";

const HomeDataContext = createContext(null);

export function HomeDataProvider({ children }) {
  const [homeData, setHomeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedUid, setLoadedUid] = useState("");
  const [loadedAt, setLoadedAt] = useState(null);

  // ✅ 중복 호출 방지 (동일 uid preload 중이면 같은 Promise 반환)
  const inflightRef = useRef({ uid: "", promise: null });

  const clearHomeData = useCallback(() => {
    inflightRef.current = { uid: "", promise: null };
    setHomeData(null);
    setLoading(false);
    setError("");
    setLoadedUid("");
    setLoadedAt(null);
  }, []);

  const preloadHomeData = useCallback(async (uid) => {
    const u = String(uid || "").trim();
    if (!u) throw new Error("preloadHomeData: uid is required");

    // ✅ 같은 uid 이미 로드됨 → 그대로 반환
    if (homeData && loadedUid === u) return homeData;

    // ✅ 같은 uid 로딩 중 → 같은 promise 공유
    if (inflightRef.current.uid === u && inflightRef.current.promise) {
      return inflightRef.current.promise;
    }

    setLoading(true);
    setError("");

    const p = (async () => {
      try {
        // ✅ uid 변경 시 캐시 무효화
        if (loadedUid && loadedUid !== u) {
          setHomeData(null);
        }

        const data = await loadHomePageData({ uid: u });

        setHomeData(data || null);
        setLoadedUid(u);
        setLoadedAt(Date.now());
        setLoading(false);
        setError("");
        return data;
      } catch (e) {
        const msg = e?.message || "홈 데이터 로딩 중 오류가 발생했습니다.";
        setError(msg);
        setLoading(false);
        throw e;
      } finally {
        // ✅ 완료되면 inflight 비움 (단, 다른 uid로 바뀌었을 수 있으니 uid 검사)
        if (inflightRef.current.uid === u) {
          inflightRef.current = { uid: "", promise: null };
        }
      }
    })();

    inflightRef.current = { uid: u, promise: p };
    return p;
  }, [homeData, loadedUid]);

  const refreshHomeData = useCallback(async (uid) => {
    const u = String(uid || "").trim();
    if (!u) throw new Error("refreshHomeData: uid is required");

    // ✅ refresh는 무조건 새로 로드
    inflightRef.current = { uid: "", promise: null };
    setLoading(true);
    setError("");

    try {
      const data = await loadHomePageData({ uid: u });
      setHomeData(data || null);
      setLoadedUid(u);
      setLoadedAt(Date.now());
      setLoading(false);
      setError("");
      return data;
    } catch (e) {
      const msg = e?.message || "홈 데이터 새로고침 중 오류가 발생했습니다.";
      setError(msg);
      setLoading(false);
      throw e;
    }
  }, []);


  const refreshFavorites = useCallback(async (uid) => {
  const u = String(uid || "").trim();
  if (!u) throw new Error("refreshFavorites: uid is required");

  try {
    const fav = await loadHomeFavorites({ uid: u });

    setHomeData((prev) => {
      const base = prev && typeof prev === "object" ? prev : {};
      return {
        ...base,
        favoriteTeams: Array.isArray(fav?.favoriteTeams) ? fav.favoriteTeams : [],
        favoritePlayers: Array.isArray(fav?.favoritePlayers) ? fav.favoritePlayers : [],
      };
    });

    setLoadedUid(u);
    setLoadedAt(Date.now());
    return fav;
  } catch (e) {
    // 즐겨찾기만 실패해도 홈 전체는 유지
    return null;
  }
}, []);


  const value = useMemo(
    () => ({
      homeData,
      loading,
      error,
      loadedUid,
      loadedAt,
      preloadHomeData,
      refreshHomeData,
      clearHomeData,
      setHomeData, // 필요 시 내부에서만 사용 (외부에서 남발 금지)
      refreshFavorites
    }),
    [homeData, loading, error, loadedUid, loadedAt, preloadHomeData, refreshHomeData, clearHomeData,refreshFavorites]
  );

  return <HomeDataContext.Provider value={value}>{children}</HomeDataContext.Provider>;
}

export function getHomeDataContext() {
  return HomeDataContext;
}
