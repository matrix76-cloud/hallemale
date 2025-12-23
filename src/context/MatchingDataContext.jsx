// src/context/MatchingDataContext.jsx
/* eslint-disable */
import React, { createContext, useCallback, useMemo, useRef, useState } from "react";
import { loadMatchingHomeData } from "../services/matchingHomeService";

const MatchingDataContext = createContext(null);

export function MatchingDataProvider({ children }) {
  const [myTeam, setMyTeam] = useState(null);
  const [opponentTeams, setOpponentTeams] = useState([]);
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
    setLoading(false);
    setError("");
    setLoadedTeamId("");
    setLoadedAt(null);
  }, []);

  const preloadMatchingHomeData = useCallback(
    async (teamId) => {
      const tid = String(teamId || "").trim();
      if (!tid) throw new Error("preloadMatchingHomeData: teamId is required");

      // ✅ 이미 로드된 동일 팀이면 캐시 반환
      if (loadedTeamId === tid && myTeam) {
        return { myTeam, opponentTeams };
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
          }

          const data = await loadMatchingHomeData({ activeTeamId: tid });

          const nextMyTeam = data?.myTeam || null;
          const nextOpp = Array.isArray(data?.opponentTeams) ? data.opponentTeams : [];

          setMyTeam(nextMyTeam);
          setOpponentTeams(nextOpp);
          setLoadedTeamId(tid);
          setLoadedAt(Date.now());
          setLoading(false);
          setError("");

          return { myTeam: nextMyTeam, opponentTeams: nextOpp };
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
    [loadedTeamId, myTeam, opponentTeams]
  );

  const refreshMatchingHomeData = useCallback(async (teamId) => {
    const tid = String(teamId || "").trim();
    if (!tid) throw new Error("refreshMatchingHomeData: teamId is required");

    inflightRef.current = { teamId: "", promise: null };
    setLoading(true);
    setError("");

    try {
      const data = await loadMatchingHomeData({ activeTeamId: tid });

      const nextMyTeam = data?.myTeam || null;
      const nextOpp = Array.isArray(data?.opponentTeams) ? data.opponentTeams : [];

      setMyTeam(nextMyTeam);
      setOpponentTeams(nextOpp);
      setLoadedTeamId(tid);
      setLoadedAt(Date.now());
      setLoading(false);
      setError("");

      return { myTeam: nextMyTeam, opponentTeams: nextOpp };
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
      loading,
      error,
      loadedTeamId,
      loadedAt,
      preloadMatchingHomeData,
      refreshMatchingHomeData,
      clearMatchingData,
      setMyTeam,
      setOpponentTeams,
    }),
    [
      myTeam,
      opponentTeams,
      loading,
      error,
      loadedTeamId,
      loadedAt,
      preloadMatchingHomeData,
      refreshMatchingHomeData,
      clearMatchingData,
    ]
  );

  return <MatchingDataContext.Provider value={value}>{children}</MatchingDataContext.Provider>;
}

export function getMatchingDataContext() {
  return MatchingDataContext;
}
