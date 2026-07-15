/* eslint-disable */
// src/pages/player/PlayerMatchHistoryFullPage.jsx
// 선수 프로필의 "경기 기록 → 전체보기" 진입 시 전체화면으로 라인업 참가 전 경기를 나열한다.
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Spinner from "../../components/common/Spinner";
import TeamMatchHistorySection from "../../components/team/TeamMatchHistorySection";
import { loadPlayerFinishedMatches } from "../../services/matchRoomService";
import { getPlayerProfile } from "../../services/playerService";

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 12px 0 calc(24px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
`;

const Inner = styled.div`
  padding: 0 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const StateWrap = styled.div`
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export default function PlayerMatchHistoryFullPage() {
  const nav = useNavigate();
  const params = useParams();
  const location = useLocation();

  const playerId = String(params.playerId || "").trim();

  const [clubId, setClubId] = useState(String(location.state?.clubId || "").trim());
  const [uid, setUid] = useState(String(location.state?.uid || "").trim());
  const [clubName, setClubName] = useState(location.state?.clubName || "");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // 새로고침 등으로 state가 없을 때만 프로필에서 보강
  useEffect(() => {
    if ((clubId && uid) || !playerId) return;
    let cancelled = false;
    getPlayerProfile(playerId)
      .then((p) => {
        if (cancelled || !p) return;
        setClubId(String(p.clubId || "").trim());
        setUid(String(p?.uid || p?.userId || playerId || "").trim());
        if (p.clubName) setClubName(p.clubName);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [clubId, uid, playerId]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!clubId || !uid) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const { rooms } = await loadPlayerFinishedMatches({ clubId, uid });
        if (cancelled) return;
        setMatches(Array.isArray(rooms) ? rooms : []);
      } catch (e) {
        console.warn("[PlayerMatchHistoryFullPage] load matches failed:", e?.message || e);
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [clubId, uid]);

  return (
    <PageWrap>
      <Inner>
        {loading ? (
          <StateWrap>
            <Spinner size="lg" />
          </StateWrap>
        ) : (
          <TeamMatchHistorySection
            teamClubId={clubId}
            teamName={clubName}
            matches={matches}
            onClickMatch={(id) =>
              nav(`/match-roomdetail/${id}`, {
                state: { viewClubId: clubId },
              })
            }
          />
        )}
      </Inner>
    </PageWrap>
  );
}
