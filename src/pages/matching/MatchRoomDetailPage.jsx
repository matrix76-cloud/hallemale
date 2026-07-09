/* eslint-disable */
// src/pages/matching/MatchRoomDetailPage.jsx
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { goBackOrHome } from "../../utils/navigation";
import { images, playerAvatars, teamLogoSrc } from "../../utils/imageAssets";
import { FiMapPin, FiCalendar } from "react-icons/fi";
import {
  loadMatchRoomDetail,
  proposeMatchSchedule,
  confirmProposedSchedule,
  cancelProposedSchedule,
  cancelMatchRequest,
  submitMatchResultWithMedia,
  acceptMatchResult,
  disputeMatchResult,
  submitMatchReview,
  markMatchRoomSeen,
  sendLineupReminder,
  subscribeMatchRoom,
} from "../../services/matchRoomService";
import { useClub } from "../../hooks/useClub";
import { useAuth } from "../../hooks/useAuth";
import { getMatchReservationStatus, requestVenueReservationForMatch } from "../../services/ownerVenueService";
import { doc as fsDoc, getDoc as fsGetDoc } from "firebase/firestore";
import { db as fsDb } from "../../services/firebase";
import { useUIContext } from "../../context/UIContext";
import VenuePickerSheet from "../../components/common/VenuePickerSheet";
import EmptyState from "../../components/common/EmptyState";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";
import MatchRoomChat from "../../components/matchRoom/MatchRoomChat";
import MapLocationPicker from "../../components/matchRoom/MapLocationPicker";
import VenueMiniMap from "../../components/matchRoom/VenueMiniMap";
import MatchAcceptedCelebration from "../../components/matchRoom/MatchAcceptedCelebration";
import MatchFinalCelebration from "../../components/matchRoom/MatchFinalCelebration";
import CancelReasonSheet from "../../components/matchRoom/CancelReasonSheet";
import MatchLineupConfirmSheet from "../../components/matchRoom/MatchLineupConfirmSheet";
import useMatchRoomUnread from "../../hooks/useMatchRoomUnread";
import useVisualViewportHeightVar from "../../hooks/useVisualViewportHeightVar";
import { getOrCreateMatchRoomChat } from "../../services/chatService";
import { getClubById } from "../../services/clubManageService";
import { getUserDoc } from "../../services/userService";
import { getTeamRankMap } from "../../services/teamRankingService";
import { getPlayerRankMap } from "../../services/rankingService";
import { createTeamReport } from "../../services/teamReportService";
import { mrp } from "../../components/matchRoom/matchRoomPalette";

/* 기획안 색 토큰 (할래말래_직접입력.html :root) — 폴백/참조용 */
const HC = {
  bg: "#070a14",
  bg2: "#0c1020",
  surface: "#121829",
  surface2: "#171f33",
  line: "#222d44",
  line2: "#2c3a55",
  t1: "#eef2ff",
  t2: "#94a6c4",
  t3: "#5d7095",
  pu: "#7c5cff",
  puD: "#5b3fd6",
  puL: "#b3a0ff",
  puBg: "#1a1640",
  gr: "#1fd187",
  grL: "#6ef0bb",
};

/* ==================== 헬퍼 ==================== */

const POSITION_LABEL = { guard: "가드", forward: "포워드", center: "센터" };
const SKILL_LABEL = {
  beginner: "입문",
  amateur: "아마추어",
  intermediate: "중급",
  advanced: "상급",
};
const toStr = (v) => String(v || "").trim();

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

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);

// 별점(1~5) → ★/☆ 문자열
const starString = (n) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));

// 평점 작성 시각 → "M.D" (Firestore Timestamp / ISO 모두 대응)
const formatShortDate = (v) => {
  if (!v) return "";
  const d = typeof v?.toDate === "function" ? v.toDate() : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}.${d.getDate()}`;
};

// 마지막 메시지 시각 → 상대시간("방금"/"N분"/"N시간"/"N일")
const formatRelTime = (v) => {
  if (!v) return "";
  const d = typeof v?.toDate === "function" ? v.toDate() : new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간`;
  return `${Math.floor(hr / 24)}일`;
};

/* ==================== 스타일 ==================== */

const PageWrap = styled.div`
  /* 채팅($dark)은 뷰포트에 꽉 차게 고정 → 페이지 스크롤 없이 입력창 하단 고정.
     구장 정하기(venue)는 내용이 길어 스크롤 허용. */
  ${({ $dark, $confirmed }) =>
    $confirmed
      ? `
        /* 확정 화면: 헤더 뺀 뷰포트 높이 안에서 전체가 일반 스크롤 (공유버튼 고정 안 함) */
        height: calc(var(--app-vph, 100dvh) - 52px - env(safe-area-inset-top));
        overflow-y: auto;
      `
      : $dark
      ? `
        /* 헤더(52px+safe area) 뺀 뷰포트 높이로 하드 고정 →
           메시지는 내부 스크롤, 입력창은 항상 화면 하단 고정.
           키보드가 올라오면 --app-vph(visualViewport 높이)로 줄어들어 입력창이 가려지지 않음 */
        height: calc(var(--app-vph, 100dvh) - 52px - env(safe-area-inset-top));
        max-height: calc(var(--app-vph, 100dvh) - 52px - env(safe-area-inset-top));
        min-height: 0;
        overflow: hidden;
      `
      : `min-height: calc(100vh - 56px);`}
  /* 페이지 배경을 채팅과 동일한 톤(mrp bg2)으로 통일 → 흰색/회색 섞임 방지 */
  background: ${({ theme }) => mrp(theme.mode).bg2};
  padding: ${({ $dark }) => ($dark ? "0" : "10px 0 24px")};
  display: flex;
  flex-direction: column;
`;

const Inner = styled.div`
  padding: 0 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

/* 로딩/빈 상태 — 화면 중앙, 굵지 않은 글씨 */
const CenterState = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  font-size: 13px;
  font-weight: 400;
  white-space: nowrap;
  color: ${({ theme }) => theme.colors.textWeak || "#6b7280"};
  text-align: center;
`;

/* 팀원에게 "조율중" 안내를 보여주는 화면 */
const MemberGateWrap = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 28px;
  gap: 12px;
`;

const MemberGateIcon = styled.div`
  font-size: 44px;
  line-height: 1;
`;

const MemberGateTitle = styled.h3`
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const MemberGateText = styled.p`
  margin: 0;
  font-size: 13.5px;
  line-height: 1.6;
  white-space: pre-line;
  color: ${({ theme }) => theme.colors.textWeak || "#6b7280"};
`;

const MemberGateBtn = styled.button`
  margin-top: 10px;
  border: none;
  border-radius: 10px;
  padding: 12px 28px;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  background: ${({ theme }) => theme.colors.primary || "#4f46e5"};
  cursor: pointer;
`;

/* /venue(구장 정하기) 화면 하단에 도킹되는 채팅 — 입력창이 항상 보이도록 */
const VenueChatDock = styled.div`
  display: flex;
  flex-direction: column;
  height: 32vh;
  min-height: 220px;
  border-top: 6px solid ${({ theme }) => theme.colors.bg || "#f5f6fa"};
`;

const MatchCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 14px 14px 16px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const TeamBlock = styled.div`
  padding: 8px 0 4px;
  border-bottom: ${({ $withDivider, theme }) =>
    $withDivider ? `1px solid ${theme.colors.divider}` : "none"};
`;

const TeamHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const TeamHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
`;

const TeamLogoWrap = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 999px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
  flex-shrink: 0;
`;

const TeamLogo = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TeamText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const TeamName = styled.div`
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const TeamStatsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const WinRatePill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99,102,241,0.18)" : "#eef2ff"};
  color: ${({ theme }) =>
    theme.mode === "dark" ? "#a5b4fc" : "#4f46e5"};
  font-size: 10px;
`;

const TeamHeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TogglePlayersBtn = styled.button`
  border: none;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "#f3f4f6"};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
`;

const LineupBox = styled.div`
  margin-top: 10px;
  padding: 10px 10px;
  border-radius: 8px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const LineupTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
`;

const LineupTitle = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const LineupList = styled.div`
  display: flex;
  flex-direction: column;
`;

const PlayerRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 4px;

  & + & {
    border-top: 1px solid ${({ theme }) => theme.colors.divider};
  }

  /* 내 이름 줄: 보라색 강조 (라인업에서 본인 식별) */
  ${({ $me, theme }) =>
    $me &&
    `
    border-radius: 10px;
    padding: 8px 8px;
    background: ${theme.mode === "dark" ? "rgba(124,92,201,0.18)" : "#f1ecff"};
    box-shadow: inset 0 0 0 1.5px ${theme.mode === "dark" ? "rgba(167,139,250,0.55)" : "#7c5cc9"};
    & + & { border-top: none; }
  `}
`;

const PlayerLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  min-width: 0;
`;

const PlayerAvatar = styled.img`
  width: 34px;
  height: 34px;
  border-radius: 999px;
  object-fit: cover;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
  flex-shrink: 0;
`;

/* 라인업: 1~3위 선수 프로필 사진 위 왕관 */
const PlayerAvatarWrap = styled.div`
  position: relative;
  flex-shrink: 0;
  display: flex;
`;
const PlayerCrown = styled.img`
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 18px;
  height: 18px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.18));
`;

const PlayerText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

const PlayerTopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PlayerName = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
`;

const PlayerBodyMeta = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
`;

/* 라인업: 포지션 — 배경 칩 없이 깔끔한 텍스트 */
const PositionText = styled.span`
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  color: ${({ theme }) => theme.colors.textStrong};
`;

/* 라인업: 선수 실력(입문/아마추어/중급/상급) — 배경 배지 없이 텍스트 */
const SkillBadge = styled.span`
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const VsDivider = styled.div`
  padding: 6px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.primary};
`;

const SectionCard = styled.div`
  width: 100%;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 14px 14px 16px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

// 카드 없는 섹션 (구장 위치 선택 — 시안: 배경/테두리 없이 바로 노출)
const BareSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SectionTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const SectionTitleLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const SectionIcon = styled.span`
  font-size: 20px;
`;

const SectionTitleActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const MapBox = styled.div`
  margin-top: 4px;
  width: 100%;
  height: 140px;
  border-radius: 8px;
  overflow: hidden;
  cursor: ${({ $tappable }) => ($tappable ? "pointer" : "default")};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
`;

const VenueImageBox = styled.div`
  margin-top: 4px;
  width: 100%;
  height: 200px;
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
  position: relative;
`;

const VenueImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

/* ───── 채팅 속 구장 제안 카드 ───── */
const PropCard = styled.div`
  align-self: stretch;
  margin: 4px 0 2px;
  border: 1px solid
    ${({ theme, $confirmed }) =>
      $confirmed ? "rgba(22,163,74,.45)" : mrp(theme.mode).line2};
  border-radius: 14px;
  overflow: hidden;
  background: ${({ theme }) => mrp(theme.mode).surface};
  box-shadow: 0 4px 14px -8px rgba(0, 0, 0, 0.18);
`;
const PropMapWrap = styled.div`
  position: relative;
  padding: 6px 6px 0;
`;
const PropBadge = styled.div`
  position: absolute;
  top: 11px;
  left: 11px;
  z-index: 2;
  background: ${({ $confirmed }) =>
    $confirmed ? "#16a34a" : "rgba(0, 0, 0, 0.62)"};
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
  backdrop-filter: blur(4px);
`;
const PropVenueImg = styled.img`
  width: 100%;
  height: 120px;
  border-radius: 10px;
  object-fit: cover;
  display: block;
  background: ${({ theme }) =>
    theme.mode === "dark" ? mrp(theme.mode).surface2 : "#e5e7eb"};
`;
const PropBody = styled.div`
  padding: 8px 12px 10px;
`;
const PropName = styled.div`
  font-size: 13px;
  font-weight: 800;
  color: ${({ theme }) => (theme.mode === "dark" ? "#fff" : "#111827")};
`;
const PropRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 4px;
  font-size: 11.5px;
`;
const PropK = styled.span`
  color: ${({ theme }) => (theme.mode === "dark" ? "rgba(255,255,255,.55)" : "#6b7280")};
`;
const PropV = styled.span`
  color: ${({ theme }) => (theme.mode === "dark" ? "#e5e7eb" : "#111827")};
  font-weight: 600;
  text-align: right;
`;
const PropPayBtn = styled.button`
  margin-top: 8px;
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 11px;
  background: #7C3AED;
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  &:active { transform: translateY(1px); }
  &:disabled {
    background: ${({ theme }) => (theme.mode === "dark" ? "#3b3550" : "#cbc3e8")};
    color: ${({ theme }) => (theme.mode === "dark" ? "#8b85a0" : "#ffffff")};
    cursor: default;
    transform: none;
  }
`;
const PropPayNote = styled.div`
  margin-top: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #b45309;
  text-align: center;
`;

/* ───── 제휴구장 분할결제 박스 ───── */
const PayBox = styled.div`
  margin-top: 10px;
  padding: 11px 12px;
  border-radius: 10px;
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(99,102,241,0.12)" : "#eef2ff")};
  display: flex;
  flex-direction: column;
  gap: 7px;
`;
const PayTitle = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;
const PayTeams = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.textWeak};
  flex-wrap: wrap;
`;
const PayBtn = styled.button`
  height: 40px;
  border: none;
  border-radius: 9px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.5; }
`;
const PayWait = styled.div`
  font-size: 12.5px;
  font-weight: 600;
  color: #b45309;
  text-align: center;
`;
const PayDone = styled.div`
  font-size: 12.5px;
  font-weight: 700;
  color: #15803d;
  text-align: center;
`;

/* ───── 입력창 위 고정 액션바 ───── */
const ActBar = styled.div`
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-top: 0.5px solid
    ${({ theme }) => (theme.mode === "dark" ? "rgba(255,255,255,.08)" : "#eef0f3")};
  background: ${({ theme }) => (theme.mode === "dark" ? theme.colors.bg : "#fff")};
`;
const ActPrimary = styled.button`
  flex: 1.4;
  border: none;
  border-radius: 12px;
  padding: 12px;
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  cursor: pointer;
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? "linear-gradient(135deg,#7c6cff,#6c5ce7)"
      : "#6c5ce7"};
  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
`;
const ActGhost = styled.button`
  flex: 1;
  border: 1px solid
    ${({ theme }) => (theme.mode === "dark" ? "rgba(255,255,255,.18)" : "#d1d5db")};
  border-radius: 12px;
  padding: 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  background: transparent;
  color: ${({ theme }) => (theme.mode === "dark" ? "#e5e7eb" : "#374151")};
`;
const ActStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px 12px;
  border-top: 0.5px solid
    ${({ theme }) => (theme.mode === "dark" ? "rgba(255,255,255,.08)" : "#eef0f3")};
  background: ${({ theme }) => (theme.mode === "dark" ? theme.colors.bg : "#fff")};
`;
const ActRow = styled.div`
  display: flex;
  gap: 8px;
`;
const ActNote = styled.div`
  font-size: 12px;
  font-weight: 500;
  margin: 0 2px 8px;
  color: ${({ theme }) => (theme.mode === "dark" ? "rgba(255,255,255,.6)" : "#6b7280")};
`;

/* ───── 채팅 메시지 위에 고정되는 제안 바 (accepted) ───── */
const TopActionBar = styled.div`
  padding: 8px 12px 10px;
  background: ${({ theme }) => mrp(theme.mode).bg2};
`;
const TopActionBtn = styled.button`
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 14px;
  font-size: 15px;
  font-weight: 800;
  color: #fff;
  cursor: pointer;
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? "linear-gradient(135deg,#7c6cff,#6c5ce7)"
      : "#6c5ce7"};
  box-shadow: 0 6px 16px -8px rgba(108, 92, 231, 0.6);
`;

/* ───── 경기 확정(confirmed) 전용 화면 ───── */
const ConfWrap = styled.div`
  flex-shrink: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 26px 18px calc(28px + env(safe-area-inset-bottom));
  background: ${({ theme }) => mrp(theme.mode).bg2};
`;
const ConfCheck = styled.div`
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 46px;
  line-height: 1;
  box-shadow: 0 14px 30px -12px rgba(22, 163, 74, 0.65);
  margin-top: 6px;
`;
const ConfTitle = styled.div`
  margin: 18px 0 0;
  font-size: 24px;
  font-weight: 900;
  text-align: center;
  color: ${({ theme }) => mrp(theme.mode).t1};
`;
const ConfTitleMark = styled.span`
  background: linear-gradient(transparent 55%, rgba(34, 197, 94, 0.28) 0);
  padding: 0 4px;
`;
const ConfSub = styled.div`
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
  color: ${({ theme }) => mrp(theme.mode).t2};
`;
const ConfStepperWrap = styled.div`
  width: 100%;
  max-width: 360px;
  margin: 18px 0 0;
`;
const Ticket = styled.div`
  width: 100%;
  max-width: 360px;
  margin: 22px 0 0;
  border-radius: 18px;
  background: ${({ theme }) => mrp(theme.mode).surface};
  border: 1px solid ${({ theme }) => mrp(theme.mode).line2};
  box-shadow: 0 12px 32px -18px rgba(0, 0, 0, 0.35);
  overflow: hidden;
`;
const TicketHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px dashed ${({ theme }) => mrp(theme.mode).line2};
`;
const TicketBrand = styled.span`
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: ${({ theme }) => mrp(theme.mode).puL};
`;
const TicketBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  color: ${({ $tone }) =>
    $tone === "red" ? "#dc2626" : $tone === "slate" ? "#475569" : "#16a34a"};
  &::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ $tone }) =>
      $tone === "red" ? "#dc2626" : $tone === "slate" ? "#475569" : "#16a34a"};
  }
`;
const TicketBody = styled.div`
  padding: 18px 16px;
`;
const TicketRows = styled.div`
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;
const TicketRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: ${({ theme }) => mrp(theme.mode).t1};
`;
/* 일시·구장 행: 아이콘 칩 + (라벨/값) */
const RowIconChip = styled.div`
  flex-shrink: 0;
  width: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
`;
const RowKV = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;
const RowK = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme }) => mrp(theme.mode).t3};
`;
const RowV = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => mrp(theme.mode).t1};
  word-break: keep-all;
`;
const DirBtn = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 11px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => mrp(theme.mode).line2};
  background: transparent;
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => mrp(theme.mode).t2};
  cursor: pointer;
`;
/* 구장 타입 구분 뱃지: 제휴구장(보라) / 직접입력(중립) */
const VenueTypeTag = styled.span`
  display: inline-block;
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 800;
  vertical-align: middle;
  background: ${({ theme, $partner }) =>
    $partner ? mrp(theme.mode).puBg : mrp(theme.mode).surface2};
  color: ${({ theme, $partner }) =>
    $partner ? mrp(theme.mode).pu : mrp(theme.mode).t2};
`;
const LineupMiniBtn = styled.button`
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => mrp(theme.mode).line2};
  background: ${({ theme, $on }) => ($on ? mrp(theme.mode).puBg : "transparent")};
  font-size: 11.5px;
  font-weight: 700;
  color: ${({ theme }) => mrp(theme.mode).t2};
  cursor: pointer;
`;

const ShareBtn = styled.button`
  width: 100%;
  max-width: 360px;
  margin: 22px 0 0;
  border: none;
  border-radius: 14px;
  padding: 16px;
  font-size: 15px;
  font-weight: 800;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(135deg, #7c6cff, #6c5ce7);
  box-shadow: 0 12px 24px -12px rgba(108, 92, 231, 0.7);
`;

/* ───── 경기 확정 / 종료 상단 웅장 배너 ───── */
const ConfBanner = styled.div`
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 16px;
  padding: 22px 22px;
  border-radius: 20px;
  text-align: left;
  color: #fff;
  position: relative;
  overflow: hidden;
  background: ${({ $tone }) =>
    $tone === "red"
      ? "linear-gradient(135deg, #f87171 0%, #ef4444 55%, #dc2626 100%)"
      : $tone === "slate"
      ? "linear-gradient(135deg, #64748b 0%, #475569 60%, #334155 100%)"
      : "linear-gradient(135deg, #22c55e 0%, #16a34a 60%, #15803d 100%)"};
  box-shadow: ${({ $tone }) =>
    $tone === "red"
      ? "0 18px 38px -16px rgba(220, 38, 38, 0.6)"
      : $tone === "slate"
      ? "0 18px 38px -16px rgba(51, 65, 85, 0.6)"
      : "0 18px 38px -16px rgba(22, 163, 74, 0.7)"};

  /* 우측 상단 장식 원 */
  &::before {
    content: "";
    position: absolute;
    top: -34px;
    right: -24px;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
  }
  &::after {
    content: "";
    position: absolute;
    bottom: -40px;
    right: 40px;
    width: 90px;
    height: 90px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
  }
`;
const ConfBannerCheck = styled.div`
  flex-shrink: 0;
  font-size: 40px;
  line-height: 1;
  position: relative;
  z-index: 1;
`;
const ConfBannerText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  position: relative;
  z-index: 1;
`;
const ConfBannerTitle = styled.div`
  font-size: 23px;
  font-weight: 900;
  letter-spacing: -0.02em;
`;
const ConfBannerSub = styled.div`
  font-size: 12.5px;
  font-weight: 600;
  opacity: 0.92;
  line-height: 1.5;
`;
/* 확정 배너 우측 D-day 뱃지 */
const ConfBannerDday = styled.div`
  flex-shrink: 0;
  margin-left: auto;
  position: relative;
  z-index: 1;
  padding: 8px 13px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 0.01em;
  line-height: 1;
  white-space: nowrap;
`;

/* ───── 확정 경기 취소 버튼 ───── */
const ConfCancelBtn = styled.button`
  width: 100%;
  max-width: 360px;
  margin: 14px 0 0;
  padding: 13px;
  border-radius: 12px;
  border: 1px solid
    ${({ theme }) => (theme.mode === "dark" ? "rgba(255,255,255,0.18)" : "#e5e7eb")};
  background: transparent;
  color: ${({ theme }) => (theme.mode === "dark" ? "#fca5a5" : "#dc2626")};
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  &:active {
    opacity: 0.8;
  }
`;

/* ───── 확정 경기: 매칭룸 채팅 진입 카드 (팀장 전용) ───── */
const ConfMsgCard = styled.button`
  width: 100%;
  max-width: 360px;
  margin: 14px 0 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid ${({ theme }) => mrp(theme.mode).line2};
  background: ${({ theme }) => mrp(theme.mode).surface};
  box-shadow: 0 12px 32px -18px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  text-align: left;
  position: relative;
  &:active {
    opacity: 0.85;
  }
`;
const ConfMsgAvatar = styled.img`
  width: 46px;
  height: 46px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: ${({ theme }) => mrp(theme.mode).surface2};
`;
const ConfMsgTexts = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
const ConfMsgTitle = styled.div`
  font-size: 15px;
  font-weight: 800;
  color: ${({ theme }) => mrp(theme.mode).t1};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
const ConfMsgSub = styled.div`
  font-size: 12.5px;
  color: ${({ theme }) => mrp(theme.mode).t2};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
const ConfMsgBadge = styled.span`
  position: absolute;
  top: 50%;
  right: 16px;
  transform: translateY(-50%);
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 3px ${({ theme }) => mrp(theme.mode).surface};
`;

/* ───── 확정 경기: 채팅 열었을 때 상단 "경기 정보로" 바 ───── */
const ConfChatBar = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  background: ${({ theme }) => mrp(theme.mode).bg2};
  border-bottom: 0.5px solid
    ${({ theme }) => (theme.mode === "dark" ? "rgba(255,255,255,.08)" : "#eef0f3")};
`;
const ConfChatBackBtn = styled.button`
  border: 1px solid ${({ theme }) => mrp(theme.mode).line2};
  background: transparent;
  color: ${({ theme }) => mrp(theme.mode).t2};
  font-size: 13px;
  font-weight: 700;
  padding: 7px 13px;
  border-radius: 999px;
  cursor: pointer;
`;

/* ───── 직접 입력 구장 안내 (작게) ───── */
const VenueNote = styled.div`
  width: 100%;
  max-width: 360px;
  display: flex;
  gap: 7px;
  padding: 11px 13px;
  border-radius: 12px;
  font-size: 11.5px;
  line-height: 1.55;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.05)" : "#f3f4f6"};
  color: ${({ theme }) => mrp(theme.mode).t3};

  b {
    color: ${({ theme }) => mrp(theme.mode).t2};
    font-weight: 700;
  }
`;

