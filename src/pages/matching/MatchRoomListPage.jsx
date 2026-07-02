/* eslint-disable */
// src/pages/matching/MatchRoomListPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";
import { FiMessageSquare } from "react-icons/fi";
import { images } from "../../utils/imageAssets";
import Spinner from "../../components/common/Spinner";
import { loadMatchRoomListPageData, listMyReviewedMatchIds } from "../../services/matchRoomService";
import useMatchRoomUnread from "../../hooks/useMatchRoomUnread";
import { listAllTeamsForRanking } from "../../services/teamRankingService";
import { useClub } from "../../hooks/useClub";
import { useAuth } from "../../hooks/useAuth";
import { roomNeedsAttention } from "../../utils/matchAttention";
import EmptyState from "../../components/common/EmptyState";
import MatchCalendar from "../../components/matchRoom/MatchCalendar";

/* ==================== 헬퍼 ==================== */

const toStr = (v) => String(v || "").trim();

// 경기 형식(3v3/4v4/5v5…) → "3 vs 3" (몇대몇)
const fmtMatchSize = (k) => {
  const m = String(k || "").toLowerCase().match(/^(\d+)v(\d+)$/);
  return m ? `${m[1]} vs ${m[2]}` : "";
};
// 여러 조각을 가운뎃점으로 이어붙임(빈 값 제외)
const joinDot = (arr) => arr.filter(Boolean).join("  ·  ");

const formatKoreanDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const day = dayNames[d.getDay()];
  const hour = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${month}.${date} (${day}) ${hour}:${min}`;
};

const formatKoreanDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const day = dayNames[d.getDay()];
  return `${month}.${date} (${day})`;
};

// 경기 날짜까지 D-day (당일 D-DAY, 미래 D-N, 과거 D+N)
const formatDday = (iso) => {
  if (!iso) return "";
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return "";
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(target) - startOfDay(new Date())) / 86400000);
  if (diffDays === 0) return "D-DAY";
  return diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`;
};

const toDateAny = (v) => {
  if (!v) return null;
  if (typeof v?.toDate === "function") {
    try {
      return v.toDate();
    } catch (e) {
      return null;
    }
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// 매칭 성사 시각: 오늘=오전/오후 h:mm, 어제="어제", 올해=M.D, 그 외=YYYY.M.D
const formatMatchedTime = (v) => {
  const d = toDateAny(v);
  if (!d) return "";
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 0) {
    let h = d.getHours();
    const ampm = h < 12 ? "오전" : "오후";
    h %= 12;
    if (h === 0) h = 12;
    return `${ampm} ${h}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  if (diffDays === 1) return "어제";
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}.${d.getDate()}`;
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
};

// 조율 진행 단계 (라인업 확정 → 구장·일정 제안 → [제휴구장은 결제] → 확정)
const buildAdjustSteps = (room) => {
  const lineupDone = !!room?.myLineupConfirmed && !!room?.oppLineupConfirmed;
  // 구장·일정은 제안 시 함께 설정됨(proposeMatchSchedule) → proposed/confirmed면 완료
  const proposeDone = !!toStr(room?.fieldAddress) && !!room?.scheduledAt;
  const confirmDone = toStr(room?.status) === "confirmed";
  const pb = room?.partnerBooking || null;
  // ✅ 제휴구장 예약이면 '결제' 단계 추가
  if (pb) {
    const payDone = pb.payState === "paid" || pb.finalized === true || confirmDone;
    return [
      { label: "라인업", done: lineupDone },
      { label: "구장·일정", done: proposeDone },
      { label: "결제", done: payDone },
      { label: "확정", done: confirmDone },
    ];
  }
  return [
    { label: "라인업", done: lineupDone },
    { label: "구장·일정", done: proposeDone },
    { label: "확정", done: confirmDone },
  ];
};

const getVsStatus = (room) => {
  const { status, scheduledAt, myScore, oppScore } = room || {};
  const resultState = toStr(room?.resultState);
  const pb = room?.partnerBooking || null;
  const lineupsDone = !!room?.myLineupConfirmed && !!room?.oppLineupConfirmed;

  // 조율중: 단계별 대기 라벨
  if (status === "accepted") {
    return lineupsDone
      ? { text: "구장·일정 제안 대기", tone: "accepted" }
      : { text: "라인업 확정 대기", tone: "accepted" };
  }
  if (status === "proposed") {
    if (pb) {
      // 제휴구장 예약: 수락 → 결제 흐름
      if (!pb.accepted) return { text: "상대 수락 대기", tone: "proposed" };
      if (pb.payState !== "paid" && !pb.finalized) {
        return { text: pb.payState === "half" ? "결제 대기 (1/2)" : "결제 대기", tone: "accepted" };
      }
      return { text: "확정 대기", tone: "proposed" };
    }
    return { text: "확정 대기", tone: "proposed" };
  }

  if (status === "confirmed") {
    if (scheduledAt) {
      const label = formatKoreanDateTime(scheduledAt);
      return { text: `${label} 예정`, tone: "confirmed" };
    }
    return { text: "확정됨(시간 미정)", tone: "confirmed" };
  }

  if (status === "finished") {
    const label = scheduledAt ? formatKoreanDate(scheduledAt) : "종료";
    if (resultState === "void") {
      return { text: `${label} · 무효 (전적 미반영)`, tone: "cancelled" };
    }
    if (myScore != null && oppScore != null) {
      const isWin = myScore > oppScore;
      const isDraw = myScore === oppScore;
      const resultWord = isDraw ? "무" : isWin ? "승" : "패";
      return { text: `${label} · ${myScore} : ${oppScore} ${resultWord}`, tone: "finished" };
    }
    return { text: `${label} · 결과 입력 대기`, tone: "finished" };
  }

  if (status === "cancelled") return { text: "취소된 매칭", tone: "cancelled" };

  return { text: "상태 미지정", tone: "default" };
};

const clampNumber = (v, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isFinite(n)) return n;
  return fallback;
};

// 팀 랭킹 키 (팀 랭킹 페이지와 동일 기준: 점수→승률→승수→경기수→이름)
const teamPerfKey = (team) => {
  const s = team?.stats || {};
  const wins = clampNumber(typeof s.wins === "number" ? s.wins : s.totalWins, 0);
  const losses = clampNumber(typeof s.losses === "number" ? s.losses : s.totalLoses, 0);
  const draws = clampNumber(typeof s.draws === "number" ? s.draws : s.totalDraws, 0);
  const total = wins + losses + draws;
  const points = wins * 5 + draws * 2 + losses * 1;
  const rawRate = typeof s.winRate === "number" ? s.winRate : total > 0 ? wins / total : 0;
  const winRatePct = Math.max(0, Math.min(100, Math.round(clampNumber(rawRate, 0) * 100)));
  return { points, winRatePct, wins, total, name: toStr(team?.name).toLowerCase() };
};

// 전체 팀을 정렬해 clubId → 순위(1-based) 맵 생성
const buildTeamRankMap = (rows) => {
  const sorted = [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const ka = teamPerfKey(a);
    const kb = teamPerfKey(b);
    if (kb.points !== ka.points) return kb.points - ka.points;
    if (kb.winRatePct !== ka.winRatePct) return kb.winRatePct - ka.winRatePct;
    if (kb.wins !== ka.wins) return kb.wins - ka.wins;
    if (kb.total !== ka.total) return kb.total - ka.total;
    if (ka.name === kb.name) return 0;
    return ka.name > kb.name ? 1 : -1;
  });
  const map = {};
  sorted.forEach((t, idx) => {
    const id = toStr(t?.clubId || t?.id);
    if (id) map[id] = idx + 1;
  });
  return map;
};

