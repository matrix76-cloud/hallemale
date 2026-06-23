// src/pages/matching/MatchingPage.jsx
/* eslint-disable */
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

import { useClubContext } from "../../context/ClubContext";

import AiRecommendedTeamsSection from "./components/AiRecommendedTeamsSection";
import TeamOpponentListSection from "./components/TeamOpponentListSection";
import Spinner from "../../components/common/Spinner";
import { useMatchingData } from "../../hooks/useMatchingData";

/* ==================== 상수/헬퍼 ==================== */

function countAppliedFilters(f) {
  if (!f) return 0;
  let c = 0;
  if (f.position) c += 1;
  if (f.skill) c += 1;
  if (f.winRate && f.winRate !== "any") c += 1;
  if (f.regionSido && f.regionSido !== "all") c += 1;
  if (f.regionGu && f.regionGu !== "all") c += 1;
  return c;
}

function toNum(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function calcWinRatePercentFromTeam(t) {
  const wins = toNum(t?.stats?.wins ?? t?.wins, 0);
  const losses = toNum(t?.stats?.losses ?? t?.losses, 0);
  const draws = toNum(t?.stats?.draws ?? t?.draws, 0);
  const total = wins + losses + draws;
  if (total <= 0) return 0;
  return Math.round((wins / total) * 100);
}

/* ==================== Styled ==================== */

const Wrap = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 16px 10px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Inner = styled.div`
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const LoadingCenter = styled.div`
  flex: 1;
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

/* ==================== 컴포넌트 ==================== */

export default function MatchingPage() {
  const navigate = useNavigate();
  const { activeTeamId, loading: clubLoading } = useClubContext();

  const {
    myTeam,
    opponentTeams,
    loading: matchingLoading,
    preloadMatchingHomeData,
  } = useMatchingData();

  const [teamQ, setTeamQ] = useState("");
  const [filters, setFilters] = useState({
    position: "",
    skill: "",
    winRate: "any",
    regionSido: "all",
    regionGu: "all",
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(filters);

  useEffect(() => {
    if (clubLoading) return;
    if (!activeTeamId) return;
    preloadMatchingHomeData(activeTeamId).catch(() => {});
  }, [clubLoading, activeTeamId, preloadMatchingHomeData]);

  const appliedCount = useMemo(() => countAppliedFilters(filters), [filters]);

  const filteredOpponentTeams = useMemo(() => {
    const base = Array.isArray(opponentTeams) ? opponentTeams : [];
    const qText = String(teamQ || "").trim().toLowerCase();

    const searched = qText
      ? base.filter((t) => {
          const name = String(t?.name || "").toLowerCase();
          const region = String(t?.region || "").toLowerCase();
          const region2 = `${String(t?.regionSido || "").trim()} ${String(t?.regionGu || "").trim()}`
            .trim()
            .toLowerCase();
          return name.includes(qText) || region.includes(qText) || region2.includes(qText);
        })
      : base;

    return searched.filter((t) => {
      const winRate = calcWinRatePercentFromTeam(t);
      if (filters.winRate === "70" && winRate < 70) return false;
      if (filters.winRate === "50" && winRate < 50) return false;

      if (filters.regionSido && filters.regionSido !== "all") {
        const tSido = String(t?.regionSido || "").trim();
        if (tSido !== filters.regionSido) return false;
        if (filters.regionGu && filters.regionGu !== "all") {
          const tGu = String(t?.regionGu || "").trim();
          if (tGu !== filters.regionGu) return false;
        }
      }

      if (filters.position) {
        const tags = Array.isArray(t?.positionTags) ? t.positionTags : [];
        if (tags.length > 0 && !tags.includes(filters.position)) return false;
      }

      if (filters.skill) {
        const tags = Array.isArray(t?.skillTags) ? t.skillTags : [];
        if (tags.length > 0 && !tags.includes(filters.skill)) return false;
      }
      return true;
    });
  }, [opponentTeams, teamQ, filters]);

  if (clubLoading) {
    return (
      <Wrap>
        <LoadingCenter>
          <Spinner />
        </LoadingCenter>
      </Wrap>
    );
  }

  if (!activeTeamId) {
    return (
      <Wrap>
        <LoadingCenter>
          <Spinner />
        </LoadingCenter>
      </Wrap>
    );
  }

  if (matchingLoading || !myTeam) {
    return (
      <Wrap>
        <LoadingCenter>
          <Spinner />
        </LoadingCenter>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <Inner>
        <AiRecommendedTeamsSection
          myTeam={myTeam}
          opponentTeams={opponentTeams}
          onOpenAnalysis={(opponentClubId) => {
            navigate(`/matching/analysis/${opponentClubId}`);
          }}
        />

        <TeamOpponentListSection
          teams={filteredOpponentTeams}
          teamQ={teamQ}
          setTeamQ={setTeamQ}
          appliedCount={appliedCount}
          filters={filters}
          setFilters={setFilters}
          draft={draft}
          setDraft={setDraft}
          sheetOpen={sheetOpen}
          setSheetOpen={setSheetOpen}
          onTeamClick={(clubId) => navigate(`/team/${clubId}`)}
        />
      </Inner>
    </Wrap>
  );
}