/* ───── 제휴구장 확정: 예약완료 카드 ───── */
/* 매치 티켓 안에 풀블리드로 들어가는 구장 사진(TicketBody 좌우 패딩 16px 상쇄) */
const TicketVenuePhoto = styled.div`
  position: relative;
  margin: 18px -16px 0;
  aspect-ratio: 2 / 1;
  background: #1b1f27;
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255, 255, 255, 0.4);
`;
const ResvThumbImg = styled.img`width: 100%; height: 100%; object-fit: cover; display: block;`;
const ResvBadge = styled.span`
  position: absolute; top: 10px; left: 10px;
  padding: 5px 10px; border-radius: 999px;
  font-size: 11.5px; font-weight: 800;
  background: rgba(34, 197, 94, 0.92); color: #fff;
`;
/* 구장 사진 탭 → 구장 상세 이동 힌트 */
const VenuePhotoHint = styled.span`
  position: absolute; top: 10px; right: 10px;
  display: inline-flex; align-items: center; gap: 3px;
  padding: 5px 10px; border-radius: 999px;
  font-size: 11px; font-weight: 800;
  background: rgba(17, 24, 39, 0.62); color: #fff;
`;
/* 히어로 이미지 위에 구장명·코트정보 오버레이 (목업 배치) */
const ResvThumbOverlay = styled.div`
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 14px 14px 11px;
  background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.30) 55%, rgba(0,0,0,0) 100%);
`;
const ResvNameOv = styled.div`
  font-size: 17px; font-weight: 800; color: #fff;
  text-shadow: 0 1px 4px rgba(0,0,0,0.35);
`;
const ResvSubOv = styled.div`
  margin-top: 3px; font-size: 12.5px; font-weight: 600; color: rgba(255,255,255,0.88);
  text-shadow: 0 1px 3px rgba(0,0,0,0.3);
`;

/* ───── 제휴구장 확정: 구장 예약완료 카드 ───── */
const PaidCard = styled.div`
  width: 100%; max-width: 360px; margin: 14px 0 0;
  border-radius: 16px; padding: 16px;
  background: ${({ theme }) => mrp(theme.mode).surface};
  border: 1px solid ${({ theme }) => (theme.mode === "dark" ? "rgba(124,92,201,0.4)" : "rgba(124,92,201,0.35)")};
`;
const PaidHead = styled.div`display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;`;
const PaidTitle = styled.div`font-size: 15px; font-weight: 800; color: ${({ theme }) => mrp(theme.mode).t1};`;
const PaidBadge = styled.span`
  padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 800;
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(124,92,201,0.25)" : "#efe9ff")};
  color: ${({ theme }) => mrp(theme.mode).puD};
`;
const PaidRow = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: ${({ $big }) => ($big ? "10px 0 0" : "6px 0")};
  font-size: ${({ $big }) => ($big ? "15px" : "13.5px")};
  color: ${({ theme }) => mrp(theme.mode).t2};
  & > b { font-weight: 800; color: ${({ theme }) => mrp(theme.mode).t1}; }
`;
const PaidDivider = styled.div`height: 1px; background: ${({ theme }) => mrp(theme.mode).line}; margin: 8px 0 2px;`;
const PaidNote = styled.div`margin-top: 8px; font-size: 12px; line-height: 1.5; color: ${({ theme }) => mrp(theme.mode).t3};`;

/* ───── 경기 취소(cancelled) 전용 화면 ───── */
const CancelIcon = styled.div`
  width: 66px;
  height: 66px;
  border-radius: 16px;
  background: ${({ theme }) => mrp(theme.mode).surface2};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  font-weight: 800;
  color: ${({ theme }) => mrp(theme.mode).t2};
  margin-top: 10px;
`;
const CancelCard = styled.div`
  width: 100%;
  max-width: 360px;
  margin: 22px 0 0;
  border-radius: 16px;
  background: ${({ theme }) => mrp(theme.mode).surface};
  border: 1px solid ${({ theme }) => mrp(theme.mode).line2};
  box-shadow: 0 12px 32px -18px rgba(0, 0, 0, 0.35);
  padding: 4px 16px;
`;
const CancelRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 14px 0;
  font-size: 13px;
  & + & {
    border-top: 1px solid ${({ theme }) => mrp(theme.mode).line};
  }
`;
const CancelK = styled.span`
  color: ${({ theme }) => mrp(theme.mode).t3};
  font-weight: 600;
`;
const CancelV = styled.span`
  color: ${({ theme }) => mrp(theme.mode).t1};
  font-weight: 800;
  text-align: right;
`;
const CancelInfo = styled.div`
  width: 100%;
  max-width: 360px;
  margin: 14px 0 0;
  display: flex;
  gap: 8px;
  border-radius: 12px;
  padding: 13px 14px;
  font-size: 12.5px;
  line-height: 1.6;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99,102,241,0.12)" : "#eef2ff"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#a5b4fc" : "#4f46e5")};

  b {
    font-weight: 800;
  }
`;

const FieldMapWrap = styled.div`
  margin-top: 8px;
`;

const DurationWrap = styled.div`
  margin-top: 12px;
`;
const DurationLabel = styled.div`
  font-size: 12.5px;
  font-weight: 700;
  margin-bottom: 8px;
  color: ${({ theme }) => (theme.mode === "dark" ? "#e5e7eb" : "#374151")};
`;
const DurationRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
`;
const DurationChip = styled.button`
  border: 1px solid
    ${({ theme, $on }) =>
      $on ? "#6c5ce7" : theme.mode === "dark" ? "rgba(255,255,255,.16)" : "#d1d5db"};
  background: ${({ theme, $on }) =>
    $on ? "#6c5ce7" : theme.mode === "dark" ? "transparent" : "#fff"};
  color: ${({ $on, theme }) =>
    $on ? "#fff" : theme.mode === "dark" ? "#e5e7eb" : "#374151"};
  font-size: 12px;
  font-weight: 600;
  padding: 8px 13px;
  border-radius: 999px;
  cursor: pointer;
`;

/* ───── 시각(시작 시간) 탭 선택 — 고르면 그 시각부터 2시간 ───── */
const TimeWrap = styled.div`
  margin-top: 14px;
`;
const TimeHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;
const TimeTitle = styled.div`
  font-size: 13px;
  font-weight: 800;
  color: ${({ theme }) => (theme.mode === "dark" ? "#fff" : "#1f2937")};
`;
const TimeHint = styled.div`
  font-size: 11px;
  color: ${({ theme }) => (theme.mode === "dark" ? "rgba(255,255,255,.55)" : "#9ca3af")};
`;
const HourScroll = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
  &::-webkit-scrollbar {
    height: 0;
  }
`;
const HourChip = styled.button`
  flex: 0 0 auto;
  min-width: 52px;
  padding: 13px 0;
  border-radius: 12px;
  border: 1px solid
    ${({ theme, $on }) =>
      $on ? "#6c5ce7" : theme.mode === "dark" ? "rgba(255,255,255,.14)" : "#e5e7eb"};
  background: ${({ theme, $on }) =>
    $on ? "#6c5ce7" : theme.mode === "dark" ? theme.colors.surface : "#fff"};
  color: ${({ $on, theme }) =>
    $on ? "#fff" : theme.mode === "dark" ? "#e5e7eb" : "#374151"};
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: ${({ $on }) => ($on ? "none" : "0 1px 3px rgba(0,0,0,.06)")};

  &:disabled {
    cursor: default;
    opacity: 0.32;
    text-decoration: line-through;
    box-shadow: none;
  }
`;
const TimeSummary = styled.div`
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 13px 15px;
  border-radius: 13px;
  border: 1px solid
    ${({ theme }) => (theme.mode === "dark" ? "rgba(124,108,255,.4)" : "rgba(108,92,231,.35)")};
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(124,108,255,.1)" : "#f6f4fe")};
`;
const TimeRange = styled.div`
  font-size: 16px;
  font-weight: 800;
  color: #6c5ce7;
`;
const TimeTotal = styled.div`
  font-size: 12.5px;
  font-weight: 600;
  color: ${({ theme }) => (theme.mode === "dark" ? "rgba(255,255,255,.7)" : "#6b7280")};
`;

const CheckRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 10px 0 2px;
  padding: 11px 12px;
  border: 1px solid ${({ theme }) => (theme.mode === "dark" ? "rgba(255,255,255,.14)" : "#e1e4ea")};
  border-radius: 11px;
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(255,255,255,.04)" : "#fafbfc")};
  cursor: pointer;
  font-size: 12.5px;
  line-height: 1.4;
  color: ${({ theme }) => (theme.mode === "dark" ? "#e5e7eb" : "#374151")};
  input {
    width: 17px;
    height: 17px;
    margin-top: 1px;
    accent-color: #6c5ce7;
    flex-shrink: 0;
  }
`;

const FieldRow = styled.div`
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const FieldName = styled.div`
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FieldEditButton = styled.button`
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 12px;
  padding: 7px 14px;
  border-radius: 999px;
  cursor: pointer;
`;

const PartnerVenueRow = styled.div`
  margin-top: 10px;
`;

const PartnerVenueButton = styled.button`
  width: 100%;
  border: 1px dashed ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99,102,241,0.10)" : "rgba(79,70,229,0.06)"};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 13px;
  font-weight: 700;
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) =>
      theme.mode === "dark" ? "rgba(99,102,241,0.18)" : "rgba(79,70,229,0.10)"};
  }
  &:active {
    transform: translateY(1px);
  }
`;

/* ── 구장 정하기: 방식 선택 게이트 (직접 입력 MVP) ── */
const ChoiceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ChoiceItem = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid
    ${({ theme, $active }) =>
      $active ? theme.colors.primary : theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};
  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
  transition: border-color 0.15s ease;
`;

const ChoiceIconBox = styled.div`
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const ChoiceTextBox = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const ChoiceTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const ChoiceDesc = styled.div`
  font-size: 12.5px;
  line-height: 1.4;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ChoiceBadge = styled.span`
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  color: #ffffff;
  background: ${({ theme, $muted }) =>
    $muted ? theme.colors.textWeak : theme.colors.primary};
`;

const ChoiceArrow = styled.span`
  flex-shrink: 0;
  font-size: 18px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const GateNotice = styled.div`
  margin-top: 2px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 12.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textNormal};
  background: ${({ theme }) => theme.colors.divider};

  strong {
    color: ${({ theme }) => theme.colors.textStrong};
  }
`;

/* ── 매칭룸 셸 (기획안 HTML 1:1, 라이트/다크 자동 전환) ── */
const DarkHeader = styled.div`
  background: ${({ theme }) => mrp(theme.mode).bg};
  padding: 8px 12px 0;
`;

const MatchInfoBar = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 14px;
  margin-bottom: 6px;
  border: none;
  border-radius: 12px;
  background: ${({ theme }) => mrp(theme.mode).surface2};
  cursor: pointer;
`;

const MatchInfoLeft = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

const MatchInfoBarTitle = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => mrp(theme.mode).t2};
  letter-spacing: -0.02em;
  flex-shrink: 0;
`;

const StepSummaryBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: ${({ theme }) => mrp(theme.mode).puBg};
  color: ${({ theme }) => mrp(theme.mode).puL};
`;

const MatchInfoToggle = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => mrp(theme.mode).puD};
  flex-shrink: 0;
`;

/* ───── 헤더 햄버거 메뉴 바텀시트 ───── */
const RoomMenuSheet = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 4px 4px;
`;
const RoomMenuTitle = styled.div`
  font-size: 13px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
  padding: 4px 6px 8px;
`;
const RoomMenuBtn = styled.button`
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 14px 8px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  color: ${({ theme, $muted, $danger }) =>
    $danger
      ? theme.mode === "dark"
        ? "#fca5a5"
        : "#dc2626"
      : $muted
      ? theme.colors.textWeak
      : theme.colors.textStrong};
  &:active {
    background: ${({ theme }) => theme.colors.divider};
  }
`;

/* ───── 라인업 보기 모달(배너 창) ───── */
const LineupModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;
const LineupModalCard = styled.div`
  width: 100%;
  max-width: 420px;
  max-height: 82vh;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 16px;
  box-shadow: 0 20px 50px -20px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
`;
const LineupModalHead = styled.div`
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  z-index: 1;
`;
const LineupModalTitle = styled.div`
  font-size: 16px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
`;
const LineupModalClose = styled.button`
  border: none;
  background: transparent;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textWeak};
  padding: 0 4px;
`;
const LineupModalBody = styled.div`
  padding: 14px 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;
const LineupTeamName = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  margin-bottom: 6px;
`;
const WaitBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 18px 16px;
  border-radius: 12px;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const RemindBtn = styled.button`
  border: none;
  border-radius: 999px;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  background: ${({ theme }) => theme.colors.primary};
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

/* ───── 상대 팀 신고 모달 ───── */
const ReportDesc = styled.div`
  font-size: 12.5px;
  line-height: 1.5;
  white-space: pre-line;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const ReportTextarea = styled.textarea`
  width: 100%;
  min-height: 110px;
  resize: vertical;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textStrong};
  padding: 12px;
  font-size: 14px;
  line-height: 1.5;
  outline: none;
  &::placeholder {
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;
const ReportActions = styled.div`
  display: flex;
  gap: 8px;
`;
const ReportCancelBtn = styled.button`
  flex: 1;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: transparent;
  color: ${({ theme }) => theme.colors.textStrong};
  border-radius: 12px;
  padding: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
`;
const ReportSubmitBtn = styled.button`
  flex: 1.4;
  border: none;
  border-radius: 12px;
  padding: 12px;
  font-size: 14px;
  font-weight: 800;
  color: #fff;
  cursor: pointer;
  background: ${({ theme }) => (theme.mode === "dark" ? "#ef4444" : "#dc2626")};
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

const VsCard = styled.div`
  background: transparent;
  box-shadow: none;
  border: none;
  border-radius: 0;
  padding: 8px 8px 4px;
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: -40px;
    right: -40px;
    width: 120px;
    height: 120px;
    background: radial-gradient(
      circle,
      ${({ theme }) => mrp(theme.mode).puBg},
      transparent 70%
    );
    opacity: 0.7;
    display: ${({ theme }) => (mrp(theme.mode).vsGlow ? "block" : "none")};
  }
`;

const VsRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  position: relative;
`;

const VsTeam = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  min-width: 0;
  cursor: pointer;
  text-align: center;
`;

const Crest = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 900;
  overflow: hidden;
  border: 2.5px solid ${({ theme }) => mrp(theme.mode).line2};
  background: ${({ theme, $home }) =>
    $home ? "#ffffff" : mrp(theme.mode).crestBg};
  color: ${({ theme }) => mrp(theme.mode).t2};
`;

const CrestImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

/* 1~3위: 팀 로고(Crest) 위에 겹쳐 배치되는 로고 */
const CrestWrap = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const CrestCrown = styled.img`
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  width: 38px;
  height: 38px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.18));
`;

const VsNm = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => mrp(theme.mode).t1};
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.02em;
`;

const VsMeta = styled.div`
  font-size: 10px;
  color: ${({ theme }) => mrp(theme.mode).t3};
  margin-top: 2px;
`;

/* 팀명 + 랭킹 묶음 */
const VsNmWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
  max-width: 100%;
`;

/* 팀명 옆/아래 랭킹 표시 — 등수 상관없이 회색으로 통일 */
const RankTag = styled.span`
  font-size: 11px;
  font-weight: 700;
  color: ${({ theme }) => mrp(theme.mode).t3};
  letter-spacing: -0.01em;
`;

const VsMid = styled.div`
  flex-shrink: 0;
  text-align: center;
  margin-top: 13px;
`;

const VsX = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1f2433;
  color: #fff;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1;
`;

const Stepper = styled.div`
  display: flex;
  align-items: flex-start;
  padding: 8px 2px 4px;
`;

const Step = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;

  &::before {
    content: "";
    position: absolute;
    top: 15px;
    left: -50%;
    width: 100%;
    height: 2px;
    background: ${({ theme }) => mrp(theme.mode).line2};
    z-index: 1;
  }
  &:first-child::before {
    display: none;
  }
`;

const StepDot = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  z-index: 2;
  ${({ theme, $state }) => {
    const c = mrp(theme.mode);
    const check = theme.mode === "dark" ? "#04140d" : "#fff";
    return $state === "done"
      ? `background:${c.gr};border:1.5px solid ${c.gr};color:${check};`
      : $state === "cur"
      ? `background:${c.pu};border:1.5px solid ${c.puL};color:#fff;box-shadow:0 0 0 4px ${c.puBg};`
      : `background:${c.surface2};border:1.5px solid ${c.line2};color:${c.t3};`;
  }}
`;

const StepLb = styled.div`
  font-size: 11px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: ${({ theme, $on }) =>
    $on ? mrp(theme.mode).t1 : mrp(theme.mode).t3};
`;

const QuickTabs = styled.div`
  display: flex;
  gap: 7px;
  padding: 12px 0;
`;

const QuickTab = styled.button`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  padding: 13px 10px;
  border-radius: 14px;
  cursor: pointer;
  border: 0.5px solid
    ${({ theme, $on }) => ($on ? mrp(theme.mode).puD : mrp(theme.mode).line2)};
  background: ${({ theme, $on }) => {
    const c = mrp(theme.mode);
    return $on ? `linear-gradient(135deg, ${c.puBg}, ${c.surface})` : c.surface;
  }};
  color: ${({ theme, $on }) => ($on ? mrp(theme.mode).t1 : mrp(theme.mode).t2)};
`;

/* venue 전용 페이지 상단 (탭 대신 "‹ 채팅 / 구장 정하기 제목") */
const VenueTopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
`;
const BackToChat = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 700;
  padding: 8px 13px;
  border-radius: 999px;
  cursor: pointer;
  flex-shrink: 0;
  border: 0.5px solid ${({ theme }) => mrp(theme.mode).line2};
  background: ${({ theme }) => mrp(theme.mode).surface};
  color: ${({ theme }) => mrp(theme.mode).t2};
`;
const VenueTitle = styled.div`
  font-size: 15px;
  font-weight: 800;
  color: ${({ theme }) => mrp(theme.mode).t1};
`;

/* venue 전용 페이지 헤더 (기획안: ‹ 구장 정하기 / 팀명, 로고 없음) */
const VenueHead = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 2px 4px;
`;
const VenueBack = styled.button`
  font-size: 22px;
  line-height: 1;
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ theme }) => mrp(theme.mode).t2};
  padding: 2px 2px 0 0;
  flex-shrink: 0;
`;
const VenueHeadTitle = styled.div`
  font-size: 20px;
  font-weight: 800;
  color: ${({ theme }) => mrp(theme.mode).t1};
`;
const VenueHeadSub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => mrp(theme.mode).t3};
  margin-top: 2px;
`;

/* "어떻게 구장을 정할까요?" 라벨 */
const AskLabel = styled.div`
  font-size: 27px;
  font-weight: 800;
  line-height: 1.28;
  letter-spacing: -0.03em;
  color: ${({ theme }) => mrp(theme.mode).t1};
  margin: 20px 0 10px;
`;

/* 게이트 항목 (목업 1:1 — 카드 스타일) */
const OptCard = styled.button`
  width: 100%;
  text-align: left;
  padding: 20px 18px;
  margin-bottom: 14px;
  display: flex;
  gap: 15px;
  align-items: center;
  transition: 0.15s;
  border-radius: 18px;
  background: ${({ theme, $primary }) =>
    $primary ? mrp(theme.mode).puBg : mrp(theme.mode).surface};
  border: 1.5px solid
    ${({ theme, $primary }) =>
      $primary ? mrp(theme.mode).pu : mrp(theme.mode).line};
  box-shadow: 0 6px 18px -12px rgba(0, 0, 0, 0.3);
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};
  opacity: ${({ disabled }) => (disabled ? 0.55 : 1)};
  &:active {
    transform: ${({ disabled }) => (disabled ? "none" : "translateY(1px)")};
  }
`;
const Oic = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 15px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  background: ${({ theme, $primary }) =>
    $primary
      ? `linear-gradient(145deg, ${mrp(theme.mode).pu}, ${mrp(theme.mode).puD})`
      : mrp(theme.mode).surface2};
  color: ${({ theme, $primary }) => ($primary ? "#fff" : mrp(theme.mode).t2)};
`;
const Ob = styled.div`
  flex: 1;
  min-width: 0;
`;
const OptT = styled.div`
  font-size: 18px;
  font-weight: 800;
  color: ${({ theme }) => mrp(theme.mode).t1};
`;
const OptD = styled.div`
  font-size: 13.5px;
  color: ${({ theme }) => mrp(theme.mode).t3};
  margin-top: 4px;
`;
const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 10px;
`;
const Pill = styled.span`
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
  white-space: nowrap;
  ${({ theme, $tone }) => {
    const c = mrp(theme.mode);
    const map = {
      p: [c.puBg, c.puL],
      g: [c.grBg, c.grL],
      y: [c.yeBg, c.yeL],
      b: [c.blBg, c.blL],
      n: [c.surface2, c.t2],
    };
    const [bg, fg] = map[$tone] || map.p;
    return `background:${bg};color:${fg};`;
  }}
`;
/* 앱내 안내 문구 — 카드/배경 없이 회색 텍스트만 (게이트 문구와 동일 톤) */
const NoticeInfo = styled.div`
  display: flex;
  gap: 7px;
  font-size: 12px;
  line-height: 1.55;
  margin-top: 10px;
  color: ${({ theme }) => mrp(theme.mode).t3};

  b {
    font-weight: 700;
    color: ${({ theme }) => mrp(theme.mode).t2};
  }
`;

/* 게이트 부제 */
const GateSub = styled.div`
  font-size: 14px;
  color: ${({ theme }) => mrp(theme.mode).t3};
  margin: 0 0 18px;
`;

/* 카드 우측 선택 표시 (라디오/체크) */
const SelDot = styled.span`
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 900;
  color: #fff;
  border: 2px solid
    ${({ theme, $on }) => ($on ? mrp(theme.mode).pu : mrp(theme.mode).line2)};
  background: ${({ theme, $on }) => ($on ? mrp(theme.mode).pu : "transparent")};
`;

/* 게이트 안내 문구 — 카드 배경 없이 회색 텍스트 */
const GateNote = styled.div`
  display: flex;
  gap: 7px;
  font-size: 12.5px;
  line-height: 1.55;
  margin-top: 12px;
  color: ${({ theme }) => mrp(theme.mode).t3};

  b {
    font-weight: 700;
    color: ${({ theme }) => mrp(theme.mode).t2};
  }
`;

/* 게이트 하단 고정 바 (화면 맨 아래) */
const GateBottomBar = styled.div`
  margin-top: auto;
  position: sticky;
  bottom: 0;
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
  background: ${({ theme }) => mrp(theme.mode).bg2};
`;

const GateHint = styled.div`
  text-align: center;
  font-size: 12.5px;
  line-height: 1.5;
  color: ${({ theme }) => mrp(theme.mode).t3};
  margin-bottom: 10px;
`;

/* 하단 "이 방식으로 정하기" 버튼 */
const GateProceedBtn = styled.button`
  width: 100%;
  border: none;
  border-radius: 14px;
  padding: 16px;
  font-size: 16px;
  font-weight: 800;
  color: #fff;
  cursor: pointer;
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? "linear-gradient(135deg,#7c6cff,#6c5ce7)"
      : "#6c5ce7"};
  box-shadow: 0 12px 24px -12px rgba(108, 92, 231, 0.7);
  &:disabled {
    opacity: 0.45;
    cursor: default;
    box-shadow: none;
  }
  &:active {
    transform: ${({ disabled }) => (disabled ? "none" : "translateY(1px)")};
  }
`;

const DateTimeRow = styled.div`
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TimeInput = styled.input.attrs({ type: "time" })`
  width: 120px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 8px 10px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
`;

const DateValue = styled.div`
  margin-top: 2px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const CalendarWrap = styled.div`
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  padding: 8px 10px 10px;
`;

const CalendarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
`;

const MonthLabel = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const MonthNavButton = styled.button`
  border: none;
  background: transparent;
  font-size: 16px;
  line-height: 1;
  padding: 4px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textWeak};

  &:disabled {
    opacity: 0.25;
    cursor: default;
  }
`;

