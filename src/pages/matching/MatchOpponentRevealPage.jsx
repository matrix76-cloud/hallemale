/* eslint-disable */
// src/pages/matching/MatchOpponentRevealPage.jsx
// 빠른 매칭 ② 상대 공개(C안) — 고정 매치업 헤더 + 상대 전체 선수단
// - 우리팀(요약) vs 상대팀(전체 선수단)
// - 사이클(재매칭) 버튼 → 새 상대 + 카드 등장 애니메이션 재생
// - "이 팀에 매칭 요청" → 기존 분석/요청 퍼널(/matching/analysis/:clubId)로 연결

import React, { useEffect, useMemo, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";
import { track } from "../../utils/analytics";
import { shareApp } from "../../utils/share";
import { showAlert } from "../../utils/appDialog";

import { useClubContext } from "../../context/ClubContext";
import { useMatchingData } from "../../hooks/useMatchingData";
import { getTeamProfile } from "../../services/teamService";
import { getTeamRankMap } from "../../services/teamRankingService";
import { getPlayerRankMap } from "../../services/rankingService";
import { getClubMemberCounts } from "../../services/matchingHomeService";
import { estimateWinProbability } from "../../utils/matchAnalysis";
import { rankOpponents, WEIGHTS } from "../../utils/matchmaking";
import { images, teamLogoSrc } from "../../utils/imageAssets";
import { MIN_TEAM_MEMBERS } from "../../utils/constants";
import FlowSteps from "./components/FlowSteps";
import Spinner from "../../components/common/Spinner";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";

const cardIn = keyframes`
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

const Page = styled.div`
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.bg};
`;

const StepsBar = styled.div`
  padding: 14px 16px 0;
`;

/* ===== 매치업 헤더 ===== */
const MatchupBar = styled.div`
  background: ${({ theme }) => theme.colors.card};
  padding: 18px 16px 20px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
`;

const Matchup = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  gap: 10px;
  animation: ${cardIn} 0.45s ease both;
`;

const TeamCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 0;
  cursor: pointer;

  &:active {
    opacity: 0.75;
  }
`;

/* 왕관이 박스 밖으로 나와도 안 잘리도록 overflow 없는 래퍼 */
const LogoWrap = styled.div`
  position: relative;
  width: 92px;
  height: 92px;
`;

const LogoBox = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 22px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#eef2f1"};
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const Crown = styled.img`
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  width: 34px;
  height: 34px;
  object-fit: contain;
  z-index: 3;
  pointer-events: none;
  filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.18));
`;

const TeamName = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

const TeamMeta = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ $mine, theme }) =>
    $mine ? theme.colors.primary : theme.colors.textWeak};
`;

const VsBadge = styled.div`
  align-self: center;
  margin-top: 24px;
  width: 52px;
  height: 52px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 16px;
  font-style: italic;
  font-weight: 800;
  display: grid;
  place-items: center;
  box-shadow: 0 6px 14px rgba(124, 92, 201, 0.32);
`;

/* ===== 선수단 ===== */
const Body = styled.div`
  flex: 1;
  padding: 16px 16px 110px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const RosterHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const RosterTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};

  svg {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const RosterCount = styled.span`
  color: ${({ theme }) => theme.colors.textWeak};
  font-weight: 600;
  font-size: 14px;
`;

const RosterNote = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ListCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border-radius: 18px;
  padding: 4px 18px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  animation: ${cardIn} 0.45s ease both;
`;

const PlayerRow = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 0;
  border: none;
  background: transparent;
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  cursor: pointer;
  text-align: left;

  &:last-child {
    border-bottom: none;
  }
  &:active {
    opacity: 0.7;
  }
`;

const AvatarWrap = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const Avatar = styled.img`
  width: 46px;
  height: 46px;
  border-radius: 999px;
  object-fit: cover;
  display: block;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
`;

const PlayerCrown = styled.img`
  position: absolute;
  top: -13px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 24px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.2));
