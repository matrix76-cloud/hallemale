// src/context/MatchingDataContext.jsx
/* eslint-disable */
import React, {
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import { loadMatchingHomeData } from "../services/matchingHomeService";

import { db } from "../services/firebase";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

const MatchingDataContext = createContext(null);

const toStr = (v) => String(v || "").trim();

async function loadActiveMatchRequestsForClub(clubId) {
  const cid = toStr(clubId);
  if (!cid) return [];

  // ✅ "진행/예정" 정의: pending + accepted(수락됨)
  // - rejected/cancelled는 제외
  const ref = collection(db, "match_requests");

  // Firestore where(in) 최대 10개. 여기선 2개라 OK
  const qy = query(
    ref,
    where("status", "in", ["pending", "accepted"]),
    where("actorClubId", "==", cid),
    orderBy("updatedAt", "desc"),
    limit(200)
  );

  const qy2 = query(
    ref,
    where("status", "in", ["pending", "accepted"]),
    where("targetClubId", "==", cid),
    orderBy("updatedAt", "desc"),
    limit(200)
  );

  // ✅ 양쪽(보낸/받은) 다 가져와서 합치기
  const [s1, s2] = await Promise.all([getDocs(qy), getDocs(qy2)]);

  const map = new Map();

  for (const d of s1.docs) {
    map.set(d.id, { id: d.id, ...d.data() });
  }
  for (const d of s2.docs) {
    map.set(d.id, { id: d.id, ...d.data() });
  }

  const list = Array.from(map.values());

  // ✅ 최신순 정렬(둘 중 하나라도 없을 수 있으니 안전 처리)
  list.sort((a, b) => {
    const aSec = Number(a?.updatedAt?.seconds || a?.createdAt?.seconds || 0);
    const bSec = Number(b?.updatedAt?.seconds || b?.createdAt?.seconds || 0);
    return bSec - aSec;
  });

  return list;
}

export function MatchingDataProvider({ children }) {
  const [myTeam, setMyTeam] = useState(null);
  const [opponentTeams, setOpponentTeams] = useState([]);
  const [matches, setMatches] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedTeamId, setLoadedTeamId] = useState("");
  const [loadedAt, setLoadedAt] = useState(null);

  // ✅ 중복 호출 방지: 동일 teamId 로딩 중이면 같은 promise 공유
  const inflightRef = useRef({ teamId: "", promise: null });

  const clearMatchingData = useCallback(() => {
    inflightRef.current = { teamId: "", promise: null };
    setMyTeam(null);
    setOpponentTeams([]);
    setMatches([]);
    setLoading(false);
    setError("");
    setLoadedTeamId("");
    setLoadedAt(null);
  }, []);

  const preloadMatchingHomeData = useCallback(
    async (teamId) => {
      const tid = toStr(teamId);
      if (!tid) throw new Error("preloadMatchingHomeData: teamId is required");

      // ✅ 이미 로드된 동일 팀이면 캐시 반환
      if (loadedTeamId === tid && myTeam) {
        return { myTeam, opponentTeams, matches };
      }

      // ✅ 동일 teamId 로딩 중이면 promise 공유
      if (inflightRef.current.teamId === tid && inflightRef.current.promise) {
        return inflightRef.current.promise;
      }

      setLoading(true);
      setError("");

      const p = (async () => {
        try {
          // ✅ 팀 바뀌면 캐시 초기화
          if (loadedTeamId && loadedTeamId !== tid) {
            setMyTeam(null);
            setOpponentTeams([]);
            setMatches([]);
          }

          const data = await loadMatchingHomeData({ activeTeamId: tid });

          const nextMyTeam = data?.myTeam || null;
          const nextOpp = Array.isArray(data?.opponentTeams) ? data.opponentTeams : [];

          // ✅ match_requests 로딩(진행/예정만)
          let nextMatches = [];
          try {
            nextMatches = await loadActiveMatchRequestsForClub(tid);
          } catch (e2) {
            // matches는 부가 데이터라 실패해도 홈 로딩은 살린다
            nextMatches = [];
            console.log("[matching] matches load failed:", e2?.message || e2);
          }

          setMyTeam(nextMyTeam);
          setOpponentTeams(nextOpp);
          setMatches(nextMatches);

          setLoadedTeamId(tid);
          setLoadedAt(Date.now());
          setLoading(false);
          setError("");

          return { myTeam: nextMyTeam, opponentTeams: nextOpp, matches: nextMatches };
        } catch (e) {
          const msg = e?.message || "매칭 데이터 로딩 중 오류가 발생했습니다.";
          setError(msg);
          setLoading(false);
          throw e;
        } finally {
          if (inflightRef.current.teamId === tid) {
            inflightRef.current = { teamId: "", promise: null };
          }
        }
      })();

      inflightRef.current = { teamId: tid, promise: p };
      return p;
    },
    [loadedTeamId, myTeam, opponentTeams, matches]
  );

  const refreshMatchingHomeData = useCallback(async (teamId) => {
    const tid = toStr(teamId);
    if (!tid) throw new Error("refreshMatchingHomeData: teamId is required");

    inflightRef.current = { teamId: "", promise: null };
    setLoading(true);
    setError("");

    try {
      const data = await loadMatchingHomeData({ activeTeamId: tid });

      const nextMyTeam = data?.myTeam || null;
      const nextOpp = Array.isArray(data?.opponentTeams) ? data.opponentTeams : [];

      let nextMatches = [];
      try {
        nextMatches = await loadActiveMatchRequestsForClub(tid);
      } catch (e2) {
        nextMatches = [];
        console.log("[matching] matches refresh failed:", e2?.message || e2);
      }

      setMyTeam(nextMyTeam);
      setOpponentTeams(nextOpp);
      setMatches(nextMatches);

      setLoadedTeamId(tid);
      setLoadedAt(Date.now());
      setLoading(false);
      setError("");

      return { myTeam: nextMyTeam, opponentTeams: nextOpp, matches: nextMatches };
    } catch (e) {
      const msg = e?.message || "매칭 데이터 새로고침 중 오류가 발생했습니다.";
      setError(msg);
      setLoading(false);
      throw e;
    }
  }, []);

  const value = useMemo(
    () => ({
      myTeam,
      opponentTeams,
      matches,
      loading,
      error,
      loadedTeamId,
      loadedAt,
      preloadMatchingHomeData,
      refreshMatchingHomeData,
      clearMatchingData,
      setMyTeam,
      setOpponentTeams,
      setMatches,
    }),
    [
      myTeam,
      opponentTeams,
      matches,
      loading,
      error,
      loadedTeamId,
      loadedAt,
      preloadMatchingHomeData,
      refreshMatchingHomeData,
      clearMatchingData,
    ]
  );

  return (
    <MatchingDataContext.Provider value={value}>
      {children}
    </MatchingDataContext.Provider>
  );
}

export function getMatchingDataContext() {
  return MatchingDataContext;
}
