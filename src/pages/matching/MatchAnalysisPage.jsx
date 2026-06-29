/* eslint-disable */
// src/pages/matching/MatchAnalysisPage.jsx
// ✅ AI 분석 페이지 하단 "매칭 신청하기" + 매치 사이즈(3v3/4v4/5v5) 선택
// - 내 팀/상대 팀 멤버 3명 미만이면 매칭 신청 막음
// - 라인업은 수락 후 매칭룸에서 각 팀이 확정 → 신청 시엔 사이즈만 선택
// - createMatchRequest 호출 후 /matchingmanage sent 탭으로 이동 (TeamProfilePage와 동일 방식)

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";

import Spinner from "../../components/common/Spinner";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";
import { WinChip, DrawChip, LoseChip } from "../../components/common/ResultChip";
import { images, teamLogoSrc } from "../../utils/imageAssets";
import { useClubContext } from "../../context/ClubContext";
import { getTeamProfile } from "../../services/teamService";
import { getTeamRankMap } from "../../services/teamRankingService";
import { getPlayerRankMap } from "../../services/rankingService";
import { estimateWinProbability } from "../../utils/matchAnalysis";
import { createMatchRequest } from "../../services/matchingService";
import { getTeamPredictionAccuracy, getHeadToHeadRecord } from "../../services/matchRoomService";
import { MIN_TEAM_MEMBERS } from "../../utils/constants";

import AnimatedAiRing from "./components/AnimatedAiRing";

/* ===================== helpers ===================== */

const SKILL_LABEL = {
  beginner: "입문",
  amateur: "아마추어",
  intermediate: "중급",
  advanced: "상급",
  pro: "프로",
};

const POSITION_LABEL = {
  guard: "가드",
  forward: "포워드",
  center: "센터",
};

const MATCH_SIZE_OPTIONS = [
  { key: "3v3", label: "3 vs 3", desc: "한 팀당 3명" },
  { key: "4v4", label: "4 vs 4", desc: "한 팀당 4명" },
  { key: "5v5", label: "5 vs 5", desc: "한 팀당 5명" },
];

function toNum(n, fallback = null) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function calcWinRatePercent(team) {
  const wins = toNum(team?.stats?.wins ?? team?.wins, 0) ?? 0;
  const losses = toNum(team?.stats?.losses ?? team?.losses, 0) ?? 0;
  const draws = toNum(team?.stats?.draws ?? team?.draws, 0) ?? 0;
  const total = wins + losses + draws;
  if (total <= 0) return 0;
  return Math.round((wins / total) * 100);
}

function buildRecentResultsFromTeam(team, count = 5) {
  const src = Array.isArray(team?.stats?.recentResults) ? team.stats.recentResults : [];
  const norm = src
    .map((x) => String(x || "").toUpperCase().trim())
    .map((x) => (x === "WIN" ? "W" : x === "LOSE" ? "L" : x === "DRAW" ? "D" : x))
    .filter((x) => x === "W" || x === "L" || x === "D");

  // ✅ 실제 경기기록(recentResults)만 사용. 없으면 빈 배열 → UI는 예정점(SoonDot) 표시.
  //    승률로 W/L을 합성하면 치르지 않은 경기를 그린 셈이라 참고용 분석의 신뢰를 깬다.
  return norm.slice(0, count);
}

function calcAvgHeightCm(members) {
  const list = Array.isArray(members) ? members : [];
  const nums = list
    .map((m) => toNum(m?.heightCm, null))
    .filter((x) => typeof x === "number" && x > 0);
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round(sum / nums.length);
}

function countPositions(members) {
  const list = Array.isArray(members) ? members : [];
  const map = { guard: 0, forward: 0, center: 0, unknown: 0 };
  list.forEach((m) => {
    const p = String(m?.mainPosition || "").trim();
    if (p === "guard") map.guard += 1;
    else if (p === "forward") map.forward += 1;
    else if (p === "center") map.center += 1;
    else map.unknown += 1;
  });
  return map;
}

function barRatio(a, b) {
  const A = typeof a === "number" ? a : 0;
  const B = typeof b === "number" ? b : 0;
  const total = A + B;
  if (total <= 0) return 50;
  return Math.round((A / total) * 100);
}

function sortMembersForList(members) {
  const list = Array.isArray(members) ? members : [];
  const posScore = (p) => (p === "guard" ? 1 : p === "forward" ? 2 : p === "center" ? 3 : 9);
  return [...list].sort((a, b) => {
    const pa = posScore(String(a?.mainPosition || "").trim());
    const pb = posScore(String(b?.mainPosition || "").trim());
    if (pa !== pb) return pa - pb;
    const ha = toNum(a?.heightCm, 0) || 0;
    const hb = toNum(b?.heightCm, 0) || 0;
    return hb - ha;
  });
}