`;

const PlayerTexts = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const PlayerNameWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

const PlayerName = styled.span`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CaptainTag = styled.span`
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const PlayerPos = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const PlayerRank = styled.span`
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const CenterState = styled.div`
  min-height: 200px;
  display: grid;
  place-items: center;
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 14px;
`;

/* ===== 상대 0명 빈 상태 (데드엔드 방지: 재탐색/홈 CTA) ===== */
const WidenNote = styled.div`
  margin: 10px 16px 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 12.5px;
  font-weight: 600;
  text-align: center;
`;

/* ===== 추천 근거 카드 =====
   rankOpponents 가 이미 점수(matchScore)와 항목별 값(matchParts)을 계산해 두는데
   화면에는 칩 두 개만 나와서 "왜 이 팀인지"가 설명되지 않았다. 계산한 걸 그대로 보여준다. */
const ReasonCard = styled.section`
  background: ${({ theme }) => theme.colors.card};
  border-radius: 18px;
  padding: 16px 18px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: ${cardIn} 0.45s ease both;
`;

const ReasonHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
`;

const ReasonTitle = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const QueuePos = styled.div`
  flex-shrink: 0;
  font-size: 12.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ScoreRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const ScoreValue = styled.div`
  flex-shrink: 0;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.6px;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.primary};

  span {
    font-size: 13px;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Bar = styled.div`
  flex: 1;
  height: ${({ $thin }) => ($thin ? 6 : 8)}px;
  border-radius: 999px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "#eef0f4"};
`;

const BarFill = styled.div`
  height: 100%;
  border-radius: 999px;
  width: ${({ $pct }) => $pct}%;
  background: ${({ theme }) => theme.colors.primary};
  transition: width 0.4s ease;
`;

const ReasonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const ReasonChip = styled.span`
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textWeak};
`;

const CardDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.divider};
`;

const SubHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};

  em {
    font-style: normal;
    font-size: 11.5px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

/* 예상 승률 — 우리:상대 한 줄 비교 */
const ProbRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const ProbSide = styled.div`
  flex-shrink: 0;
  min-width: 54px;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: ${({ $right }) => ($right ? "right" : "left")};
  color: ${({ $mine, theme }) =>
    $mine ? theme.colors.primary : theme.colors.textWeak};
`;

/* 항목별 점수 — 오른쪽 숫자는 가중치(합 100). 문구와 실제 계산이 같은 표를 본다. */
const PartRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const PartLabel = styled.div`
  flex-shrink: 0;
  width: 62px;
  font-size: 12.5px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const PartWeight = styled.div`
  flex-shrink: 0;
  width: 26px;
  text-align: right;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const EmptyWrap = styled.div`
  min-height: calc(100dvh - 120px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  padding: 24px 20px calc(24px + env(safe-area-inset-bottom));
  text-align: center;
`;

const EmptyText = styled.div`
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 15px;
  line-height: 1.6;
`;

const EmptyActions = styled.div`
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const EmptyPrimary = styled.button`
  width: 100%;
  height: 52px;
  border: none;
  border-radius: 14px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  &:active { transform: translateY(1px); }
`;

const EmptyGhost = styled.button`
  width: 100%;
  height: 48px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 14px;
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textNormal};
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  &:active { transform: translateY(1px); }
`;

/* ===== 하단 액션 ===== */
const Footer = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
  background: ${({ theme }) => theme.colors.bg};
  border-top: 1px solid ${({ theme }) => theme.colors.divider};
  display: flex;
  gap: 12px;
`;

const RequestBtn = styled.button`
  flex: 1;
  height: 56px;
  border: none;
  border-radius: 16px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 17px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(124, 92, 201, 0.3);
  transition: transform 0.12s ease;

  &:disabled {
    opacity: 0.5;
    box-shadow: none;
  }
  &:active:not(:disabled) {
    transform: translateY(1px);
  }
`;

const CycleBtn = styled.button`
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1.5px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.primary};
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 0.2s ease;

  &:active {
    transform: rotate(-180deg);
  }
  &:disabled {
    opacity: 0.5;
  }
`;

function PeopleIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3.2" stroke={color} strokeWidth="2" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M16 6.2A3 3 0 0 1 16 12M17 14.4c2.3.5 4 2.3 4 4.6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* 점수 항목 표기 — matchmaking.WEIGHTS 의 키와 1:1 로 맞춘다 */
const PART_LABELS = [
  ["balance", "전력 균형"],
  ["region", "지역 근접"],
  ["activity", "활동량"],
  ["size", "인원 규모"],
  ["rank", "랭킹 인접"],
];

function CycleIcon({ size = 24, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20 11a8 8 0 0 0-14.3-4.9M4 13a8 8 0 0 0 14.3 4.9" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M20 4v3.5h-3.5M4 20v-3.5h3.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function MatchOpponentRevealPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const region = location.state?.region || "";
  const regionGu = String(location.state?.regionGu || "").trim();
  const regionSido = String(location.state?.regionSido || "").trim();

  const { activeTeamId, loading: clubLoading } = useClubContext();
  const { myTeam, opponentTeams, preloadMatchingHomeData } = useMatchingData();

  const [rankMap, setRankMap] = useState(null);
  const [playerRankMap, setPlayerRankMap] = useState(null);
  const [memberCounts, setMemberCounts] = useState(null); // Map | null(로딩 중)
  const [oppDetail, setOppDetail] = useState(null); // 선택 상대 멤버 조립본
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [loadError, setLoadError] = useState(false);   // 매칭 데이터 로드 실패
  const [loadTimedOut, setLoadTimedOut] = useState(false); // 무한 로딩 타임아웃
  const [retryTick, setRetryTick] = useState(0);       // 재시도 트리거

  // 데이터 미로딩 진입 대비 — 실패를 삼키지 않고 상태로 노출(무한 스피너 방지)
  useEffect(() => {
    if (clubLoading || !activeTeamId) return;
    if (myTeam && opponentTeams?.length) return;
    setLoadError(false);
    preloadMatchingHomeData(activeTeamId).catch(() => setLoadError(true));
  }, [clubLoading, activeTeamId, myTeam, opponentTeams, preloadMatchingHomeData, retryTick]);

  useEffect(() => {
    let alive = true;
    getTeamRankMap()
      .then((m) => alive && setRankMap(m))
      .catch(() => {});
    getPlayerRankMap()
      .then((m) => alive && setPlayerRankMap(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 멤버 수는 전체 후보에 대해 조회(지역 폴백 대비 — 정확 지역에 상대가 없을 때 전체로 넓힘)
  const allIdsKey = useMemo(
    () =>
      (Array.isArray(opponentTeams) ? opponentTeams : [])
        .map((t) => String(t.clubId || t.id || "").trim())
        .filter(Boolean)
        .join(","),
    [opponentTeams]
  );

  // 탐색 화면이 이미 조회해 넘겨준 멤버 수 — 있으면 재조회하지 않는다(스피너도 안 뜬다)
  const seededCounts = useMemo(() => {
    const raw = location.state?.memberCounts;
    return Array.isArray(raw) && raw.length ? new Map(raw) : null;
  }, [location.state]);

  useEffect(() => {
    const ids = allIdsKey ? allIdsKey.split(",") : [];
    if (ids.length === 0) {
      setMemberCounts(new Map());
      return;
    }
    if (seededCounts && ids.every((id) => seededCounts.has(id))) {
      setMemberCounts(seededCounts);
      return;
    }
    let alive = true;
    setMemberCounts(null);
    getClubMemberCounts(ids)
      .then((m) => alive && setMemberCounts(m))
      .catch(() => alive && setMemberCounts(new Map()));
    return () => {
      alive = false;
    };
  }, [allIdsKey, seededCounts]);

  // 후보 순서는 matchmaking.rankOpponents 가 정한다 —
  // 하드 필터(내 팀·인원 미달 제외) → 전력/지역/활동/인원/랭킹 점수 → 상위 풀 다양성 샘플링.
  // 이 큐는 한 번만 만들고(사이클 의존 없음) 화면이 순서대로 소비한다.
  const ranked = useMemo(() => {
    if (!memberCounts) return null; // 멤버 수 로딩 중
    return rankOpponents({
      myTeam,
      candidates: opponentTeams,
      memberCounts,
      regionGu,
      regionSido,
      rankMap,
    });
    // rankMap 은 늦게 도착해도 순서만 바뀌므로 의존성에 넣지 않는다(큐가 흔들리면 사이클이 튄다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTeam, opponentTeams, memberCounts, regionGu, regionSido]);

  const rawPool = ranked?.queue || null;
  const widened = !!ranked?.widened;

  // 큐는 다양성 샘플링(Math.random) 으로 매번 다르게 만들어진다. 이 화면은
  // 상대팀 프로필을 보고 오거나(remount) 사이클(광고 화면 경유)마다 다시 마운트되므로,
  // 큐를 매번 새로 섞으면 보던 상대가 바뀌거나 이미 본 팀이 또 나온다.
  // → 처음 만든 순서와 현재 위치를 세션에 적어 두고, 이후에는 그 순서를 따른다.
  const queueKey = `halle.matchQueue.${activeTeamId || ""}.${regionGu}|${regionSido}`;
  const savedRef = useRef({ order: [], idx: 0 });
  // 첫 렌더에는 activeTeamId 가 아직 비어 있을 수 있다(ClubContext 로딩 중).
  // 그때 읽으면 엉뚱한 키를 보게 되므로, 키가 확정될 때 다시 읽는다.
  const loadedKeyRef = useRef(null);
  if (loadedKeyRef.current !== queueKey) {
    loadedKeyRef.current = queueKey;
    let parsed = null;
    try {
      parsed = JSON.parse(window.sessionStorage?.getItem(queueKey) || "null");
    } catch (e) {}
    savedRef.current =
      parsed && Array.isArray(parsed.order)
        ? { order: parsed.order, idx: Number(parsed.idx) || 0 }
        : { order: [], idx: 0 };
  }

  // 저장된 순서를 먼저 깔고, 그 사이 새로 생긴 팀은 뒤에 붙인다
  const eligiblePool = useMemo(() => {
    if (!rawPool) return null;
    const saved = savedRef.current.order;
    if (!saved.length) return rawPool;
    const byId = new Map(
      rawPool.map((t) => [String(t.clubId || t.id || "").trim(), t])
    );
    const head = saved.map((id) => byId.get(id)).filter(Boolean);
    const seen = new Set(head.map((t) => String(t.clubId || t.id || "").trim()));
    const rest = rawPool.filter(
      (t) => !seen.has(String(t.clubId || t.id || "").trim())
    );
    return head.concat(rest);
    // queueKey 가 바뀌면 savedRef 를 다시 읽으므로 순서도 다시 잡아야 한다
  }, [rawPool, queueKey]);

  const countsLoading = eligiblePool === null;
  const poolLen = eligiblePool?.length || 0;
  const index = poolLen ? savedRef.current.idx % poolLen : 0;
  const opponent = poolLen ? eligiblePool[index] : null;
  const oppId = opponent ? String(opponent.clubId || opponent.id || "").trim() : "";

  // 순서와 위치를 적어 둔다 — 사이클로 광고 화면을 거쳐 돌아와도 이어서 보여주기 위해
  useEffect(() => {
    if (!poolLen) return;
    savedRef.current = {
      order: eligiblePool.map((t) => String(t.clubId || t.id || "").trim()),
      idx: index,
    };
    try {
      window.sessionStorage?.setItem(queueKey, JSON.stringify(savedRef.current));
    } catch (e) {}
  }, [eligiblePool, poolLen, index, queueKey]);

  // 상대 선수단 로드
  useEffect(() => {
    if (!oppId) {
      setOppDetail(null);
      setLoadingDetail(false);
      return;
    }
    let alive = true;
    setLoadingDetail(true);
    getTeamProfile(oppId)
      .then((p) => {
        if (alive) setOppDetail(p || null);
      })
      .catch(() => alive && setOppDetail(null))
      .finally(() => alive && setLoadingDetail(false));
    return () => {
      alive = false;
    };
  }, [oppId]);

  const myRank = rankMap?.get?.(String(activeTeamId)) || null;
  const oppRank = oppId && rankMap?.get?.(oppId);
  const winProb = useMemo(() => {
    if (!myTeam || !opponent) return null;
    try {
      return estimateWinProbability(myTeam, opponent)?.prob ?? null;
    } catch {
      return null;
    }
  }, [myTeam, opponent]);

  const members = Array.isArray(oppDetail?.members) ? oppDetail.members : [];

  const eligibleCount = poolLen;

  // 추천 근거 카드용 파생값 — rankOpponents 가 붙여 둔 값을 그대로 읽는다
  const queuePos = eligibleCount > 0 ? index + 1 : 0;
  const parts = opponent?.matchParts || null;
  const oppStats = opponent?.stats || null;

  // 다른 상대 찾기 — 탐색(광고) 화면을 다시 거쳐서 다음 후보로 간다.
  // 다음 위치를 먼저 세션에 적어 두면, 돌아온 화면이 그 자리부터 보여준다.
  const handleCycle = () => {
    if (eligibleCount <= 1) return;
    const next = { ...savedRef.current, idx: (index + 1) % eligibleCount };
    savedRef.current = next;
    try {
      window.sessionStorage?.setItem(queueKey, JSON.stringify(next));
    } catch (e) {}
    navigate("/matching/searching", {
      state: {
        region,
        regionGu,
        regionSido,
        // 멤버 수를 넘겨 재조회를 막는다 — 탐색 화면은 연출과 광고만 담당
        memberCounts: memberCounts ? Array.from(memberCounts.entries()) : null,
        cycling: true,
      },
      replace: true, // 사이클을 눌러도 히스토리가 쌓이지 않게(뒤로가기 = 지역 선택)
    });
  };

  const handleRequest = () => {
    if (!oppId) return;
    navigate(`/matching/analysis/${oppId}`);
  };

  const handleInviteFriends = async () => {
    const res = await shareApp({ context: "opponent_none" });
    if (res.method === "copied") showAlert("초대 링크를 복사했어요.\n친구 팀을 초대해보세요!");
    else if (res.method === "unsupported") showAlert(`초대 링크:\n${res.url}`);
  };

  const goTeam = (clubId) => {
    const id = String(clubId || "").trim();
    if (id) navigate(`/team/${id}`);
  };

  const goPlayer = (userId) => {
    const id = String(userId || "").trim();
    if (id) navigate(`/player/${id}`);
  };

  const ownerUid = String(oppDetail?.ownerUid || "").trim();
  const myClubId = String(myTeam?.clubId || myTeam?.id || activeTeamId || "").trim();

  const showInitialLoading = clubLoading || !myTeam || countsLoading;

  // 무한 로딩 방지: 로딩이 8초 넘게 지속되면 타임아웃 처리(재시도 노출)
  useEffect(() => {
    if (!showInitialLoading) { setLoadTimedOut(false); return; }
    const t = setTimeout(() => setLoadTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [showInitialLoading, retryTick]);

  // 매칭 탐색 결과 계측: 상대 공개 / 상대 없음(데드엔드 유입)
  useEffect(() => {
    if (showInitialLoading) return;
    if (opponent) track("opponent_found", { region: region || "" });
    else track("opponent_none", { region: region || "" });
  }, [showInitialLoading, opponent, oppId, region]);

  // 로드 실패 / 팀 없음 / 무한 로딩(타임아웃) → 데드엔드 대신 재시도·홈 안내
  const showLoadError =
    (!clubLoading && !activeTeamId) || loadError || (showInitialLoading && loadTimedOut);

  if (showLoadError) {
    return (
      <Page>
        <EmptyWrap>
          <EmptyText>
            {!activeTeamId ? (
              "매칭할 내 팀 정보를 찾을 수 없어요."
            ) : (
              <>매칭 정보를 불러오지 못했어요.<br />네트워크 상태를 확인해 주세요.</>
            )}
          </EmptyText>
          <EmptyActions>
            {activeTeamId ? (
              <EmptyPrimary
                type="button"
                onClick={() => { setLoadError(false); setLoadTimedOut(false); setRetryTick((n) => n + 1); }}
              >
                다시 시도
              </EmptyPrimary>
            ) : null}
            <EmptyGhost type="button" onClick={() => navigate("/home")}>홈으로</EmptyGhost>
          </EmptyActions>
        </EmptyWrap>
      </Page>
    );
  }

  if (showInitialLoading) {
    return (
      <Page>
        <CenterState>
          <Spinner />
        </CenterState>
      </Page>
    );
  }

  if (!opponent) {
    return (
      <Page>
        <EmptyWrap>
          <EmptyText>
            {region ? `${region} 주변에 ` : ""}팀원 {MIN_TEAM_MEMBERS}명 이상인
            <br />매칭 가능한 상대가 아직 없어요.
          </EmptyText>
          <EmptyActions>
            <EmptyPrimary
              type="button"
              onClick={() => navigate("/matching/region", { replace: true })}
            >
              다른 지역에서 다시 찾기
            </EmptyPrimary>
            <EmptyGhost type="button" onClick={handleInviteFriends}>
              친구 팀 초대하기 🏀
            </EmptyGhost>
            <EmptyGhost type="button" onClick={() => navigate("/home")}>
              홈으로
            </EmptyGhost>
          </EmptyActions>
        </EmptyWrap>
      </Page>
    );
  }

  const myMeta = `우리팀${myRank ? ` · ${myRank}위` : ""}`;
  const oppMetaParts = [];
  if (oppRank) oppMetaParts.push(`${oppRank}위`);
  if (winProb != null) oppMetaParts.push(`${winProb}%`);
  const oppMeta = oppMetaParts.join(" · ");

  // 애니메이션 재생용 키(상대/사이클 바뀔 때마다 등장 애니메이션 다시)
  const animKey = oppId;

  return (
    <Page>
      <StepsBar>
        <FlowSteps current={3} />
      </StepsBar>
      {widened ? (
        <WidenNote>선택한 지역에 매칭 가능한 상대가 없어 범위를 넓혀 찾았어요.</WidenNote>
      ) : null}
      <MatchupBar>
        <Matchup key={animKey}>
          <TeamCol onClick={() => goTeam(myClubId)}>
            <LogoWrap>
              {myRank && myRank <= 3 ? <Crown src={images.logo} alt={`${myRank}위`} /> : null}
              <LogoBox>
                <LogoImg
                  src={teamLogoSrc(myTeam?.logoUrl || images[myTeam?.logoKey])}
                  alt={myTeam?.name || "우리팀"}
                />
              </LogoBox>
            </LogoWrap>
            <TeamName>{myTeam?.name || "우리팀"}</TeamName>
            <TeamMeta $mine>{myMeta}</TeamMeta>
          </TeamCol>

          <VsBadge>VS</VsBadge>

          <TeamCol onClick={() => goTeam(oppId)}>
            <LogoWrap>
              {oppRank && oppRank <= 3 ? <Crown src={images.logo} alt={`${oppRank}위`} /> : null}
              <LogoBox>
                <LogoImg
                  src={teamLogoSrc(opponent.logoUrl || images[opponent.logoKey])}
                  alt={opponent.name}
                />
              </LogoBox>
            </LogoWrap>
            <TeamName>{opponent.name}</TeamName>
            <TeamMeta>{oppMeta || "상대팀"}</TeamMeta>
          </TeamCol>
        </Matchup>

      </MatchupBar>

      <Body>
        {/* 이 팀이 왜 먼저 떴는지 — rankOpponents 가 계산한 점수를 그대로 펼친다 */}
        <ReasonCard key={`${animKey}-r`}>
          <ReasonHead>
            <ReasonTitle>이 팀을 먼저 추천한 이유</ReasonTitle>
            {eligibleCount > 0 ? (
              <QueuePos>
                추천 {queuePos}번째 · 후보 {eligibleCount}팀
              </QueuePos>
            ) : null}
          </ReasonHead>

          <ScoreRow>
            <ScoreValue>
              {Math.round(opponent.matchScore || 0)}
              <span> / 100</span>
            </ScoreValue>
            <Bar>
              <BarFill $pct={Math.min(100, Math.max(0, opponent.matchScore || 0))} />
            </Bar>
          </ScoreRow>

          {opponent.matchReasons?.length ? (
            <ReasonRow>
              {opponent.matchReasons.map((r) => (
                <ReasonChip key={r}>{r}</ReasonChip>
              ))}
            </ReasonRow>
          ) : null}

          {winProb != null ? (
            <>
              <CardDivider />
              <SubHead>
                예상 승률
                <em>{oppStats?.totalMatches ? `상대 ${oppStats.wins}승 ${oppStats.losses}패` : "상대 전적 없음"}</em>
              </SubHead>
              <ProbRow>
                <ProbSide $mine>우리 {winProb}%</ProbSide>
                <Bar $thin>
                  <BarFill $pct={winProb} />
                </Bar>
                <ProbSide $right>{100 - winProb}% 상대</ProbSide>
              </ProbRow>
            </>
          ) : null}

          {parts ? (
            <>
              <CardDivider />
              <SubHead>
                점수 항목
                <em>오른쪽 숫자는 가중치(합 100)</em>
              </SubHead>
              {PART_LABELS.map(([key, label]) => (
                <PartRow key={key}>
                  <PartLabel>{label}</PartLabel>
                  <Bar $thin>
                    <BarFill $pct={Math.round((Number(parts[key]) || 0) * 100)} />
                  </Bar>
                  <PartWeight>{WEIGHTS[key]}</PartWeight>
                </PartRow>
              ))}
            </>
          ) : null}
        </ReasonCard>

        <RosterHead>
          <RosterTitle>
            <PeopleIcon />
            상대팀 선수단 <RosterCount>{members.length}명</RosterCount>
          </RosterTitle>
          <RosterNote>라인업은 매칭 후 확정</RosterNote>
        </RosterHead>

        {loadingDetail ? (
          <CenterState>
            <Spinner />
          </CenterState>
        ) : members.length === 0 ? (
          <CenterState>아직 등록된 선수단 정보가 없어요.</CenterState>
        ) : (
          <ListCard key={animKey}>
            {members.map((m, idx) => {
              const uid = String(m.userId || m.id || "").trim();
              const isLeader = ownerUid ? uid === ownerUid : idx === 0;
              const pRank = uid && playerRankMap?.get?.(uid);
              const showPlayerCrown = pRank && pRank <= 3;
              return (
                <PlayerRow
                  key={uid || idx}
                  type="button"
                  onClick={() => goPlayer(uid)}
                >
                  <AvatarWrap>
                    {showPlayerCrown ? (
                      <PlayerCrown src={images.logo} alt={`${pRank}위`} />
                    ) : null}
                    {m.avatarUrl ? (
                      <Avatar
                        src={m.avatarUrl}
                        alt={m.name || m.nickname || "선수"}
                      />
                    ) : (
                      <AvatarPlaceholder size={46} />
                    )}
                  </AvatarWrap>

                  <PlayerTexts>
                    <PlayerNameWrap>
                      <PlayerName>{m.name || m.nickname || "선수"}</PlayerName>
                      {isLeader ? <CaptainTag>팀장</CaptainTag> : null}
                    </PlayerNameWrap>
                    <PlayerPos>{m.position || m.positionLabel || "포지션 미정"}</PlayerPos>
                  </PlayerTexts>

                  {pRank ? <PlayerRank>{pRank}위</PlayerRank> : null}
                </PlayerRow>
              );
            })}
          </ListCard>
        )}
      </Body>

      <Footer>
        <RequestBtn type="button" onClick={handleRequest} disabled={!oppId}>
          이 팀에 매칭 요청
        </RequestBtn>
        <CycleBtn
          type="button"
          onClick={handleCycle}
          disabled={eligibleCount <= 1}
          aria-label="다른 상대 찾기"
          title="다른 상대 찾기"
        >
          <CycleIcon />
        </CycleBtn>
      </Footer>
    </Page>
  );
}