const WeekRow = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
  margin-bottom: 4px;
`;

const WeekCell = styled.div`
  text-align: center;
`;

const DaysGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
`;

const DayCell = styled.button`
  height: 30px;
  border-radius: 999px;
  border: none;
  font-size: 12px;
  cursor: pointer;

  ${({ $isEmpty }) =>
    $isEmpty
      ? `
    background: transparent;
    cursor: default;
  `
      : `
    background: transparent;
  `}

  ${({ $isToday, $isSelected, theme }) => {
    if ($isSelected) {
      return `
        background:${theme.colors.primary};
        color:#ffffff;
      `;
    }
    if ($isToday) {
      return `
        border:1px solid ${theme.colors.primary};
        color:${theme.colors.primary};
      `;
    }
    return `
      color:${theme.colors.textStrong};
    `;
  }}

  &:disabled {
    cursor: default;
    opacity: 0.28;
    background: transparent;
    border: none;
    color: ${({ theme }) => theme.colors.textWeak};
    text-decoration: line-through;
  }
`;

const NoticeText = styled.div`
  margin: 4px 10px 0;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
  text-align: center;
`;

const ActionsWrap = styled.div`
  margin-top: 10px;
  padding: 0 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PrimaryButton = styled.button`
  width: 100%;
  padding: 12px 0;
  border-radius: 999px;
  border: none;
  background: ${({ theme, disabled }) =>
    disabled
      ? theme.mode === "dark"
        ? "rgba(99,102,241,0.35)"
        : "#cbd5f5"
      : theme.colors.primary};
  color: #ffffff;
  font-size: 15px;
  cursor: ${({ disabled }) => (disabled ? "default" : "pointer")};
`;

const MutedButton = styled.button`
  width: 100%;
  padding: 10px 0;
  border-radius: 999px;
  border: none;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "#f3f4f6"};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 13px;
  cursor: pointer;
`;

const ResultScoreRow = styled.div`
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ScoreBlock = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ScoreTeamLabel = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ScoreInput = styled.input`
  width: 100%;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  padding: 10px 12px;
  font-size: 16px;
  text-align: center;
`;

const ScoreSeparator = styled.div`
  font-size: 18px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ResultStatusText = styled.div`
  margin-top: 8px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.5;
`;

const ResultActionsRow = styled.div`
  margin-top: 10px;
  display: flex;
  gap: 8px;
`;

const ResultButton = styled.button`
  flex: 1;
  padding: 9px 0;
  border-radius: 999px;
  border: none;
  font-size: 13px;
  cursor: pointer;

  ${({ variant, theme }) =>
    variant === "primary"
      ? `
    background:${theme.colors.primary};
    color:#ffffff;
  `
      : `
    background:${theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "#f3f4f6"};
    color:${theme.colors.textNormal};
  `}
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 120px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 12px 12px;
  font-size: 14px;
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  outline: none;
  resize: none;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

/* ====== 결과 입력 리디자인(3카드) ====== */
const RATING_LABELS = ["", "별로예요", "그저 그래요", "괜찮아요", "좋아요", "최고예요"];

const SubLabel = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ScoreCardRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-top: 4px;
`;

const ScoreTeamCol = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;

const ScoreLogoChip = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 14px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
  display: grid;
  place-items: center;
  box-shadow: 0 0 0 1px ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)"};
`;

/* 1~3위: 로고 위에 겹쳐지는 앱 로고 왕관 */
const ScoreLogoWrap = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const ScoreCrown = styled.img`
  position: absolute;
  top: -17px;
  left: 50%;
  transform: translateX(-50%);
  width: 26px;
  height: 26px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.18));
`;

const ScoreLogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ScoreColName = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

const ScoreColSub = styled.div`
  font-size: 11px;
  color: ${({ $me, theme }) =>
    $me ? theme.colors.primary : theme.colors.textWeak};
  text-align: center;
`;

const ScoreInputBig = styled.input`
  width: 100%;
  margin-top: 2px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  padding: 12px 8px;
  font-size: 26px;
  font-weight: 700;
  text-align: center;
  outline: none;
  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const ScoreColon = styled.div`
  padding-bottom: 14px;
  font-size: 20px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* 완료 경기: 확정 점수 읽기 전용 박스(승=초록·패=빨강) */
const ScoreReadBox = styled.div`
  width: 100%;
  margin-top: 2px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  padding: 12px 8px;
  font-size: 26px;
  font-weight: 700;
  text-align: center;
  color: ${({ theme, $outcome }) =>
    $outcome === "win"
      ? "#16a34a"
      : $outcome === "lose"
      ? "#dc2626"
      : theme.colors.textStrong};
`;

const RatingSubtitle = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.5;
`;

/* 완료 경기 결과 히어로 배너 (승리=그린 그라데이션 / 무·패 컬러) */
const ResultBanner = styled.div`
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 2px 0 14px;
  padding: 13px 16px;
  border-radius: 14px;
  background: ${({ $outcome, theme }) =>
    $outcome === "win"
      ? "linear-gradient(135deg,#34d399 0%,#10b981 100%)"
      : $outcome === "lose"
      ? theme.mode === "dark"
        ? "rgba(220,38,38,0.16)"
        : "#fef2f2"
      : theme.mode === "dark"
      ? "rgba(255,255,255,0.06)"
      : "#f3f4f6"};
  box-shadow: ${({ $outcome }) =>
    $outcome === "win" ? "0 12px 22px -12px rgba(16,185,129,0.6)" : "none"};
`;
const ResultBannerText = styled.div`
  font-size: 19px;
  font-weight: 900;
  letter-spacing: -0.3px;
  color: ${({ $outcome, theme }) =>
    $outcome === "win"
      ? "#ffffff"
      : $outcome === "lose"
      ? "#dc2626"
      : theme.colors.textStrong};
`;
const ResultBanner3D = styled.img`
  width: 30px;
  height: 30px;
  object-fit: contain;
  filter: drop-shadow(0 4px 8px rgba(15, 23, 42, 0.25));
`;

/* 완료 경기: 가로 스코어보드 (가운데 큰 점수 · 이긴 쪽만 진하게) */
const ScoreBoard = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0 2px;
`;
const SbTeam = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
`;
const SbLogoWrap = styled.div`
  position: relative;
  flex-shrink: 0;
`;
const SbLogo = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 16px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
  box-shadow: 0 0 0 1px ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)"};
`;
const SbName = styled.div`
  font-size: 13.5px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;
const SbSub = styled.div`
  font-size: 11px;
  color: ${({ $me, theme }) => ($me ? theme.colors.primary : theme.colors.textWeak)};
  text-align: center;
`;
const SbScore = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 2px 20px;
`;
const SbNum = styled.div`
  font-size: 36px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: -1px;
  color: ${({ $win, theme }) =>
    $win ? theme.colors.textStrong : theme.colors.textWeak};
`;
const SbColon = styled.div`
  font-size: 22px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const StarsRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 6px 0 2px;
`;

const StarBtn = styled.button`
  border: none;
  background: none;
  cursor: pointer;
  font-size: 30px;
  line-height: 1;
  padding: 0;
  color: ${({ $on, theme }) =>
    $on
      ? theme.colors.primary
      : theme.mode === "dark"
      ? "rgba(255,255,255,0.25)"
      : "#d1d5db"};
`;

const RatingValueLabel = styled.div`
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  min-height: 17px;
`;

/* 결과 제출 버튼 — 화면 하단 고정(스크롤해도 위치 유지) */
const ResultSubmitBar = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 11px 16px calc(17px + env(safe-area-inset-bottom));
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? theme.colors.card
      : "linear-gradient(to top, #ffffff, rgba(249, 250, 251, 0.96))"};
  box-shadow: ${({ theme }) => theme.shadows.card};
  z-index: 20;
`;

const ResultBarSpacer = styled.div`
  height: 84px;
`;

const ReviewActionBtn = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.primary};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 6px;
`;

/* ───── 지난 경기: 상대 팀 선수 평점 카드 ───── */
const ReviewHeadRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;
const ReviewHeadLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;
const ReviewTeamLogo = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 999px;
  overflow: hidden;
  flex-shrink: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;
const ReviewTitle = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
const ReviewAvg = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`;
const ReviewAvgStars = styled.span`
  letter-spacing: 1px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.primary};
`;
const ReviewAvgNum = styled.span`
  font-size: 14px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
`;
const ReviewList = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 2px;
`;
const ReviewItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 0;

  & + & {
    border-top: 1px solid ${({ theme }) => theme.colors.divider};
  }
`;
const ReviewAvatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 999px;
  object-fit: cover;
  flex-shrink: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
`;
const ReviewBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
const ReviewNameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;
const ReviewName = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;
const ReviewStars = styled.span`
  letter-spacing: 1px;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.primary};
`;
const ReviewText = styled.div`
  font-size: 12.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textNormal};
  word-break: break-word;
`;
const ReviewDate = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const ReviewEmpty = styled.div`
  padding: 18px 4px;
  text-align: center;
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* ====== 결과/기록 UI ====== */

const ScoreHero = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 10px;
  padding: 10px 0 4px;
`;

const ScoreHeroNum = styled.div`
  font-size: 34px;
  color: ${({ theme, $outcome }) =>
    $outcome === "win"
      ? "#16a34a"
      : $outcome === "lose"
      ? "#dc2626"
      : theme.colors.textStrong};
  letter-spacing: -0.02em;
`;

const ScoreHeroSep = styled.div`
  font-size: 22px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ScoreHeroHint = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  text-align: center;
`;

/* ✅ 경기결과 입력 잠금 안내 박스 */
const ResultInfoBox = styled.div`
  margin-top: 8px;
  padding: 12px 12px;
  border-radius: 8px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f8fafc"};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 12px;
  line-height: 1.55;
`;

/* ==================== helpers ==================== */

function formatPositionKo(pos) {
  const v = toStr(pos).toLowerCase();
  if (!v) return "";
  if (v.includes("가드")) return "가드";
  if (v.includes("포워드")) return "포워드";
  if (v.includes("센터")) return "센터";
  if (v === "g" || v.includes("guard")) return "가드";
  if (v === "f" || v.includes("forward")) return "포워드";
  if (v === "c" || v.includes("center")) return "센터";
  return toStr(pos);
}

/* ==================== 페이지 ==================== */