const resolveLogoSrc = (team) => {
  const url = toStr(team?.logoUrl || team?.photoUrl);
  if (url) return url;
  return images.teamPlaceholder;
};

/* ==================== 스타일 ==================== */

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#f3f4f6"};
  padding: 8px 0 24px;
  display: flex;
  flex-direction: column;
`;

const Inner = styled.div`
  padding: 0 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const TitleCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 14px 14px 14px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const TitleText = styled.div`
  font-size: 16px;
  color: ${({ theme }) => theme.colors.textStrong};
  font-weight: 600;
`;

const SubText = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* 탭별 컬러 히어로 타이틀 (매칭하기 카드처럼 · 우측 3D) */
const TabHero = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  padding: 16px 92px 16px 16px;
  min-height: 74px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  background: ${({ $grad }) => $grad};
  box-shadow: 0 14px 26px -12px ${({ $shadow }) => $shadow};
`;
const TabHeroTitle = styled.div`
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: #ffffff;
`;
const TabHeroSub = styled.div`
  font-size: 12.5px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
`;
const TabHeroDeco = styled.img`
  position: absolute;
  right: -2px;
  bottom: -4px;
  width: 66px;
  height: 66px;
  object-fit: contain;
  transform: rotate(-6deg);
  filter: ${({ $gray }) => ($gray ? "grayscale(1) " : "")}drop-shadow(0 8px 14px rgba(15, 23, 42, 0.28));
  pointer-events: none;
`;

const RoomList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 6px;
`;

const RoomCard = styled.div`
  position: relative;
  width: 100%;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 6px 0;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadows.card};
  overflow: hidden;
`;

// 카드 미확인(반응 필요) 표시 — 우상단 빨간 점
const CardAttnDot = styled.span`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #ff5a5a;
  box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.card};
  z-index: 1;
`;

const MatchHeader = styled.div`
  padding: 9px 14px 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const MatchTitle = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
`;

const VsStatusPill = styled.div`
  padding: 5px 10px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "#f3f4f6"};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 12px;
  white-space: nowrap;
`;

/* 조율중 카드 좌상단 상태 배지 (제안 필요 = 보라, 확정 대기 = 회색) */
const StatusPill = styled.span`
  padding: 4px 11px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  ${({ $tone, theme }) =>
    $tone === "accepted"
      ? `background:${theme.colors.primary}; color:#fff;`
      : `background:${theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "#eef0f3"}; color:${theme.colors.textNormal};`}
`;

/* 조율중 카드 우상단 매칭 성사 시각 */
const HeaderTime = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
`;

/* 조율 진행 단계 행 */
const ProgressRow = styled.div`
  display: flex;
  align-items: center;
  padding: 4px 14px 12px;
`;

const StepItem = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
`;

const StepDot = styled.span`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  ${({ $active, theme }) =>
    $active
      ? `background:${theme.colors.primary}; color:#fff;`
      : `background:${theme.mode === "dark" ? "rgba(255,255,255,0.12)" : "#e5e7eb"}; color:${theme.colors.textWeak};`}
`;

const StepLabel = styled.span`
  font-size: 11px;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.textStrong : theme.colors.textWeak};
  white-space: nowrap;
`;

const StepLine = styled.span`
  flex: 1;
  min-width: 8px;
  height: 2px;
  margin: 0 5px;
  border-radius: 2px;
  background: ${({ $done, theme }) =>
    $done ? theme.colors.primary : theme.mode === "dark" ? "rgba(255,255,255,0.12)" : "#e5e7eb"};
`;

/* 확정 카드: 예약 유형 행 (제휴구장 결제 vs 직접입력) */
const VenueRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;
const VenueBadge = styled.span`
  flex-shrink: 0;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  background: ${({ $partner, theme }) =>
    $partner ? (theme.mode === "dark" ? "rgba(124,92,201,0.22)" : "#efe9ff") : theme.colors.surface};
  color: ${({ $partner, theme }) => ($partner ? "#7c5cc9" : theme.colors.textWeak)};
  border: 1px solid ${({ $partner, theme }) => ($partner ? "transparent" : theme.colors.border)};
`;
const VenueName = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/* 마지막 메시지 + 안 읽은 수 행 */
const MessageRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const MsgIcon = styled(FiMessageSquare)`
  flex-shrink: 0;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const MsgText = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textNormal};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const UnreadBadge = styled.span`
  flex-shrink: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #ff5a5a;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
`;

const TeamName = styled.div`
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/* 좌우 2열 팀 배치 (컴팩트) */
const TeamsRow = styled.div`
  display: flex;
  align-items: stretch;
  padding: 6px 10px 10px;
`;

const TeamCol = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
`;

/* 1~3위: 프로필 위에 로고(왕관) 겹쳐 올리는 래퍼 (홈 랭킹과 동일) */
const ColLogoBox = styled.div`
  position: relative;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
`;

const ColLogo = styled.div`
  width: 46px;
  height: 46px;
  border-radius: 10px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
`;

/* 1~3위 프로필 위에 겹쳐지는 로고 (전체보기 페이지와 동일) */
const CrownImg = styled.img`
  position: absolute;
  /* 큰 로고(46px)/작은 로고(38px) 사진 크기에 비례 */
  top: ${({ $sm }) => ($sm ? "-14px" : "-17px")};
  left: 50%;
  transform: translateX(-50%);
  width: ${({ $sm }) => ($sm ? "23px" : "28px")};
  height: ${({ $sm }) => ($sm ? "23px" : "28px")};
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.18));
`;