/* ===================== styled ===================== */

const Page = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 14px 16px calc(24px + 82px) 16px; /* ✅ 하단 CTA 높이만큼 여백 */
`;

const Card = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 14px 14px 16px;
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const TitleCol = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-size: 17px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Sub = styled.div`
  margin-top: 4px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const AccuracyBadge = styled.div`
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  padding: 4px 9px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(16,185,129,0.14)" : "rgba(16,185,129,0.10)"};
  border: 1px solid
    ${({ theme }) => (theme.mode === "dark" ? "rgba(16,185,129,0.35)" : "rgba(16,185,129,0.25)")};
  color: ${({ theme }) => (theme.mode === "dark" ? "#6ee7b7" : "#047857")};
`;

const Divider = styled.div`
  margin: 18px 0;
  height: 1px;
  background: ${({ theme }) => theme.colors.divider};
`;

const Section = styled.div`
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const SectionHeadLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const AccentBar = styled.div`
  width: 3px;
  height: 18px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  flex-shrink: 0;
`;

const SectionTitleStrong = styled.div`
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textStrong};
  line-height: 1.2;
`;

const SectionBadge = styled.div`
  flex-shrink: 0;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? "rgba(99,102,241,0.18)"
      : "rgba(79, 70, 229, 0.08)"};
  border: 1px solid
    ${({ theme }) =>
      theme.mode === "dark"
        ? "rgba(99,102,241,0.35)"
        : "rgba(79, 70, 229, 0.22)"};
  color: ${({ theme }) =>
    theme.mode === "dark" ? "#a5b4fc" : "#3730a3"};
`;

const Hint = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.5;
`;

const OneCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Mini = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  padding: 12px 12px;
  background: ${({ theme }) => theme.colors.card};
`;

const MiniLabel = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const TeamCardRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const TeamLogoWrap = styled.div`
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
`;

const TeamLogo = styled.img`
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
  display: block;
`;

const CrownImg = styled.img`
  position: absolute;
  top: -15px;
  left: 50%;
  transform: translateX(-50%);
  width: 26px;
  height: 26px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.2));
`;

const TeamCardTexts = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TeamCardName = styled.div`
  font-size: 17px;
  color: ${({ theme }) => theme.colors.textStrong};
  line-height: 1.25;
  word-break: keep-all;
  overflow-wrap: anywhere;
`;

const TeamCardRegion = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.25;
  word-break: keep-all;
  overflow-wrap: anywhere;
`;

const CompareRow = styled.div`
  display: grid;
  grid-template-columns: 84px 1fr 84px;
  gap: 10px;
  align-items: center;
`;

const SideValue = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
  text-align: ${({ $right }) => ($right ? "right" : "left")};
  white-space: nowrap;
`;

const MidBar = styled.div`
  height: 10px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99,102,241,0.18)" : "#eef2ff"};
  position: relative;
  overflow: hidden;
`;

const MidFill = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: ${({ $pct }) => $pct}%;
  background: ${({ theme }) => theme.colors.primary};
  border-radius: 999px;
`;

const LabelRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const RecentRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
`;

const RecentLabel = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textNormal};
  white-space: normal;
  word-break: keep-all;
  overflow-wrap: anywhere;
`;

const RecentDots = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const SoonDot = styled.div`
  width: 14px;
  height: 14px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#d1d5db"};
  border: 1px dashed ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "#cbd5e1"};
  box-sizing: border-box;
`;

const PlayerList = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
`;

const PlayerRow = styled.button`
  width: 100%;
  min-width: 0; /* ✅ 그리드 셀이 내용보다 커지지 않게(가로 넘침 방지) */
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  padding: 10px 10px;
  background: ${({ theme }) => theme.colors.card};
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  text-align: left;

  &:active {
    opacity: 0.7;
  }
`;

const PlayerAvatarWrap = styled.div`
  position: relative;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
`;

const PlayerAvatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  object-fit: cover;
  display: block;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
`;

const PlayerCrown = styled.img`
  position: absolute;
  top: -11px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 20px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.2));
`;

const PlayerCol = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const PlayerName = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PlayerMeta = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/* 키·몸무게 — 포지션·실력 아래 두 번째 줄 */
const PlayerSub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AiBox = styled.div`
  border: 1px solid
    ${({ theme }) =>
      theme.mode === "dark"
        ? "rgba(99,102,241,0.35)"
        : "rgba(79, 70, 229, 0.18)"};
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? "rgba(99,102,241,0.08)"
      : "rgba(79, 70, 229, 0.06)"};
  border-radius: 8px;
  padding: 12px 12px;
`;

const Bullet = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textNormal};
  line-height: 1.6;
`;

const ErrorText = styled.div`
  padding: 20px 16px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  text-align: center;
  line-height: 1.5;
