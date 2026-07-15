/* eslint-disable */
// src/pages/team/TeamMatchHistoryFullPage.jsx
// 팀 프로필의 "경기 기록 → 전체보기" 진입 시 전체화면으로 전 경기 기록을 나열한다.
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Spinner from "../../components/common/Spinner";
import TeamMatchHistorySection from "../../components/team/TeamMatchHistorySection";
import { loadMatchRoomListPageData } from "../../services/matchRoomService";
import { getTeamProfile } from "../../services/teamService";

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

export default function TeamMatchHistoryFullPage() {
  const nav = useNavigate();
  const params = useParams();
  const location = useLocation();

  const clubId = String(
    location.state?.teamClubId || params.teamId || ""
  ).trim();

  const [teamName, setTeamName] = useState(location.state?.teamName || "");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!clubId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await loadMatchRoomListPageData(clubId);
        if (cancelled) return;
        const rooms = Array.isArray(data?.rooms) ? data.rooms : [];
        setMatches(rooms.filter((r) => r?.status === "finished"));
      } catch (e) {
        console.warn("[TeamMatchHistoryFullPage] load matches failed:", e?.message || e);
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  // 새로고침 등으로 state가 없을 때만 팀명 보강
  useEffect(() => {
    if (teamName || !clubId) return;
    let cancelled = false;
    getTeamProfile(clubId)
      .then((t) => {
        if (!cancelled && t?.name) setTeamName(t.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [teamName, clubId]);

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
            teamName={teamName}
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