/* 팀명(중앙 고정) + 랭킹(그 옆) 한 줄 배치 — 이름이 가운데 칸에 와서 위치가 밀리지 않음 */
const NameRank = styled.div`
  display: grid;
  grid-template-columns: 1fr minmax(0, auto) 1fr;
  align-items: baseline;
  width: 100%;
  column-gap: 4px;
`;

const ColName = styled(TeamName)`
  grid-column: 2;
  justify-self: center;
  min-width: 0;
  max-width: 100%;
  font-weight: 700;
`;

/* 랭킹 — 배경 없이 텍스트만 (1~3위는 보라색) */
const RankText = styled.span`
  grid-column: 3;
  justify-self: start;
  font-size: 11px;
  font-weight: 700;
  color: ${({ $top, theme }) =>
    $top ? theme.colors.primary : theme.colors.textWeak};
  white-space: nowrap;
`;

const VsSep = styled.div`
  flex-shrink: 0;
  align-self: center;
  padding: 0 12px;
  font-size: 14px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.primary};
`;

/* ===== 지난 경기: 섹션 헤더 ===== */
const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 14px 4px 9px;
`;

const SectionEmoji = styled.span`
  font-size: 15px;
  line-height: 1;
`;

const SectionLabel = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme, $muted }) =>
    $muted ? theme.colors.textNormal : theme.colors.textStrong};
`;

const SectionCount = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const SectionCountBadge = styled.span`
  background: #ff5a5a;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 8px;
`;

/* ===== 지난 경기: 공통 카드 상단행 / 미니 팀 ===== */
const CardTopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
`;

const CardDate = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* 지난 경기 카드 상단 좌측 그룹 (구장유형 배지 + 상태/날짜) */
const TopLeftGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

/* 무효 처리된 경기 배지 */
const VoidBadge = styled.span`
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
  white-space: nowrap;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "#f3f4f6"};
  color: ${({ theme }) => theme.colors.textWeak};
`;

const TeamsMini = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 8px;
`;

const MiniTeam = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
`;

const MiniLogoBox = styled.div`
  position: relative;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
`;

const MiniLogo = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 10px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
`;

const MiniLogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const MiniName = styled.span`
  grid-column: 2;
  justify-self: center;
  min-width: 0;
  max-width: 100%;
  font-size: 11.5px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MiniVs = styled.span`
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* ===== 결과 입력 필요 카드 ===== */
const PendingCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 14px;
  padding: 13px 14px;
  margin-bottom: 8px;
`;

const EndedBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme }) => (theme.mode === "dark" ? "#e7c66b" : "#c2890e")};
`;

const ResultInputBtn = styled.button`
  width: 100%;
  margin-top: 12px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 11px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  &:active {
    opacity: 0.85;
  }
`;

/* ===== 완료된 경기 카드 ===== */
const CompletedCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 13px;
  padding: 12px 14px;
  margin-bottom: 8px;
  cursor: pointer;
`;

const ResultBadge = styled.span`
  font-size: 11px;
  font-weight: 700;
  ${({ $outcome, theme }) => {
    const dark = theme.mode === "dark";
    if ($outcome === "win") return `color:${dark ? "#6ee0ab" : "#1e9e70"};`;
    if ($outcome === "lose") return `color:${dark ? "#f87171" : "#dc2626"};`;
    return `color:${dark ? "#b6b6bf" : "#65656e"};`;
  }}
`;

/* 팀원 지난경기: 리뷰 쓰기 버튼 / 리뷰 완료 배지 */
const ReviewBtn = styled.button`
  width: 100%;
  margin-top: 12px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 11px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  &:active { opacity: 0.85; }
`;
const ReviewDoneBadge = styled.span`
  font-size: 11px;
  font-weight: 700;
  color: ${({ theme }) => (theme.mode === "dark" ? "#6ee0ab" : "#1e9e70")};
`;

/* 팀원 지난경기: 정렬/필터 카테고리 바 */
const PastFilterBar = styled.div`
  display: flex;
  gap: 7px;
  margin: 12px 4px 4px;
  flex-wrap: wrap;
`;
const FilterChip = styled.button`
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ $on, theme }) =>
    $on ? theme.colors.primary : theme.mode === "dark" ? theme.colors.surface : "#fff"};
  color: ${({ $on, theme }) => ($on ? "#fff" : theme.colors.textNormal)};
  border-radius: 999px;
  padding: 7px 13px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  &:active { transform: translateY(1px); }
`;

/* 캘린더/리스트 보기 토글 (세그먼트) */
const ViewToggle = styled.div`
  display: inline-flex;
  align-self: flex-start;
  gap: 3px;
  padding: 3px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "#eef0f3"};
  margin: 2px 4px 2px;
`;
const ToggleBtn = styled.button`
  border: none;
  border-radius: 999px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  background: ${({ $on, theme }) => ($on ? theme.colors.card : "transparent")};
  color: ${({ $on, theme }) => ($on ? theme.colors.textStrong : theme.colors.textWeak)};
  box-shadow: ${({ $on, theme }) => ($on ? theme.shadows.card : "none")};
`;

const ScoreMid = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 9px;
`;

const ScoreNum = styled.span`
  font-size: 18px;
  font-weight: 800;
  ${({ $tone, theme }) => {
    const dark = theme.mode === "dark";
    // 내 팀 점수: 승=초록, 패=빨강. 무승부/상대 점수=기본 글씨색
    if ($tone === "win") return `color:${dark ? "#6ee0ab" : "#1e9e70"};`;
    if ($tone === "lose") return `color:${dark ? "#f87171" : "#dc2626"};`;
    return `color:${theme.colors.textStrong};`;
  }}
`;

const ScoreColon = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* 점수 미입력(팀장이 아직 결과 입력 안 함) — 점수 자리에 '결과 대기중' */
const WaitingLabel = styled.span`
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  white-space: nowrap;
  color: ${({ theme }) => (theme.mode === "dark" ? "#fcd34d" : "#b45309")};
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(217,119,6,0.16)" : "#fef3c7")};
`;

/* ===== 취소된 경기 카드 ===== */
const CancelledCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 13px;
  padding: 12px 14px;
  margin-bottom: 8px;
  cursor: pointer;