`;

/* ===== 하단 CTA + 라인업 선택 모달 ===== */

const BottomCTAWrap = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 14px 16px calc(14px + env(safe-area-inset-bottom));
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? `linear-gradient(to top, ${theme.colors.bg} 0%, ${theme.colors.bg} 70%, rgba(11, 18, 32, 0.85) 100%)`
      : `linear-gradient(to top, #ffffff 0%, #ffffff 70%, rgba(255, 255, 255, 0.85) 100%)`};
  box-shadow: ${({ theme }) =>
    theme.mode === "dark"
      ? "0 -6px 20px rgba(0, 0, 0, 0.45)"
      : "0 -6px 20px rgba(15, 23, 42, 0.12)"};
  z-index: 50;
`;

/* 팀원 안내: 매칭 요청은 팀장만 가능 */
const LeaderNotice = styled.div`
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
  font-size: 12px;
  line-height: 1.5;
  color: ${({ theme }) => (theme.mode === "dark" ? "#fbbf24" : "#b45309")};
`;

const MatchApplyButton = styled.button`
  width: 100%;
  height: 52px;
  border-radius: 999px;
  border: none;
  background: ${({ disabled, theme }) =>
    disabled
      ? theme.mode === "dark"
        ? "rgba(99,102,241,0.35)"
        : "#c7d2fe"
      : theme.colors.primary};
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};

  &:active {
    transform: ${({ disabled }) => (disabled ? "none" : "translateY(1px)")};
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.45)"};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
`;

const SelectCard = styled.div`
  width: 94%;
  max-width: 420px;
  max-height: 70vh;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 16px 16px 18px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
`;

const SelectHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const SelectTitle = styled.div`
  font-size: 18px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const SelectClose = styled.button`
  border: none;
  background: none;
  font-size: 20px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const SelectMeta = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const SelectBody = styled.div`
  margin-top: 10px;
  flex: 1;
  overflow-y: auto;
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 4px;
  }
`;

const SelectList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SelectItem = styled.button`
  width: 100%;
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid
    ${({ $selected, theme }) =>
      $selected ? theme.colors.primary : theme.colors.border};
  background: ${({ $selected, theme }) =>
    $selected
      ? theme.mode === "dark"
        ? "rgba(99,102,241,0.18)"
        : "#eef2ff"
      : theme.colors.card};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  text-align: left;
`;

const SelectTexts = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const SelectName = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const SelectMetaText = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const SelectRadio = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid
    ${({ $selected, theme }) =>
      $selected ? theme.colors.primary : theme.colors.border};
  background: ${({ $selected, theme }) =>
    $selected ? theme.colors.primary : theme.colors.card};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #ffffff;
`;

const SelectActions = styled.div`
  margin-top: 12px;
  display: flex;
  gap: 8px;
`;

const SelectButton = styled.button`
  flex: 1;
  height: 42px;
  border-radius: 999px;
  border: ${({ $primary, theme }) =>
    $primary ? "none" : `1px solid ${theme.colors.border}`};
  background: ${({ $primary, theme }) =>
    $primary ? theme.colors.primary : theme.colors.card};
  color: ${({ $primary, theme }) =>
    $primary ? "#ffffff" : theme.colors.textStrong};
  font-size: 13px;
  cursor: pointer;
`;

/* ===================== component ===================== */

