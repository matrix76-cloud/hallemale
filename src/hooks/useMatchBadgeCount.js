/* eslint-disable */
// src/hooks/useMatchBadgeCount.js
// ✅ 매칭 배지 카운트 훅 (실시간)
// - 실시간(onSnapshot) 허용 범위: 배지 카운트
// - SSOT: match_requests(status=="pending") & (actorClubId==myClubId OR targetClubId==myClubId)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { useClub } from "./useClub";
import { subscribeMatchPendingCountForTeam, getMatchUnreadCountForTeam } from "../services/matchingBadgeService";

const toStr = (v) => String(v || "").trim();

export default function useMatchBadgeCount() {
  const { firebaseUser, userDoc } = useAuth();
  const uid = toStr(firebaseUser?.uid || userDoc?.uid || userDoc?.id);

  const { club } = useClub();
  const clubId = toStr(club?.clubId || club?.id);

  const [count, setCount] = useState(0);

  const unsubRef = useRef(null);
  const bootKey = useMemo(() => `${uid || "nouid"}:${clubId || "noclub"}`, [uid, clubId]);

  const stop = useCallback(() => {
    try {
      if (unsubRef.current) unsubRef.current();
    } catch (e) {}
    unsubRef.current = null;
  }, []);

  const start = useCallback(async () => {
    stop();

    if (!uid || !clubId) {
      setCount(0);
      return;
    }

    // ✅ 초기값 1회 로드(옵션) — 화면 진입 직후 0으로 잠깐 보이는 걸 줄임
    try {
      const n = await getMatchUnreadCountForTeam({ clubId });
      setCount(Number.isFinite(n) ? n : 0);
    } catch (e) {
      setCount(0);
    }

    // ✅ 실시간 구독
    unsubRef.current = subscribeMatchPendingCountForTeam({
      clubId,
      onCount: (n) => setCount(Number.isFinite(n) ? n : 0),
    });
  }, [uid, clubId, stop]);

  // ✅ uid/clubId 바뀌면 구독 재시작
  useEffect(() => {
    start();
    return () => stop();
  }, [bootKey, start, stop]);

  // ✅ refresh: 재구독 트리거 (MainLayout에서 호출해도 OK)
  const refresh = useCallback(() => {
    start();
  }, [start]);

  return { count, refresh, uid, clubId };
}
