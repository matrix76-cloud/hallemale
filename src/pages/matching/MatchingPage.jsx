// src/pages/matching/MatchingPage.jsx
/* eslint-disable */
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

import { useClubContext } from "../../context/ClubContext";
import { useUIActions } from "../../hooks/useUI";

import QuickMatchHero from "./components/QuickMatchHero";
import AiRecommendedTeamsSection from "./components/AiRecommendedTeamsSection";
import TeamOpponentListSection from "./components/TeamOpponentListSection";
import Spinner from "../../components/common/Spinner";
import { useMatchingData } from "../../hooks/useMatchingData";
import { getTeamRankMap } from "../../services/teamRankingService";
import { loadMatchingHomeData } from "../../services/matchingHomeService";
import { getTeamProfile } from "../../services/teamService";
import { useAuth } from "../../hooks/useAuth";
import { teamLogoSrc } from "../../utils/imageAssets";
import { MIN_TEAM_MEMBERS } from "../../utils/constants";

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
  padding: 16px 10px calc(24px + env(safe-area-inset-bottom));
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

/* ===== 찜한 팀 도전 섹션 (favoriteTeamIds 활성화) ===== */
const FavSection = styled.section`display: flex; flex-direction: column; gap: 8px;`;
const FavHead = styled.div`font-size: 15px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong}; padding: 0 2px;`;
const FavRow = styled.div`display: flex; gap: 10px; overflow-x: auto; padding-bottom: 2px; &::-webkit-scrollbar { display: none; }`;
const FavCard = styled.div`
  flex: 0 0 auto; width: 148px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 14px; padding: 12px;
  display: flex; flex-direction: column; align-items: center; gap: 7px;
`;
const FavLogo = styled.img`width: 44px; height: 44px; border-radius: 12px; object-fit: cover; background: ${({ theme }) => theme.colors.surface};`;
const FavName = styled.div`font-size: 13px; font-weight: 700; color: ${({ theme }) => theme.colors.textStrong}; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
const FavRegion = styled.div`font-size: 11px; color: ${({ theme }) => theme.colors.textWeak};`;
const FavBtn = styled.button`
  width: 100%; height: 32px; border: 1px solid ${({ theme }) => theme.colors.primary}; border-radius: 8px;
  background: transparent; color: ${({ theme }) => theme.colors.primary}; font-size: 12px; font-weight: 700; cursor: pointer;
  &:active { transform: translateY(1px); }
`;

export default function MatchingPage() {
  const navigate = useNavigate();
  const { showToast } = useUIActions();
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
  const [rankMap, setRankMap] = useState(null);
  // 팀 없는 사용자 둘러보기용 상대팀 목록(null=로딩 전)
  const [browseTeams, setBrowseTeams] = useState(null);

  // 찜한 팀(favoriteTeamIds) → 도전 섹션용으로 id로 로드
  const { userDoc } = useAuth();
  const [favTeams, setFavTeams] = useState([]);

  useEffect(() => {
    if (clubLoading) return;
    if (activeTeamId) {
      preloadMatchingHomeData(activeTeamId).catch(() => {});
      return;
    }
    // 팀 없음 → 둘러보기용으로 전체 팀 목록만 로드
    let alive = true;
    loadMatchingHomeData({})
      .then((d) => {
        if (alive) setBrowseTeams(Array.isArray(d?.opponentTeams) ? d.opponentTeams : []);
      })
      .catch(() => {
        if (alive) setBrowseTeams([]);
      });
    return () => {
      alive = false;
    };
  }, [clubLoading, activeTeamId, preloadMatchingHomeData]);

  // 찜한 팀 로드 — 본인 팀은 제외
  useEffect(() => {
    const ids = Array.isArray(userDoc?.favoriteTeamIds)
      ? userDoc.favoriteTeamIds.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    const myId = String(activeTeamId || "");
    const targetIds = Array.from(new Set(ids)).filter((id) => id !== myId).slice(0, 12);
    if (targetIds.length === 0) { setFavTeams([]); return; }
    let alive = true;
    Promise.all(
      targetIds.map((id) =>
        getTeamProfile(id)
          .then((t) => (t ? { ...t, clubId: t.clubId || t.id || id } : null))
          .catch(() => null)
      )
    ).then((list) => {
      if (alive) setFavTeams(list.filter(Boolean));
    });
    return () => { alive = false; };
  }, [userDoc?.favoriteTeamIds, activeTeamId]);

  // 팀 유무에 따른 실효 데이터
  const effMyTeam = activeTeamId ? myTeam : null;
  const sourceOpponents = activeTeamId ? opponentTeams : browseTeams;

  // 팀 랭킹 등수(clubId → 등수) — 랭킹 페이지와 동일 기준
  useEffect(() => {
    let alive = true;
    getTeamRankMap()
      .then((m) => {
        if (alive) setRankMap(m);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const appliedCount = useMemo(() => countAppliedFilters(filters), [filters]);

  const filteredOpponentTeams = useMemo(() => {
    const base = Array.isArray(sourceOpponents) ? sourceOpponents : [];
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
  }, [sourceOpponents, teamQ, filters]);

  if (clubLoading) {
    return (
      <Wrap>
        <LoadingCenter>
          <Spinner />
        </LoadingCenter>
      </Wrap>
    );
  }

  // 팀 없는 사용자: 둘러보기 목록 로딩 전까지만 스피너
  if (!activeTeamId) {
    if (browseTeams === null) {
      return (
        <Wrap>
          <LoadingCenter>
            <Spinner />
          </LoadingCenter>
        </Wrap>
      );
    }
  } else if (matchingLoading || !myTeam) {
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
        <QuickMatchHero
          onStart={() => {
            if (!activeTeamId) {
              showToast({ message: "팀을 먼저 만들어야 매칭할 수 있어요." });
              return;
            }
            const myCount = Array.isArray(effMyTeam?.members) ? effMyTeam.members.length : 0;
            if (myCount < MIN_TEAM_MEMBERS) {
              showToast({
                message: `팀원이 ${MIN_TEAM_MEMBERS}명 이상부터 매칭할 수 있어요.`,
              });
              return;
            }
            navigate("/matching/region");
          }}
        />

        {effMyTeam && (
          <AiRecommendedTeamsSection
            myTeam={effMyTeam}
            opponentTeams={sourceOpponents || []}
            onOpenAnalysis={(opponentClubId) => {
              navigate(`/matching/analysis/${opponentClubId}`);
            }}
          />
        )}

        {favTeams.length > 0 && (
          <FavSection>
            <FavHead>찜한 팀 ⭐</FavHead>
            <FavRow>
              {favTeams.map((t) => (
                <FavCard key={t.clubId}>
                  <FavLogo src={teamLogoSrc(t.logoUrl)} alt={t.name || "팀"} />
                  <FavName title={t.name}>{t.name || "팀"}</FavName>
                  <FavRegion>{t.region || ""}</FavRegion>
                  <FavBtn type="button" onClick={() => navigate(`/matching/analysis/${t.clubId}`)}>
                    도전
                  </FavBtn>
                </FavCard>
              ))}
            </FavRow>
          </FavSection>
        )}

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
          rankMap={rankMap}
        />
      </Inner>
    </Wrap>
  );
}