export default function MatchRoomDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const { club, isTeamLeader } = useClub();
  const { firebaseUser, userDoc } = useAuth();
  const myUid = toStr(firebaseUser?.uid || userDoc?.uid || userDoc?.id);
  const { setHeaderSubtitle, setHeaderConfig, showBottomSheet, hideBottomSheet, showToast } = useUIContext() || {};

  // ✅ 모바일 키보드가 올라오면 채팅 입력창이 가려지지 않도록 실제 보이는 높이를 CSS 변수로 노출
  useVisualViewportHeightVar();

  // ✅ 키보드가 올라오면(visualViewport 축소) 상단 진행단계/라인업 헤더를 접어
  //    채팅 입력창이 잘리지 않고 키보드 바로 위에 보이도록 한다. (내리면 복원)
  const [kbOpen, setKbOpen] = useState(false);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const onResize = () => {
      setKbOpen(window.innerHeight - vv.height > 120);
    };
    onResize();
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const myClubId = toStr(club?.clubId || club?.id);

  // 제휴구장 분할결제 상태 (partnerBooking + 예약 결제현황)
  const [partnerPay, setPartnerPay] = useState(null); // { pb, resv }

  const roomId = toStr(params?.roomId || params?.matchId);

  // ✅ 확정 경기 채팅 진입 카드용: 매칭룸 안읽음/마지막 메시지(팀장 전용 노출)
  const { byRoom: chatMeta } = useMatchRoomUnread({ clubId: myClubId, uid: myUid });
  const roomChat = chatMeta[roomId] || {};
  // 확정 경기 상세에서 "메시지" 카드를 눌러 채팅을 펼쳤는지
  const [confirmedChatOpen, setConfirmedChatOpen] = useState(false);

  const authorDisplayName = toStr(club?.name) || "참가자";

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rankMap, setRankMap] = useState(null); // clubId → 전체 랭킹 등수
  const [playerRankMap, setPlayerRankMap] = useState(null); // userId → 선수 전체 랭킹 등수

  // ───── 제휴구장 분할결제 현황 로드 (room 선언 뒤 · early return 앞) ─────
  const loadPartnerPay = React.useCallback(async () => {
    if (!room?.id) { setPartnerPay(null); return; }
    try {
      const snap = await fsGetDoc(fsDoc(fsDb, "match_requests", room.id));
      const pb = snap.exists() ? snap.data()?.partnerBooking : null;
      if (!pb) { setPartnerPay(null); return; }
      const resv = await getMatchReservationStatus(room.id);
      setPartnerPay({ pb, resv });
    } catch (e) {
      console.warn("[matchRoom] loadPartnerPay failed", e?.message || e);
    }
  }, [room?.id]);

  useEffect(() => { loadPartnerPay(); }, [loadPartnerPay, room?.status]);
  // 실시간 구독 콜백에서 항상 최신 loadPartnerPay 를 호출할 수 있도록 ref 동기화
  useEffect(() => { loadPartnerPayRef.current = loadPartnerPay; }, [loadPartnerPay]);

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [durationMin, setDurationMin] = useState(120); // 경기 진행 시간(분), 기본 2시간
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const [myLineupOpen, setMyLineupOpen] = useState(false);
  const [oppLineupOpen, setOppLineupOpen] = useState(false);

  // 매치 정보 · 진행 단계 카드 접기/펼치기 — 메시지 화면을 넓게 쓰도록 기본 접힘
  const [matchInfoOpen, setMatchInfoOpen] = useState(false);

  const [fieldAddress, setFieldAddress] = useState("");
  const [fieldLatLng, setFieldLatLng] = useState(null);
  const [venueConfirmChecked, setVenueConfirmChecked] = useState(false); // "구장 예약 직접 확인" 체크
  const [showConfirmAnim, setShowConfirmAnim] = useState(false); // (2-7) 확정 축하 애니메이션
  const [showAcceptAnim, setShowAcceptAnim] = useState(false); // 매칭 성사(수락) 축하 애니메이션
  const [showLineupDoneAnim, setShowLineupDoneAnim] = useState(false); // 양 팀 라인업 확정 축하
  const lineupBothRef = useRef(null); // 양 팀 라인업 확정 상태(전환 감지용, null=미초기화)
  const acceptedAnimRef = useRef(null); // 제휴구장 수락 상태(전환 감지용, null=미초기화)
  const loadPartnerPayRef = useRef(null); // 실시간 구독에서 최신 loadPartnerPay 호출용
  const acceptAnimRef = useRef(false);
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false); // 취소 사유 선택 시트
  const [cancelBusy, setCancelBusy] = useState(false);
  const [showFinalAnim, setShowFinalAnim] = useState(false); // 최종 경기 확정(양 팀 결제 완료) 웅장 축하
  const finalAnimRef = useRef(false); // 최종 확정 축하 1회 가드
  const confirmedRef = useRef(null); // 경기 확정 상태(전환 감지용, null=미초기화)
  const [venuePickerOpen, setVenuePickerOpen] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [venueImageUrl, setVenueImageUrl] = useState("");
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const markerRef = useRef(null);
  const venueAutoOpenRef = useRef(false);

  const [editMode, setEditMode] = useState(false);
  const initOnceRef = useRef(false);

  // 구장 정하기 방식 선택 게이트: "none"(미선택) → 게이트 노출 → "direct"(직접 입력) 선택 시 지도 흐름.
  // ("제휴구장 예약"은 준비중 — 결제/예약 백엔드 미구현)
  const [venueMode, setVenueMode] = useState("none");
  // 구장 방식 선택 게이트: 직접입력/제휴 중 택1 후 "이 방식으로 정하기" 버튼으로 진행
  const [gateChoice, setGateChoice] = useState("");

  // 매칭룸 탭은 URL로 분리: /match-roomdetail/:id (채팅) vs /:id/venue (구장 정하기 별도 페이지)
  const location = useLocation();
  const isVenue = location.pathname.endsWith("/venue");
  // 상대 팀장과의 DM 채팅방 id (getOrCreateDmRoom으로 확보)
  const [chatId, setChatId] = useState("");
  // 상대 팀장(채팅 상대) — 프로필 사진·이름·uid (채팅 헤더/읽음표시용)
  const [oppLeader, setOppLeader] = useState({ uid: "", name: "", avatarUrl: "" });

  const [myScoreInput, setMyScoreInput] = useState("");
  const [oppScoreInput, setOppScoreInput] = useState("");
  const [oppRating, setOppRating] = useState(0); // 상대 팀 별점(1~5)
  const [resultBusy, setResultBusy] = useState(false);

  // ✅ 지난 경기 리뷰(별점·한줄평) — 팀장·팀원 공통, 1인 1리뷰
  const [reviewStars, setReviewStars] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [editingReview, setEditingReview] = useState(false); // 등록된 리뷰 → "수정" 누르면 편집 모드
  const reviewPrefillRef = useRef("");

  // 내가 이전에 남긴 리뷰가 있으면 입력칸에 한 번 채움 (경기별 1회)
  useEffect(() => {
    const rid = toStr(room?.id);
    if (!rid || !myUid) return;
    if (reviewPrefillRef.current === rid) return;
    reviewPrefillRef.current = rid;
    const mine = (Array.isArray(room?.reviews) ? room.reviews : []).find(
      (r) => toStr(r.raterUid) === myUid
    );
    if (mine) {
      setReviewStars(Math.max(0, Math.min(5, Number(mine.stars) || 0)));
      setReviewComment(toStr(mine.comment));
    }
  }, [room, myUid]);

  // 조율 단계 라인업 확정 시트
  const [lineupSheetOpen, setLineupSheetOpen] = useState(false);

  // 라인업 보기 모달(배너 창) + 상대 라인업 확정 요청 알림 상태
  const [lineupViewOpen, setLineupViewOpen] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);

  // 상대 팀 신고 모달
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  const refresh = async () => {
    if (!roomId) return;
    const res = await loadMatchRoomDetail(roomId);
    setRoom(res?.room || null);
  };

  // 결과 자동 확정: 상대가 경기 종료일 기준 3일 내 미승인 시 입력값으로 자동 확정
  const AUTO_CONFIRM_DAYS = 3;
  const autoConfirmRanRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        if (!roomId) {
          if (!cancelled) setRoom(null);
          return;
        }
        const res = await loadMatchRoomDetail(roomId);
        if (cancelled) return;
        setRoom(res?.room || null);
        // 상세를 열면 "본 것"으로 처리 → 홈/목록의 미확인 배지 해제 (지난 결과필요는 상태기반이라 유지)
        markMatchRoomSeen({ matchRequestId: roomId });
      } catch (e) {
        console.error("[MatchRoomDetailPage] loadMatchRoomDetail failed", e);
        if (!cancelled) setRoom(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // ✅ 실시간 구독: 상대 팀장의 라인업 확정·일정 제안·확정 등 핵심 변화가 생기면 즉시 재조회.
  //    (라인업을 둘 다 확정하면 "구장·일정 제안하기" 버튼이 새로고침 없이 바로 뜨도록)
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    let lastSig = null;
    const unsub = subscribeMatchRoom(roomId, (sig) => {
      if (cancelled || !sig) return;
      const key = JSON.stringify(sig);
      if (lastSig === null) {
        lastSig = key; // 초기 스냅샷은 이미 로드된 상태와 동일 → 건너뜀
        return;
      }
      if (key !== lastSig) {
        lastSig = key;
        loadMatchRoomDetail(roomId)
          .then((res) => {
            if (!cancelled) setRoom(res?.room || null);
          })
          .catch(() => {});
        // 제휴구장 수락/결제 현황도 함께 갱신 (status 변화가 없어도 partnerBooking.accepted 반영)
        loadPartnerPayRef.current && loadPartnerPayRef.current();
      }
    });
    return () => {
      cancelled = true;
      unsub && unsub();
    };
  }, [roomId]);

  // ✅ 양 팀 라인업이 "둘 다 확정"으로 전환되는 순간 → 라인업 확정 축하 화면 1회 표시.
  //    (실시간 구독 덕에 상대가 확정해도 내 화면에서 바로 트리거됨)
  useEffect(() => {
    if (!room) return;
    const st = toStr(room.status);
    const iAmActorClub = !!myClubId && myClubId === toStr(room.actorClubId);
    const myConfirmed = !!(iAmActorClub ? room.myLineup : room.oppLineup)?.confirmed;
    const oppConfirmed = !!(iAmActorClub ? room.oppLineup : room.myLineup)?.confirmed;
    const both = st === "accepted" && myConfirmed && oppConfirmed;

    const prev = lineupBothRef.current;
    lineupBothRef.current = both;
    if (prev === null) return; // 첫 로드: 기준값만 기록(이미 확정된 방 재방문 시 축하 안 함)
    if (!prev && both) setShowLineupDoneAnim(true); // false→true 전환에만 축하
  }, [room, myClubId]);

  // 매칭 수락 직후(수락한 사람) / 수락 푸시알림 클릭 진입(요청한 사람) 시
  // "매칭 성사" 축하 애니메이션을 1회 표시. 조율중(accepted/proposed)일 때만.
  useEffect(() => {
    if (acceptAnimRef.current) return;
    // 라우터 state(앱 내 이동) 또는 ?celebrate=accepted(푸시 딥링크) 둘 다 지원
    const wantCelebrate =
      !!location.state?.celebrateAccepted ||
      new URLSearchParams(location.search || "").get("celebrate") === "accepted";
    if (!wantCelebrate) return;
    if (!room) return;
    const st = toStr(room.status);
    if (st !== "accepted" && st !== "proposed") return;
    acceptAnimRef.current = true;
    setShowAcceptAnim(true);
    // 새로고침/뒤로가기 시 재생되지 않도록 state·쿼리에서 플래그 제거 (다른 state는 보존)
    navigate(location.pathname, {
      replace: true,
      state: { viewClubId: location.state?.viewClubId },
    });
  }, [room, location.state, location.pathname, location.search, navigate]);

  // 최종 경기 확정 축하 — 결제 완료로 진입(celebrateConfirmed) 또는 푸시 딥링크(?celebrate=confirmed)
  useEffect(() => {
    if (finalAnimRef.current) return;
    const want =
      !!location.state?.celebrateConfirmed ||
      new URLSearchParams(location.search || "").get("celebrate") === "confirmed";
    if (!want || !room) return;
    if (toStr(room.status) !== "confirmed") return;
    finalAnimRef.current = true;
    setShowFinalAnim(true);
    navigate(location.pathname, {
      replace: true,
      state: { viewClubId: location.state?.viewClubId },
    });
  }, [room, location.state, location.pathname, location.search, navigate]);

  // 실시간: 방을 보는 중 status가 confirmed로 전환되면 최종 확정 축하.
  //  - 제휴구장: 양 팀 결제 완료 시
  //  - 직접입력: 상대가 내가 보낸 일정을 수락(확정)했을 때 → 제안자(보낸 사람)도 실시간으로 축하
  // 확정 액션 당사자는 handleConfirmSchedule에서 finalAnimRef를 세워 중복 축하를 막는다.
  useEffect(() => {
    if (!room) return;
    const isConfirmedNow = toStr(room.status) === "confirmed";
    const prev = confirmedRef.current;
    confirmedRef.current = isConfirmedNow;
    if (prev === null) return; // 첫 로드: 기준값만 기록(이미 확정된 방 재방문 시 축하 안 함)
    if (!prev && isConfirmedNow && !finalAnimRef.current) {
      finalAnimRef.current = true;
      setShowFinalAnim(true);
    }
  }, [room]);

  // 결과 자동 확정: waiting_accept 상태에서 경기 종료일 + 3일이 지나면 제출값으로 확정
  useEffect(() => {
    if (!room) return;
    if (toStr(room.resultState) !== "waiting_accept") return;

    // ✅ 참여팀(내 팀이 이 경기의 actor/target)일 때만 자동 확정 트리거 (비참여자 뷰어가 남의 경기 전적을 쓰지 않도록)
    const me = toStr(myClubId);
    if (!me || (me !== toStr(room.actorClubId) && me !== toStr(room.targetClubId))) return;

    const schMs = room.scheduledAt ? new Date(room.scheduledAt).getTime() : NaN;
    if (!Number.isFinite(schMs)) return;
    const durMin = Number(room.durationMin) || 120;
    const autoMs = schMs + durMin * 60 * 1000 + AUTO_CONFIRM_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() < autoMs) return;
    if (autoConfirmRanRef.current) return;
    autoConfirmRanRef.current = true;

    const submittedBy = toStr(room?.result?.submittedByClubId);
    const actorId = toStr(room.actorClubId);
    const targetId = toStr(room.targetClubId);
    // 확정 주체는 미승인(상대) 팀으로 기록
    const confirmer = (submittedBy === actorId ? targetId : actorId) || submittedBy;

    (async () => {
      try {
        await acceptMatchResult({ matchRequestId: room.id, confirmedByClubId: confirmer });
        await refresh();
      } catch (e) {
        console.warn("[MatchRoomDetailPage] auto-confirm failed", e?.message || e);
        autoConfirmRanRef.current = false; // 실패 시 재시도 허용
      }
    })();
  }, [room]);

  // 팀 전체 랭킹 등수 (티켓에 "랭킹 N위" 표시용)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const map = await getTeamRankMap();
        if (!cancelled) setRankMap(map);
      } catch (e) {
        console.error("[MatchRoomDetailPage] getTeamRankMap failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 선수 전체 랭킹 등수 (라인업에서 1~3위 선수 왕관 표시용)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const map = await getPlayerRankMap();
        if (!cancelled) setPlayerRankMap(map);
      } catch (e) {
        console.error("[MatchRoomDetailPage] getPlayerRankMap failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!room) return;
    if (initOnceRef.current) return;
    initOnceRef.current = true;

    const initialDate = room.scheduledAt ? String(room.scheduledAt).slice(0, 10) : "";
    const initialTime = room.scheduledAt ? new Date(room.scheduledAt).toTimeString().slice(0, 5) : "";

    setSelectedDate(initialDate);
    // 처음(예약 일정 없음)이면 시간도 미선택 상태로 둔다 (현재 시각 자동 선택 X)
    setSelectedTime(initialTime);

    const today = new Date();
    const y = initialDate ? Number(initialDate.slice(0, 4)) : today.getFullYear();
    const m = initialDate ? Number(initialDate.slice(5, 7)) - 1 : today.getMonth();
    setCalYear(y);
    setCalMonth(m);

    const addr = toStr(room?.fieldAddress);
    const lat = room?.fieldLat;
    const lng = room?.fieldLng;
    if (addr) setFieldAddress(addr);
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) setFieldLatLng({ lat: Number(lat), lng: Number(lng) });

    const dur = room?.durationMin;
    if (Number.isFinite(Number(dur)) && Number(dur) > 0) setDurationMin(Number(dur));

    const st = toStr(room?.status);
    const proposer = toStr(room?.proposedByClubId);
    const wantCounter = !!location.state?.counter; // 받은 팀이 "다른 일정 제안"으로 진입
    if (st === "accepted") setEditMode(true);
    else if (st === "proposed") setEditMode(wantCounter || (!!myClubId && proposer === myClubId));
    else setEditMode(false);

    if (room.myScore != null) setMyScoreInput(String(room.myScore));
    if (room.oppScore != null) setOppScoreInput(String(room.oppScore));
  }, [room, myClubId]);

  // 구장 정하기 페이지일 때 상단 헤더 부제에 "내 팀 vs 상대팀" 표시
  useEffect(() => {
    if (!setHeaderSubtitle) return;
    if (isVenue && room) {
      const actorId = toStr(room.actorClubId);
      const iAmActor = !!myClubId && !!actorId && myClubId === actorId;
      const myT = iAmActor ? room.myTeam : room.oppTeam;
      const oppT = iAmActor ? room.oppTeam : room.myTeam;
      const myN = toStr(myT?.name) || "내 팀";
      const oppN = toStr(oppT?.name) || "상대팀";
      setHeaderSubtitle(`${myN} vs ${oppN}`);
    } else if (room) {
      // 매칭룸(채팅) 화면: 헤더에 팀명(headerConfig) 아래 "매칭공간 · 팀장이름" 부제
      setHeaderSubtitle(
        oppLeader.name ? `매칭공간 · ${oppLeader.name}` : "매칭공간"
      );
    } else {
      setHeaderSubtitle("");
    }
    return () => setHeaderSubtitle && setHeaderSubtitle("");
  }, [isVenue, room, myClubId, setHeaderSubtitle, oppLeader.name]);

  // ✅ 매칭룸 상단 헤더: 상대 팀 로고 + 팀명 + 햄버거(메뉴)
  // (구장 정하기 페이지는 기본 헤더 유지)
  useEffect(() => {
    if (!setHeaderConfig) return;
    if (!room) {
      setHeaderConfig(null);
      return;
    }
    // 구장 정하기 페이지: 단계별 뒤로가기
    //  - 날짜/시간 폼(venueMode==="direct") → 구장 위치 선택(맵 픽커) 다시 열기
    //  - 직접입력 선택 게이트(그 외) → 채팅방으로
    if (isVenue) {
      setHeaderConfig({
        onBack: () => {
          // 날짜/시간 폼 → 구장 위치 선택 다시 열기
          if (venueMode === "direct") setMapPickerOpen(true);
          // 게이트 → 히스토리 pop(채팅방으로). push 하면 채팅방 뒤로가기가 게이트로 되돌아가는 버그.
          else goBackOrHome(navigate);
        },
      });
      return;
    }
    const actorId = toStr(room.actorClubId);
    const iAmActor = !!myClubId && !!actorId && myClubId === actorId;
    const oppT = iAmActor ? room.oppTeam : room.myTeam;
    const oppN = toStr(oppT?.name) || "상대팀";
    const oppId = toStr(oppT?.clubId || oppT?.id);

    setHeaderConfig({
      title: oppN,
      avatarUrl: teamLogoSrc(oppT?.logoUrl),
      // 확정 경기: 뒤로가기 → 확정 탭 목록으로 치환.
      // navigate(-1)이면 조율 중 쌓인 히스토리(제안·구장 선택)로 되돌아가 혼란스럽다.
      ...(toStr(room.status) === "confirmed"
        ? { onBack: () => navigate("/match-roomlist?tab=confirmed", { replace: true }) }
        : null),
      onMenu: () => {
        if (!showBottomSheet) return;
        showBottomSheet(() => (
          <RoomMenuSheet>
            <RoomMenuTitle>{oppN}</RoomMenuTitle>
            {oppId && (
              <RoomMenuBtn
                type="button"
                onClick={() => {
                  hideBottomSheet && hideBottomSheet();
                  navigate(`/team/${oppId}`);
                }}
              >
                상대 팀 프로필 보기
              </RoomMenuBtn>
            )}
            <RoomMenuBtn
              type="button"
              onClick={() => {
                hideBottomSheet && hideBottomSheet();
                navigate("/match-roomlist");
              }}
            >
              매칭룸 목록으로
            </RoomMenuBtn>
            <RoomMenuBtn
              type="button"
              $danger
              onClick={() => {
                hideBottomSheet && hideBottomSheet();
                setReportReason("");
                setReportOpen(true);
              }}
            >
              🚩 상대 팀 신고하기
            </RoomMenuBtn>
            {(toStr(room?.status) === "accepted" ||
              toStr(room?.status) === "proposed") && (
              <RoomMenuBtn
                type="button"
                $danger
                onClick={() => {
                  hideBottomSheet && hideBottomSheet();
                  setCancelSheetOpen(true);
                }}
              >
                ✖ 매칭 취소
              </RoomMenuBtn>
            )}
            <RoomMenuBtn
              type="button"
              $muted
              onClick={() => hideBottomSheet && hideBottomSheet()}
            >
              닫기
            </RoomMenuBtn>
          </RoomMenuSheet>
        ));
      },
    });

    return () => setHeaderConfig && setHeaderConfig(null);
  }, [isVenue, room, myClubId, setHeaderConfig, showBottomSheet, hideBottomSheet, navigate, venueMode, roomId]);

  // 상대 팀장과의 DM 채팅방 확보 (매칭룸 채팅 탭에서 사용)
  useEffect(() => {
    if (!room || !myUid || !myClubId) return;
    let alive = true;
    (async () => {
      try {
        const actorId = toStr(room.actorClubId);
        const targetId = toStr(room.targetClubId);
        // 로그인 팀이 이 경기 참가자일 때만 채팅 확보 (다른 팀 경기 조회 시 부수효과 방지)
        if (myClubId !== actorId && myClubId !== targetId) return;
        const oppClubId = myClubId === actorId ? targetId : actorId;
        if (!oppClubId) return;
        const oppClub = await getClubById(oppClubId);
        const oppOwnerUid = toStr(oppClub?.ownerUid);
        if (!oppOwnerUid || oppOwnerUid === myUid) return;
        // 상대 팀장 프로필(사진·이름) 조회 → 채팅 헤더/읽음표시에 사용
        const leaderDoc = await getUserDoc(oppOwnerUid).catch(() => null);
        if (alive) {
          setOppLeader({
            uid: oppOwnerUid,
            name: toStr(leaderDoc?.nickname),
            avatarUrl: toStr(leaderDoc?.avatarUrl),
          });
        }
        // 매칭룸마다 독립 채팅 (chatId = match_{roomId})
        const cid = await getOrCreateMatchRoomChat({
          matchRoomId: toStr(roomId),
          myUid,
          otherUid: oppOwnerUid,
        });
        if (alive && cid) setChatId(toStr(cid));
      } catch (e) {}
    })();
    return () => {
      alive = false;
    };
  }, [room, myUid, myClubId, roomId]);

  // "직접 입력"을 고른 뒤에만 지도 피커를 먼저 한 번 자동 오픈.
  // (방식 선택 게이트를 먼저 보여주기 위해 venueMode === "direct" 일 때만)
  useEffect(() => {
    if (!isVenue) {
      venueAutoOpenRef.current = false;
      return;
    }
    if (venueAutoOpenRef.current) return;
    if (venueMode !== "direct") return;
    const st = toStr(room?.status);
    if (st === "accepted" && !fieldLatLng) {
      venueAutoOpenRef.current = true;
      setMapPickerOpen(true);
    }
  }, [isVenue, room?.status, fieldLatLng, venueMode]);

  useEffect(() => {
    const kakao = window.kakao;
    const st = toStr(room?.status);
    const isAdjustingNow = st === "accepted" || st === "proposed";
    if (!isAdjustingNow) return;

    if (!mapRef.current) return;
    if (mapObjRef.current) return;

    if (!kakao || !kakao.maps) return;

    const runInit = () => {
      if (!mapRef.current) return;
      if (mapObjRef.current) return;

      const center = fieldLatLng
        ? new kakao.maps.LatLng(fieldLatLng.lat, fieldLatLng.lng)
        : new kakao.maps.LatLng(37.5665, 126.978);

      const map = new kakao.maps.Map(mapRef.current, { center, level: 4 });
      const marker = new kakao.maps.Marker({ position: center });
      marker.setMap(map);

      mapObjRef.current = map;
      markerRef.current = marker;
    };

    if (typeof kakao.maps.load === "function") kakao.maps.load(runInit);
    else runInit();
  }, [room?.status, fieldLatLng, venueMode]);

  useEffect(() => {
    const kakao = window.kakao;
    if (!kakao || !kakao.maps) return;
    if (!mapObjRef.current || !markerRef.current) return;
    if (!fieldLatLng) return;

    const pos = new kakao.maps.LatLng(fieldLatLng.lat, fieldLatLng.lng);
    markerRef.current.setPosition(pos);
    mapObjRef.current.setCenter(pos);
  }, [fieldLatLng]);

  useEffect(() => {
    const kakao = window.kakao;
    const st = toStr(room?.status);
    const isAdjustingNow = st === "accepted" || st === "proposed";
    if (!isAdjustingNow) return;

    if (fieldLatLng) return;

    const region = toStr(room?.myTeam?.region) || `${toStr(room?.myTeam?.regionSido)} ${toStr(room?.myTeam?.regionGu)}`.trim();
    if (!region) return;

    if (!kakao || !kakao.maps || !kakao.maps.services) return;

    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.addressSearch(region, (result, status) => {
      if (status !== kakao.maps.services.Status.OK) return;
      const first = result && result[0] ? result[0] : null;
      if (!first) return;
      const lat = Number(first.y);
      const lng = Number(first.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      // ✅ 비동기 콜백이 늦게 도착해 "이미 로드된 실제 구장 좌표/주소"를 지역 기본값으로
      //    덮어쓰지 않도록 함수형 가드 (덮어쓰면 받는 팀 핀이 엉뚱한 곳을 가리킴)
      setFieldLatLng((prev) => (prev ? prev : { lat, lng }));
      setFieldAddress((prev) => (toStr(prev) ? prev : region));
    });
  }, [room?.status, room?.myTeam?.region, room?.myTeam?.regionSido, room?.myTeam?.regionGu, fieldLatLng, fieldAddress]);

  const handlePickVenue = (venue) => {
    if (!venue) return;
    const addr = toStr(venue.address);
    if (addr) setFieldAddress(addr);
    if (
      Number.isFinite(Number(venue.lat)) &&
      Number.isFinite(Number(venue.lng))
    ) {
      setFieldLatLng({ lat: Number(venue.lat), lng: Number(venue.lng) });
    }
    setVenueImageUrl(toStr(venue.imageUrl));
  };

  // 카카오T식 지도 픽커에서 위치 확정
  const handleMapPickerConfirm = ({ address, lat, lng }) => {
    if (address) setFieldAddress(address);
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      setFieldLatLng({ lat: Number(lat), lng: Number(lng) });
    }
    setVenueImageUrl(""); // 지도로 직접 잡은 위치는 제휴구장 이미지 해제
    setVenueMode("direct"); // 위치 확정 → 날짜/시간 선택 폼으로 이동
    setMapPickerOpen(false);
    // 위치 확정 → 구장 정하기 폼(선택된 구장 + 날짜)으로 이동
    if (!isVenue) navigate(`/match-roomdetail/${roomId}/venue`);
  };

  const openAddressSearch = () => {
    const daum = window.daum;
    const kakao = window.kakao;

    if (!daum || !daum.Postcode) {
      showAlert("주소 검색 스크립트가 아직 로드되지 않았습니다.");
      return;
    }
    if (!kakao || !kakao.maps || !kakao.maps.services) {
      showAlert("지도 스크립트가 아직 로드되지 않았습니다.");
      return;
    }

    new daum.Postcode({
      oncomplete: (data) => {
        const roadAddr = data.roadAddress || "";
        const jibunAddr = data.jibunAddress || "";
        const address = roadAddr || jibunAddr;
        if (!address) return;

        setFieldAddress(address);
        setVenueImageUrl(""); // 직접 주소 검색 시 제휴구장 이미지 해제

        const geocoder = new kakao.maps.services.Geocoder();
        geocoder.addressSearch(address, (result, status) => {
          if (status !== kakao.maps.services.Status.OK) {
            showAlert("주소 좌표를 찾을 수 없습니다.");
            return;
          }
          const first = result && result[0] ? result[0] : null;
          if (!first) return;
          const lat = Number(first.y);
          const lng = Number(first.x);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          setFieldLatLng({ lat, lng });

          try {
            if (mapObjRef.current && markerRef.current) {
              const pos = new kakao.maps.LatLng(lat, lng);
              markerRef.current.setPosition(pos);
              mapObjRef.current.setCenter(pos);
            }
          } catch (e) {}
        });
      },
    }).open();
  };

  const combinedLabel = useMemo(() => {
    if (!selectedDate || !selectedTime) return "날짜와 시간을 선택해주세요.";
    const iso = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
    return formatKoreanDateTime(iso);
  }, [selectedDate, selectedTime]);

  if (loading) {
    return (
      <PageWrap>
        <CenterState>매칭 정보를 불러오는 중입니다…</CenterState>
      </PageWrap>
    );
  }

  if (!room) {
    return (
      <PageWrap>
        <CenterState>매칭 정보를 찾을 수 없습니다.</CenterState>
      </PageWrap>
    );
  }

  const status = toStr(room.status);

  const actorClubId = toStr(room.actorClubId);
  const targetClubId = toStr(room.targetClubId);

  // 표시 관점: 팀 프로필에서 들어온 경우 그 팀(viewClubId) 기준으로 표시, 아니면 로그인 팀 기준
  const viewClubId = toStr(location.state?.viewClubId);
  const isParticipantClub = (cid) => !!cid && (cid === actorClubId || cid === targetClubId);
  const perspectiveClubId = isParticipantClub(viewClubId) ? viewClubId : myClubId;
  // 편집(결과 입력·평점·사진/코멘트) 가능: 내 팀 관점일 때만. 다른 팀 관점이면 읽기전용
  const isViewerMyTeam = !!myClubId && perspectiveClubId === myClubId;

  const isActor = !!perspectiveClubId && !!actorClubId && perspectiveClubId === actorClubId;

  const myTeamView = isActor ? room.myTeam : room.oppTeam;
  const oppTeamView = isActor ? room.oppTeam : room.myTeam;

  // 팀 전체 랭킹 등수 (없으면 미표시) — 표시 관점 기준
  const oppClubId = isActor ? targetClubId : actorClubId;
  const myRank = rankMap?.get(perspectiveClubId) || null;
  const oppRank = rankMap?.get(oppClubId) || null;

  const actorScoreSaved = room.myScore;
  const targetScoreSaved = room.oppScore;

  // ── 조율 단계 라인업 확정 (편집은 로그인 팀 기준) ──
  const myIsActorClub = !!myClubId && myClubId === actorClubId;
  const myLineupSnap = myIsActorClub ? room.myLineup : room.oppLineup; // 내 클럽 라인업
  const oppLineupSnap = myIsActorClub ? room.oppLineup : room.myLineup;
  const myLineupConfirmed = !!myLineupSnap?.confirmed;
  const oppLineupConfirmed = !!oppLineupSnap?.confirmed;
  const bothLineupsConfirmed = myLineupConfirmed && oppLineupConfirmed;
  const matchSizeKey = toStr(room.matchSizeKey) || toStr(myLineupSnap?.matchSizeKey) || toStr(oppLineupSnap?.matchSizeKey);

  const myStats = myTeamView?.stats || {};
  const oppStats = oppTeamView?.stats || {};
  const myRecord = `${myStats.wins ?? 0}승 ${myStats.losses ?? 0}패`;
  const oppRecord = `${oppStats.wins ?? 0}승 ${oppStats.losses ?? 0}패`;
  const myWinRate = Math.round((myStats.winRate ?? 0) * 100);
  const oppWinRate = Math.round((oppStats.winRate ?? 0) * 100);

  const myPlayers = Array.isArray((isActor ? room.myLineup?.players : room.oppLineup?.players))
    ? (isActor ? room.myLineup.players : room.oppLineup.players).slice(0, 10)
    : [];
  const oppPlayers = Array.isArray((isActor ? room.oppLineup?.players : room.myLineup?.players))
    ? (isActor ? room.oppLineup.players : room.myLineup.players).slice(0, 10)
    : [];

  // 후보(벤치) 선수 — 표시 관점 기준
  const mySubPlayers = (isActor ? room.myLineup?.subPlayers : room.oppLineup?.subPlayers) || [];
  const oppSubPlayers = (isActor ? room.oppLineup?.subPlayers : room.myLineup?.subPlayers) || [];

  const isAdjusting = status === "accepted" || status === "proposed" || status === "awaiting_venue_approval";
  const proposerClubId = toStr(room.proposedByClubId);
  const iAmProposer = !!myClubId && !!proposerClubId && myClubId === proposerClubId;
  // "구장 정하기 방식 선택" 게이트(제휴/직접) 노출 조건:
  //  - accepted: 아직 직접입력을 고르기 전
  //  - proposed + 수정/역제안(editMode): 보낸 팀 "제안 수정"·받은 팀 "다른 일정 제안" 모두
  //    방식(제휴/직접)부터 다시 고르도록 게이트를 먼저 보여줌
  const showVenueGate =
    venueMode !== "direct" &&
    (status === "accepted" || (status === "proposed" && editMode));
  const canEdit = status === "accepted" ? true : status === "proposed" ? editMode : false;
  const canConfirm = status === "proposed" && !!myClubId && !iAmProposer;

  const isConfirmed = status === "confirmed";
  const isFinished = status === "finished";
  const isCancelled = status === "cancelled";
  const isVoided = toStr(room?.resultState) === "void"; // 결과 미입력 무효 종결

  // 팀원(비팀장)은 "조율중"(accepted/proposed) 경기의 상세를 볼 수 없음 → 안내 화면으로 대체.
  // 확정/지난경기(finished)/취소는 팀원도 열람 가능.
  if (isAdjusting && !isTeamLeader) {
    return (
      <PageWrap>
        <MemberGateWrap>
          <MemberGateIcon>🤝</MemberGateIcon>
          <MemberGateTitle>조율 중인 경기예요</MemberGateTitle>
          <MemberGateText>
            팀장이 상대 팀과 일정·구장을 조율하고 있어요.{"\n"}
            경기가 확정되면 팀원도 상세 내용을 확인할 수 있어요.
          </MemberGateText>
          <MemberGateBtn type="button" onClick={() => goBackOrHome(navigate)}>
            돌아가기
          </MemberGateBtn>
        </MemberGateWrap>
      </PageWrap>
    );
  }

  // 진행단계 스텝퍼 (직접 입력 흐름)
  // 결제 단계 제거 (현장 정산만 있어 앱 결제 없음)
  // 단계: 라인업(양 팀 확정) → 구장·일정(제안) → 확정(상대 수락)
  //  - 구장·일정은 제안 시 함께 설정되므로 한 단계로 합침
  const STEP_LABELS = ["라인업", "구장·일정", "확정"];
  const stepStates = (() => {
    if (status === "accepted")
      return bothLineupsConfirmed
        ? ["done", "cur", "todo"]
        : ["cur", "todo", "todo"];
    if (status === "proposed") return ["done", "done", "cur"];
    if (status === "awaiting_venue_approval") return ["done", "done", "cur"];
    if (status === "confirmed") return ["done", "done", "done"];
    if (status === "finished") return ["done", "done", "done"];
    if (status === "cancelled") return ["todo", "todo", "todo"];
    return ["cur", "todo", "todo"];
  })();

  // 진행 단계 요약 배지 ("1/3 · 라인업 확정 중")
  const stepSummary = (() => {
    if (isVoided) return "무효 처리";
    if (status === "finished") return "경기 종료";
    if (status === "cancelled") return "취소된 매칭";
    if (status === "awaiting_venue_approval") return "구장 승인 대기 중";
    if (status === "confirmed") return "3/3 · 확정 완료";
    const labelNote = {
      라인업: "라인업 확정 중",
      "구장·일정": "구장·일정 정하는 중",
    };
    const curIdx = stepStates.findIndex((s) => s === "cur");
    if (curIdx >= 0) {
      const lb = STEP_LABELS[curIdx];
      return `${curIdx + 1}/3 · ${labelNote[lb] || `${lb} 단계`}`;
    }
    return "";
  })();

  const oppName = toStr(oppTeamView?.name) || "상대팀";
  const chatSystemNotice =
    status === "accepted"
      ? `${oppName}와 매칭이 성사됐어요 · 일정을 조율해 보세요 🏀`
      : status === "proposed"
      ? "구장·일정이 제안됐어요 · 채팅으로 조율하세요"
      : status === "confirmed"
      ? "경기가 확정됐어요 🎉"
      : isVoided
      ? "양 팀 결과 미입력으로 무효 처리됐어요 · 전적 미반영"
      : status === "finished"
      ? "경기가 종료됐어요 · 수고하셨습니다"
      : status === "cancelled"
      ? "이 매칭은 취소되었습니다"
      : "";

  const resultState = toStr(room.resultState);
  const resultSubmittedBy = toStr(room?.result?.submittedByClubId);
  const iSubmittedResult = !!myClubId && !!resultSubmittedBy && myClubId === resultSubmittedBy;

  const canAcceptResult = isConfirmed && resultState === "waiting_accept" && !iSubmittedResult && !resultBusy;

  /* ✅ 경기 결과 입력 노출 타이밍: 경기 시작(확정 scheduledAt) + 선택한 경기 시간(durationMin) 후 */
  const scheduledAtMs = (() => {
    const t = room?.scheduledAt ? new Date(room.scheduledAt).getTime() : NaN;
    return Number.isFinite(t) ? t : NaN;
  })();

  const resultDurMin = Number(room?.durationMin) || Number(durationMin) || 120;
  const resultOpenAtMs = Number.isFinite(scheduledAtMs)
    ? scheduledAtMs + resultDurMin * 60 * 1000
    : NaN;
  const canOpenResultInput = !resultState && Number.isFinite(resultOpenAtMs) && Date.now() >= resultOpenAtMs;

  // 종료(지난 경기) 판정: 결과 확정(finished)됐거나, 확정 경기인데 경기 종료시각이 지난 경우
  const isEnded = Number.isFinite(resultOpenAtMs) && Date.now() >= resultOpenAtMs;
  const isPast = isFinished || (isConfirmed && isEnded);

  // 결과 확정된 완료 경기의 승/패/무 판정 (내 팀 관점)
  const myScoreNum = Number(isActor ? actorScoreSaved : targetScoreSaved);
  const oppScoreNum = Number(isActor ? targetScoreSaved : actorScoreSaved);
  const hasFinalScore =
    (resultState === "confirmed" || isFinished) &&
    Number.isFinite(myScoreNum) &&
    Number.isFinite(oppScoreNum);
  const outcome = !hasFinalScore
    ? null
    : myScoreNum > oppScoreNum
    ? "win"
    : myScoreNum < oppScoreNum
    ? "lose"
    : "draw";

  // 상단 배너(종료 경기): 무효 → 승/패/무 → 경기 종료 폴백
  const pastBanner =
    isVoided
      ? { icon: "🚫", title: "무효 처리", sub: "양 팀 결과 미입력 · 전적에 반영되지 않아요", tone: "slate" }
      : outcome === "win"
      ? { icon: "🏆", title: "경기 승리", sub: "멋진 승리예요 · 수고하셨습니다", tone: "green" }
      : outcome === "lose"
      ? { icon: "😞", title: "경기 패배", sub: "아쉬운 경기였어요 · 다음을 기약해요", tone: "red" }
      : outcome === "draw"
      ? { icon: "🤝", title: "경기 무승부", sub: "치열한 경기였어요 · 수고하셨습니다", tone: "slate" }
      : { icon: "🏁", title: "경기 종료", sub: "경기가 종료됐어요 · 수고하셨습니다", tone: "slate" };

  const resultOpenAtLabel = Number.isFinite(resultOpenAtMs)
    ? formatKoreanDateTime(new Date(resultOpenAtMs).toISOString())
    : "";

  // 결과 자동 확정 기한(경기 종료일 + 3일) 라벨
  const autoConfirmAtMs = Number.isFinite(resultOpenAtMs)
    ? resultOpenAtMs + AUTO_CONFIRM_DAYS * 24 * 60 * 60 * 1000
    : NaN;
  const autoConfirmAtLabel = Number.isFinite(autoConfirmAtMs)
    ? formatKoreanDateTime(new Date(autoConfirmAtMs).toISOString())
    : "";

  const handlePropose = async () => {
    if (!myClubId) {
      showAlert("팀 정보를 확인할 수 없습니다.");
      return;
    }
    if (!selectedDate || !selectedTime) return;
    if (!toStr(fieldAddress) || !fieldLatLng) return;

    const iso = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();

    try {
      await proposeMatchSchedule({
        matchRequestId: room.id,
        scheduledAtISO: iso,
        fieldAddress,
        fieldLatLng,
        durationMin,
        proposedByClubId: myClubId,
      });
      await refresh();
      setEditMode(false);
      setVenueMode("none");
      // 제안 완료 → 구장정하기 페이지(제안 대기 화면) 대신 채팅 화면으로 이동.
      // (history pop: venue 항목을 빼서 채팅 뒤로가기가 venue로 되돌아가지 않게)
      if (isVenue) goBackOrHome(navigate);
    } catch (e) {
      showAlert(e?.message || "일정 제안에 실패했습니다.");
    }
  };

  const handleConfirmSchedule = async () => {
    if (!myClubId) return;
    try {
      await confirmProposedSchedule({ matchRequestId: room.id, confirmedByClubId: myClubId });
      // 확정 당사자는 여기서 축하창을 띄우고, 실시간 워처가 다시 띄우지 않도록 가드를 세운다.
      finalAnimRef.current = true;
      setShowConfirmAnim(true); // (2-7) 확정 애니메이션
      await refresh();
      // 확정 후에도 같은 경로(/match-roomdetail/:roomId)에 머문다. 화면은 status로 전환되므로
      // 추가 navigate가 필요 없다. 확정 화면의 뒤로가기는 headerConfig.onBack에서 처리한다.
    } catch (e) {
      showAlert(e?.message || "일정 확정에 실패했습니다.");
    }
  };

  // 제휴구장 제안 수락 → 구장주 승인 대기(예약 요청 생성). 결제 없음(현장 정산).
  const handleAcceptPartnerProposal = async () => {
    if (!myClubId || !room?.id) return;
    try {
      await requestVenueReservationForMatch({ matchId: room.id, requestedByClubId: myClubId });
      await refresh();
      await loadPartnerPay();
      showToast && showToast({ message: "구장 예약을 요청했어요. 구장주 승인을 기다려 주세요." });
    } catch (e) {
      showAlert(e?.message || "예약 요청에 실패했습니다.");
    }
  };

  // 취소 사유 선택 시트에서 확정 → 사유/환불(구조)와 함께 취소
  const handleCancelMatch = async (reasonKey, reasonText) => {
    if (cancelBusy) return;
    // 경기/매칭 취소는 팀장만 가능
    if (!isTeamLeader) {
      showAlert("경기 취소는 팀장만 할 수 있어요.");
      return;
    }
    setCancelBusy(true);
    try {
      await cancelMatchRequest({
        matchRequestId: room.id,
        cancelledByClubId: myClubId,
        reasonKey,
        reasonText,
        cancelledByName: toStr(myTeamView?.name) || toStr(room?.myTeam?.name) || "상대팀",
      });
      setCancelSheetOpen(false);
      await refresh();
      goBackOrHome(navigate);
    } catch (e) {
      showAlert(e?.message || "매칭 취소에 실패했습니다.");
    } finally {
      setCancelBusy(false);
    }
  };

  // 보낸 제안만 취소 (매칭은 유지) → proposed → accepted(조율중) 복귀, 재제안 가능
  const handleCancelProposal = async () => {
    if (
      !await showConfirm(
        "보낸 구장·일정 제안을 취소할까요?\n매칭은 유지되며 다시 제안할 수 있어요."
      )
    )
      return;
    try {
      await cancelProposedSchedule({ matchRequestId: room.id, cancelledByClubId: myClubId });
      await refresh();
      showToast && showToast({ message: "보낸 제안을 취소했어요. 다시 제안할 수 있어요." });
    } catch (e) {
      showAlert(e?.message || "제안 취소에 실패했습니다.");
    }
  };

  // 확정 경기 취소 — 사유 선택 시트 오픈(결제건이면 환불 안내 포함). 팀장만 가능.
  const handleCancelConfirmedMatch = () => {
    if (!isTeamLeader) {
      showAlert("경기 취소는 팀장만 할 수 있어요.");
      return;
    }
    setCancelSheetOpen(true);
  };

  const handleSubmitResult = async () => {
    if (!myClubId) return;

    const myScore = toStr(myScoreInput);
    const oppScore = toStr(oppScoreInput);

    if (!myScore || !oppScore) {
      showAlert("점수를 입력해 주세요.");
      return;
    }

    const myN = Number(myScore);
    const oppN = Number(oppScore);

    if (!Number.isFinite(myN) || !Number.isFinite(oppN)) {
      showAlert("점수는 숫자만 입력해 주세요.");
      return;
    }

    const actorScore = isActor ? myN : oppN;
    const targetScore = isActor ? oppN : myN;

    setResultBusy(true);
    try {
      await submitMatchResultWithMedia({
        matchRequestId: room.id,
        actorScore,
        targetScore,
        opponentRating: oppRating,
        submittedByClubId: myClubId,
        authorName: authorDisplayName,
        authorUid: myUid,
        authorRole: isTeamLeader ? "owner" : "member",
      });

      setOppRating(0);
      await refresh();
      showAlert("결과를 제출했습니다. 상대팀 승인을 기다립니다.");
    } catch (e) {
      showAlert(e?.message || "결과 제출에 실패했습니다.");
    } finally {
      setResultBusy(false);
    }
  };

  // ✅ 지난 경기 리뷰 제출/수정 (팀장·팀원 공통) — 상대 팀 평점
  const handleSubmitReview = async () => {
    if (!myClubId || !myUid) {
      showAlert("로그인 정보를 확인할 수 없습니다.");
      return;
    }
    if (reviewStars < 1) {
      showAlert("별점을 선택해 주세요.");
      return;
    }
    const targetClubId = isActor ? toStr(room.targetClubId) : toStr(room.actorClubId);
    setReviewBusy(true);
    try {
      await submitMatchReview({
        matchRequestId: room.id,
        raterUid: myUid,
        raterName: toStr(userDoc?.nickname) || toStr(userDoc?.name),
        raterClubId: myClubId,
        targetClubId,
        stars: reviewStars,
        comment: reviewComment,
      });
      reviewPrefillRef.current = ""; // 새 데이터로 prefill 재적용 허용
      await refresh();               // room.reviews 갱신 → 등록된 리뷰 카드로 표시
      setEditingReview(false);
      showAlert("리뷰가 등록되었습니다.");
      return;
    } catch (e) {
      showAlert(e?.message || "리뷰 등록에 실패했습니다.");
    } finally {
      setReviewBusy(false);
    }
  };

  const handleAcceptResult = async () => {
    if (!myClubId) return;
    if (!isTeamLeader) {
      showAlert("경기 결과 인정은 팀장만 할 수 있어요.");
      return;
    }
    setResultBusy(true);
    try {
      await acceptMatchResult({ matchRequestId: room.id, confirmedByClubId: myClubId });
      await refresh();
      showAlert("경기 결과가 확정되었습니다.");
      navigate("/match-roomlist");
    } catch (e) {
      showAlert(e?.message || "결과 인정에 실패했습니다.");
    } finally {
      setResultBusy(false);
    }
  };

  const handleDisputeResult = async () => {
    if (!isTeamLeader) {
      showAlert("이의 제기는 팀장만 할 수 있어요.");
      return;
    }
    const ok = await showConfirm(
      "이의를 제기하면 입력된 결과가 취소되고, 두 팀이 협의 후 결과를 다시 입력할 수 있어요. 진행할까요?"
    );
    if (!ok) return;

    setResultBusy(true);
    try {
      await disputeMatchResult({ matchRequestId: room.id });
      await refresh();
      showAlert("이의가 제기됐어요. 상대팀과 협의 후 결과를 다시 입력해 주세요.");
    } catch (e) {
      showAlert(e?.message || "이의 제기에 실패했습니다.");
    } finally {
      setResultBusy(false);
    }
  };

  const goTeamDetail = (team) => {
    if (!team) return;
    const slug = team.id || team.clubId || encodeURIComponent(team.name || "");
    navigate(`/team/${slug}`);
  };

  const goPlayerDetail = (p) => {
    if (!p) return;
    navigate(`/player/${p.userId}`);
  };

  const renderPlayerRow = (p, fallbackText) => {
    const avatar = playerAvatars?.[p.userId] || p.photoUrl || "";
    const posKo = POSITION_LABEL[p.mainPosition] || "포지션";

    const height = p.heightCm ? `${p.heightCm}cm` : null;
    const weight = p.weightKg ? `${p.weightKg}kg` : null;
    const bodyText = [height, weight].filter(Boolean).join(" / ");

    // ✅ 실력(개인 프로필) 표시 — 승패 대신
    const skillLabel = SKILL_LABEL[toStr(p.skillLevel)] || "";

    // 선수 전체 랭킹 1~3위면 프로필 사진 위 왕관
    const pRank = playerRankMap?.get(p.userId) || null;
    const showPlayerCrown = !!pRank && pRank <= 3;

    // 내 이름 줄 강조
    const isMe = !!myUid && toStr(p.userId) === myUid;

    return (
      <PlayerRow key={p.userId} $me={isMe}>
        <PlayerLeft onClick={() => goPlayerDetail(p)}>
          <PlayerAvatarWrap>
            {showPlayerCrown ? (
              <PlayerCrown src={images.logo} alt={`${pRank}위`} />
            ) : null}
            {avatar ? (
              <PlayerAvatar src={avatar} alt={p.nickname} />
            ) : (
              <AvatarPlaceholder size={34} />
            )}
          </PlayerAvatarWrap>
          <PlayerText>
            <PlayerTopRow>
              <PositionText>{formatPositionKo(posKo)}</PositionText>
              <PlayerName>{p.nickname}{isMe ? " (나)" : ""}</PlayerName>
            </PlayerTopRow>
          </PlayerText>
        </PlayerLeft>
        {skillLabel ? (
          <SkillBadge>{skillLabel}</SkillBadge>
        ) : (
          <PlayerBodyMeta>{bodyText || "실력 미입력"}</PlayerBodyMeta>
        )}
      </PlayerRow>
    );
  };

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  const todayMidnight = new Date(todayY, todayM, todayD);
  const atCurrentMonth = calYear === todayY && calMonth === todayM;

  const handleDayClick = (day) => {
    if (!day) return;
    // 지난 날짜는 선택 불가
    if (new Date(calYear, calMonth, day) < todayMidnight) return;
    const dateStr = `${calYear}-${pad2(calMonth + 1)}-${pad2(day)}`;
    setSelectedDate(dateStr);
  };

  const goPrevMonth = () => {
    // 이번 달보다 과거로는 이동 금지
    if (atCurrentMonth) return;
    let y = calYear;
    let m = calMonth - 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    setCalYear(y);
    setCalMonth(m);
  };

  const goNextMonth = () => {
    let y = calYear;
    let m = calMonth + 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setCalYear(y);
    setCalMonth(m);
  };

  // ───── 채팅 안에 노출할 구장 제안 카드 (status=proposed) ─────
  const venueWhenLabel = room.scheduledAt
    ? formatKoreanDateTime(room.scheduledAt)
    : "-";
  const venueDurLabel = (() => {
    const d = Number(durationMin) || Number(room?.durationMin) || 0;
    if (!d) return "";
    const h = Math.floor(d / 60);
    const m = d % 60;
    return `${h ? `${h}시간` : ""}${m ? ` ${m}분` : ""}`.trim();
  })();

  // ───── 확정 화면용: "5.16(토) 16:00-18:00" 포맷 ─────
  const confDateLabel = (() => {
    if (!room.scheduledAt) return "일정 미정";
    const d = new Date(room.scheduledAt);
    if (Number.isNaN(d.getTime())) return "일정 미정";
    const wk = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    const dur = Number(durationMin) || Number(room?.durationMin) || 120;
    const e = new Date(d.getTime() + dur * 60 * 1000);
    const hm = (x) => `${pad2(x.getHours())}:${pad2(x.getMinutes())}`;
    return `${d.getMonth() + 1}.${d.getDate()}(${wk}) ${hm(d)}-${hm(e)}`;
  })();

  // 경기일까지 남은 일수(D-day) — 확정 배너 우측 표시용
  const confDDay = (() => {
    if (!room.scheduledAt) return null;
    const d = new Date(room.scheduledAt);
    if (Number.isNaN(d.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return "D-DAY";
    return diff > 0 ? `D-${diff}` : `D+${-diff}`;
  })();

  const openDirections = () => {
    const name = encodeURIComponent(toStr(fieldAddress) || "경기 구장");
    const url =
      fieldLatLng?.lat && fieldLatLng?.lng
        ? `https://map.kakao.com/link/to/${name},${fieldLatLng.lat},${fieldLatLng.lng}`
        : `https://map.kakao.com/link/search/${name}`;
    window.open(url, "_blank");
  };

  const shareMatch = async () => {
    const myName = toStr(myTeamView?.name) || "우리 팀";
    const text =
      `[경기 확정] ${myName} vs ${oppName}\n` +
      `일시: ${confDateLabel}\n` +
      `구장: ${toStr(fieldAddress) || "-"}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "경기 확정", text });
      } else {
        await navigator.clipboard.writeText(text);
        showAlert("경기 정보가 복사되었어요.");
      }
    } catch (e) {}
  };

  // ───── 취소 화면용 ─────
  const cancelledBy = toStr(room?.cancelledByClubId);
  const iCancelled = !!cancelledBy && cancelledBy === myClubId;
  const cancelReasonLabel = !cancelledBy
    ? "경기 취소"
    : iCancelled
    ? "우리팀 취소"
    : "상대팀 취소";
  const cancelSubText = !cancelledBy
    ? "확정된 경기가 취소됐어요."
    : iCancelled
    ? "우리팀 사정으로 확정된 경기가 취소됐어요."
    : "상대팀 사정으로 확정된 경기가 취소됐어요.";
  const cancelReasonStored = toStr(room?.cancelReason); // 선택한 실제 취소 사유(상대팀에 표시)
  const cancelRefund = room?.refund || null; // { status:"refunded"|"pending", amount } | null

  // 제안한 구장 사진(제휴구장). 있으면 지도 대신 사진을 보여준다(직접입력 구장은 사진이 없어 지도 폴백).
  const propVenueImage = toStr(partnerPay?.pb?.venueImageUrl);
  // 제안한 구장(제휴구장)이면 카드 클릭 시 구장 상세로 이동. 직접입력 구장은 상세가 없어 이동 안 함.
  const propVenueId = toStr(partnerPay?.pb?.venueId);
  const openVenueDetail = () => {
    // 매칭 카드(제안됨/확정/지난경기)에서 들어온 구장 상세는 읽기 전용.
    // 예약은 매칭룸의 구장·일정 제안/결제 흐름에서만 가능하다.
    if (propVenueId) navigate(`/venue-book/${propVenueId}?view=1`);
  };

  // 구장·일정 제안 카드 — 채팅의 제안 시점 자리에 말풍선처럼 놓인다(제안자 쪽 정렬)
  const proposalCard =
    status === "proposed" ? (
      <PropCard
        onClick={openVenueDetail}
        role={propVenueId ? "button" : undefined}
        style={{ cursor: propVenueId ? "pointer" : "default" }}
      >
        <PropMapWrap>
          {propVenueImage ? (
            <>
              <PropBadge>🏟️ 구장 사진</PropBadge>
              <PropVenueImg src={propVenueImage} alt={toStr(fieldAddress) || "구장 사진"} />
            </>
          ) : (
            <>
              <PropBadge>🗺️ 지도 위치</PropBadge>
              <VenueMiniMap latLng={fieldLatLng} height={84} />
            </>
          )}
        </PropMapWrap>
        <PropBody>
          <PropName>{toStr(fieldAddress) || "선택한 구장 위치"}</PropName>
          <PropRow>
            <PropK>일시</PropK>
            <PropV>{venueWhenLabel}</PropV>
          </PropRow>
          {venueDurLabel && (
            <PropRow>
              <PropK>경기 시간</PropK>
              <PropV>{venueDurLabel}</PropV>
            </PropRow>
          )}
          {partnerPay?.pb && (
            <>
              <PropRow>
                <PropK>구장비</PropK>
                <PropV>
                  총 {Number(partnerPay.pb.totalPrice).toLocaleString()}원
                  <span style={{ color: "#6b7280", fontWeight: 600 }}> · 현장 정산</span>
                </PropV>
              </PropRow>
              <PropPayNote style={{ color: "#6b7280" }}>
                상대팀이 제안을 수락하면 구장주에게 예약을 요청해요
              </PropPayNote>
            </>
          )}
        </PropBody>
      </PropCard>
    ) : status === "awaiting_venue_approval" ? (
      <PropCard
        onClick={openVenueDetail}
        role={propVenueId ? "button" : undefined}
        style={{ cursor: propVenueId ? "pointer" : "default" }}
      >
        <PropMapWrap>
          <PropBadge>⏳ 구장 승인 대기</PropBadge>
          {propVenueImage ? (
            <PropVenueImg src={propVenueImage} alt={toStr(fieldAddress) || "구장 사진"} />
          ) : (
            <VenueMiniMap latLng={fieldLatLng} height={84} />
          )}
        </PropMapWrap>
        <PropBody>
          <PropName>{toStr(fieldAddress) || "선택한 구장"}</PropName>
          <PropRow>
            <PropK>일시</PropK>
            <PropV>{venueWhenLabel}</PropV>
          </PropRow>
          {venueDurLabel && (
            <PropRow>
              <PropK>경기 시간</PropK>
              <PropV>{venueDurLabel}</PropV>
            </PropRow>
          )}
          {partnerPay?.pb && (
            <PropRow>
              <PropK>구장비</PropK>
              <PropV>
                총 {Number(partnerPay.pb.totalPrice).toLocaleString()}원
                <span style={{ color: "#6b7280", fontWeight: 600 }}> · 현장 정산</span>
              </PropV>
            </PropRow>
          )}
          <PropPayNote style={{ color: "#2563eb" }}>
            구장주 승인을 기다리는 중이에요 · 승인되면 경기가 확정돼요
          </PropPayNote>
        </PropBody>
      </PropCard>
    ) : status === "confirmed" ? (
      <PropCard
        $confirmed
        onClick={openVenueDetail}
        role={propVenueId ? "button" : undefined}
        style={{ cursor: propVenueId ? "pointer" : "default" }}
      >
        <PropMapWrap>
          <PropBadge $confirmed>✅ 경기 확정</PropBadge>
          {propVenueImage ? (
            <PropVenueImg src={propVenueImage} alt={toStr(fieldAddress) || "구장 사진"} />
          ) : (
            <VenueMiniMap latLng={fieldLatLng} height={84} />
          )}
        </PropMapWrap>
        <PropBody>
          <PropName>{toStr(fieldAddress) || "확정된 구장"}</PropName>
          <PropRow>
            <PropK>일시</PropK>
            <PropV>{venueWhenLabel}</PropV>
          </PropRow>
          {venueDurLabel && (
            <PropRow>
              <PropK>경기 시간</PropK>
              <PropV>{venueDurLabel}</PropV>
            </PropRow>
          )}
          {partnerPay?.pb && (
            <PropRow>
              <PropK>구장비</PropK>
              <PropV>
                총 {Number(partnerPay.pb.totalPrice).toLocaleString()}원
                <span style={{ color: "#6b7280", fontWeight: 600 }}> · 현장 정산</span>
              </PropV>
            </PropRow>
          )}
        </PropBody>
      </PropCard>
    ) : null;

  // 진행 단계 스텝퍼 — 진행 단계 바를 펼칠 때만 노출
  const stepperEl = (
    <Stepper>
      {STEP_LABELS.map((lb, i) => (
        <Step key={lb}>
          <StepDot $state={stepStates[i]}>
            {stepStates[i] === "done" ? "✓" : i + 1}
          </StepDot>
          <StepLb $on={stepStates[i] !== "todo"}>{lb}</StepLb>
        </Step>
      ))}
    </Stepper>
  );

  // ───── 조율 단계: 상대 팀에 라인업 확정 요청 알림 ─────
  const handleSendLineupReminder = async () => {
    if (!room?.id || reminderBusy) return;
    try {
      setReminderBusy(true);
      await sendLineupReminder({ matchRequestId: room.id, fromClubId: myClubId });
      setReminderSent(true);
      showToast && showToast({ message: "상대팀에 라인업 확정 요청을 보냈어요." });
    } catch (e) {
      showToast && showToast({ message: e?.message || "알림 전송에 실패했어요." });
    } finally {
      setReminderBusy(false);
    }
  };

  // ───── 상대 팀 신고 제출 ─────
  const handleSubmitReport = async () => {
    const reason = toStr(reportReason);
    if (!reason) {
      showToast && showToast({ message: "신고 사유를 입력해 주세요." });
      return;
    }
    if (!myUid) {
      showToast && showToast({ message: "로그인이 필요합니다." });
      return;
    }
    // 상대 팀(관점 무관, 로그인 팀의 상대) 산출
    const actorId = toStr(room?.actorClubId);
    const iAmActor = !!myClubId && !!actorId && myClubId === actorId;
    const oppT = iAmActor ? room?.oppTeam : room?.myTeam;
    const oppClubId = toStr(oppT?.clubId || oppT?.id);
    if (!oppClubId) {
      showToast && showToast({ message: "상대 팀 정보를 찾을 수 없습니다." });
      return;
    }
    setReportBusy(true);
    try {
      await createTeamReport({
        clubId: oppClubId,
        clubName: toStr(oppT?.name),
        reporterUid: myUid,
        reporterNickname: toStr(userDoc?.nickname || userDoc?.name || ""),
        reason,
      });
      setReportOpen(false);
      setReportReason("");
      showToast && showToast({ message: "신고가 접수되었습니다. 검토 후 조치합니다." });
    } catch (e) {
      showToast && showToast({ message: e?.message || "신고 접수에 실패했습니다." });
    } finally {
      setReportBusy(false);
    }
  };

  // ───── 채팅 메시지 위에 고정되는 액션 바 (accepted / proposed 공통) ─────
  let chatTopBar = null;
  if (status === "accepted") {
    const iAmParticipant = myClubId === actorClubId || myClubId === targetClubId;
    if (!iAmParticipant) {
      chatTopBar = (
        <ActStack>
          <ActNote>양 팀이 라인업을 확정하면 구장·일정을 정합니다.</ActNote>
        </ActStack>
      );
    } else if (!bothLineupsConfirmed) {
      chatTopBar = (
        <ActStack>
          <ActRow>
            <ActPrimary style={{ flex: 1 }} type="button" onClick={() => setLineupSheetOpen(true)}>
              {myLineupConfirmed ? "우리 라인업 수정" : "우리 라인업 확정하기"}
            </ActPrimary>
            <ActGhost type="button" onClick={() => setLineupViewOpen(true)}>
              라인업 보기
            </ActGhost>
          </ActRow>
        </ActStack>
      );
    } else {
      chatTopBar = (
        <ActStack>
          <ActNote>✅ 양 팀 라인업 확정 완료 · 이제 구장·일정을 정해요</ActNote>
          <ActRow>
            <ActGhost type="button" onClick={() => setLineupSheetOpen(true)}>
              라인업 수정
            </ActGhost>
            <ActGhost type="button" onClick={() => setLineupViewOpen(true)}>
              라인업 보기
            </ActGhost>
          </ActRow>
          <ActRow>
            <ActPrimary
              type="button"
              onClick={() => {
                // 제휴 구장 / 직접 입력 선택 화면(venue 게이트)부터 보여준다
                setVenueMode("none");
                navigate(`/match-roomdetail/${roomId}/venue`);
              }}
            >
              구장·일정 제안하기
            </ActPrimary>
          </ActRow>
        </ActStack>
      );
    }
  } else if (status === "proposed") {
    chatTopBar = iAmProposer ? (
      partnerPay?.pb?.accepted ? (
        // 제휴구장: 상대팀이 수락함 → 결제는 위 구장 카드의 버튼으로 (중복 버튼 제거)
        <ActStack>
          <ActNote>✅ 상대팀이 제안을 수락했어요 · 아래 구장 카드에서 구장비를 결제해 주세요</ActNote>
        </ActStack>
      ) : (
        <ActStack>
          <ActNote>상대팀 응답을 기다리는 중…</ActNote>
          <ActRow>
            <ActGhost
              type="button"
              onClick={() => {
                // 구장 위치 선택(맵 픽커)이 아니라 날짜/시간 입력 화면을 바로 띄운다.
                // (이 화면의 "변경" 버튼으로 구장 위치도 바꿀 수 있음)
                setEditMode(true);
                setVenueMode("none");
                navigate(`/match-roomdetail/${roomId}/venue`);
              }}
            >
              제안 수정
            </ActGhost>
            <ActGhost type="button" onClick={handleCancelProposal}>
              제안 취소
            </ActGhost>
          </ActRow>
        </ActStack>
      )
    ) : partnerPay?.pb?.accepted ? (
      // 제휴구장: 내가 수락함 → 결제는 위 구장 카드의 버튼으로 (중복 버튼 제거)
      <ActStack>
        <ActNote>✅ 제안을 수락했어요 · 아래 구장 카드에서 구장비를 결제해 주세요</ActNote>
      </ActStack>
    ) : (
      <ActBar>
        <ActGhost
          type="button"
          onClick={() => {
            setEditMode(true);
            setVenueMode("none");
            navigate(`/match-roomdetail/${roomId}/venue`, { state: { counter: true } });
          }}
        >
          다른 일정 제안
        </ActGhost>
        <ActPrimary
          type="button"
          onClick={partnerPay?.pb ? handleAcceptPartnerProposal : handleConfirmSchedule}
          disabled={!canConfirm}
        >
          {partnerPay?.pb ? "제안 수락" : "수락하고 확정"}
        </ActPrimary>
      </ActBar>
    );
  } else if (status === "awaiting_venue_approval") {
    chatTopBar = (
      <ActStack>
        <ActNote>⏳ 구장주 승인을 기다리는 중이에요 · 승인되면 경기가 확정돼요</ActNote>
      </ActStack>
    );
  }

  // 경기 결과 입력 폼: 최종 스코어 / 사진·후기 (2카드)
  // 다른 팀 관점(읽기전용)에서는 입력 폼 미노출. ✅ 결과(스코어) 입력은 팀장만.
  const canInputResult = !resultState && canOpenResultInput && isViewerMyTeam && isTeamLeader;

  const resultInputCards = (
    <>
      {/* 최종 스코어 카드 */}
      <SectionCard>
        <SectionTitleRow>
          <SectionTitleLeft>
            <span>최종 스코어</span>
            <SubLabel>직접 입력</SubLabel>
          </SectionTitleLeft>
          <SectionTitleActions />
        </SectionTitleRow>

        <ScoreCardRow>
          <ScoreTeamCol>
            <ScoreLogoWrap>
              {myRank && myRank <= 3 ? <ScoreCrown src={images.logo} alt={`${myRank}위`} /> : null}
              <ScoreLogoChip>
                <ScoreLogoImg src={teamLogoSrc(myTeamView?.logoUrl)} alt={myTeamView?.name} />
              </ScoreLogoChip>
            </ScoreLogoWrap>
            <ScoreColName>{myTeamView?.name || "우리팀"}</ScoreColName>
            <ScoreColSub $me>우리팀{myRank ? ` · 랭킹 ${myRank}위` : ""}</ScoreColSub>
            <ScoreInputBig
              inputMode="numeric"
              pattern="\\d*"
              value={myScoreInput}
              onChange={(e) => setMyScoreInput(e.target.value.replace(/[^\d]/g, ""))}
            />
          </ScoreTeamCol>

          <ScoreColon>:</ScoreColon>

          <ScoreTeamCol>
            <ScoreLogoWrap>
              {oppRank && oppRank <= 3 ? <ScoreCrown src={images.logo} alt={`${oppRank}위`} /> : null}
              <ScoreLogoChip>
                <ScoreLogoImg src={teamLogoSrc(oppTeamView?.logoUrl)} alt={oppTeamView?.name} />
              </ScoreLogoChip>
            </ScoreLogoWrap>
            <ScoreColName>{oppTeamView?.name || "상대팀"}</ScoreColName>
            <ScoreColSub>{oppRank ? `랭킹 ${oppRank}위` : "랭킹 정보 없음"}</ScoreColSub>
            <ScoreInputBig
              inputMode="numeric"
              pattern="\\d*"
              value={oppScoreInput}
              onChange={(e) => setOppScoreInput(e.target.value.replace(/[^\d]/g, ""))}
            />
          </ScoreTeamCol>
        </ScoreCardRow>
      </SectionCard>

      {/* 별점 평가는 '리뷰 남기기' 카드로 분리 (팀장·팀원 공통, 지난 경기에서) */}

      <ResultSubmitBar>
        <PrimaryButton
          type="button"
          onClick={handleSubmitResult}
          disabled={resultBusy || !toStr(myScoreInput) || !toStr(oppScoreInput)}
        >
          {resultBusy ? "처리중..." : "결과 제출"}
        </PrimaryButton>
      </ResultSubmitBar>
    </>
  );

  // 완료/확정 경기: 결과 표시 카드 (입력 카드와 동일 디자인, 점수는 읽기 전용)
  const isResultView = resultState === "confirmed" || isFinished;

  const resultConfirmedCards = (
    <>
      {/* 최종 스코어 카드 */}
      <SectionCard>
        <SectionTitleRow>
          <SectionTitleLeft>
            <span>경기 결과</span>
          </SectionTitleLeft>
          <SectionTitleActions />
        </SectionTitleRow>

        <ResultBanner $outcome={outcome}>
          {outcome === "win" && <ResultBanner3D src={images.emoji3dTrophy} alt="" />}
          <ResultBannerText $outcome={outcome}>
            {outcome === "win" ? "승리!" : outcome === "lose" ? "패배" : "무승부"}
          </ResultBannerText>
        </ResultBanner>

        <ScoreBoard>
          <SbTeam>
            <SbLogoWrap>
              {myRank && myRank <= 3 ? <ScoreCrown src={images.logo} alt={`${myRank}위`} /> : null}
              <SbLogo>
                <ScoreLogoImg src={teamLogoSrc(myTeamView?.logoUrl)} alt={myTeamView?.name} />
              </SbLogo>
            </SbLogoWrap>
            <SbName>{myTeamView?.name || "우리팀"}</SbName>
            <SbSub $me>우리팀{myRank ? ` · ${myRank}위` : ""}</SbSub>
          </SbTeam>

          <SbScore>
            <SbNum $win={outcome === "win" || outcome === "draw"}>
              {Number.isFinite(myScoreNum) ? myScoreNum : "-"}
            </SbNum>
            <SbColon>:</SbColon>
            <SbNum $win={outcome === "lose" || outcome === "draw"}>
              {Number.isFinite(oppScoreNum) ? oppScoreNum : "-"}
            </SbNum>
          </SbScore>

          <SbTeam>
            <SbLogoWrap>
              {oppRank && oppRank <= 3 ? <ScoreCrown src={images.logo} alt={`${oppRank}위`} /> : null}
              <SbLogo>
                <ScoreLogoImg src={teamLogoSrc(oppTeamView?.logoUrl)} alt={oppTeamView?.name} />
              </SbLogo>
            </SbLogoWrap>
            <SbName>{oppTeamView?.name || "상대팀"}</SbName>
            <SbSub>{oppRank ? `${oppRank}위` : "랭킹 없음"}</SbSub>
          </SbTeam>
        </ScoreBoard>
      </SectionCard>
    </>
  );

  // 승인 대기중: 제출된 최종 스코어 카드 + 인정/이의 (확정 화면과 동일 디자인, 확정 전이라 점수 색상 없음)
  const resultWaitingCards = (
    <SectionCard>
      <SectionTitleRow>
        <SectionTitleLeft>
          <span>최종 스코어</span>
        </SectionTitleLeft>
        <SectionTitleActions />
      </SectionTitleRow>

      <ScoreCardRow>
        <ScoreTeamCol>
          <ScoreLogoWrap>
            {myRank && myRank <= 3 ? <ScoreCrown src={images.logo} alt={`${myRank}위`} /> : null}
            <ScoreLogoChip>
              <ScoreLogoImg src={teamLogoSrc(myTeamView?.logoUrl)} alt={myTeamView?.name} />
            </ScoreLogoChip>
          </ScoreLogoWrap>
          <ScoreColName>{myTeamView?.name || "우리팀"}</ScoreColName>
          <ScoreColSub $me>우리팀{myRank ? ` · 랭킹 ${myRank}위` : ""}</ScoreColSub>
          <ScoreReadBox>{Number.isFinite(myScoreNum) ? myScoreNum : "-"}</ScoreReadBox>
        </ScoreTeamCol>

        <ScoreColon>:</ScoreColon>

        <ScoreTeamCol>
          <ScoreLogoWrap>
            {oppRank && oppRank <= 3 ? <ScoreCrown src={images.logo} alt={`${oppRank}위`} /> : null}
            <ScoreLogoChip>
              <ScoreLogoImg src={teamLogoSrc(oppTeamView?.logoUrl)} alt={oppTeamView?.name} />
            </ScoreLogoChip>
          </ScoreLogoWrap>
          <ScoreColName>{oppTeamView?.name || "상대팀"}</ScoreColName>
          <ScoreColSub>{oppRank ? `랭킹 ${oppRank}위` : "랭킹 정보 없음"}</ScoreColSub>
          <ScoreReadBox>{Number.isFinite(oppScoreNum) ? oppScoreNum : "-"}</ScoreReadBox>
        </ScoreTeamCol>
      </ScoreCardRow>

      {!iSubmittedResult ? (
        <>
          {isTeamLeader ? (
            <>
              <ScoreHeroHint>상대팀이 제출한 결과입니다. 인정하거나 이의 제기할 수 있어요.</ScoreHeroHint>
              <ResultActionsRow>
                <ResultButton type="button" variant="primary" onClick={handleAcceptResult} disabled={!canAcceptResult}>
                  {resultBusy ? "처리중..." : "결과 인정"}
                </ResultButton>
                <ResultButton type="button" variant="secondary" onClick={handleDisputeResult} disabled={resultBusy}>
                  이의 제기
                </ResultButton>
              </ResultActionsRow>
            </>
          ) : (
            <ScoreHeroHint>상대팀이 제출한 결과입니다. 결과 인정·이의 제기는 팀장이 처리해요.</ScoreHeroHint>
          )}
          {autoConfirmAtLabel ? (
            <ResultStatusText>
              ⏳ {autoConfirmAtLabel}까지 승인하지 않으면 상대팀이 입력한 결과로 자동 확정됩니다.
            </ResultStatusText>
          ) : null}
        </>
      ) : (
        <>
          <ScoreHeroHint>상대팀 승인을 기다리는 중입니다.</ScoreHeroHint>
          {autoConfirmAtLabel ? (
            <ResultStatusText>
              ⏳ 상대팀이 {autoConfirmAtLabel}까지 승인하지 않으면 입력한 결과로 자동 확정됩니다.
            </ResultStatusText>
          ) : null}
        </>
      )}
    </SectionCard>
  );

  // 경기 결과 입력/제출/인정 섹션 (확정 화면·결과 화면에서 공용)
  const resultSection = isVoided ? (
    <SectionCard>
      <SectionTitleRow>
        <SectionTitleLeft>
          <SectionIcon>🚫</SectionIcon>
          <span>경기 결과</span>
        </SectionTitleLeft>
        <SectionTitleActions />
      </SectionTitleRow>
      <ResultInfoBox>
        양 팀 모두 결과를 입력하지 않아 <strong>무효 처리</strong>된 경기예요.
        <br />
        전적에 반영되지 않습니다.
      </ResultInfoBox>
    </SectionCard>
  ) : canInputResult ? (
    resultInputCards
  ) : isResultView ? (
    resultConfirmedCards
  ) : resultState === "waiting_accept" ? (
    resultWaitingCards
  ) : (
    <SectionCard>
      <SectionTitleRow>
        <SectionTitleLeft>
          <SectionIcon>📊</SectionIcon>
          <span>경기 결과</span>
        </SectionTitleLeft>
        <SectionTitleActions />
      </SectionTitleRow>

      {!resultState && !canOpenResultInput && (
        isViewerMyTeam && !isTeamLeader ? (
          <ResultInfoBox>
            경기 결과(스코어)는 <strong>팀장</strong>이 입력해요.
            <br />
            경기가 끝나면 아래에서 상대 팀 <strong>리뷰</strong>를 남길 수 있어요.
            {resultOpenAtLabel ? (
              <>
                <br />
                리뷰 가능 시간: <strong>{resultOpenAtLabel}</strong>
              </>
            ) : null}
          </ResultInfoBox>
        ) : (
          <ResultInfoBox>
            경기 시작 후 <strong>{venueDurLabel || "경기 시간"}</strong>이 지나면 경기 결과를 입력할 수 있어요.
            {resultOpenAtLabel ? (
              <>
                <br />
                입력 가능 시간: <strong>{resultOpenAtLabel}</strong>
              </>
            ) : null}
          </ResultInfoBox>
        )
      )}

      {/* ✅ 팀원: 결과(스코어) 입력은 팀장 전용 안내 */}
      {!resultState && canOpenResultInput && isViewerMyTeam && !isTeamLeader && (
        <ResultInfoBox>
          경기 결과(스코어)는 <strong>팀장</strong>이 입력해요.
          <br />
          경기가 끝났다면 아래에서 상대 팀 <strong>리뷰</strong>를 남겨 주세요.
        </ResultInfoBox>
      )}

      {resultState === "disputed" && <ResultStatusText>이의 제기 상태입니다. 관리자 검토 후 처리됩니다.</ResultStatusText>}
    </SectionCard>
  );

  // 평점 데이터 (상대 팀에 남긴 별점) — loadMatchRoomDetail이 동봉
  const allReviews = Array.isArray(room.reviews) ? room.reviews : [];

  // 상대 팀 선수들이 "우리 팀(표시 관점)"에 남긴 평점 (targetClubId == 표시 관점 팀)
  const oppPlayerById = {};
  oppPlayers.forEach((p) => {
    oppPlayerById[toStr(p.userId)] = p;
  });
  const oppReviews = allReviews
    .filter((r) => toStr(r.targetClubId) === perspectiveClubId)
    .map((r) => {
      const p = oppPlayerById[toStr(r.raterUid)];
      return {
        key: r.id,
        name: toStr(r.raterName) || toStr(p?.nickname) || "상대 선수",
        avatar: playerAvatars?.[r.raterUid] || toStr(p?.photoUrl) || "",
        stars: Math.max(1, Math.min(5, Number(r.stars) || 0)),
        text: toStr(r.comment),
        date: formatShortDate(r.createdAt),
      };
    });
  const oppRatingAvg = oppReviews.length
    ? Math.round(
        (oppReviews.reduce((sum, r) => sum + r.stars, 0) / oppReviews.length) * 10
      ) / 10
    : 0;

  // 지난(완료) 경기: 상대 팀 선수들이 우리 팀에 남긴 평점 (표시)
  const oppReviewSection = (
    <SectionCard>
      <ReviewHeadRow>
        <ReviewHeadLeft>
          <ReviewTeamLogo>
            <img src={teamLogoSrc(oppTeamView?.logoUrl)} alt={oppName} />
          </ReviewTeamLogo>
          <ReviewTitle>{oppName} 선수 평점</ReviewTitle>
        </ReviewHeadLeft>
        {oppReviews.length > 0 && (
          <ReviewAvg>
            <ReviewAvgStars>{starString(Math.round(oppRatingAvg))}</ReviewAvgStars>
            <ReviewAvgNum>{oppRatingAvg.toFixed(1)}</ReviewAvgNum>
          </ReviewAvg>
        )}
      </ReviewHeadRow>
      <RatingSubtitle>상대 팀 선수들이 우리 팀에 남겼어요</RatingSubtitle>
      {oppReviews.length > 0 ? (
        <ReviewList>
          {oppReviews.map((r) => (
            <ReviewItem key={r.key}>
              {r.avatar ? (
                <ReviewAvatar src={r.avatar} alt={r.name} />
              ) : (
                <AvatarPlaceholder size={36} />
              )}
              <ReviewBody>
                <ReviewNameRow>
                  <ReviewName>{r.name}</ReviewName>
                  <ReviewStars>{starString(r.stars)}</ReviewStars>
                </ReviewNameRow>
                {r.text ? <ReviewText>{r.text}</ReviewText> : null}
                {r.date ? <ReviewDate>{r.date}</ReviewDate> : null}
              </ReviewBody>
            </ReviewItem>
          ))}
        </ReviewList>
      ) : (
        <ReviewEmpty>아직 상대 팀이 남긴 평점이 없어요.</ReviewEmpty>
      )}
    </SectionCard>
  );

  // ✅ 내가 상대 팀에 남기는 리뷰 카드 (팀장·팀원 공통, 지난 경기) — 1인 1리뷰
  const myReview = allReviews.find((r) => toStr(r.raterUid) === myUid) || null;
  const myHasReview = !!myReview;
  // 이미 등록한 리뷰가 있으면 기본은 "등록됨" 표시, "수정" 누르면 편집 모드
  const reviewEditing = !myHasReview || editingReview;

  const startEditReview = () => {
    if (myReview) {
      setReviewStars(Math.max(0, Math.min(5, Number(myReview.stars) || 0)));
      setReviewComment(toStr(myReview.comment));
    }
    setEditingReview(true);
  };

  const myReviewSection = reviewEditing ? (
    <SectionCard>
      <SectionTitleRow>
        <SectionTitleLeft>
          <span>{oppName} 리뷰 {myHasReview ? "수정" : "남기기"}</span>
        </SectionTitleLeft>
        <SectionTitleActions>
          {myHasReview && (
            <ReviewActionBtn type="button" onClick={() => setEditingReview(false)}>
              취소
            </ReviewActionBtn>
          )}
        </SectionTitleActions>
      </SectionTitleRow>
      <RatingSubtitle>매너·실력을 별점으로 남기면 상대 팀 평판에 반영돼요. 팀원도 남길 수 있어요.</RatingSubtitle>
      <StarsRow>
        {[1, 2, 3, 4, 5].map((n) => (
          <StarBtn
            key={n}
            type="button"
            $on={n <= reviewStars}
            onClick={() => setReviewStars(n === reviewStars ? 0 : n)}
            aria-label={`${n}점`}
          >
            {n <= reviewStars ? "★" : "☆"}
          </StarBtn>
        ))}
      </StarsRow>
      <RatingValueLabel>{RATING_LABELS[reviewStars] || ""}</RatingValueLabel>
      <TextArea
        value={reviewComment}
        onChange={(e) => setReviewComment(e.target.value)}
        placeholder="한줄 후기 (예: 매너 좋았습니다. 다음에 또 경기해요!)"
      />
      <ResultSubmitBar>
        <PrimaryButton type="button" onClick={handleSubmitReview} disabled={reviewBusy || reviewStars < 1}>
          {reviewBusy ? "처리중..." : myHasReview ? "리뷰 수정 완료" : "리뷰 남기기"}
        </PrimaryButton>
      </ResultSubmitBar>
    </SectionCard>
  ) : (
    <SectionCard>
      <SectionTitleRow>
        <SectionTitleLeft>
          <span>{oppName}에 남긴 리뷰</span>
        </SectionTitleLeft>
        <SectionTitleActions>
          <ReviewActionBtn type="button" onClick={startEditReview}>
            수정
          </ReviewActionBtn>
        </SectionTitleActions>
      </SectionTitleRow>
      <RatingSubtitle>내가 남긴 리뷰예요. 언제든 수정할 수 있어요.</RatingSubtitle>
      <ReviewList>
        <ReviewItem>
          <ReviewBody>
            <ReviewNameRow>
              <ReviewName>내 리뷰</ReviewName>
              <ReviewStars>{starString(Math.round(Number(myReview.stars) || 0))}</ReviewStars>
            </ReviewNameRow>
            {myReview.comment ? <ReviewText>{toStr(myReview.comment)}</ReviewText> : null}
            {formatShortDate(myReview.updatedAt || myReview.createdAt) ? (
              <ReviewDate>{formatShortDate(myReview.updatedAt || myReview.createdAt)}</ReviewDate>
            ) : null}
          </ReviewBody>
        </ReviewItem>
      </ReviewList>
    </SectionCard>
  );

  return (
    <>
      <PageWrap
        $dark={!isVenue}
        $confirmed={!isVenue && (status === "confirmed" || status === "cancelled" || status === "finished") && !confirmedChatOpen}
      >
        {!kbOpen && !(isVenue || status === "confirmed" || status === "cancelled" || status === "finished") && (
          <DarkHeader>
              <MatchInfoBar
                type="button"
                onClick={() => setMatchInfoOpen((o) => !o)}
                aria-expanded={matchInfoOpen}
              >
                <MatchInfoLeft>
                  <MatchInfoBarTitle>진행 단계</MatchInfoBarTitle>
                  {stepSummary ? <StepSummaryBadge>{stepSummary}</StepSummaryBadge> : null}
                </MatchInfoLeft>
                <MatchInfoToggle>{matchInfoOpen ? "▴" : "›"}</MatchInfoToggle>
              </MatchInfoBar>

              {/* 펼치면 스텝퍼 노출 — 제안 카드 위에 배치 */}
              {matchInfoOpen && stepperEl}

              {/* 펼치면 팀 매치업(VS) 상세 */}
              {matchInfoOpen && (
                <VsCard>
                  <VsRow>
                    <VsTeam
                      role="button"
                      onClick={() => goTeamDetail(myTeamView)}
                    >
                      <CrestWrap>
                        {myRank && myRank <= 3 ? (
                          <CrestCrown src={images.logo} alt={`${myRank}위`} />
                        ) : null}
                        <Crest $home>
                          <CrestImg src={teamLogoSrc(myTeamView?.logoUrl)} alt={myTeamView?.name} />
                        </Crest>
                      </CrestWrap>
                      <VsNmWrap>
                        <VsNm>{toStr(myTeamView?.name) || "내 팀"}</VsNm>
                        {myRank ? <RankTag>랭킹 {myRank}위</RankTag> : null}
                      </VsNmWrap>
                    </VsTeam>

                    <VsMid>
                      <VsX>VS</VsX>
                    </VsMid>

                    <VsTeam
                      role="button"
                      onClick={() => goTeamDetail(oppTeamView)}
                    >
                      <CrestWrap>
                        {oppRank && oppRank <= 3 ? (
                          <CrestCrown src={images.logo} alt={`${oppRank}위`} />
                        ) : null}
                        <Crest>
                          <CrestImg src={teamLogoSrc(oppTeamView?.logoUrl)} alt={oppTeamView?.name} />
                        </Crest>
                      </CrestWrap>
                      <VsNmWrap>
                        <VsNm>{oppName}</VsNm>
                        {oppRank ? <RankTag>랭킹 {oppRank}위</RankTag> : null}
                      </VsNmWrap>
                    </VsTeam>
                  </VsRow>
                </VsCard>
              )}

          </DarkHeader>
        )}

        {!isVenue && isConfirmed && confirmedChatOpen ? (
          <>
            <ConfChatBar>
              <ConfChatBackBtn type="button" onClick={() => setConfirmedChatOpen(false)}>
                ← 경기 정보
              </ConfChatBackBtn>
            </ConfChatBar>
            <MatchRoomChat
              chatId={chatId}
              myUid={myUid}
              opponentName={oppName}
              opponentLeaderName={oppLeader.name}
              opponentAvatarUrl={oppLeader.avatarUrl}
              otherUid={oppLeader.uid}
              systemNotice="경기가 확정됐어요 🎉 · 채팅으로 계속 대화하세요"
            />
          </>
        ) : !isVenue && status === "cancelled" ? (
          <ConfWrap>
            <CancelIcon>✕</CancelIcon>
            <ConfTitle>경기가 취소됐어요</ConfTitle>
            <ConfSub>{cancelSubText}</ConfSub>

            <CancelCard>
              <CancelRow>
                <CancelK>취소 주체</CancelK>
                <CancelV>{cancelReasonLabel}</CancelV>
              </CancelRow>
              <CancelRow>
                <CancelK>사유</CancelK>
                <CancelV>{cancelReasonStored || "사유 미입력"}</CancelV>
              </CancelRow>
              <CancelRow>
                <CancelK>정산</CancelK>
                <CancelV>
                  {cancelRefund && cancelRefund.amount > 0
                    ? cancelRefund.status === "refunded"
                      ? `${Number(cancelRefund.amount).toLocaleString()}원 환불 완료`
                      : `${Number(cancelRefund.amount).toLocaleString()}원 환불 예정`
                    : "현장 정산 · 결제 없음"}
                </CancelV>
              </CancelRow>
            </CancelCard>

            <CancelInfo>
              <span>ⓘ</span>
              <div>
                {cancelRefund && cancelRefund.amount > 0 ? (
                  cancelRefund.status === "refunded" ? (
                    <>결제하신 구장비는 <b>환불 처리됐어요.</b> (결제 수단으로 환불)</>
                  ) : (
                    <>결제하신 구장비는 <b>환불 처리될 예정이에요.</b> (영업일 기준 처리)</>
                  )
                ) : (
                  <>직접 입력 경기는 앱 결제가 없어 <b>환불 절차가 없어요.</b> 별도 정산이 있었다면 두 팀이 직접 정리해요.</>
                )}
              </div>
            </CancelInfo>

            <ShareBtn type="button" onClick={() => navigate("/matching")}>
              새 매칭 찾기
            </ShareBtn>
          </ConfWrap>
        ) : !isVenue && (status === "confirmed" || status === "finished") ? (
          <ConfWrap>
            {isPast ? (
              <ConfBanner $tone={pastBanner.tone}>
                <ConfBannerCheck>{pastBanner.icon}</ConfBannerCheck>
                <ConfBannerText>
                  <ConfBannerTitle>{pastBanner.title}</ConfBannerTitle>
                  <ConfBannerSub>{pastBanner.sub}</ConfBannerSub>
                </ConfBannerText>
              </ConfBanner>
            ) : isConfirmed ? (
              <ConfBanner $tone="green">
                <ConfBannerCheck>✓</ConfBannerCheck>
                <ConfBannerText>
                  <ConfBannerTitle>경기 확정!</ConfBannerTitle>
                  <ConfBannerSub>
                    {partnerPay?.pb
                      ? "구장 예약까지 완료됐어요. 경기장에서 만나요!"
                      : "상대 팀과 일정이 확정됐어요. 경기장에서 만나요!"}
                  </ConfBannerSub>
                </ConfBannerText>
                {partnerPay?.pb && confDDay ? (
                  <ConfBannerDday>{confDDay}</ConfBannerDday>
                ) : null}
              </ConfBanner>
            ) : null}

            {/* ✅ 확정 후에도 같은 매칭룸 채팅 계속 (팀장 전용) */}
            {isConfirmed && !isPast && isTeamLeader && (
              <ConfMsgCard type="button" onClick={() => setConfirmedChatOpen(true)}>
                {toStr(oppLeader.avatarUrl) ? (
                  <ConfMsgAvatar src={oppLeader.avatarUrl} alt={oppName} />
                ) : (
                  <AvatarPlaceholder size={46} />
                )}
                <ConfMsgTexts>
                  <ConfMsgTitle>{oppName} · 매칭룸 채팅</ConfMsgTitle>
                  <ConfMsgSub>
                    {Number(roomChat.unread) > 0
                      ? `새 메시지 ${roomChat.unread}개${
                          formatRelTime(roomChat.lastMessageAt)
                            ? ` · ${formatRelTime(roomChat.lastMessageAt)}`
                            : ""
                        }`
                      : toStr(roomChat.lastMessageText) || "확정 후에도 메시지로 계속 대화해요"}
                  </ConfMsgSub>
                </ConfMsgTexts>
                {Number(roomChat.unread) > 0 ? (
                  <ConfMsgBadge>{Number(roomChat.unread) > 99 ? "99+" : roomChat.unread}</ConfMsgBadge>
                ) : null}
              </ConfMsgCard>
            )}

            {/* 지난(완료) 경기: 경기 결과 카드를 결과 배너 바로 아래에 배치 */}
            {isPast && resultSection}

            {/* 지난 경기: 내가 상대 팀에 남기는 리뷰 (팀장·팀원 공통) */}
            {isPast && isViewerMyTeam && myReviewSection}

            {/* 결과 확정된 완료 경기: 상대 팀 선수들이 우리 팀에 남긴 평점 (보기 전용) */}
            {isResultView && oppReviewSection}

            <Ticket>
              <TicketHead>
                <TicketBrand>MATCH TICKET</TicketBrand>
                <TicketBadge $tone={isPast ? pastBanner.tone : "green"}>
                  {isPast ? pastBanner.title : "확정됨"}
                </TicketBadge>
              </TicketHead>
              <TicketBody>
                <VsRow>
                  <VsTeam role="button" onClick={() => goTeamDetail(myTeamView)}>
                    <CrestWrap>
                      {myRank && myRank <= 3 ? (
                        <CrestCrown src={images.logo} alt={`${myRank}위`} />
                      ) : null}
                      <Crest $home>
                        <CrestImg src={teamLogoSrc(myTeamView?.logoUrl)} alt={myTeamView?.name} />
                      </Crest>
                    </CrestWrap>
                    <VsNmWrap>
                      <VsNm>{toStr(myTeamView?.name) || "내 팀"}</VsNm>
                      {myRank ? <RankTag>랭킹 {myRank}위</RankTag> : null}
                    </VsNmWrap>
                  </VsTeam>

                  <VsMid>
                    <VsX>VS</VsX>
                  </VsMid>

                  <VsTeam role="button" onClick={() => goTeamDetail(oppTeamView)}>
                    <CrestWrap>
                      {oppRank && oppRank <= 3 ? (
                        <CrestCrown src={images.logo} alt={`${oppRank}위`} />
                      ) : null}
                      <Crest>
                        <CrestImg src={teamLogoSrc(oppTeamView?.logoUrl)} alt={oppTeamView?.name} />
                      </Crest>
                    </CrestWrap>
                    <VsNmWrap>
                      <VsNm>{oppName}</VsNm>
                      {oppRank ? <RankTag>랭킹 {oppRank}위</RankTag> : null}
                    </VsNmWrap>
                  </VsTeam>
                </VsRow>

                <div style={{ textAlign: "center", marginTop: 10 }}>
                  <LineupMiniBtn type="button" onClick={() => setLineupViewOpen(true)}>
                    라인업 보기
                  </LineupMiniBtn>
                </div>

                {/* 구장 정보(사진·일시·위치·지도)를 매치 티켓 한 카드로 묶어 표시.
                    제휴구장: 구장 사진 + 일시 + 위치 + 지도 / 직접입력: 일시 + 위치 + 지도 */}
                {partnerPay?.pb ? (
                  <>
                    <TicketVenuePhoto
                      onClick={propVenueId ? openVenueDetail : undefined}
                      role={propVenueId ? "button" : undefined}
                      style={{ cursor: propVenueId ? "pointer" : "default" }}
                    >
                      {toStr(partnerPay.pb.venueImageUrl)
                        ? <ResvThumbImg src={partnerPay.pb.venueImageUrl} alt={toStr(partnerPay.pb.venueName)} />
                        : <FiMapPin size={26} />}
                      <ResvBadge>✓ 예약 완료</ResvBadge>
                      {propVenueId ? <VenuePhotoHint>구장 상세 ›</VenuePhotoHint> : null}
                      <ResvThumbOverlay>
                        <ResvNameOv>{toStr(partnerPay.pb.venueName) || "제휴구장"}</ResvNameOv>
                        {toStr(partnerPay.pb.courtName) ? <ResvSubOv>{toStr(partnerPay.pb.courtName)}</ResvSubOv> : null}
                      </ResvThumbOverlay>
                    </TicketVenuePhoto>
                    <TicketRows>
                      <TicketRow>
                        <RowIconChip><FiCalendar size={17} /></RowIconChip>
                        <RowKV>
                          <RowK>일시</RowK>
                          <RowV>{confDateLabel}</RowV>
                        </RowKV>
                      </TicketRow>
                      <TicketRow>
                        <RowIconChip><FiMapPin size={17} /></RowIconChip>
                        <RowKV>
                          <RowK>
                            구장
                            <VenueTypeTag $partner={true}>제휴구장</VenueTypeTag>
                          </RowK>
                          <RowV>{toStr(fieldAddress) || toStr(partnerPay.pb.venueName) || "제휴구장"}</RowV>
                        </RowKV>
                        {fieldLatLng?.lat && fieldLatLng?.lng ? (
                          <DirBtn type="button" onClick={openDirections}>
                            길찾기
                          </DirBtn>
                        ) : null}
                      </TicketRow>
                      {fieldLatLng?.lat && fieldLatLng?.lng ? (
                        <FieldMapWrap>
                          <VenueMiniMap latLng={fieldLatLng} height={140} />
                        </FieldMapWrap>
                      ) : null}
                    </TicketRows>
                  </>
                ) : (
                  <TicketRows>
                    <TicketRow>
                      <RowIconChip><FiCalendar size={17} /></RowIconChip>
                      <RowKV>
                        <RowK>일시</RowK>
                        <RowV>{confDateLabel}</RowV>
                      </RowKV>
                    </TicketRow>
                    <TicketRow>
                      <RowIconChip><FiMapPin size={17} /></RowIconChip>
                      <RowKV>
                        <RowK>
                          구장
                          <VenueTypeTag $partner={false}>직접입력</VenueTypeTag>
                        </RowK>
                        <RowV>{toStr(fieldAddress) || "직접 입력 구장"}</RowV>
                      </RowKV>
                      {fieldLatLng?.lat && fieldLatLng?.lng ? (
                        <DirBtn type="button" onClick={openDirections}>
                          길찾기
                        </DirBtn>
                      ) : null}
                    </TicketRow>
                    {fieldLatLng?.lat && fieldLatLng?.lng ? (
                      <FieldMapWrap>
                        <VenueMiniMap latLng={fieldLatLng} height={140} />
                      </FieldMapWrap>
                    ) : null}
                  </TicketRows>
                )}
              </TicketBody>
            </Ticket>

            {/* ✅ 제휴구장 예약: 예약완료 + 현장 결제 예정 금액 카드 (앱 결제 없음, 현장 정산) */}
            {partnerPay?.pb && (() => {
              const pb = partnerPay.pb;
              const side = myClubId === toStr(pb.proposerClubId) ? "A" : "B";
              const myShare = side === "A" ? pb.shareA : pb.shareB;
              return (
                <PaidCard>
                  <PaidHead>
                    <PaidTitle>🎟️ 구장 예약 완료</PaidTitle>
                    <PaidBadge>예약확정</PaidBadge>
                  </PaidHead>
                  <PaidRow><span>총 대관료 (양 팀 공동)</span><b>{Number(pb.totalPrice || 0).toLocaleString()}원</b></PaidRow>
                  <PaidRow><span>{toStr(pb.proposerTeamName) || "A팀"}</span><b>{Number(pb.shareA || 0).toLocaleString()}원</b></PaidRow>
                  <PaidRow><span>{toStr(pb.opponentTeamName) || "B팀"}</span><b>{Number(pb.shareB || 0).toLocaleString()}원</b></PaidRow>
                  <PaidDivider />
                  <PaidRow $big><span>우리 팀 현장 결제 예정 (1/2)</span><b>{Number(myShare || 0).toLocaleString()}원</b></PaidRow>
                  <PaidNote>앱에서 결제되지 않아요. 경기 당일 구장에서 현장 정산합니다.</PaidNote>
                </PaidCard>
              );
            })()}

            {!partnerPay?.pb && (
              <VenueNote>
                <span>📌</span>
                <span>
                  <b>구장 예약·문의는 직접 해주세요.</b> 할래말래의 직접 입력 구장은
                  매칭(상대·인원 모으기)만 도와드려요. 구장 예약과 문의는 이용자가 직접
                  진행해야 합니다.
                </span>
              </VenueNote>
            )}

            {/* 경기 결과 입력/제출/인정 — 확정 화면에서 바로 (별도 채팅 없음) */}
            {!isPast && resultSection}

            {/* 경기 취소는 팀장만 가능 — 팀원에겐 버튼 미표시 */}
            {isConfirmed && !isEnded && isTeamLeader && (
              <ConfCancelBtn type="button" onClick={handleCancelConfirmedMatch}>
                경기 취소하기
              </ConfCancelBtn>
            )}

            {/* 결과 입력 시 하단 고정 버튼에 콘텐츠가 가리지 않도록 여백 */}
            {canInputResult && <ResultBarSpacer />}
          </ConfWrap>
        ) : !isVenue ? (
          <>
            {chatTopBar}
            <MatchRoomChat
              chatId={chatId}
              myUid={myUid}
              opponentName={oppName}
              opponentLeaderName={oppLeader.name}
              opponentAvatarUrl={oppLeader.avatarUrl}
              otherUid={oppLeader.uid}
              systemNotice={chatSystemNotice}
              noticeIcon={status === "accepted" ? "🤝" : ""}
              proposalCard={proposalCard}
              proposalCardMine={iAmProposer}
            />
          </>
        ) : (
          <>
        <Inner>
          {/* 라인업 카드 삭제: 상단 VS 헤더와 중복 (기획안 구장 정하기 화면엔 없음) */}
          {false && (
          <MatchCard>
            <TeamBlock $withDivider>
              <TeamHeaderRow>
                <TeamHeaderLeft onClick={() => goTeamDetail(myTeamView)}>
                  <TeamLogoWrap>
                    <TeamLogo src={myTeamView?.logoUrl || images.logo} alt={myTeamView?.name} />
                  </TeamLogoWrap>
                  <TeamText>
                    <TeamName>{myTeamView?.name || "우리팀"}</TeamName>
                    <TeamStatsRow>
                      <span>{myRecord}</span>
                      <WinRatePill>승률 {myWinRate}%</WinRatePill>
                    </TeamStatsRow>
                  </TeamText>
                </TeamHeaderLeft>

                <TeamHeaderRight>
                  <TogglePlayersBtn type="button" onClick={() => setMyLineupOpen((v) => !v)}>
                    {myLineupOpen ? "선수 접기" : "선수 보기"}
                  </TogglePlayersBtn>
                </TeamHeaderRight>
              </TeamHeaderRow>

              {myLineupOpen && (
                <LineupBox>
                  <LineupTitleRow>
                    <LineupTitle>우리팀 선수 명단</LineupTitle>
                  </LineupTitleRow>
                  <LineupList>{myPlayers.length > 0 ? myPlayers.map((p) => renderPlayerRow(p, myRecord)) : null}</LineupList>
                  {mySubPlayers.length > 0 && (
                    <>
                      <LineupTitle style={{ marginTop: 8 }}>후보 {mySubPlayers.length}명</LineupTitle>
                      <LineupList>{mySubPlayers.map((p) => renderPlayerRow(p, myRecord))}</LineupList>
                    </>
                  )}
                </LineupBox>
              )}
            </TeamBlock>

            <VsDivider>VS</VsDivider>

            <TeamBlock>
              <TeamHeaderRow>
                <TeamHeaderLeft onClick={() => goTeamDetail(oppTeamView)}>
                  <TeamLogoWrap>
                    <TeamLogo src={oppTeamView?.logoUrl || images.logo} alt={oppTeamView?.name} />
                  </TeamLogoWrap>
                  <TeamText>
                    <TeamName>{oppTeamView?.name || "상대팀"}</TeamName>
                    <TeamStatsRow>
                      <span>{oppRecord}</span>
                      <WinRatePill>승률 {oppWinRate}%</WinRatePill>
                    </TeamStatsRow>
                  </TeamText>
                </TeamHeaderLeft>

                <TeamHeaderRight>
                  <TogglePlayersBtn type="button" onClick={() => setOppLineupOpen((v) => !v)}>
                    {oppLineupOpen ? "선수 접기" : "선수 보기"}
                  </TogglePlayersBtn>
                </TeamHeaderRight>
              </TeamHeaderRow>

              {oppLineupOpen && (
                <LineupBox>
                  <LineupTitleRow>
                    <LineupTitle>상대팀 선수 명단</LineupTitle>
                  </LineupTitleRow>
                  <LineupList>{oppPlayers.length > 0 ? oppPlayers.map((p) => renderPlayerRow(p, oppRecord)) : null}</LineupList>
                  {oppSubPlayers.length > 0 && (
                    <>
                      <LineupTitle style={{ marginTop: 8 }}>후보 {oppSubPlayers.length}명</LineupTitle>
                      <LineupList>{oppSubPlayers.map((p) => renderPlayerRow(p, oppRecord))}</LineupList>
                    </>
                  )}
                </LineupBox>
              )}
            </TeamBlock>
          </MatchCard>
          )}

          {isAdjusting && (
            <>
              {showVenueGate && (
                <>
                  <AskLabel>
                    어떻게 구장을<br />정할까요?
                  </AskLabel>
                  <GateSub>경기를 진행할 구장 방식을 선택해요.</GateSub>

                  {/* 제휴구장 예약 — 선택 후 하단 버튼으로 진행 */}
                  <OptCard
                    type="button"
                    $primary={gateChoice === "partner"}
                    aria-pressed={gateChoice === "partner"}
                    onClick={() => setGateChoice("partner")}
                  >
                    <Oic $primary={gateChoice === "partner"}>🏟️</Oic>
                    <Ob>
                      <OptT>제휴구장 예약</OptT>
                      <OptD>앱에서 결제 · 자동 확정</OptD>
                      <Chips>
                        <Pill $tone="p">앱 결제</Pill>
                        <Pill $tone="n">바로 확정</Pill>
                      </Chips>
                    </Ob>
                    <SelDot $on={gateChoice === "partner"}>{gateChoice === "partner" ? "✓" : ""}</SelDot>
                  </OptCard>

                  {/* 직접 입력 — 선택 후 하단 버튼으로 진행 */}
                  <OptCard
                    type="button"
                    $primary={gateChoice === "direct"}
                    aria-pressed={gateChoice === "direct"}
                    onClick={() => setGateChoice("direct")}
                  >
                    <Oic $primary={gateChoice === "direct"}><FiMapPin size={26} /></Oic>
                    <Ob>
                      <OptT>직접 입력</OptT>
                      <OptD>현장 정산 · 결제 없음</OptD>
                      <Chips>
                        <Pill $tone="n">팀끼리 직접 합의</Pill>
                      </Chips>
                    </Ob>
                    <SelDot $on={gateChoice === "direct"}>{gateChoice === "direct" ? "✓" : ""}</SelDot>
                  </OptCard>

                  <GateNote>
                    <span>ⓘ</span>
                    <div>
                      할래말래는 구장을 <b>대신 예약하지 않아요.</b> 직접 입력은
                      매칭(상대·일정)만 도와드리며, <b>구장 예약은 각 팀이 따로</b> 진행해야
                      합니다.
                    </div>
                  </GateNote>

                  <GateNote>
                    <span>ⓘ</span>
                    <div>
                      <b>제휴구장 예약</b>은 향후 인앱에서 구장 예약·결제와 자동 확정까지
                      지원하도록 <b>준비 중</b>이에요. 정식 오픈 전까지는 직접 입력으로
                      이용해 주세요.
                    </div>
                  </GateNote>
                </>
              )}

              {!showVenueGate && (
                <>
              <BareSection>
                {/* 정보입력 화면(시안 화면2)엔 지도 풀박스를 두지 않음.
                    지도 선택은 아래 "지도에서 선택" → MapLocationPicker(시안 화면1)에서만. */}
                {venueImageUrl && (
                  <VenueImageBox>
                    <VenueImage src={venueImageUrl} alt="구장 이미지" />
                  </VenueImageBox>
                )}

                <FieldRow>
                  <FieldName>{toStr(fieldAddress) || "구장 주소를 선택해 주세요."}</FieldName>

                  {canEdit ? (
                    <FieldEditButton type="button" onClick={() => setMapPickerOpen(true)}>
                      {toStr(fieldAddress) ? "변경" : "지도에서 선택"}
                    </FieldEditButton>
                  ) : (
                    <FieldEditButton type="button" onClick={() => setEditMode(true)}>
                      수정 제안
                    </FieldEditButton>
                  )}
                </FieldRow>

                {/* 선택한 구장은 주소 + 지도 미리보기 함께 표시 */}
                {fieldLatLng && (
                  <FieldMapWrap>
                    <VenueMiniMap latLng={fieldLatLng} height={150} />
                  </FieldMapWrap>
                )}

                {/* (2-2) 직접입력 구장 안내 */}
                <NoticeInfo>
                  <span>ⓘ</span>
                  <div>
                    할래말래 <b>제휴 구장만</b> 앱에서 예약·결제가 가능합니다. 직접 입력
                    구장은 <b>매칭 전용</b>이며, 실제 이용 가능 여부·예약·문의는 이용자가
                    직접 진행해야 합니다.
                  </div>
                </NoticeInfo>
              </BareSection>

              {canEdit ? (
                <SectionCard>
                  <SectionTitleRow>
                    <SectionTitleLeft>
                      <SectionIcon><FiCalendar size={18} /></SectionIcon>
                      <span>날짜 선택</span>
                    </SectionTitleLeft>
                    <SectionTitleActions />
                  </SectionTitleRow>

                  <CalendarWrap>
                      <CalendarHeader>
                        <MonthNavButton type="button" onClick={goPrevMonth} disabled={atCurrentMonth}>
                          ‹
                        </MonthNavButton>
                        <MonthLabel>
                          {calYear}년 {calMonth + 1}월
                        </MonthLabel>
                        <MonthNavButton type="button" onClick={goNextMonth}>
                          ›
                        </MonthNavButton>
                      </CalendarHeader>

                      <WeekRow>
                        {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
                          <WeekCell key={w}>{w}</WeekCell>
                        ))}
                      </WeekRow>

                      <DaysGrid>
                        {cells.map((day, idx) => {
                          if (!day) return <DayCell key={idx} $isEmpty>{" "}</DayCell>;

                          const isToday = calYear === todayY && calMonth === todayM && day === todayD;
                          const dateStr = `${calYear}-${pad2(calMonth + 1)}-${pad2(day)}`;
                          const isSelected = selectedDate === dateStr;
                          const isPast = new Date(calYear, calMonth, day) < todayMidnight;

                          return (
                            <DayCell
                              key={idx}
                              type="button"
                              onClick={() => handleDayClick(day)}
                              disabled={isPast}
                              $isToday={isToday}
                              $isSelected={isSelected}
                            >
                              {day}
                            </DayCell>
                          );
                        })}
                      </DaysGrid>
                  </CalendarWrap>

                  {/* (2-4) 시작 시각 탭 → 그 시각부터 2시간 고정 */}
                  <TimeWrap>
                    <TimeHead>
                      <TimeTitle>🕐 시간</TimeTitle>
                      <TimeHint>시작·종료 시각을 탭</TimeHint>
                    </TimeHead>
                    <HourScroll>
                      {Array.from({ length: 24 }, (_, i) => i).map((h) => {
                        const hhmm = `${pad2(h)}:00`;
                        const sH = selectedTime
                          ? parseInt(selectedTime.slice(0, 2), 10)
                          : null;
                        // 선택된 칩 = 시작~마지막. 칩 개수 = 게임 시간(시간)
                        const lastH = sH != null ? sH + durationMin / 60 - 1 : null;
                        const on = sH != null && h >= sH && h <= lastH;
                        // 선택한 날짜가 오늘이면 지난 시각은 선택 불가
                        const selIsToday =
                          selectedDate ===
                          `${todayY}-${pad2(todayM + 1)}-${pad2(todayD)}`;
                        const isPastHour =
                          selIsToday &&
                          (h < today.getHours() ||
                            (h === today.getHours() && today.getMinutes() > 0));
                        return (
                          <HourChip
                            key={h}
                            type="button"
                            $on={on}
                            disabled={isPastHour}
                            onClick={() => {
                              if (isPastHour) return;
                              if (!selectedTime) {
                                setSelectedTime(hhmm);
                                setDurationMin(60); // 하나 클릭 → 그 시각 하나(1시간)
                                return;
                              }
                              const start = parseInt(selectedTime.slice(0, 2), 10);
                              if (h === start) {
                                // 시작 시각 다시 → 해제
                                setSelectedTime("");
                                setDurationMin(60);
                              } else if (h > start) {
                                const lastH = start + durationMin / 60 - 1;
                                if (h === lastH) {
                                  // 종료 시각 다시 탭 → 그 시각 제거(한 칸 축소)
                                  setDurationMin(durationMin - 60);
                                } else {
                                  // 늦은 시각 → 그 시각 포함해 연속 선택 (7→10이면 7~10)
                                  setDurationMin((h - start + 1) * 60);
                                }
                              } else {
                                // 더 이른 시각 → 새 시작(하나)
                                setSelectedTime(hhmm);
                                setDurationMin(60);
                              }
                            }}
                          >
                            {h}
                          </HourChip>
                        );
                      })}
                    </HourScroll>
                    {selectedTime ? (
                      <TimeSummary>
                        <TimeRange>
                          {selectedTime} -{" "}
                          {pad2(
                            (parseInt(selectedTime.slice(0, 2), 10) +
                              durationMin / 60) %
                              24
                          )}
                          :00
                        </TimeRange>
                        <TimeTotal>총 {durationMin / 60}시간</TimeTotal>
                      </TimeSummary>
                    ) : null}
                  </TimeWrap>

                  {/* (2-6) 시간대 안내 */}
                  <NoticeInfo style={{ marginTop: 10 }}>
                    <span>ⓘ</span>
                    <div>
                      직접 입력 구장은 <b>앱 결제·자동 확정이 없어요.</b> 가용 여부·대관·정산은
                      두 팀이 직접 확인·진행해요.
                    </div>
                  </NoticeInfo>
                </SectionCard>
              ) : (
                <SectionCard>
                  <SectionTitleRow>
                    <SectionTitleLeft>
                      <SectionIcon>🕒</SectionIcon>
                      <span>제안된 일정</span>
                    </SectionTitleLeft>
                    <SectionTitleActions />
                  </SectionTitleRow>
                  <ResultStatusText>{room.scheduledAt ? `${formatKoreanDateTime(room.scheduledAt)} 예정` : "일정 정보가 없습니다."}</ResultStatusText>
                </SectionCard>
              )}
                </>
              )}
            </>
          )}

          {isConfirmed && (
            <>
              <SectionCard>
                <SectionTitleRow>
                  <SectionTitleLeft>
                    <SectionIcon>✅</SectionIcon>
                    <span>확정된 일정</span>
                  </SectionTitleLeft>
                  <SectionTitleActions />
                </SectionTitleRow>
                <ResultStatusText>{room.scheduledAt ? `${formatKoreanDateTime(room.scheduledAt)} 예정` : "일정 정보가 없습니다."}</ResultStatusText>
                <ResultStatusText>{toStr(fieldAddress) ? `구장: ${fieldAddress}` : "구장 정보가 없습니다."}</ResultStatusText>
              </SectionCard>

              <SectionCard>
                <SectionTitleRow>
                  <SectionTitleLeft>
                    <SectionIcon>📊</SectionIcon>
                    <span>경기 결과</span>
                  </SectionTitleLeft>
                  <SectionTitleActions />
                </SectionTitleRow>

                {!resultState && !canOpenResultInput && (
                  <ResultInfoBox>
                    경기 시작 후 <strong>{venueDurLabel || "경기 시간"}</strong>이 지나면 경기 결과 입력 화면이 노출됩니다.
                    {resultOpenAtLabel ? (
                      <>
                        <br />
                        입력 가능 시간: <strong>{resultOpenAtLabel}</strong>
                      </>
                    ) : (
                      <>
                        <br />
                        일정이 확정되면 입력 가능 시간이 자동으로 계산됩니다.
                      </>
                    )}
                  </ResultInfoBox>
                )}

                {!resultState && canOpenResultInput && (
                  <>
                    <ResultScoreRow>
                      <ScoreBlock>
                        <ScoreTeamLabel>{myTeamView?.name || "우리팀"}</ScoreTeamLabel>
                        <ScoreInput
                          inputMode="numeric"
                          pattern="\\d*"
                          value={myScoreInput}
                          onChange={(e) => setMyScoreInput(e.target.value.replace(/[^\d]/g, ""))}
                        />
                      </ScoreBlock>

                      <ScoreSeparator>:</ScoreSeparator>

                      <ScoreBlock>
                        <ScoreTeamLabel>{oppTeamView?.name || "상대팀"}</ScoreTeamLabel>
                        <ScoreInput
                          inputMode="numeric"
                          pattern="\\d*"
                          value={oppScoreInput}
                          onChange={(e) => setOppScoreInput(e.target.value.replace(/[^\d]/g, ""))}
                        />
                      </ScoreBlock>
                    </ResultScoreRow>

                    <ActionsWrap>
                      <PrimaryButton
                        type="button"
                        onClick={handleSubmitResult}
                        disabled={resultBusy || !toStr(myScoreInput) || !toStr(oppScoreInput)}
                      >
                        {resultBusy ? "처리중..." : "결과 제출"}
                      </PrimaryButton>
                    </ActionsWrap>
                  </>
                )}

                {resultState === "waiting_accept" && (
                  <>
                    <ScoreHero>
                      <ScoreHeroNum>{String(actorScoreSaved ?? "-")}</ScoreHeroNum>
                      <ScoreHeroSep>:</ScoreHeroSep>
                      <ScoreHeroNum>{String(targetScoreSaved ?? "-")}</ScoreHeroNum>
                    </ScoreHero>
                    <ScoreHeroHint>상대팀 승인을 기다리는 중입니다.</ScoreHeroHint>

                    {!iSubmittedResult ? (
                      isTeamLeader ? (
                        <>
                          <ResultStatusText>상대팀이 제출한 결과입니다. 인정하거나 이의 제기할 수 있어요.</ResultStatusText>
                          <ResultActionsRow>
                            <ResultButton type="button" variant="primary" onClick={handleAcceptResult} disabled={!canAcceptResult}>
                              {resultBusy ? "처리중..." : "결과 인정"}
                            </ResultButton>
                            <ResultButton type="button" variant="secondary" onClick={handleDisputeResult} disabled={resultBusy}>
                              이의 제기
                            </ResultButton>
                          </ResultActionsRow>
                        </>
                      ) : (
                        <ResultStatusText>상대팀이 제출한 결과입니다. 결과 인정·이의 제기는 팀장이 처리해요.</ResultStatusText>
                      )
                    ) : (
                      <ResultStatusText>상대팀 승인을 기다리는 중입니다.</ResultStatusText>
                    )}
                  </>
                )}

                {resultState === "disputed" && <ResultStatusText>이의 제기 상태입니다. 관리자 검토 후 처리됩니다.</ResultStatusText>}
              </SectionCard>
            </>
          )}

          {isFinished && (
            <>
              <SectionCard>
                <SectionTitleRow>
                  <SectionTitleLeft>
                    <SectionIcon>🏁</SectionIcon>
                    <span>확정된 경기 결과</span>
                  </SectionTitleLeft>
                  <SectionTitleActions />
                </SectionTitleRow>

                <ScoreHero>
                  <ScoreHeroNum>{String(actorScoreSaved ?? "-")}</ScoreHeroNum>
                  <ScoreHeroSep>:</ScoreHeroSep>
                  <ScoreHeroNum>{String(targetScoreSaved ?? "-")}</ScoreHeroNum>
                </ScoreHero>

                <ScoreHeroHint>{room?.scheduledAt ? `${formatKoreanDateTime(room.scheduledAt)} 경기` : "경기 결과"}</ScoreHeroHint>
              </SectionCard>
            </>
          )}

          {isCancelled && (
            <SectionCard>
              <SectionTitleRow>
                <SectionTitleLeft>
                  <SectionIcon>⚠️</SectionIcon>
                  <span>취소된 매칭</span>
                </SectionTitleLeft>
                <SectionTitleActions />
              </SectionTitleRow>
              <ResultStatusText>이 매칭은 취소 처리되었습니다.</ResultStatusText>
            </SectionCard>
          )}
        </Inner>

        {status === "accepted" && venueMode === "direct" && (
          <>
            <NoticeText>제안하면 상대팀이 확인 후 확정할 수 있어요. (직접 입력 · 현장 정산)</NoticeText>

            {/* (2-3) 구장 예약 직접 확인 체크박스 */}
            <CheckRow>
              <input
                type="checkbox"
                checked={venueConfirmChecked}
                onChange={(e) => setVenueConfirmChecked(e.target.checked)}
              />
              <span>구장 예약은 직접 해야 함을 확인했습니다.</span>
            </CheckRow>

            <ActionsWrap>
              <PrimaryButton type="button" onClick={handlePropose} disabled={!selectedDate || !selectedTime || !toStr(fieldAddress) || !fieldLatLng || !venueConfirmChecked}>
                매칭 일정·장소 제안
              </PrimaryButton>
            </ActionsWrap>
          </>
        )}

        {status === "proposed" && !showVenueGate && (
          <>
            {iAmProposer ? (
              <>
                <NoticeText>상대팀 확정을 기다리고 있어요.</NoticeText>
                <ActionsWrap>
                  {editMode ? (
                    <PrimaryButton type="button" onClick={handlePropose} disabled={!selectedDate || !selectedTime || !toStr(fieldAddress) || !fieldLatLng}>
                      수정 제안 보내기
                    </PrimaryButton>
                  ) : (
                    <MutedButton type="button" onClick={() => setEditMode(true)}>
                      제안 수정하기
                    </MutedButton>
                  )}
                </ActionsWrap>
              </>
            ) : (
              <>
                <NoticeText>
                  다른 일정·구장으로 역제안할 수 있어요. (이 제안 수락은 채팅에서)
                </NoticeText>
                <ActionsWrap>
                  {editMode ? (
                    <PrimaryButton type="button" onClick={handlePropose} disabled={!selectedDate || !selectedTime || !toStr(fieldAddress) || !fieldLatLng}>
                      역제안 보내기
                    </PrimaryButton>
                  ) : (
                    <PrimaryButton type="button" onClick={() => setEditMode(true)}>
                      다른 일정·구장 제안하기
                    </PrimaryButton>
                  )}
                </ActionsWrap>
              </>
            )}
          </>
        )}

        {/* 구장 정하는 방식(제휴/직접) 선택 게이트에서는 채팅을 숨겨 깔끔한 단독 화면으로 */}
        {!showVenueGate &&
          !(status === "accepted" && venueMode === "direct") &&
          status !== "proposed" && (
          <VenueChatDock>
            <MatchRoomChat
              chatId={chatId}
              myUid={myUid}
              opponentName={oppName}
              opponentLeaderName={oppLeader.name}
              opponentAvatarUrl={oppLeader.avatarUrl}
              otherUid={oppLeader.uid}
              systemNotice=""
            />
          </VenueChatDock>
        )}

        {/* 구장 방식 선택(게이트) — 하단 고정 "이 방식으로 정하기" 버튼 */}
        {isAdjusting && showVenueGate && (
          <GateBottomBar>
            {status === "proposed" && (
              <GateHint>
                {iAmProposer
                  ? "다른 일정·구장으로 제안을 수정할 수 있어요."
                  : "다른 일정·구장으로 역제안할 수 있어요. (이 제안 수락은 채팅에서)"}
              </GateHint>
            )}
            <GateProceedBtn
              type="button"
              disabled={!gateChoice}
              onClick={() => {
                if (gateChoice === "partner") {
                  navigate(`/venues?match=${roomId}`);
                } else if (gateChoice === "direct") {
                  // 직접입력: 구장 위치 선택(지도 피커)을 먼저 연다.
                  // (effect 자동오픈은 once-ref라 재선택 시 안 열려서, 여기서 명시적으로 오픈)
                  setVenueMode("direct");
                  setMapPickerOpen(true);
                }
              }}
            >
              이 방식으로 정하기
            </GateProceedBtn>
          </GateBottomBar>
        )}
          </>
        )}
      </PageWrap>

      <VenuePickerSheet
        open={venuePickerOpen}
        onClose={() => setVenuePickerOpen(false)}
        onPick={handlePickVenue}
      />

      <MatchLineupConfirmSheet
        open={lineupSheetOpen}
        onClose={() => setLineupSheetOpen(false)}
        matchRequestId={room.id}
        clubId={myClubId}
        matchSizeKey={matchSizeKey}
        initialStarterIds={myLineupSnap?.memberIds || []}
        initialSubIds={myLineupSnap?.subMemberIds || []}
        onConfirmed={refresh}
      />

      <MapLocationPicker
        open={mapPickerOpen}
        subtitle={(() => {
          const iAmActor = !!myClubId && !!actorClubId && myClubId === actorClubId;
          const myT = iAmActor ? room.myTeam : room.oppTeam;
          const oppT = iAmActor ? room.oppTeam : room.myTeam;
          const myN = toStr(myT?.name) || "내 팀";
          const oppN = toStr(oppT?.name) || "상대팀";
          return `${myN} vs ${oppN}`;
        })()}
        initialLatLng={fieldLatLng}
        initialAddress={toStr(fieldAddress)}
        onClose={() => {
          setMapPickerOpen(false);
          // 구장 위치 선택 뒤로가기 → 직전 화면(직접입력 선택 게이트)으로
          if (isVenue) setVenueMode("none");
        }}
        onConfirm={handleMapPickerConfirm}
      />

      <CancelReasonSheet
        open={cancelSheetOpen}
        busy={cancelBusy}
        paid={!!partnerPay?.resv && (partnerPay.resv.paidByA || partnerPay.resv.paidByB)}
        refundAmount={(() => {
          const r = partnerPay?.resv;
          const pb = partnerPay?.pb || {};
          if (!r) return 0;
          let amt = 0;
          if (r.paidByA) amt += Number(pb.shareA) || 0;
          if (r.paidByB) amt += Number(pb.shareB) || 0;
          return amt;
        })()}
        onConfirm={(k, t) => handleCancelMatch(k, t)}
        onClose={() => setCancelSheetOpen(false)}
      />

      <MatchFinalCelebration
        open={showFinalAnim}
        onClose={() => setShowFinalAnim(false)}
        myName={toStr(myTeamView?.name) || "우리팀"}
        myLogoUrl={toStr(myTeamView?.logoUrl)}
        myRank={myRank}
        oppName={oppName}
        oppLogoUrl={toStr(oppTeamView?.logoUrl)}
        oppRank={oppRank}
        dateText={confDateLabel}
        courtName={toStr(partnerPay?.pb?.courtName)}
        venueName={toStr(fieldAddress) || toStr(partnerPay?.pb?.venueName)}
        payText={partnerPay?.pb ? "예약 완료 (현장 정산)" : ""}
      />

      {/* 직접입력 구장 확정도 제휴구장과 동일한 '경기 확정' 축하로 통일 */}
      <MatchFinalCelebration
        open={showConfirmAnim}
        onClose={() => setShowConfirmAnim(false)}
        myName={toStr(myTeamView?.name) || "우리팀"}
        myLogoUrl={toStr(myTeamView?.logoUrl)}
        myRank={myRank}
        oppName={oppName}
        oppLogoUrl={toStr(oppTeamView?.logoUrl)}
        oppRank={oppRank}
        dateText={confDateLabel}
        courtName={toStr(partnerPay?.pb?.courtName)}
        venueName={toStr(fieldAddress) || toStr(partnerPay?.pb?.venueName)}
        payText={partnerPay?.pb ? "예약 완료 (현장 정산)" : ""}
      />

      <MatchAcceptedCelebration
        open={showAcceptAnim}
        myName={toStr(myTeamView?.name) || "우리팀"}
        myLogoUrl={teamLogoSrc(myTeamView?.logoUrl)}
        myRank={myRank}
        oppName={oppName}
        oppLogoUrl={teamLogoSrc(oppTeamView?.logoUrl)}
        oppRank={oppRank}
        onStart={() => setShowAcceptAnim(false)}
        onClose={() => setShowAcceptAnim(false)}
        onLater={() => {
          setShowAcceptAnim(false);
          navigate("/matchingmanage");
        }}
      />

      {/* ✅ 양 팀 라인업 확정 축하 → 바로 구장·일정 제안하기로 이동 가능 */}
      <MatchAcceptedCelebration
        open={showLineupDoneAnim}
        title="라인업 확정 완료!"
        sub={"양 팀 라인업이 모두 확정됐어요.\n이제 구장·일정을 정해요!"}
        primaryLabel="구장·일정 제안하기  ›"
        laterLabel="나중에 하기"
        myName={toStr(myTeamView?.name) || "우리팀"}
        myLogoUrl={teamLogoSrc(myTeamView?.logoUrl)}
        myRank={myRank}
        oppName={oppName}
        oppLogoUrl={teamLogoSrc(oppTeamView?.logoUrl)}
        oppRank={oppRank}
        onStart={() => {
          setShowLineupDoneAnim(false);
          setVenueMode("none");
          navigate(`/match-roomdetail/${roomId}/venue`);
        }}
        onLater={() => setShowLineupDoneAnim(false)}
        onClose={() => setShowLineupDoneAnim(false)}
      />

      {/* 라인업 보기 모달 — 우리/상대 라인업을 한 창에서 확인. X 또는 바깥 클릭으로 닫힘 */}
      {lineupViewOpen && (
        <LineupModalOverlay onClick={() => setLineupViewOpen(false)}>
          <LineupModalCard onClick={(e) => e.stopPropagation()}>
            <LineupModalHead>
              <LineupModalTitle>라인업</LineupModalTitle>
              <LineupModalClose type="button" aria-label="닫기" onClick={() => setLineupViewOpen(false)}>
                ×
              </LineupModalClose>
            </LineupModalHead>
            <LineupModalBody>
              {/* 우리팀 */}
              <div>
                <LineupTeamName>
                  {toStr(myTeamView?.name) || "우리팀"}
                  {myLineupConfirmed ? ` · 라인업 ${myPlayers.length}명` : ""}
                </LineupTeamName>
                {myLineupConfirmed ? (
                  <LineupBox>
                    <LineupList>
                      {myPlayers.length > 0 ? (
                        myPlayers.map((p) => renderPlayerRow(p, myRecord))
                      ) : (
                        <LineupTitle>선수 정보가 없어요.</LineupTitle>
                      )}
                    </LineupList>
                    {mySubPlayers.length > 0 && (
                      <>
                        <LineupTitle style={{ marginTop: 8 }}>후보 {mySubPlayers.length}명</LineupTitle>
                        <LineupList>{mySubPlayers.map((p) => renderPlayerRow(p, myRecord))}</LineupList>
                      </>
                    )}
                  </LineupBox>
                ) : (
                  <WaitBox>
                    <div>아직 우리 팀 라인업을 확정하지 않았어요.</div>
                    <RemindBtn
                      type="button"
                      onClick={() => {
                        setLineupViewOpen(false);
                        setLineupSheetOpen(true);
                      }}
                    >
                      우리 라인업 확정하기
                    </RemindBtn>
                  </WaitBox>
                )}
              </div>

              {/* 상대팀 */}
              <div>
                <LineupTeamName>
                  {oppName}
                  {oppLineupConfirmed ? ` · 라인업 ${oppPlayers.length}명` : ""}
                </LineupTeamName>
                {oppLineupConfirmed ? (
                  <LineupBox>
                    <LineupList>
                      {oppPlayers.length > 0 ? (
                        oppPlayers.map((p) => renderPlayerRow(p, oppRecord))
                      ) : (
                        <LineupTitle>선수 정보가 없어요.</LineupTitle>
                      )}
                    </LineupList>
                    {oppSubPlayers.length > 0 && (
                      <>
                        <LineupTitle style={{ marginTop: 8 }}>후보 {oppSubPlayers.length}명</LineupTitle>
                        <LineupList>{oppSubPlayers.map((p) => renderPlayerRow(p, oppRecord))}</LineupList>
                      </>
                    )}
                  </LineupBox>
                ) : (
                  <WaitBox>
                    <div>{oppName}이(가) 아직 라인업을 확정하지 않았어요.</div>
                    <RemindBtn
                      type="button"
                      disabled={reminderBusy || reminderSent}
                      onClick={handleSendLineupReminder}
                    >
                      {reminderSent ? "요청을 보냈어요" : reminderBusy ? "보내는 중…" : "알림 보내기"}
                    </RemindBtn>
                  </WaitBox>
                )}
              </div>
            </LineupModalBody>
          </LineupModalCard>
        </LineupModalOverlay>
      )}

      {/* 상대 팀 신고 모달 — X 또는 바깥 클릭으로 닫힘 */}
      {reportOpen && (
        <LineupModalOverlay
          onClick={() => {
            if (!reportBusy) setReportOpen(false);
          }}
        >
          <LineupModalCard onClick={(e) => e.stopPropagation()}>
            <LineupModalHead>
              <LineupModalTitle>🚩 상대 팀 신고</LineupModalTitle>
              <LineupModalClose
                type="button"
                aria-label="닫기"
                onClick={() => {
                  if (!reportBusy) setReportOpen(false);
                }}
              >
                ×
              </LineupModalClose>
            </LineupModalHead>
            <LineupModalBody>
              <ReportDesc>
                {`신고 대상: ${oppName}\n신고 내용은 관리자가 검토 후 조치합니다.\n허위 신고 시 서비스 이용이 제한될 수 있습니다.`}
              </ReportDesc>
              <ReportTextarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="신고 사유를 입력해 주세요. (예: 비매너, 노쇼, 허위 정보 등)"
              />
              <ReportActions>
                <ReportCancelBtn
                  type="button"
                  onClick={() => {
                    if (!reportBusy) setReportOpen(false);
                  }}
                >
                  취소
                </ReportCancelBtn>
                <ReportSubmitBtn
                  type="button"
                  disabled={reportBusy || !reportReason.trim()}
                  onClick={handleSubmitReport}
                >
                  {reportBusy ? "전송중…" : "신고하기"}
                </ReportSubmitBtn>
              </ReportActions>
            </LineupModalBody>
          </LineupModalCard>
        </LineupModalOverlay>
      )}
    </>
  );
}