`;

const CancelTopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const CancelTopLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

const CancelChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "#eef0f3")};
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Chevron = styled.span`
  flex-shrink: 0;
  font-size: 18px;
  line-height: 1;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const CancelTeams = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px; /* 상위 3위 왕관이 위로 떠도 잘리지 않게 여유 */
`;

const CancelTeamCell = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  justify-content: ${({ $align }) => ($align === "right" ? "flex-end" : "flex-start")};
`;

/* 왕관을 로고 위에 띄우기 위한 포지셔닝 박스 */
const CancelLogoBox = styled.div`
  position: relative;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
`;

const CancelTeamLogo = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  background: ${({ theme }) => (theme.mode === "dark" ? theme.colors.surface : "#f3f4f6")};
`;

const CancelTeamName = styled.span`
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CancelRank = styled.span`
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 700;
  color: ${({ $top, theme }) => ($top ? theme.colors.primary : theme.colors.textWeak)};
`;

const CancelBottomRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
`;

const CancelReasonGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

const ReasonTypeBadge = styled.span`
  flex-shrink: 0;
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "#f1f3f5")};
  color: ${({ theme }) => theme.colors.textNormal};
`;

const ReasonText = styled.span`
  min-width: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textNormal};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RefundBadge = styled.span`
  flex-shrink: 0;
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  ${({ $tone, theme }) => {
    const dark = theme.mode === "dark";
    if ($tone === "refund")
      return `background:${dark ? "rgba(139,92,246,0.18)" : "#ede9fe"}; color:${dark ? "#c4b5fd" : "#7c3aed"};`;
    return `background:${dark ? "rgba(255,255,255,0.06)" : "#f1f3f5"}; color:${theme.colors.textWeak};`;
  }}
`;

const StateWrap = styled.div`
  padding: 32px 4px;
  display: flex;
  justify-content: center;
`;

const EmptyText = styled.div`
  padding: 18px 4px 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  text-align: center;
`;

/* ==================== 앱2 스타일 썸네일형 카드 ==================== */
/* 좌측 상대팀 프로필 썸네일 + 우측 정보 (조율중/확정/지난/취소 공통) */
const ThumbCard = styled.div`
  position: relative;
  display: flex;
  gap: 12px;
  width: 100%;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 16px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: 12px;
  cursor: pointer;
  overflow: hidden;
  &:active {
    transform: translateY(1px);
  }
`;

const Thumb = styled.div`
  position: relative;
  width: 76px;
  height: 76px;
  flex: 0 0 auto;
  align-self: flex-start;
`;

const ThumbInner = styled.div`
  width: 76px;
  height: 76px;
  border-radius: 16px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
`;

const ThumbImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

/* 1~3위 상대팀: 썸네일 위 왕관 */
const ThumbCrown = styled.img`
  position: absolute;
  top: -15px;
  left: 50%;
  transform: translateX(-50%);
  width: 27px;
  height: 27px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.18));
`;

const Body = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  justify-content: center;
`;

const BodyTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const OppName = styled.div`
  min-width: 0;
  font-size: 15.5px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/* 카드 2번째 줄: 🏀 몇대몇 · 핵심정보 */
const SubLine = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textNormal};
  & > span {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  & b {
    color: ${({ theme }) => theme.colors.textStrong};
    font-weight: 700;
  }
`;

/* 몇대몇 앞 농구공 3D (받은요청 페이지와 통일) */
const SubBall = styled.img`
  width: 17px;
  height: 17px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.16));
`;

const VsLine = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  & b {
    color: ${({ theme }) => theme.colors.textNormal};
    font-weight: 700;
  }
`;

/* 썸네일 카드 하단 부가정보 행 (구장/사유/환불 등) */
const DetailRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