export default function MatchAnalysisPage() {
  const nav = useNavigate();
  const { clubId } = useParams(); // 상대팀 id
  const { activeTeamId, isTeamLeader, loading: clubLoading } = useClubContext();

  const [loading, setLoading] = useState(true);
  const [myTeam, setMyTeam] = useState(null);
  const [oppTeam, setOppTeam] = useState(null);
  const [error, setError] = useState("");

  // ✅ 매칭 신청용 (사이즈만 선택 — 라인업은 수락 후 매칭룸에서 확정)
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [selectedMatchSize, setSelectedMatchSize] = useState(""); // "3v3" | "4v4" | "5v5"
  const [showMatchConfirm, setShowMatchConfirm] = useState(false);
  const [submittingMatch, setSubmittingMatch] = useState(false);

  // 랭킹(1~3위 왕관 표시용)
  const [teamRankMap, setTeamRankMap] = useState(null);
  const [playerRankMap, setPlayerRankMap] = useState(null);

  // AI 예측 적중률(내 팀 기준) — { rate, sample } | null(로딩)
  const [accuracy, setAccuracy] = useState(null);

  // 상대전적(H2H, 내 팀 관점) — { wins, losses, draws, games, recent } | null
  const [h2h, setH2h] = useState(null);

  useEffect(() => {
    let alive = true;
    getTeamRankMap()
      .then((m) => alive && setTeamRankMap(m))
      .catch(() => {});
    getPlayerRankMap()
      .then((m) => alive && setPlayerRankMap(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // AI 예측 적중률 로드(내 팀 활동 기준)
  useEffect(() => {
    let alive = true;
    if (!activeTeamId) return;
    getTeamPredictionAccuracy(String(activeTeamId))
      .then((a) => alive && setAccuracy(a))
      .catch(() => alive && setAccuracy({ rate: null, sample: 0 }));
    return () => {
      alive = false;
    };
  }, [activeTeamId]);

  // 상대전적(H2H) 로드 — 내 팀 vs 이 상대(clubId)
  useEffect(() => {
    let alive = true;
    setH2h(null);
    if (!activeTeamId || !clubId) return;
    getHeadToHeadRecord(String(activeTeamId), String(clubId))
      .then((r) => alive && setH2h(r))
      .catch(() => alive && setH2h({ wins: 0, losses: 0, draws: 0, games: 0, recent: [] }));
    return () => {
      alive = false;
    };
  }, [activeTeamId, clubId]);

  const goTeam = (cid) => {
    const id = String(cid || "").trim();
    if (id) nav(`/team/${id}`);
  };

  const goPlayer = (uid) => {
    const id = String(uid || "").trim();
    if (id) nav(`/player/${id}`);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (clubLoading) return;
      if (!activeTeamId || !clubId) return;

      setLoading(true);
      setError("");

      try {
        const [mine, opp] = await Promise.all([
          getTeamProfile(String(activeTeamId)),
          getTeamProfile(String(clubId)),
        ]);

        if (cancelled) return;

        if (!mine || !opp) {
          setError("분석 데이터를 불러올 수 없습니다.");
          setMyTeam(null);
          setOppTeam(null);
        } else {
          setMyTeam(mine);
          setOppTeam(opp);
        }
      } catch (e) {
        if (cancelled) return;
        setError("잠시 후 다시 시도해 주세요.");
        setMyTeam(null);
        setOppTeam(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [clubLoading, activeTeamId, clubId]);

  const view = useMemo(() => {
    if (!myTeam || !oppTeam) return null;

    const myMembers = sortMembersForList(myTeam.members || []);
    const oppMembers = sortMembersForList(oppTeam.members || []);

    const myAvgH = calcAvgHeightCm(myMembers);
    const oppAvgH = calcAvgHeightCm(oppMembers);

    const myPos = countPositions(myMembers);
    const oppPos = countPositions(oppMembers);

    const myWin = calcWinRatePercent(myTeam);
    const oppWin = calcWinRatePercent(oppTeam);

    // ✅ 실데이터(stats/members) + 상대전적(H2H) + 리그 랭킹 기반 승률 추정
    const myClubId = String(myTeam.clubId || myTeam.id || "");
    const oppClubId = String(oppTeam.clubId || oppTeam.id || "");
    const est = estimateWinProbability(myTeam, oppTeam, {
      h2h: h2h && h2h.games > 0 ? h2h : null,
      myRank: teamRankMap?.get?.(myClubId) || 0,
      oppRank: teamRankMap?.get?.(oppClubId) || 0,
      totalRanked: teamRankMap?.size || 0,
    });
    const prob = est.prob;
    const probLow = est.probLow ?? prob;
    const probHigh = est.probHigh ?? prob;
    const confidence = est.confidence;
    const insufficient = est.insufficient;
    const limited = !!est.limited;
    const sample = est.sample || { my: 0, opp: 0, h2h: 0 };
    const reasons = Array.isArray(est.reasons) ? est.reasons : [];

    const myRecent = buildRecentResultsFromTeam(myTeam, 5);
    const oppRecent = buildRecentResultsFromTeam(oppTeam, 5);

    return {
      prob,
      probLow,
      probHigh,
      confidence,
      insufficient,
      limited,
      sample,
      reasons,
      my: {
        clubId: myTeam.clubId || myTeam.id,
        name: myTeam.name,
        region: myTeam.region || `${myTeam.regionSido || ""} ${myTeam.regionGu || ""}`.trim(),
        membersCount: myMembers.length,
        avgHeight: myAvgH,
        winRate: myWin,
        pos: myPos,
        recent: myRecent,
        members: myMembers,
        logoUrl: teamLogoSrc(String(myTeam.logoUrl || "").trim()),
      },
      opp: {
        clubId: oppTeam.clubId || oppTeam.id,
        name: oppTeam.name,
        region: oppTeam.region || `${oppTeam.regionSido || ""} ${oppTeam.regionGu || ""}`.trim(),
        membersCount: oppMembers.length,
        avgHeight: oppAvgH,
        winRate: oppWin,
        pos: oppPos,
        recent: oppRecent,
        members: oppMembers,
        logoUrl: teamLogoSrc(String(oppTeam.logoUrl || "").trim()),
      },
    };
  }, [myTeam, oppTeam, h2h, teamRankMap]);

  const handleMatchRequestClick = () => {
    if (!view) return;

    // ✅ 팀원은 매칭 분석까지만 가능 — 요청 전송은 팀장만
    if (!isTeamLeader) {
      alert("매칭 요청은 팀장만 보낼 수 있어요. 이 분석 결과를 팀장에게 알려 주세요.");
      return;
    }

    const myCount = view.my.membersCount || 0;
    const oppCount = view.opp.membersCount || 0;

    if (myCount < MIN_TEAM_MEMBERS) {
      alert(`우리 팀원이 ${MIN_TEAM_MEMBERS}명 이상일 때 매칭을 신청할 수 있어요.`);
      return;
    }

    if (oppCount < MIN_TEAM_MEMBERS) {
      alert(`상대 팀이 아직 팀원 ${MIN_TEAM_MEMBERS}명을 채우지 못해 매칭을 받을 수 없어요.`);
      return;
    }

    setSelectedMatchSize("");
    setShowSizeModal(true);
  };

  const handleSubmitMatchRequest = async () => {
    if (!view || !myTeam || !oppTeam) {
      setShowSizeModal(false);
      setShowMatchConfirm(false);
      return;
    }

    if (!selectedMatchSize) {
      alert("매치 사이즈(3 vs 3 / 4 vs 4 / 5 vs 5)를 선택해 주세요.");
      return;
    }

    if (submittingMatch) return;
    setSubmittingMatch(true);
    try {
      const matchId = await createMatchRequest({
        actorClubId: String(view.my.clubId),
        actorTeam: myTeam,

        targetClubId: String(view.opp.clubId),
        targetTeam: oppTeam,

        matchSizeKey: selectedMatchSize,
      });

      console.log("[MatchAnalysis] match request created:", matchId);

      setShowMatchConfirm(false);
      setShowSizeModal(false);
      setSelectedMatchSize("");
      nav("/matchingmanage", { state: { initialTab: "sent" } });
    } catch (e) {
      console.warn("[MatchAnalysis] create match request failed:", e?.message || e);
      alert(e?.message || "매칭 신청에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setShowMatchConfirm(false);
      setShowSizeModal(false);
    } finally {
      setSubmittingMatch(false);
    }
  };

  if (clubLoading || loading) {
    return (
      <Page>
         <Spinner />
      </Page>
    );
  }

  if (error || !view) {
    return (
      <Page>
        <Card>
          <ErrorText>{error || "분석 정보를 불러올 수 없습니다."}</ErrorText>
        </Card>
      </Page>
    );
  }

  const my = view.my;
  const opp = view.opp;

  const myTeamRank = my.clubId ? teamRankMap?.get?.(String(my.clubId)) : null;
  const oppTeamRank = opp.clubId ? teamRankMap?.get?.(String(opp.clubId)) : null;

  const memberPct = barRatio(my.membersCount, opp.membersCount);
  const heightPct = barRatio(my.avgHeight || 0, opp.avgHeight || 0);
  const winPct = barRatio(my.winRate, opp.winRate);

  const posTotalMy = my.pos.guard + my.pos.forward + my.pos.center;
  const posTotalOpp = opp.pos.guard + opp.pos.forward + opp.pos.center;

  const myGuardPct = posTotalMy ? Math.round((my.pos.guard / posTotalMy) * 100) : 0;
  const oppGuardPct = posTotalOpp ? Math.round((opp.pos.guard / posTotalOpp) * 100) : 0;

  return (
    <>
      <Page>
        <Card>
          <TopRow>
            <AnimatedAiRing percent={view.prob} size={96} label="승리확률" />
            <TitleCol>
              <Title>{opp.name} 분석 리포트</Title>
              <Sub>내 팀 vs 상대 팀 비교 · 신뢰도: {view.confidence}</Sub>
              {accuracy != null &&
                (accuracy.sample >= 5 && accuracy.rate != null ? (
                  <AccuracyBadge>
                    🎯 AI 예측 적중률 {accuracy.rate}% · 최근 {accuracy.sample}경기
                  </AccuracyBadge>
                ) : (
                  <AccuracyBadge>
                    🔬 예측 검증 중 · 누적 {accuracy.sample}경기
                  </AccuracyBadge>
                ))}
            </TitleCol>
          </TopRow>

          <Divider />

          <OneCol>
            <Mini>
              <MiniLabel>내 팀</MiniLabel>
              <TeamCardRow
                style={{ marginTop: 10, cursor: "pointer" }}
                onClick={() => goTeam(my.clubId)}
              >
                <TeamLogoWrap>
                  {myTeamRank && myTeamRank <= 3 ? (
                    <CrownImg src={images.logo} alt={`${myTeamRank}위`} />
                  ) : null}
                  <TeamLogo src={my.logoUrl} alt={my.name} />
                </TeamLogoWrap>
                <TeamCardTexts>
                  <TeamCardName>{my.name}</TeamCardName>
                  <TeamCardRegion>{my.region || "지역 미지정"}</TeamCardRegion>
                </TeamCardTexts>
              </TeamCardRow>
            </Mini>

            <Mini>
              <MiniLabel>상대 팀</MiniLabel>
              <TeamCardRow
                style={{ marginTop: 10, cursor: "pointer" }}
                onClick={() => goTeam(opp.clubId)}
              >
                <TeamLogoWrap>
                  {oppTeamRank && oppTeamRank <= 3 ? (
                    <CrownImg src={images.logo} alt={`${oppTeamRank}위`} />
                  ) : null}
                  <TeamLogo src={opp.logoUrl} alt={opp.name} />
                </TeamLogoWrap>
                <TeamCardTexts>
                  <TeamCardName>{opp.name}</TeamCardName>
                  <TeamCardRegion>{opp.region || "지역 미지정"}</TeamCardRegion>
                </TeamCardTexts>
              </TeamCardRow>
            </Mini>
          </OneCol>

          <Section>
            <SectionHead>
              <SectionHeadLeft>
                <AccentBar />
                <SectionTitleStrong>핵심 비교 지표</SectionTitleStrong>
              </SectionHeadLeft>
              <SectionBadge>3항목</SectionBadge>
            </SectionHead>

            <LabelRow>
              <span>멤버 수</span>
              <span />
              <span />
            </LabelRow>
            <CompareRow>
              <SideValue>{my.membersCount}명</SideValue>
              <MidBar>
                <MidFill $pct={memberPct} />
              </MidBar>
              <SideValue $right>{opp.membersCount}명</SideValue>
            </CompareRow>

            <LabelRow>
              <span>평균 키</span>
              <span />
              <span />
            </LabelRow>
            <CompareRow>
              <SideValue>{my.avgHeight ? `${my.avgHeight}cm` : "—"}</SideValue>
              <MidBar>
                <MidFill $pct={heightPct} />
              </MidBar>
              <SideValue $right>{opp.avgHeight ? `${opp.avgHeight}cm` : "—"}</SideValue>
            </CompareRow>

            <LabelRow>
              <span>승률</span>
              <span />
              <span />
            </LabelRow>
            <CompareRow>
              <SideValue>{my.winRate}%</SideValue>
              <MidBar>
                <MidFill $pct={winPct} />
              </MidBar>
              <SideValue $right>{opp.winRate}%</SideValue>
            </CompareRow>

            <Hint>
              가드 비중(내 {myGuardPct}% vs 상대 {oppGuardPct}%)은 속공 전개/수비 매치업에
              영향을 줄 수 있어요.
            </Hint>
          </Section>

          <Section>
            <SectionHead>
              <SectionHeadLeft>
                <AccentBar />
                <SectionTitleStrong>최근 경기기록</SectionTitleStrong>
              </SectionHeadLeft>
              <SectionBadge>5경기</SectionBadge>
            </SectionHead>

            <OneCol>
              <Mini>
                <MiniLabel>내 팀</MiniLabel>
                <RecentRow>
                  <RecentLabel>최근 5경기</RecentLabel>
                  <RecentDots>
                    {my.recent.length > 0 ? (
                      my.recent.map((r, idx) => {
                        if (r === "W") return <WinChip key={`m-${idx}`} size="sm" />;
                        if (r === "D") return <DrawChip key={`m-${idx}`} size="sm" />;
                        return <LoseChip key={`m-${idx}`} size="sm" />;
                      })
                    ) : (
                      <>
                        <SoonDot /><SoonDot /><SoonDot /><SoonDot /><SoonDot />
                      </>
                    )}
                  </RecentDots>
                </RecentRow>
              </Mini>

              <Mini>
                <MiniLabel>상대 팀</MiniLabel>
                <RecentRow>
                  <RecentLabel>최근 5경기</RecentLabel>
                  <RecentDots>
                    {opp.recent.length > 0 ? (
                      opp.recent.map((r, idx) => {
                        if (r === "W") return <WinChip key={`o-${idx}`} size="sm" />;
                        if (r === "D") return <DrawChip key={`o-${idx}`} size="sm" />;
                        return <LoseChip key={`o-${idx}`} size="sm" />;
                      })
                    ) : (
                      <>
                        <SoonDot /><SoonDot /><SoonDot /><SoonDot /><SoonDot />
                      </>
                    )}
                  </RecentDots>
                </RecentRow>
              </Mini>
            </OneCol>
          </Section>

          <Section>
            <SectionHead>
              <SectionHeadLeft>
                <AccentBar />
                <SectionTitleStrong>선수 구성</SectionTitleStrong>
              </SectionHeadLeft>
              <SectionBadge>
                내 {my.membersCount} · 상대 {opp.membersCount}
              </SectionBadge>
            </SectionHead>

            <Hint>내 팀 / 상대 팀 선수 정보를 보여줘요.</Hint>

            <SectionTitleStrong style={{ marginTop: 6 }}>내 팀</SectionTitleStrong>
            <PlayerList>
              {my.members.map((p) => {
                const pos = String(p?.mainPosition || "").trim();
                const posKo = POSITION_LABEL[pos] || "포지션";
                const skill = String(p?.skillLevel || "").trim();
                const skillKo = SKILL_LABEL[skill] || "실력";

                const height = p.heightCm ? `${p.heightCm}cm` : "";
                const weight = p.weightKg ? `${p.weightKg}kg` : "";

                const metaTop = `${posKo} · ${skillKo}`;
                const metaSub = [height, weight].filter(Boolean).join(" · ");

                const uid = String(p.userId || p.id || "").trim();
                const pRank = uid ? playerRankMap?.get?.(uid) : null;

                return (
                  <PlayerRow key={uid || p.id} type="button" onClick={() => goPlayer(uid)}>
                    <PlayerAvatarWrap>
                      {pRank && pRank <= 3 ? (
                        <PlayerCrown src={images.logo} alt={`${pRank}위`} />
                      ) : null}
                      {p.avatarUrl ? (
                        <PlayerAvatar src={p.avatarUrl} alt={p.nickname || p.name || "선수"} />
                      ) : (
                        <AvatarPlaceholder size={36} />
                      )}
                    </PlayerAvatarWrap>
                    <PlayerCol>
                      <PlayerName>{p.nickname || p.name || "선수"}</PlayerName>
                      <PlayerMeta>{metaTop}</PlayerMeta>
                      {metaSub ? <PlayerSub>{metaSub}</PlayerSub> : null}
                    </PlayerCol>
                  </PlayerRow>
                );
              })}
            </PlayerList>

            <SectionTitleStrong style={{ marginTop: 10 }}>상대 팀</SectionTitleStrong>
            <PlayerList>
              {opp.members.map((p) => {
                const pos = String(p?.mainPosition || "").trim();
                const posKo = POSITION_LABEL[pos] || "포지션";
                const skill = String(p?.skillLevel || "").trim();
                const skillKo = SKILL_LABEL[skill] || "실력";

                const height = p.heightCm ? `${p.heightCm}cm` : "";
                const weight = p.weightKg ? `${p.weightKg}kg` : "";

                const metaTop = `${posKo} · ${skillKo}`;
                const metaSub = [height, weight].filter(Boolean).join(" · ");

                const uid = String(p.userId || p.id || "").trim();
                const pRank = uid ? playerRankMap?.get?.(uid) : null;

                return (
                  <PlayerRow key={uid || p.id} type="button" onClick={() => goPlayer(uid)}>
                    <PlayerAvatarWrap>
                      {pRank && pRank <= 3 ? (
                        <PlayerCrown src={images.logo} alt={`${pRank}위`} />
                      ) : null}
                      {p.avatarUrl ? (
                        <PlayerAvatar src={p.avatarUrl} alt={p.nickname || p.name || "선수"} />
                      ) : (
                        <AvatarPlaceholder size={36} />
                      )}
                    </PlayerAvatarWrap>
                    <PlayerCol>
                      <PlayerName>{p.nickname || p.name || "선수"}</PlayerName>
                      <PlayerMeta>{metaTop}</PlayerMeta>
                      {metaSub ? <PlayerSub>{metaSub}</PlayerSub> : null}
                    </PlayerCol>
                  </PlayerRow>
                );
              })}
            </PlayerList>
          </Section>

          <Section>
            <SectionHead>
              <SectionHeadLeft>
                <AccentBar />
                <SectionTitleStrong>AI 해석</SectionTitleStrong>
              </SectionHeadLeft>
              <SectionBadge>요약</SectionBadge>
            </SectionHead>

            <AiBox>
              {view.insufficient ? (
                <>
                  <Bullet>
                    • 표본이 부족해 현재는 균형(<b>{view.prob}%</b>)을 기준으로 제시합니다.
                  </Bullet>
                  <Bullet>
                    • 경기 결과가 누적되면 추정 신뢰도가 단계적으로 올라갑니다.
                  </Bullet>
                </>
              ) : view.limited ? (
                <>
                  <Bullet>
                    • 아직 전적이 충분하지 않아 정밀한 분석은 어렵습니다 (내 팀 {view.sample.my}경기 · 상대{" "}
                    {view.sample.opp}경기
                    {view.sample.h2h > 0 ? ` · 맞대결 ${view.sample.h2h}전` : ""}).
                  </Bullet>
                  <Bullet>
                    • 현재 데이터 기준으로는 <b>약 {view.probLow}~{view.probHigh}%</b> 수준이며, 참고용으로만
                    봐주세요.
                  </Bullet>
                  {view.reasons.map((line, idx) => (
                    <Bullet key={`reason-${idx}`}>• {line}</Bullet>
                  ))}
                  <Bullet style={{ marginTop: 6, opacity: 0.75 }}>
                    ※ 경기 결과가 쌓이면 분석이 그에 맞춰 점점 정교해집니다.
                  </Bullet>
                </>
              ) : (
                <>
                  <Bullet>
                    • {opp.name}전 승리 확률은 <b>{view.prob}%</b>로 추정됩니다. (신뢰도{" "}
                    {view.confidence})
                  </Bullet>
                  {view.reasons.map((line, idx) => (
                    <Bullet key={`reason-${idx}`}>• {line}</Bullet>
                  ))}
                  <Bullet style={{ marginTop: 6, opacity: 0.75 }}>
                    ※ 통산·상대전적·최근 폼 등 실데이터를 가중 합산하고 소표본은 보정(셰이드)했습니다.
                    확정이 아닌 참고용 지표입니다.
                  </Bullet>
                </>
              )}
            </AiBox>
          </Section>
        </Card>
      </Page>

      {/* ✅ 하단 매칭 신청하기 CTA (요청 전송은 팀장만) */}
      <BottomCTAWrap>
        {!clubLoading && !isTeamLeader ? (
          <LeaderNotice>
            매칭 요청은 팀장만 보낼 수 있어요. 분석 결과를 팀장에게 알려 주세요.
          </LeaderNotice>
        ) : null}
        <MatchApplyButton type="button" onClick={handleMatchRequestClick}>
          🏀 매칭 신청하기
        </MatchApplyButton>
      </BottomCTAWrap>

      {/* ✅ 매치 사이즈 선택 모달 (라인업은 수락 후 매칭룸에서 확정) */}
      {showSizeModal && (
        <Overlay onClick={() => setShowSizeModal(false)}>
          <SelectCard onClick={(e) => e.stopPropagation()}>
            <SelectHeader>
              <SelectTitle>매치 사이즈를 선택해 주세요</SelectTitle>
              <SelectClose onClick={() => setShowSizeModal(false)}>×</SelectClose>
            </SelectHeader>

            <SelectMeta>
              {opp?.name ? `${opp.name}에 매칭 신청` : "매칭 신청"} · 라인업은 수락 후 매칭룸에서 각 팀이
              확정해요
            </SelectMeta>

            <SelectBody>
              <SelectList>
                {MATCH_SIZE_OPTIONS.map((optn) => {
                  const selected = selectedMatchSize === optn.key;
                  return (
                    <SelectItem
                      key={optn.key}
                      type="button"
                      $selected={selected}
                      onClick={() => setSelectedMatchSize(optn.key)}
                    >
                      <SelectTexts>
                        <SelectName>{optn.label}</SelectName>
                        <SelectMetaText>{optn.desc}</SelectMetaText>
                      </SelectTexts>
                      <SelectRadio $selected={selected}>{selected ? "✓" : ""}</SelectRadio>
                    </SelectItem>
                  );
                })}
              </SelectList>
            </SelectBody>

            <SelectActions>
              <SelectButton type="button" onClick={() => setShowSizeModal(false)}>
                취소
              </SelectButton>
              <SelectButton
                type="button"
                $primary
                disabled={!selectedMatchSize}
                onClick={() => setShowMatchConfirm(true)}
              >
                매칭 신청
              </SelectButton>
            </SelectActions>
          </SelectCard>
        </Overlay>
      )}

      {/* ✅ 매칭 신청 최종 확인 모달 */}
      {showMatchConfirm && (
        <Overlay onClick={() => !submittingMatch && setShowMatchConfirm(false)}>
          <SelectCard onClick={(e) => e.stopPropagation()}>
            <SelectHeader>
              <SelectTitle>매칭 신청 확인</SelectTitle>
              <SelectClose onClick={() => !submittingMatch && setShowMatchConfirm(false)}>×</SelectClose>
            </SelectHeader>

            <SelectMeta>
              {`${opp?.name || "상대 팀"}에 ${selectedMatchSize.replace("v", " vs ")} 경기를 신청할까요?`}
              <br />
              신청 후 상대 팀이 수락하면 매칭룸에서 라인업·구장·일정을 조율해요.
            </SelectMeta>

            <SelectActions>
              <SelectButton type="button" onClick={() => setShowMatchConfirm(false)} disabled={submittingMatch}>
                취소
              </SelectButton>
              <SelectButton type="button" $primary onClick={handleSubmitMatchRequest} disabled={submittingMatch}>
                {submittingMatch ? "신청 중…" : "매칭 신청"}
              </SelectButton>
            </SelectActions>
          </SelectCard>
        </Overlay>
      )}
    </>
  );
}
