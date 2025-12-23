/* eslint-disable */
// src/pages/matching/MatchAnalysisPage.jsx
// ✅ AI 분석 페이지 하단 "매칭 신청하기" + 내 라인업 선택 모달 추가
// - 내 팀/상대 팀 멤버 3명 미만이면 매칭 신청 막음
// - 내 팀 lineups가 있으면 사용, 없으면 기본 라인업(3/4/5) 1개 생성
// - 신청 시 payload 콘솔 출력 + /matchingmanage sent 탭으로 이동(목업)

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";

import Spinner from "../../components/common/Spinner";
import { WinChip, DrawChip, LoseChip } from "../../components/common/ResultChip";
import { images } from "../../utils/imageAssets";
import { useClubContext } from "../../context/ClubContext";
import { getTeamProfile } from "../../services/teamService";

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

const MATCH_SIZE_LABEL = {
  "3v3": "3 vs 3",
  "4v4": "4 vs 4",
  "5v5": "5 vs 5",
};

function hashInt(str) {
  const s = String(str || "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function mockWinProb(myClubId, oppClubId) {
  const h = hashInt(`${myClubId}::${oppClubId}`);
  return 55 + (h % 24); // 55~78
}

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

  if (norm.length > 0) return norm.slice(0, count);

  const wins = toNum(team?.stats?.wins ?? team?.wins, 0) ?? 0;
  const losses = toNum(team?.stats?.losses ?? team?.losses, 0) ?? 0;
  const draws = toNum(team?.stats?.draws ?? team?.draws, 0) ?? 0;
  const total = wins + losses + draws;
  if (total <= 0) return [];
  const winRate = wins / total;
  const winCount = Math.round(winRate * count);
  const arr = [];
  for (let i = 0; i < winCount && arr.length < count; i += 1) arr.push("W");
  while (arr.length < count) arr.push("L");
  return arr;
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

function pickMediaImages(team, max = 6) {
  const media = Array.isArray(team?.media) ? team.media : [];
  const imgs = media
    .filter((m) => String(m?.type || "") !== "video" && String(m?.type || "") !== "youtube")
    .map((m) => String(m?.url || m?.thumbnailUrl || "").trim())
    .filter(Boolean);

  const logo = String(team?.logoUrl || "").trim();
  const merged = logo ? [logo, ...imgs] : imgs;

  const seen = new Set();
  const out = [];
  merged.forEach((u) => {
    if (seen.has(u)) return;
    seen.add(u);
    out.push(u);
  });
  return out.slice(0, max);
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

function buildDefaultLineupsForMyTeam(team) {
  const members = Array.isArray(team?.members) ? team.members : [];
  if (members.length < 3) return [];

  const ids = members.map((m) => m.userId || m.id).filter(Boolean);
  const key = members.length >= 5 ? "5v5" : members.length === 4 ? "4v4" : "3v3";
  const need = key === "5v5" ? 5 : key === "4v4" ? 4 : 3;

  return [
    {
      id: "default-main",
      name: `${team.name} 기본 라인업`,
      memberIds: ids.slice(0, need),
      matchSizeKey: key,
    },
  ];
}

/* ===================== styled ===================== */

const Page = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 14px 16px calc(24px + 82px) 16px; /* ✅ 하단 CTA 높이만큼 여백 */
  font-family: "GmarketSans", "Gmarket Sans", "GmarketSansTTF", system-ui, -apple-system,
    "Segoe UI", Roboto, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif;
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 18px;
  padding: 14px 14px 16px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
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
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const Divider = styled.div`
  margin: 18px 0;
  height: 1px;
  background: #eef2f7;
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
  background: #4f46e5;
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
  background: rgba(79, 70, 229, 0.08);
  border: 1px solid rgba(79, 70, 229, 0.22);
  color: #3730a3;
`;

const Hint = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
  line-height: 1.5;
`;

const OneCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Mini = styled.div`
  border: 1px solid #eef2f7;
  border-radius: 14px;
  padding: 12px 12px;
  background: #ffffff;
`;

const MiniLabel = styled.div`
  font-size: 13px;
  color: #6b7280;
`;

const TeamCardRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const TeamLogo = styled.img`
  width: 44px;
  height: 44px;
  border-radius: 14px;
  object-fit: cover;
  background: #e5e7eb;
  flex-shrink: 0;
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
  color: #111827;
  line-height: 1.25;
  word-break: keep-all;
  overflow-wrap: anywhere;
`;

const TeamCardRegion = styled.div`
  font-size: 13px;
  color: #6b7280;
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
  color: #111827;
  text-align: ${({ $right }) => ($right ? "right" : "left")};
  white-space: nowrap;
`;

const MidBar = styled.div`
  height: 10px;
  border-radius: 999px;
  background: #eef2ff;
  position: relative;
  overflow: hidden;
`;

const MidFill = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: ${({ $pct }) => $pct}%;
  background: #4f46e5;
  border-radius: 999px;
`;

const LabelRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #6b7280;
`;

const RecentRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
`;

const RecentLabel = styled.div`
  font-size: 13px;
  color: #374151;
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
  background: #d1d5db;
  border: 1px dashed #cbd5e1;
  box-sizing: border-box;
`;

const PlayerList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PlayerRow = styled.div`
  border: 1px solid #eef2f7;
  border-radius: 14px;
  padding: 10px 10px;
  background: #ffffff;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Avatar = styled.img`
  width: 44px;
  height: 44px;
  border-radius: 999px;
  object-fit: cover;
  background: #e5e7eb;
  flex-shrink: 0;
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
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PlayerMeta = styled.div`
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Gallery = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const MediaCard = styled.div`
  width: 100%;
  height: 220px;
  border-radius: 16px;
  overflow: hidden;
  background: #e5e7eb;
`;

const MediaImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const AiBox = styled.div`
  border: 1px solid rgba(79, 70, 229, 0.18);
  background: rgba(79, 70, 229, 0.06);
  border-radius: 16px;
  padding: 12px 12px;
`;

const Bullet = styled.div`
  font-size: 13px;
  color: #374151;
  line-height: 1.6;
`;

const ErrorText = styled.div`
  padding: 20px 16px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
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
  background: linear-gradient(
    to top,
    #ffffff 0%,
    #ffffff 70%,
    rgba(255, 255, 255, 0.85) 100%
  );
  box-shadow: 0 -6px 20px rgba(15, 23, 42, 0.12);
  z-index: 50;
`;

const MatchApplyButton = styled.button`
  width: 100%;
  height: 52px;
  border-radius: 999px;
  border: none;
  background: ${({ disabled }) => (disabled ? "#c7d2fe" : "#4f46e5")};
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
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
`;

const SelectCard = styled.div`
  width: 94%;
  max-width: 420px;
  max-height: 70vh;
  background: #ffffff;
  border-radius: 18px;
  padding: 16px 16px 18px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.4);
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
  color: #111827;
`;

const SelectClose = styled.button`
  border: none;
  background: none;
  font-size: 20px;
  cursor: pointer;
`;

const SelectMeta = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
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
  border-radius: 12px;
  padding: 10px 12px;
  border: 1px solid ${({ $selected }) => ($selected ? "#4f46e5" : "#e5e7eb")};
  background: ${({ $selected }) => ($selected ? "#eef2ff" : "#ffffff")};
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
  color: #111827;
`;

const SelectMetaText = styled.div`
  font-size: 12px;
  color: #4b5563;
`;

const SelectRadio = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid ${({ $selected }) => ($selected ? "#4f46e5" : "#d4d4d8")};
  background: ${({ $selected }) => ($selected ? "#4f46e5" : "#ffffff")};
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
  border: ${({ $primary }) => ($primary ? "none" : "1px solid #e5e7eb")};
  background: ${({ $primary }) => ($primary ? "#4f46e5" : "#ffffff")};
  color: ${({ $primary }) => ($primary ? "#ffffff" : "#111827")};
  font-size: 13px;
  cursor: pointer;
`;

/* ===================== component ===================== */

export default function MatchAnalysisPage() {
  const nav = useNavigate();
  const { clubId } = useParams(); // 상대팀 id
  const { activeTeamId, loading: clubLoading } = useClubContext();

  const [loading, setLoading] = useState(true);
  const [myTeam, setMyTeam] = useState(null);
  const [oppTeam, setOppTeam] = useState(null);
  const [error, setError] = useState("");

  // ✅ 매칭 신청용
  const [showLineupSelectModal, setShowLineupSelectModal] = useState(false);
  const [selectedLineupIdForRequest, setSelectedLineupIdForRequest] = useState(null);

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

    const prob = mockWinProb(myTeam.clubId || myTeam.id, oppTeam.clubId || oppTeam.id);
    const confidence = prob >= 70 ? "높음" : prob >= 60 ? "중간" : "낮음";

    const myRecent = buildRecentResultsFromTeam(myTeam, 5);
    const oppRecent = buildRecentResultsFromTeam(oppTeam, 5);

    const oppMedia = pickMediaImages(oppTeam, 6);

    // ✅ 내 팀 라인업: 실데이터 우선, 없으면 기본 라인업 생성
    const lineupsRaw = Array.isArray(myTeam?.lineups) ? myTeam.lineups : [];
    const lineups = lineupsRaw.length > 0 ? lineupsRaw : buildDefaultLineupsForMyTeam(myTeam);

    return {
      prob,
      confidence,
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
        logoUrl: String(myTeam.logoUrl || "").trim() || images.logo,
        lineups,
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
        media: oppMedia,
        logoUrl: String(oppTeam.logoUrl || "").trim() || images.logo,
      },
    };
  }, [myTeam, oppTeam]);

  const handleMatchRequestClick = () => {
    if (!view) return;

    const myCount = view.my.membersCount || 0;
    const oppCount = view.opp.membersCount || 0;

    if (myCount < 3) {
      alert("매칭 신청을 하려면 내 팀원이 최소 3명 이상이어야 합니다.");
      return;
    }

    if (oppCount < 3) {
      alert("매칭 신청을 하려면 상대 팀원이 최소 3명 이상이어야 합니다.");
      return;
    }

    const lineups = Array.isArray(view.my.lineups) ? view.my.lineups : [];
    if (lineups.length === 0) {
      alert("먼저 라인업을 구성한 뒤 매칭을 신청할 수 있어요.");
      return;
    }

    const firstId = lineups[0].id || lineups[0].name;
    setSelectedLineupIdForRequest(firstId);
    setShowLineupSelectModal(true);
  };

  const handleSubmitMatchRequest = () => {
    if (!view) {
      setShowLineupSelectModal(false);
      return;
    }

    const lineups = Array.isArray(view.my.lineups) ? view.my.lineups : [];
    if (!lineups.length || !selectedLineupIdForRequest) {
      setShowLineupSelectModal(false);
      return;
    }

    const lineup =
      lineups.find((lu) => (lu.id || lu.name) === selectedLineupIdForRequest) || lineups[0];

    const memberIds = Array.isArray(lineup.memberIds) ? lineup.memberIds : [];
    const matchSizeKey = String(lineup.matchSizeKey || "5v5");

    const payload = {
      myClubId: String(view.my.clubId),
      opponentClubId: String(view.opp.clubId),
      opponentName: view.opp.name,
      lineupId: lineup.id || "",
      lineupName: lineup.name || "",
      lineupMatchSizeKey: matchSizeKey,
      lineupMemberIds: memberIds,
      createdFrom: "analysis",
    };

    console.log("📡 매칭 신청 payload (임시):", payload);

    setShowLineupSelectModal(false);
    nav("/matchingmanage", { state: { initialTab: "sent", payload } });
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
            </TitleCol>
          </TopRow>

          <Divider />

          <OneCol>
            <Mini>
              <MiniLabel>내 팀</MiniLabel>
              <TeamCardRow style={{ marginTop: 10 }}>
                <TeamLogo src={my.logoUrl} alt={my.name} />
                <TeamCardTexts>
                  <TeamCardName>{my.name}</TeamCardName>
                  <TeamCardRegion>{my.region || "지역 미지정"}</TeamCardRegion>
                </TeamCardTexts>
              </TeamCardRow>
            </Mini>

            <Mini>
              <MiniLabel>상대 팀</MiniLabel>
              <TeamCardRow style={{ marginTop: 10 }}>
                <TeamLogo src={opp.logoUrl} alt={opp.name} />
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

            <Hint>내 팀 / 상대 팀 선수 정보를 한 줄씩 보여줘요.</Hint>

            <SectionTitleStrong style={{ marginTop: 6 }}>내 팀</SectionTitleStrong>
            <PlayerList>
              {my.members.map((p) => {
                const avatar =
                  String(p?.avatarUrl || "").trim() ||
                  String(p?.photoUrl || "").trim() ||
                  images.profileDefault ||
                  images.logo;

                const pos = String(p?.mainPosition || "").trim();
                const posKo = POSITION_LABEL[pos] || "포지션";
                const skill = String(p?.skillLevel || "").trim();
                const skillKo = SKILL_LABEL[skill] || "실력";

                const height = p.heightCm ? `${p.heightCm}cm` : "";
                const weight = p.weightKg ? `${p.weightKg}kg` : "";

                const meta = `${posKo} · ${skillKo}${height ? ` · ${height}` : ""}${weight ? ` · ${weight}` : ""}`;

                return (
                  <PlayerRow key={p.userId || p.id}>
                    <Avatar src={avatar} alt={p.nickname || p.name || "player"} />
                    <PlayerCol>
                      <PlayerName>{p.nickname || p.name || "선수"}</PlayerName>
                      <PlayerMeta>{meta}</PlayerMeta>
                    </PlayerCol>
                  </PlayerRow>
                );
              })}
            </PlayerList>

            <SectionTitleStrong style={{ marginTop: 10 }}>상대 팀</SectionTitleStrong>
            <PlayerList>
              {opp.members.map((p) => {
                const avatar =
                  String(p?.avatarUrl || "").trim() ||
                  String(p?.photoUrl || "").trim() ||
                  images.profileDefault ||
                  images.logo;

                const pos = String(p?.mainPosition || "").trim();
                const posKo = POSITION_LABEL[pos] || "포지션";
                const skill = String(p?.skillLevel || "").trim();
                const skillKo = SKILL_LABEL[skill] || "실력";

                const height = p.heightCm ? `${p.heightCm}cm` : "";
                const weight = p.weightKg ? `${p.weightKg}kg` : "";

                const meta = `${posKo} · ${skillKo}${height ? ` · ${height}` : ""}${weight ? ` · ${weight}` : ""}`;

                return (
                  <PlayerRow key={p.userId || p.id}>
                    <Avatar src={avatar} alt={p.nickname || p.name || "player"} />
                    <PlayerCol>
                      <PlayerName>{p.nickname || p.name || "선수"}</PlayerName>
                      <PlayerMeta>{meta}</PlayerMeta>
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
                <SectionTitleStrong>팀 사진</SectionTitleStrong>
              </SectionHeadLeft>
              <SectionBadge>{opp.media.length > 0 ? `${opp.media.length}장` : "1장"}</SectionBadge>
            </SectionHead>

            <Hint>상대 팀의 미디어를 리포트 형태로 보여줘요.</Hint>

            <Gallery>
              {opp.media.length > 0 ? (
                opp.media.map((url) => (
                  <MediaCard key={url}>
                    <MediaImg src={url} alt="team media" />
                  </MediaCard>
                ))
              ) : (
                <MediaCard>
                  <MediaImg src={opp.logoUrl} alt="team logo" />
                </MediaCard>
              )}
            </Gallery>
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
              <Bullet>
                • {opp.name}와의 매치업은 <b>{view.prob}%</b> 확률로 승리 가능성이 있어요.
              </Bullet>
              <Bullet>• 평균 키/멤버 수/승률/가드 비중을 종합해 전개를 예측합니다.</Bullet>
              <Bullet>• 데이터가 쌓이면 선수 스탯 기반으로 더 정교한 분석이 가능합니다.</Bullet>
            </AiBox>
          </Section>
        </Card>
      </Page>

      {/* ✅ 하단 매칭 신청하기 CTA */}
      <BottomCTAWrap>
        <MatchApplyButton type="button" onClick={handleMatchRequestClick}>
          🏀 매칭 신청하기
        </MatchApplyButton>
      </BottomCTAWrap>

      {/* ✅ 내 라인업 선택 모달 */}
      {showLineupSelectModal && (
        <Overlay onClick={() => setShowLineupSelectModal(false)}>
          <SelectCard onClick={(e) => e.stopPropagation()}>
            <SelectHeader>
              <SelectTitle>어떤 라인업으로 매칭할까요?</SelectTitle>
              <SelectClose onClick={() => setShowLineupSelectModal(false)}>×</SelectClose>
            </SelectHeader>

            <SelectMeta>내 팀 라인업을 선택해 주세요.</SelectMeta>

            <SelectBody>
              <SelectList>
                {my.lineups.map((lu) => {
                  const idKey = lu.id || lu.name;
                  const selected = idKey === selectedLineupIdForRequest;

                  const sizeLabel = MATCH_SIZE_LABEL[lu.matchSizeKey] || lu.matchSizeKey || "";
                  const count = Array.isArray(lu.memberIds) ? lu.memberIds.length : 0;

                  return (
                    <SelectItem
                      key={idKey}
                      type="button"
                      $selected={selected}
                      onClick={() => setSelectedLineupIdForRequest(idKey)}
                    >
                      <SelectTexts>
                        <SelectName>{lu.name}</SelectName>
                        <SelectMetaText>
                          {count}명 · {sizeLabel}
                        </SelectMetaText>
                      </SelectTexts>
                      <SelectRadio $selected={selected}>{selected ? "✓" : ""}</SelectRadio>
                    </SelectItem>
                  );
                })}
              </SelectList>
            </SelectBody>

            <SelectActions>
              <SelectButton type="button" onClick={() => setShowLineupSelectModal(false)}>
                취소
              </SelectButton>
              <SelectButton type="button" $primary onClick={handleSubmitMatchRequest}>
                매칭 신청
              </SelectButton>
            </SelectActions>
          </SelectCard>
        </Overlay>
      )}
    </>
  );
}