/* 지난 경기 점수 행 (좌측 정렬) */
const ScoreRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ScoreCaption = styled.span`
  margin-left: 4px;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* ==================== 페이지 ==================== */

export default function MatchRoomListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { club, isTeamLeader } = useClub();
  const myClubId = toStr(club?.clubId || club?.id);
  const { firebaseUser, userDoc } = useAuth();
  const myUid = toStr(firebaseUser?.uid || userDoc?.uid || userDoc?.id);

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rankMap, setRankMap] = useState({});
  // 팀원 지난경기: 내가 리뷰한 경기 id 집합 + 정렬/필터 카테고리
  const [reviewedSet, setReviewedSet] = useState(() => new Set());
  const [pastView, setPastView] = useState("recent"); // "recent" | "oldest" | "needReview"
  // 확정/지난 탭 보기 모드: 캘린더 ⇄ 리스트
  const [view, setView] = useState("calendar"); // "calendar" | "list"
  // 카드 마지막 메시지 + 안 읽은 메시지 수 (실시간)
  const { byRoom: chatMeta } = useMatchRoomUnread({ clubId: myClubId, uid: myUid });

  const tab = useMemo(() => {
    const sp = new URLSearchParams(location.search || "");
    const raw = toStr(sp.get("tab")).toLowerCase();

    // 홈에서 넘기는 값: ongoing | confirmed | past | cancelled
    if (raw === "ongoing" || raw === "adjusting") return "adjusting";
    if (raw === "confirmed") return "confirmed";
    if (raw === "past" || raw === "finished") return "past";
    if (raw === "cancelled" || raw === "canceled") return "cancelled";

    // 파라미터 없으면 전체(섹션 3개를 아래로 쭉)
    return "all";
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const data = await loadMatchRoomListPageData(myClubId);
        if (cancelled) return;
        const nextRooms = Array.isArray(data?.rooms) ? data.rooms : [];
        setRooms(nextRooms);
      } catch (e) {
        console.error("[MatchRoomListPage] load failed", e);
        if (!cancelled) setRooms([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [myClubId]);

  // 카드에 표시할 팀 순위 — 전체 팀 랭킹을 한 번 로드해 clubId→순위 맵 생성
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { rows } = await listAllTeamsForRanking();
        if (alive) setRankMap(buildTeamRankMap(rows));
      } catch (e) {
        console.warn("[MatchRoomListPage] rank load failed:", e?.message || e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 확정 경기는 종료시각(시작 + 경기시간)이 지나면 '지난 경기'로 이동 (2-9)
  const isEnded = (r) => {
    const start = r?.scheduledAt ? new Date(r.scheduledAt).getTime() : NaN;
    if (!Number.isFinite(start)) return false;
    const durMin = Number(r?.durationMin) > 0 ? Number(r.durationMin) : 120; // 기본 2시간
    return Date.now() >= start + durMin * 60 * 1000;
  };

  // 정렬용: 최신 시간 먼저 (scheduledAt → updatedAt → createdAt)
  const toMs = (v) => {
    if (!v) return 0;
    if (typeof v === "object" && typeof v.toDate === "function") {
      try {
        return v.toDate().getTime();
      } catch (e) {
        return 0;
      }
    }
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  };
  const byLatest = (a, b) =>
    (toMs(b?.scheduledAt) || toMs(b?.updatedAt) || toMs(b?.createdAt)) -
    (toMs(a?.scheduledAt) || toMs(a?.updatedAt) || toMs(a?.createdAt));

  // 확정 경기는 오름차순(곧 열릴 경기가 위)
  const bySoonest = (a, b) =>
    (toMs(a?.scheduledAt) || toMs(a?.updatedAt) || toMs(a?.createdAt)) -
    (toMs(b?.scheduledAt) || toMs(b?.updatedAt) || toMs(b?.createdAt));

  const adjustingRooms = useMemo(
    () =>
      rooms
        .filter((r) => r.status === "accepted" || r.status === "proposed")
        .sort(byLatest),
    [rooms]
  );

  const confirmedRooms = useMemo(
    () =>
      rooms.filter((r) => r.status === "confirmed" && !isEnded(r)).sort(bySoonest),
    [rooms]
  );

  const pastRooms = useMemo(
    () =>
      rooms
        .filter(
          (r) => r.status === "finished" || (r.status === "confirmed" && isEnded(r))
        )
        .sort(byLatest),
    [rooms]
  );

  // 팀원: 지난 경기 중 내가 리뷰한 경기 id 로드 (리뷰 안 쓴 카드에 '리뷰 쓰기' 버튼 노출용)
  useEffect(() => {
    if (isTeamLeader || !myUid) return;
    const ids = pastRooms.map((r) => toStr(r.id)).filter(Boolean);
    if (ids.length === 0) {
      setReviewedSet(new Set());
      return;
    }
    let alive = true;
    listMyReviewedMatchIds({ matchIds: ids, raterUid: myUid })
      .then((set) => { if (alive) setReviewedSet(set || new Set()); })
      .catch(() => { if (alive) setReviewedSet(new Set()); });
    return () => { alive = false; };
  }, [pastRooms, myUid, isTeamLeader]);

  // 팀원 지난경기 정렬/필터 적용 목록
  const memberPastList = useMemo(() => {
    if (pastView === "needReview") {
      return pastRooms.filter((r) => !reviewedSet.has(toStr(r.id))); // 이미 byLatest 정렬
    }
    if (pastView === "oldest") {
      return [...pastRooms].sort(bySoonest);
    }
    return pastRooms; // recent (byLatest)
  }, [pastRooms, pastView, reviewedSet]);

  const cancelledRooms = useMemo(
    () => rooms.filter((r) => r.status === "cancelled").sort(byLatest),
    [rooms]
  );

  // 지난 경기 → 결과 입력 필요 / 상대 승인 대기중 / 완료(finished) 3분류
  // - 승인 대기중: 결과를 제출했고 상대 팀 승인을 기다리는 상태(resultState === "waiting_accept")
  const approvalPendingRooms = useMemo(
    () =>
      pastRooms.filter(
        (r) => toStr(r?.status) !== "finished" && toStr(r?.resultState) === "waiting_accept"
      ),
    [pastRooms]
  );
  const resultPendingRooms = useMemo(
    () =>
      pastRooms.filter(
        (r) => toStr(r?.status) !== "finished" && toStr(r?.resultState) !== "waiting_accept"
      ),
    [pastRooms]
  );
  const completedRooms = useMemo(
    () => pastRooms.filter((r) => toStr(r?.status) === "finished"),
    [pastRooms]
  );

  const titleText = useMemo(() => {
    if (tab === "adjusting") return "조율중 경기";
    if (tab === "confirmed") return "확정된 경기";
    if (tab === "past") return "지난 경기";
    if (tab === "cancelled") return "취소된 경기";
    return "매칭룸";
  }, [tab]);

  const subText = useMemo(() => {
    if (tab === "adjusting") return `조율중인 경기 ${adjustingRooms.length}개`;
    if (tab === "confirmed") return `확정된 경기 ${confirmedRooms.length}개`;
    if (tab === "past") return `지난 경기 ${pastRooms.length}개`;
    if (tab === "cancelled") return `취소된 경기 ${cancelledRooms.length}개`;
    return `조율중 ${adjustingRooms.length} · 확정 ${confirmedRooms.length} · 지난경기 ${pastRooms.length}`;
  }, [tab, adjustingRooms.length, confirmedRooms.length, pastRooms.length, cancelledRooms.length]);

  const handleClickRoom = (roomId) => {
    navigate(`/match-roomdetail/${roomId}`);
  };

  const renderTeamCol = ({ team, fallbackName = "팀" }) => {
    const name = toStr(team?.name) || fallbackName;
    const logoSrc = resolveLogoSrc(team);
    const clubId = toStr(team?.clubId || team?.id);
    const rank = rankMap[clubId];
    const isTop = rank >= 1 && rank <= 3;

    return (
      <TeamCol>
        <ColLogoBox>
          {isTop ? <CrownImg src={images.logo} alt={`${rank}위`} /> : null}
          <ColLogo>
            <LogoImg src={logoSrc} alt={name} />
          </ColLogo>
        </ColLogoBox>
        <NameRank>
          <ColName title={name}>{name}</ColName>
          {rank ? <RankText $top={isTop}>{rank}위</RankText> : null}
        </NameRank>
      </TeamCol>
    );
  };


  // 상대팀 프로필 썸네일 (앱2 상품 이미지 자리) — 1~3위면 왕관
  const renderThumb = (team, fallbackName = "상대팀") => {
    const name = toStr(team?.name) || fallbackName;
    const logoSrc = resolveLogoSrc(team);
    const rank = rankMap[toStr(team?.clubId || team?.id)];
    const isTop = rank >= 1 && rank <= 3;
    return (
      <Thumb>
        {isTop ? <ThumbCrown src={images.logo} alt={`${rank}위`} /> : null}
        <ThumbInner>
          <ThumbImg src={logoSrc} alt={name} />
        </ThumbInner>
      </Thumb>
    );
  };

  const renderRoomCard = (room) => {
    const { myTeam, oppTeam } = room || {};
    const status = getVsStatus(room);
    const { text } = status;
    // 지난 경기(경기 종료 or finished) = 상태칩 숨김
    const isPast = isEnded(room) || toStr(room?.status) === "finished";
    // 조율중(제안 필요/확정 대기) 카드 = 새 구성(상태 배지 + 성사 시각 + 진행 단계 + 마지막 메시지)
    const isAdjusting = room?.status === "accepted" || room?.status === "proposed";
    const needsAttn = roomNeedsAttention(room, { myUid, myClubId });

    const oppName = toStr(oppTeam?.name) || "상대팀";
    const oppRank = rankMap[toStr(oppTeam?.clubId || oppTeam?.id)];
    const oppRankLabel = oppRank ? ` · ${oppRank}위` : "";
    const sizeLabel = fmtMatchSize(room?.matchSizeKey);

    if (isAdjusting) {
      const matchedAt = formatMatchedTime(room?.acceptedAt || room?.createdAt);
      return (
        <ThumbCard key={room.id} onClick={() => handleClickRoom(room.id)} role="button" tabIndex={0}>
          {needsAttn && <CardAttnDot />}
          {renderThumb(oppTeam)}
          <Body>
            <BodyTop>
              <OppName>{oppName}{oppRankLabel}</OppName>
              <StatusPill $tone={status.tone}>{text || "조율중"}</StatusPill>
            </BodyTop>
            <SubLine>
              <SubBall src={images.emoji3dBasketball} alt="" />
              <span>{joinDot([sizeLabel, matchedAt && `성사 ${matchedAt}`])}</span>
            </SubLine>
          </Body>
        </ThumbCard>
      );
    }

    // 확정 / 기타
    const dday = room?.scheduledAt && toStr(room?.status) !== "cancelled" ? formatDday(room.scheduledAt) : "";
    const whenLabel = room?.scheduledAt ? formatKoreanDateTime(room.scheduledAt) : "";
    return (
      <ThumbCard key={room.id} onClick={() => handleClickRoom(room.id)} role="button" tabIndex={0}>
        {needsAttn && <CardAttnDot />}
        {renderThumb(oppTeam)}
        <Body>
          <BodyTop>
            <OppName>{oppName}{oppRankLabel}</OppName>
            {dday ? (
              <VsStatusPill>{dday}</VsStatusPill>
            ) : !isPast ? (
              <VsStatusPill>{text || "일정 조율중"}</VsStatusPill>
            ) : null}
          </BodyTop>
          <SubLine>
            <SubBall src={images.emoji3dBasketball} alt="" />
            <span>{joinDot([sizeLabel, whenLabel])}</span>
          </SubLine>
        </Body>
      </ThumbCard>
    );
  };

  // 지난 경기 카드용 미니 팀(로고 + 팀명)
  const renderMiniTeam = (team, fallbackName) => {
    const name = toStr(team?.name) || fallbackName;
    const logoSrc = resolveLogoSrc(team);
    const rank = rankMap[toStr(team?.clubId || team?.id)];
    const isTop = rank >= 1 && rank <= 3;
    return (
      <MiniTeam>
        <MiniLogoBox>
          {isTop ? <CrownImg $sm src={images.logo} alt={`${rank}위`} /> : null}
          <MiniLogo>
            <MiniLogoImg src={logoSrc} alt={name} />
          </MiniLogo>
        </MiniLogoBox>
        <NameRank>
          <MiniName title={name}>{name}</MiniName>
          {rank ? <RankText $top={isTop}>{rank}위</RankText> : null}
        </NameRank>
      </MiniTeam>
    );
  };

  // 결과 입력이 필요한 / 상대 승인 대기중인 지난 경기 카드
  const renderPendingCard = (room) => {
    const { myTeam, oppTeam } = room || {};
    const dateLabel = room?.scheduledAt ? formatKoreanDateTime(room.scheduledAt) : "";
    const waiting = toStr(room?.resultState) === "waiting_accept";
    const oppName = toStr(oppTeam?.name) || "상대팀";
    const sizeLabel = fmtMatchSize(room?.matchSizeKey);
    return (
      <ThumbCard key={room.id} onClick={() => handleClickRoom(room.id)} role="button" tabIndex={0}>
        {renderThumb(oppTeam)}
        <Body>
          <BodyTop>
            <OppName>{oppName}</OppName>
            <EndedBadge>{waiting ? "🕓 승인 대기" : "⏱ 결과 입력"}</EndedBadge>
          </BodyTop>
          <SubLine>
            <SubBall src={images.emoji3dBasketball} alt="" />
            <span>{joinDot([sizeLabel, dateLabel])}</span>
          </SubLine>
          <ResultInputBtn type="button" onClick={(e) => { e.stopPropagation(); handleClickRoom(room.id); }}>
            ✏️ {waiting ? "결과 확인하기" : "경기 결과 입력하기"}
          </ResultInputBtn>
        </Body>
      </ThumbCard>
    );
  };

  // 결과가 확정된(완료된) 지난 경기 카드
  // opts.memberReview=true 면 팀원용: 내가 리뷰 안 쓴 경기엔 '리뷰 쓰기' 버튼, 쓴 경기엔 '리뷰 완료'
  const renderCompletedCard = (room, opts = {}) => {
    const { myTeam, oppTeam } = room || {};
    const dateLabel = room?.scheduledAt ? formatKoreanDateTime(room.scheduledAt) : "";
    const reviewed = reviewedSet.has(toStr(room?.id));

    // 무효 처리된 경기(양 팀 결과 미입력 → 자동 무효): 점수 없음 · 전적 미반영
    const isVoid = toStr(room?.resultState) === "void";

    // myTeam=뷰어, oppTeam=상대. 점수는 서비스에서 이미 조회 팀 관점(myScore=우리팀)으로 정렬됨
    const leftScore = room?.myScore;
    const rightScore = room?.oppScore;
    const hasScore = leftScore != null && rightScore != null;
    const outcome = !hasScore
      ? null
      : leftScore > rightScore
      ? "win"
      : leftScore < rightScore
      ? "lose"
      : "draw";

    const oppName = toStr(oppTeam?.name) || "상대팀";
    const sizeLabel = fmtMatchSize(room?.matchSizeKey);
    const scoreText = isVoid
      ? "무효"
      : hasScore
      ? `${leftScore} : ${rightScore}`
      : toStr(room?.status) !== "finished"
      ? "결과 대기중"
      : "- : -";
    return (
      <ThumbCard key={room.id} onClick={() => handleClickRoom(room.id)} role="button" tabIndex={0}>
        {renderThumb(oppTeam)}
        <Body>
          <BodyTop>
            <OppName>{oppName}</OppName>
            {isVoid ? (
              <VoidBadge>무효</VoidBadge>
            ) : opts.memberReview && reviewed ? (
              <ReviewDoneBadge>✓ 리뷰 완료</ReviewDoneBadge>
            ) : outcome ? (
              <ResultBadge $outcome={outcome}>
                {outcome === "win" ? "승리" : outcome === "lose" ? "패배" : "무승부"}
              </ResultBadge>
            ) : null}
          </BodyTop>
          <SubLine>
            <SubBall src={images.emoji3dBasketball} alt="" />
            <span>{joinDot([sizeLabel, scoreText, dateLabel])}</span>
          </SubLine>
          {opts.memberReview && !reviewed && (
            <ReviewBtn
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClickRoom(room.id); }}
            >
              ✏️ 상대 팀 리뷰 쓰기
            </ReviewBtn>
          )}
        </Body>
      </ThumbCard>
    );
  };

  // 취소된 경기 카드용 인라인 팀 (왕관 + 로고 + 팀명 + 순위)
  const renderCancelTeam = (team, fallbackName, align) => {
    const name = toStr(team?.name) || fallbackName;
    const logoSrc = resolveLogoSrc(team);
    const rank = rankMap[toStr(team?.clubId || team?.id)];
    const isTop = rank >= 1 && rank <= 3;
    const logo = (
      <CancelLogoBox>
        {isTop ? <CrownImg $sm src={images.logo} alt={`${rank}위`} /> : null}
        <CancelTeamLogo>
          <MiniLogoImg src={logoSrc} alt={name} />
        </CancelTeamLogo>
      </CancelLogoBox>
    );
    return (
      <CancelTeamCell $align={align}>
        {align === "left" && logo}
        <CancelTeamName title={name}>{name}</CancelTeamName>
        {rank ? <CancelRank $top={isTop}>{rank}위</CancelRank> : null}
        {align === "right" && logo}
      </CancelTeamCell>
    );
  };

  // 취소된 경기 카드 (취소됨 배지 + 날짜 · 팀 vs 팀 · 취소사유 + 환불상태)
  const renderCancelledCard = (room) => {
    const { myTeam, oppTeam } = room || {};
    const dateLabel = room?.scheduledAt
      ? formatKoreanDateTime(room.scheduledAt)
      : formatMatchedTime(room?.cancelledAt);

    // 상세페이지와 동일 기준으로 표시: 취소 주체(우리팀/상대팀 취소) + 저장된 전체 사유 문자열
    const cancelledBy = toStr(room?.cancelledByClubId);
    const byMe = !!myClubId && cancelledBy === myClubId;

    const reasonBadge = !cancelledBy ? "경기 취소" : byMe ? "우리팀 취소" : "상대팀 취소";
    const reasonDesc = toStr(room?.cancelReason) || "사유 미입력";

    // 상세페이지(취소 화면)의 "정산" 줄과 동일하게 표시 — 금액·결제유무까지 딱 보고 알 수 있게
    const refund = room?.refund;
    const hasRefund = !!refund && Number(refund.amount) > 0;
    const refundDone = hasRefund && toStr(refund.status) === "refunded";
    const refundLabel = !hasRefund
      ? "현장 정산 · 결제 없음"
      : refundDone
      ? `${Number(refund.amount).toLocaleString()}원 환불 완료`
      : `${Number(refund.amount).toLocaleString()}원 환불 예정`;

    const oppName = toStr(oppTeam?.name) || "상대팀";
    const myName = toStr(myTeam?.name) || "우리팀";
    return (
      <ThumbCard key={room.id} onClick={() => handleClickRoom(room.id)} role="button" tabIndex={0}>
        {renderThumb(oppTeam)}
        <Body>
          <BodyTop>
            <OppName>{oppName}</OppName>
            <CancelChip>✕ 취소됨</CancelChip>
          </BodyTop>
          <VsLine>
            vs <b>{myName}</b>{dateLabel ? ` · ${dateLabel}` : ""}
          </VsLine>
          <DetailRow>
            <ReasonTypeBadge>{reasonBadge}</ReasonTypeBadge>
            <ReasonText>{reasonDesc}</ReasonText>
          </DetailRow>
          <DetailRow>
            <RefundBadge $tone={hasRefund ? "refund" : "none"}>{refundLabel}</RefundBadge>
          </DetailRow>
        </Body>
      </ThumbCard>
    );
  };

  // 캘린더 날짜별 목록용 — 지난 경기 통합 렌더러(완료/대기 자동 분기)
  const renderPastCard = (room) => {
    if (toStr(room?.status) === "finished") {
      return renderCompletedCard(room, { memberReview: !isTeamLeader });
    }
    return isTeamLeader
      ? renderPendingCard(room)
      : renderCompletedCard(room, { memberReview: true });
  };

  // 확정/지난 탭 상단 보기 토글
  const renderViewToggle = () => (
    <ViewToggle>
      <ToggleBtn type="button" $on={view === "calendar"} onClick={() => setView("calendar")}>
        📅 캘린더
      </ToggleBtn>
      <ToggleBtn type="button" $on={view === "list"} onClick={() => setView("list")}>
        목록
      </ToggleBtn>
    </ViewToggle>
  );

  const listToRender = useMemo(() => {
    if (tab === "adjusting") return adjustingRooms;
    if (tab === "confirmed") return confirmedRooms;
    if (tab === "past") return pastRooms;
    if (tab === "cancelled") return cancelledRooms;
    return [];
  }, [tab, adjustingRooms, confirmedRooms, pastRooms, cancelledRooms]);

  const HERO = {
    adjusting: { grad: "linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%)", shadow: "rgba(245,158,11,0.5)", deco: images.emoji3dSpeech },
    confirmed: { grad: "linear-gradient(135deg,#7c6ef2 0%,#4f46e5 100%)", shadow: "rgba(79,70,229,0.5)", deco: images.emoji3dCheck },
    past: { grad: "linear-gradient(135deg,#34d399 0%,#10b981 100%)", shadow: "rgba(16,185,129,0.45)", deco: images.emoji3dFlag },
    cancelled: { grad: "linear-gradient(135deg,#9ca3af 0%,#6b7280 100%)", shadow: "rgba(107,114,128,0.4)", deco: images.emoji3dCross },
    all: { grad: "linear-gradient(135deg,#7c6ef2 0%,#4f46e5 100%)", shadow: "rgba(79,70,229,0.5)", deco: images.emoji3dFolder },
  };
  const hero = HERO[tab] || HERO.all;

  return (
    <PageWrap>
      <Inner>
        <TabHero $grad={hero.grad} $shadow={hero.shadow}>
          <TabHeroTitle>{titleText}</TabHeroTitle>
          <TabHeroSub>{subText}</TabHeroSub>
          <TabHeroDeco src={hero.deco} alt="" $gray={tab === "cancelled"} />
        </TabHero>

        {loading ? (
          <StateWrap>
            <Spinner size="lg" />
          </StateWrap>
        ) : (
          <>
            {tab === "all" ? (
              <RoomList>
                {adjustingRooms.length > 0 ? (
                  <>
                    <TitleCard>
                      <TitleText>조율중 경기</TitleText>
                      <SubText>{adjustingRooms.length}개</SubText>
                    </TitleCard>
                    {adjustingRooms.map((room) => renderRoomCard(room))}
                  </>
                ) : (
                  <EmptyState text="조율중인 매칭이 아직 없습니다." />
                )}

                {confirmedRooms.length > 0 ? (
                  <>
                    <TitleCard>
                      <TitleText>확정된 경기</TitleText>
                      <SubText>{confirmedRooms.length}개</SubText>
                    </TitleCard>
                    {confirmedRooms.map((room) => renderRoomCard(room))}
                  </>
                ) : (
                  <EmptyState text="확정된 매칭이 아직 없습니다." />
                )}

                {pastRooms.length > 0 ? (
                  <>
                    <TitleCard>
                      <TitleText>지난 경기</TitleText>
                      <SubText>{pastRooms.length}개</SubText>
                    </TitleCard>
                    {pastRooms.map((room) => renderRoomCard(room))}
                  </>
                ) : (
                  <EmptyState text="지난 게임 기록이 아직 없습니다." />
                )}

                {cancelledRooms.length > 0 && (
                  <>
                    <TitleCard>
                      <TitleText>취소된 경기</TitleText>
                      <SubText>{cancelledRooms.length}개</SubText>
                    </TitleCard>
                    {cancelledRooms.map((room) => renderCancelledCard(room))}
                  </>
                )}
              </RoomList>
            ) : tab === "confirmed" ? (
              <>
                {renderViewToggle()}
                {view === "calendar" ? (
                  <MatchCalendar
                    matches={confirmedRooms}
                    renderCard={renderRoomCard}
                    emptyText="이 날 확정 경기가 없어요"
                  />
                ) : (
                  <RoomList>
                    {confirmedRooms.length > 0 ? (
                      confirmedRooms.map((room) => renderRoomCard(room))
                    ) : (
                      <EmptyState text="확정된 매칭이 아직 없습니다." />
                    )}
                  </RoomList>
                )}
              </>
            ) : tab === "past" ? (
              view === "calendar" && pastRooms.length > 0 ? (
                <>
                  {renderViewToggle()}
                  <MatchCalendar
                    matches={pastRooms}
                    renderCard={renderPastCard}
                    emptyText="이 날 지난 경기가 없어요"
                  />
                </>
              ) : (
              <RoomList>
                {pastRooms.length > 0 && renderViewToggle()}
                {pastRooms.length === 0 ? (
                  <EmptyState text="지난 게임 기록이 아직 없습니다." />
                ) : !isTeamLeader ? (
                  // 팀원: 결과 입력 권한 없음 → 입력 버튼 없이 지난 경기를 카드로.
                  // 점수 미입력 건은 '결과 대기중', 리뷰 미작성 건은 '리뷰 쓰기' 버튼. 정렬/필터 제공.
                  <>
                    <PastFilterBar>
                      <FilterChip $on={pastView === "recent"} onClick={() => setPastView("recent")}>
                        최신순
                      </FilterChip>
                      <FilterChip $on={pastView === "oldest"} onClick={() => setPastView("oldest")}>
                        오래된순
                      </FilterChip>
                      <FilterChip $on={pastView === "needReview"} onClick={() => setPastView("needReview")}>
                        리뷰 안 쓴 것만
                      </FilterChip>
                    </PastFilterBar>
                    {memberPastList.length === 0 ? (
                      <EmptyState
                        text={
                          pastView === "needReview"
                            ? "작성하지 않은 리뷰가 없어요. 모두 작성했어요! ✅"
                            : "지난 게임 기록이 아직 없습니다."
                        }
                      />
                    ) : (
                      memberPastList.map((room) => renderCompletedCard(room, { memberReview: true }))
                    )}
                  </>
                ) : (
                  <>
                    {resultPendingRooms.length > 0 && (
                      <>
                        <SectionHead>
                          <SectionEmoji>🔔</SectionEmoji>
                          <SectionLabel>결과 입력이 필요해요</SectionLabel>
                          <SectionCountBadge>{resultPendingRooms.length}</SectionCountBadge>
                        </SectionHead>
                        {resultPendingRooms.map((room) => renderPendingCard(room))}
                      </>
                    )}

                    {approvalPendingRooms.length > 0 && (
                      <>
                        <SectionHead>
                          <SectionEmoji>🕓</SectionEmoji>
                          <SectionLabel>승인 대기중</SectionLabel>
                          <SectionCount>{approvalPendingRooms.length}</SectionCount>
                        </SectionHead>
                        {approvalPendingRooms.map((room) => renderPendingCard(room))}
                      </>
                    )}

                    {completedRooms.length > 0 && (
                      <>
                        <SectionHead>
                          <SectionEmoji>✅</SectionEmoji>
                          <SectionLabel $muted>완료된 경기</SectionLabel>
                          <SectionCount>{completedRooms.length}</SectionCount>
                        </SectionHead>
                        {completedRooms.map((room) => renderCompletedCard(room))}
                      </>
                    )}
                  </>
                )}
              </RoomList>
              )
            ) : (
              <RoomList>
                {listToRender.length > 0 ? (
                  listToRender.map((room) =>
                    tab === "cancelled" ? renderCancelledCard(room) : renderRoomCard(room)
                  )
                ) : (
                  <EmptyState
                    text={
                      tab === "adjusting"
                        ? "조율중인 매칭이 아직 없습니다."
                        : tab === "confirmed"
                        ? "확정된 매칭이 아직 없습니다."
                        : "취소된 경기가 없습니다."
                    }
                  />
                )}
              </RoomList>
            )}
          </>
        )}
      </Inner>
    </PageWrap>
  );
}
