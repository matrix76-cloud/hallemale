/* eslint-disable */
// src/hooks/useOwnerAuth.js
// 구장주 전용 Auth(ownerAuth) 상태 구독 훅 — 사용자 앱 세션과 분리.
import { useEffect, useState } from "react";
import { watchOwnerAuth, consumeOwnerRedirectResult } from "../services/ownerAuthService";

// redirect 결과 소비는 앱당 1회만
let _consumePromise = null;
function consumeOnce() {
  if (!_consumePromise) _consumePromise = consumeOwnerRedirectResult().catch(() => {});
  return _consumePromise;
}

export function useOwnerAuth() {
  const [user, setUser] = useState(() => undefined); // undefined=초기, null=로그아웃
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    consumeOnce();
    const unsub = watchOwnerAuth((u) => {
      setUser(u || null);
      setLoading(false);
    });
    return () => { try { unsub && unsub(); } catch {} };
  }, []);

  return {
    firebaseUser: user || null,
    uid: user?.uid || "",
    isLoggedIn: !!user?.uid,
    loading,
  };
}
