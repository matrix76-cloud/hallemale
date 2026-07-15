/* eslint-disable */
// src/pages/matching/MatchingHomePage.jsx
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate, useLocation } from "react-router-dom";
import { images, teamLogoSrc } from "../../utils/imageAssets";
import Spinner from "../../components/common/Spinner";

import { useClub } from "../../hooks/useClub";
import { useAuth } from "../../hooks/useAuth";
import { MIN_TEAM_MEMBERS } from "../../utils/constants";
import { listMatchInboxForClub } from "../../services/matchingInboxService";
import {
  acceptMatchRequest,
  rejectMatchRequest,
  cancelMatchRequest,
} from "../../services/matchingService";
import { fetchLineupRosterProfiles } from "../../services/lineupRosterService";
import { getTeamRankMap } from "../../services/teamRankingService";
import PositionChip from "../../components/common/PositionChip";
import EmptyState from "../../components/common/EmptyState";
import { FiInfo } from "react-icons/fi";

/* ========================= helpers ========================= */

const toStr = (v) => String(v || "").trim();

function formatDateTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}.${dd} ${hh}:${mi}`;
}

function isPendingOnlyRow(row) {
  const phase = toStr(row?.phase);
  const st = toStr(row?.status);
  return (
    phase === "pending" ||
    phase === "requesting" ||
    st === "pending" ||
    st === "requesting"
  );
}

function isCancelledOrRejectedRow(row) {
  const phase = toStr(row?.phase);
  const st = toStr(row?.status);
  return (
    phase === "cancelled" ||
    phase === "rejected" ||
    st === "cancelled" ||
    st === "rejected"
  );
}

function getActionsByPhase({ direction, phase }) {
  if (phase === "pending" && direction === "sent") {
    return [{ type: "cancel", label: "요청 철회" }];
  }
  if (phase === "pending" && direction === "received") {
    return [
      { type: "accept", label: "수락하기" },
      { type: "reject", label: "거절하기" },
    ];
  }
  return [];
}

function buildLineupLabel(lu) {
  if (!lu) return "";
  const name = toStr(lu?.name);
  const size = toStr(lu?.matchSizeKey);
  const cnt =
    typeof lu?.memberCount === "number"
      ? lu.memberCount
      : Array.isArray(lu?.memberIds)
      ? lu.memberIds.length
      : null;

  const pieces = [size, typeof cnt === "number" ? `${cnt}명` : ""]
    .filter(Boolean)
    .join(" · ");
  if (!pieces) return name || "라인업";
  return `${name || "라인업"} (${pieces})`;
}

function formatSkillKo(level) {
  const v = toStr(level).toLowerCase();

  if (!v) return "";
  if (v.includes("beginner") || v === "b") return "초보";
  if (v.includes("amateur")) return "아마추어";
  if (v.includes("intermediate") || v.includes("mid")) return "중급";
  if (v.includes("advanced")) return "상급";
  if (v.includes("pro") || v.includes("expert")) return "프로";
  return toStr(level);
}

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

// 경기 형식(3v3/4v4/5v5) → "3 vs 3" (몇대몇 표시용)
function formatMatchSizeKo(sizeKey) {
  const sz = toStr(sizeKey).toLowerCase();
  if (["3v3", "4v4", "5v5"].includes(sz)) return sz.replace("v", " vs ");
  return "";
}

function buildBodyText(p) {
  const h = typeof p?.heightCm === "number" ? `${p.heightCm}cm` : "";
  const w = typeof p?.weightKg === "number" ? `${p.weightKg}kg` : "";
  const hw = [h, w].filter(Boolean).join(" / ");

  const skillKo = formatSkillKo(p?.skillLevel);
  const pieces = [skillKo, hw].filter(Boolean);

  if (pieces.length === 0) return "프로필 정보 없음";
  return pieces.join(" · ");
}

function resolveOtherTeamSnapshot(row) {
  const latest = row?.latest || {};
  const direction = toStr(row?.direction);

  // ✅ 받은 제안(received): 상대는 fromTeam
  if (direction === "received") {
    return latest?.fromTeamSnapshot || row?.opponentSnapshot || {};
  }

  // ✅ 보낸 제안(sent): 상대는 toTeam
  if (direction === "sent") {
    return latest?.toTeamSnapshot || row?.opponentSnapshot || {};
  }

  // fallback
  return row?.opponentSnapshot || latest?.toTeamSnapshot || latest?.fromTeamSnapshot || {};
}



function getMatchBadgeMeta(row) {
  const phase = toStr(row?.phase);
  const direction = toStr(row?.direction);

  let stateLabel = "상태";
  let tone = "muted";

  if (phase === "pending" || phase === "requesting") {
    stateLabel = direction === "sent" ? "응답대기" : "요청도착";
    tone = "pending";
  } else if (phase === "rejected") {
    stateLabel = direction === "sent" ? "상대 거절" : "내가 거절";
    tone = "danger";
  } else if (phase === "cancelled") {
    stateLabel = direction === "sent" ? "내가 철회" : "상대 철회";
    tone = "muted";
  } else if (phase === "accepted") {
    stateLabel = "수락됨";
    tone = "positive";
  } else if (phase === "confirmed") {
    stateLabel = "일정확정";
    tone = "positive";
  } else if (phase === "finished") {
    stateLabel = "경기종료";
    tone = "muted";
  }

  return { stateLabel, tone };
}

/* ========================= styles ========================= */

const Page = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg};
`;

const Inner = styled.div`
  width: 100%;
  margin: 0 auto;
  padding-bottom: calc(${({ theme }) => theme.layout.bottomTabHeight}px + 20px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const TabsWrap = styled.div`
  display: flex;
  width: 90%;
  align-items: center;
  gap: 6px;
  padding: 4px;
  margin: 10px auto 0px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const TabButton = styled.button`
  flex: 1;
  min-width: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border: none;
  border-radius: 999px;
  background: ${({ $active, theme }) =>
    $active ? theme.colors.card : "transparent"};
  box-shadow: ${({ $active, theme }) =>
    $active ? theme.shadows.card : "none"};

  color: ${({ $active, theme }) =>
    $active ? theme.colors.textStrong : theme.colors.textWeak};
  cursor: pointer;
  white-space: nowrap;
  text-align: center;
  font-weight: 600;
  padding: 10px 0;
  font-size: 13px;

  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;

  &:active {
    transform: translateY(1px);
  }
`;

const TabLabel = styled.span`
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
`;

const TabCount = styled.span`
  font-size: 12px;
  color: inherit;
  opacity: 0.9;
`;

const ListCard = styled.div`
  margin-top: 4px;
  background: transparent;
  width: 90%;
  margin-left: auto;
  margin-right: auto;

  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const ItemCard = styled.div`
  position: relative;
  width: 100%;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 16px;
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "#eef2f7"};
  box-shadow: ${({ theme }) => theme.shadows.card};
  overflow: hidden;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

/* 앱2 스타일: 좌측 상대팀 썸네일 + 우측 정보 (클릭 시 팀 프로필로 이동) */
const CardTop = styled.button`
  border: none;
  background: transparent;
  padding: 0;
  width: 100%;
  display: flex;
  gap: 12px;
  text-align: left;
  cursor: pointer;

  &:active {
    opacity: 0.9;
  }
`;

const Thumb = styled.div`
  position: relative;
  width: 72px;
  height: 72px;
  flex: 0 0 auto;
  align-self: flex-start;
  /* 1~3위 왕관이 위로 튀어나오므로 상단 여백 확보 */
  margin-top: ${({ $crowned }) => ($crowned ? "12px" : "0")};
`;

const ThumbInner = styled.div`
  width: 72px;
  height: 72px;
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
  gap: 6px;
  justify-content: center;
`;

/* 팀명 + 상태 배지 한 줄 (배지는 우측 코너로) */
const NameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

/* 지역 · 몇대몇 pill */
const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

const MetaText = styled.span`
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`;

const MetaDot = styled.span`
  width: 3px;
  height: 3px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.textWeak};
  opacity: 0.55;
  flex-shrink: 0;
`;

/* 경기 형식(3v3/4v4/5v5) — 제안의 핵심.
   보라 배경 없이 농구공 + 진한 글씨의 깔끔한 아웃라인 칩 */
const FormatChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 7px 12px 7px 8px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#ffffff"};
  font-size: 14px;
  font-weight: 800;
  line-height: 1;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
`;

const FormatChipIcon = styled.img`
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex-shrink: 0;
`;

const FormatUnit = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
`;

const HeaderLeft = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const HeaderTitle = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const HeaderRight = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
`;

const BadgeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-top: 3px;
`;

const TONE_PALETTE = {
  positive: {
    light: { bg: "#eff6ff", color: "#2563eb" },
    dark: { bg: "rgba(99, 102, 241, 0.18)", color: "#a5b4fc" },
  },
  danger: {
    light: { bg: "#fef2f2", color: "#b91c1c" },
    dark: { bg: "rgba(248, 113, 113, 0.16)", color: "#fca5a5" },
  },
  pending: {
    light: { bg: "#f3f4f6", color: "#111827" },
    dark: { bg: "rgba(255, 255, 255, 0.08)", color: "#f9fafb" },
  },
  muted: {
    light: { bg: "#f3f4f6", color: "#6b7280" },
    dark: { bg: "rgba(255, 255, 255, 0.05)", color: "#9ca3af" },
  },
};

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: auto;
  flex-shrink: 0;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  background: ${({ $tone, theme }) =>
    (TONE_PALETTE[$tone] || TONE_PALETTE.muted)[theme.mode === "dark" ? "dark" : "light"].bg};
  color: ${({ $tone, theme }) =>
    (TONE_PALETTE[$tone] || TONE_PALETTE.muted)[theme.mode === "dark" ? "dark" : "light"].color};
`;

const BadgeTime = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
`;

/* 경기 형식(몇대몇) 배지 — 브랜드 보라 */
const SizeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(124, 92, 201, 0.22)" : "#efe9ff"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#c4b5fd" : "#7c5cc9")};
`;

const TeamInfoCell = styled.button`
  border: none;
  background: transparent;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  cursor: pointer;
  width: 100%;
  /* 1~3위 왕관이 위로 튀어나오므로 상단 여백 확보 */
  margin-top: ${({ $crowned }) => ($crowned ? "14px" : "0")};
`;

/* 로고 + 왕관 오버레이 래퍼 (LogoWrap은 overflow:hidden이라 왕관을 밖에서 얹음) */
const LogoCrownWrap = styled.div`
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
`;

/* 1~3위: 팀 로고 위에 얹는 왕관 (앱 전체 공통 비율 — 사진의 약 59%, 위로 ~38% 돌출) */
const CrownImg = styled.img`
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  width: 31px;
  height: 31px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.22));
`;

const LogoWrap = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
  flex-shrink: 0;
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TeamTexts = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
`;

const TeamName = styled.div`
  font-size: 16px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TeamRegion = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "#eef2f7"};
`;

const LineupTextRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

/* 라인업 안내 앞 3D 농구공 액센트 (앱 농구 테마) */
const LineupIcon = styled.img`
  width: 22px;
  height: 22px;
  object-fit: contain;
  flex-shrink: 0;
`;

const LineupText = styled.div`
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textNormal};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LineupInfoIconBtn = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#ffffff"};
  color: ${({ theme }) => theme.colors.textWeak};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;

  &:active {
    transform: translateY(1px);
    opacity: 0.85;
  }
`;

const Arrow = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  flex-shrink: 0;
`;

const ActionRow = styled.div`
  width: 100%;
  display: flex;
  justify-content: ${({ $align }) => ($align === "right" ? "flex-end" : "stretch")};
`;

const ActionGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  width: 100%;
`;

const ActionButtonSm = styled.button`
  width: 100%;
  border-radius: 12px;
  padding: 11px 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ $variant, theme }) =>
    $variant === "accept"
      ? "linear-gradient(135deg, #9575CD 0%, #7C5CC9 100%)"
      : theme.mode === "dark"
      ? theme.colors.surface
      : "#ffffff"};
  color: ${({ $variant, theme }) =>
    $variant === "accept" ? "#ffffff" : theme.colors.textStrong};
  ${({ $variant }) =>
    $variant === "accept"
      ? "border-color: transparent; box-shadow: 0 6px 14px rgba(79, 70, 229, 0.28);"
      : ""}

  &:active {
    transform: translateY(1px);
    opacity: 0.85;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const CancelButton = styled.button`
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? "rgba(251, 146, 60, 0.35)" : "#fed7aa"};
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(251, 146, 60, 0.12)" : "#fff7ed"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#fdba74" : "#c2410c")};
  border-radius: 12px;
  width: 100%;
  padding: 11px 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  text-align: center;

  &:active {
    transform: translateY(1px);
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const StateWrap = styled.div`
  padding: 32px 16px;
  text-align: center;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0, 0, 0, 0.65)" : "rgba(15, 23, 42, 0.45)"};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
`;

const ModalCard = styled.div`
  width: 94%;
  max-width: 520px;
  max-height: 84vh;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  border-radius: 8px;
  padding: 14px 14px 16px;
  box-shadow: ${({ theme }) =>
    theme.mode === "dark"
      ? "0 18px 40px rgba(0, 0, 0, 0.5)"
      : "0 18px 40px rgba(15, 23, 42, 0.4)"};
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const ModalTitle = styled.div`
  font-size: 17px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const ModalClose = styled.button`
  border: none;
  background: none;
  font-size: 20px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const ModalBody = styled.div`
  margin-top: 10px;
  overflow-y: auto;
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 4px;
  }
`;

const LineupBlock = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  padding: 12px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#ffffff"};
`;

const LineupBlockTitle = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
  margin-bottom: 8px;
`;

const LineupName = styled.div`
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const LineupMeta = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const LineupDivider = styled.div`
  height: 10px;
`;

const RosterList = styled.div`
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PlayerRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.card : "transparent"};
`;

const PlayerAvatar = styled.img`
  width: 34px;
  height: 34px;
  border-radius: 999px;
  object-fit: cover;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.bg : "#e5e7eb"};
  flex-shrink: 0;
`;

const PlayerTexts = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
`;

const PlayerName = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PlayerMetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const PlayerMetaText = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const EmptyHint = styled.div`
  margin-top: 8px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const MiniLoading = styled.div`
  padding: 12px 0 2px;
  display: flex;
  justify-content: center;
`;

/* ========================= page ========================= */

export default function MatchingManagePage() {
  const nav = useNavigate();
  const location = useLocation();

  const initialTab =
    location.state && location.state.initialTab
      ? String(location.state.initialTab)
      : "received";

  const [activeTab, setActiveTab] = useState(
    initialTab === "sent" || initialTab === "closed" ? initialTab : "received"
  );

  const { club, members: myMembers, isTeamLeader } = useClub();
  const myClubId = toStr(club?.clubId || club?.id);
  const myMemberCount = Array.isArray(myMembers) ? myMembers.length : 0;

  const { firebaseUser, userDoc } = useAuth();
  const myUid = toStr(firebaseUser?.uid || userDoc?.uid || userDoc?.id);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [busyKey, setBusyKey] = useState("");

  const [lineupModalOpen, setLineupModalOpen] = useState(false);
  const [lineupModalLatest, setLineupModalLatest] = useState(null);
  const [fromRoster, setFromRoster] = useState([]);
  const [toRoster, setToRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const reload = async ({ silent = false } = {}) => {
    if (!myClubId) {
      setItems([]);
      setErr("팀 정보를 확인할 수 없습니다.");
      setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);
      setErr("");
      const list = await listMatchInboxForClub({ clubId: myClubId, limitCount: 300 });
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      // 백그라운드(silent) 갱신 실패 시 기존 목록 유지
      if (!silent) {
        setErr("매칭 정보를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.");
        setItems([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myClubId]);

  // ✅ 화면 복귀(앱 전환·뒤로가기)·포커스 시 목록을 조용히 재조회 →
  //    상대가 수락/거절/취소하면 pending(받은/보낸 제안)에서 즉시 빠지도록 최신 상태 반영
  useEffect(() => {
    if (!myClubId) return;
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") reload({ silent: true });
    };
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myClubId]);

  // ✅ 전역 팀 랭킹 맵 — 카드 상대팀이 1~3위면 로고 위 왕관 표시(현재 순위 기준, 변동 자동 반영)
  const [rankMap, setRankMap] = useState(null);
  useEffect(() => {
    let alive = true;
    getTeamRankMap()
      .then((m) => { if (alive) setRankMap(m); })
      .catch(() => { if (alive) setRankMap(null); });
    return () => { alive = false; };
  }, []);

  const pendingItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items.filter((x) => isPendingOnlyRow(x));
  }, [items]);

  const closedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items.filter((x) => isCancelledOrRejectedRow(x));
  }, [items]);

  const receivedCount = useMemo(() => {
    return pendingItems.filter((x) => x?.direction === "received").length;
  }, [pendingItems]);

  const sentCount = useMemo(() => {
    return pendingItems.filter((x) => x?.direction === "sent").length;
  }, [pendingItems]);

  const closedCount = useMemo(() => {
    return closedItems.length;
  }, [closedItems]);

  const visibleItems = useMemo(() => {
    if (activeTab === "closed") return closedItems;

    const base = pendingItems;
    if (activeTab === "sent") return base.filter((x) => x.direction === "sent");
    return base.filter((x) => x.direction === "received");
  }, [activeTab, pendingItems, closedItems]);

  const handleTeamClick = (clubId) => {
    const id = toStr(clubId);
    if (!id) return;
    nav(`/team/${id}`);
  };

  const handleAction = async (row, action) => {
    const latest = row?.latest || null;
    const matchId = toStr(latest?.matchId);
    if (!latest || !matchId) {
      showAlert("매칭 정보를 확인할 수 없습니다.");
      return;
    }

    // ✅ 매칭 요청 수락/거절/취소는 팀장만 가능
    if (!isTeamLeader) {
      showAlert("매칭 요청 수락·거절은 팀장만 할 수 있어요.");
      return;
    }

    const key = `${action.type}:${matchId}`;
    if (busyKey) return;

    try {
      setBusyKey(key);

      if (action.type === "accept") {
        // ✅ 최소 인원(팀장 포함 3명) 미만이면 수락 불가
        if (myMemberCount < MIN_TEAM_MEMBERS) {
          showAlert(`우리 팀원이 ${MIN_TEAM_MEMBERS}명 이상일 때 매칭을 수락할 수 있어요. (현재 ${myMemberCount}명)`);
          return;
        }
        await acceptMatchRequest({ myClubId, latestNoti: latest });

        // 매칭 성사 → 조율중 매칭룸으로 이동하며 "매칭 성사" 축하 애니메이션 표시
        nav(`/match-roomdetail/${matchId}`, {
          state: { celebrateAccepted: true },
        });
        return;
      }

      if (action.type === "reject") {
        await rejectMatchRequest({ myClubId, latestNoti: latest });
        await reload();
        return;
      }

      if (action.type === "cancel") {
        await cancelMatchRequest({ myClubId, latestNoti: latest });
        await reload();
        return;
      }
    } catch (e) {
      showAlert(e?.message || "처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusyKey("");
    }
  };

  const openLineupModal = async (row) => {
    const latest = row?.latest || null;
    if (!latest) return;

    setLineupModalLatest(latest);
    setLineupModalOpen(true);

    const fromIds = Array.isArray(latest?.fromLineupSnapshot?.memberIds)
      ? latest.fromLineupSnapshot.memberIds
      : [];
    const toIds = Array.isArray(latest?.toLineupSnapshot?.memberIds)
      ? latest.toLineupSnapshot.memberIds
      : [];

    setRosterLoading(true);
    setFromRoster([]);
    setToRoster([]);

    try {
      const [a, b] = await Promise.all([
        fetchLineupRosterProfiles(fromIds),
        fetchLineupRosterProfiles(toIds),
      ]);
      setFromRoster(Array.isArray(a) ? a : []);
      setToRoster(Array.isArray(b) ? b : []);
    } finally {
      setRosterLoading(false);
    }
  };

  const closeLineupModal = () => {
    setLineupModalOpen(false);
    setLineupModalLatest(null);
    setFromRoster([]);
    setToRoster([]);
    setRosterLoading(false);
  };

  // 매칭 신청/수락 관리는 팀장만. 팀원은 경기 종료 후 평점·리뷰만 가능.
  if (!isTeamLeader) {
    return (
      <Page>
        <Inner>
          <EmptyState
            icon="🤝"
            text="매칭 신청·수락은 팀장만 관리할 수 있어요."
            sub="팀원은 경기가 끝난 뒤 상대 팀 평점·리뷰를 남길 수 있어요."
          />
        </Inner>
      </Page>
    );
  }

  return (
    <Page>
      <Inner>
        <TabsWrap>
          <TabButton
            type="button"
            $active={activeTab === "received"}
            onClick={() => setActiveTab("received")}
          >
            <TabLabel>
              받은 제안 <TabCount>({receivedCount})</TabCount>
            </TabLabel>
          </TabButton>

          <TabButton type="button" $active={activeTab === "sent"} onClick={() => setActiveTab("sent")}>
            <TabLabel>
              보낸 제안 <TabCount>({sentCount})</TabCount>
            </TabLabel>
          </TabButton>

          <TabButton
            type="button"
            $active={activeTab === "closed"}
            onClick={() => setActiveTab("closed")}
          >
            <TabLabel>
              철회·거절 <TabCount>({closedCount})</TabCount>
            </TabLabel>
          </TabButton>
        </TabsWrap>

        {loading && (
          <StateWrap>
            <Spinner size="lg" />
          </StateWrap>
        )}

        {!loading && err && <StateWrap>{err}</StateWrap>}

        {!loading && !err && visibleItems.length === 0 && (
          <EmptyState
            icon={
              activeTab === "closed" ? "🗂️" : activeTab === "sent" ? "📨" : "📬"
            }
            text={
              activeTab === "closed"
                ? "철회되거나 거절된 제안이 없습니다."
                : "표시할 매칭이 없습니다."
            }
          />
        )}

        {!loading && !err && visibleItems.length > 0 && (
          <ListCard>
            {visibleItems.map((row) => {
              const latest = row.latest || {};


              const opp =  resolveOtherTeamSnapshot(row);
              const oppName = toStr(opp?.name) || "상대 팀";
              const oppRegion = toStr(opp?.region);
              const logoSrc = teamLogoSrc(toStr(opp?.logoUrl));
              const oppRank = rankMap?.get(toStr(row.opponentClubId)) || 0;
              const hasCrown = oppRank >= 1 && oppRank <= 3;

              const ts = row.timestamp ? formatDateTime(row.timestamp) : "";
              const badgeMeta = getMatchBadgeMeta(row);
              const fmtLabel = formatMatchSizeKo(latest?.matchSizeKey);

              const actions =
                activeTab === "closed"
                  ? []
                  : getActionsByPhase({ direction: row.direction, phase: row.phase });

              const isSentTab = activeTab === "sent";

              const directionLabel =
                row.direction === "received"
                  ? "받은 제안"
                  : row.direction === "sent"
                  ? "보낸 제안"
                  : "제안";

              return (
                <ItemCard key={row.matchId || latest?.matchId || row.opponentClubId}>
                  <CardTop type="button" onClick={() => handleTeamClick(row.opponentClubId)}>
                    <Thumb $crowned={hasCrown}>
                      {hasCrown ? (
                        <ThumbCrown src={images.logo} alt={`${oppRank}위`} />
                      ) : null}
                      <ThumbInner>
                        <ThumbImg src={logoSrc} alt={oppName} />
                      </ThumbInner>
                    </Thumb>

                    <Body>
                      <NameRow>
                        <TeamName>{oppName}</TeamName>
                        <Badge $tone={badgeMeta.tone}>{badgeMeta.stateLabel}</Badge>
                      </NameRow>

                      <MetaRow>
                        <MetaText>{oppRegion || "지역 미등록"}</MetaText>
                        <MetaDot />
                        <MetaText>{directionLabel}</MetaText>
                      </MetaRow>

                      {fmtLabel ? (
                        <FormatChip>
                          <FormatChipIcon
                            src={images.emoji3dBasketball}
                            alt=""
                            aria-hidden="true"
                          />
                          {fmtLabel} <FormatUnit>매칭</FormatUnit>
                        </FormatChip>
                      ) : null}
                    </Body>
                  </CardTop>

                  {actions.length > 0 && (
                    <ActionRow $align="stretch">
                      {isSentTab && actions.length === 1 && actions[0].type === "cancel" ? (
                        <CancelButton
                          type="button"
                          onClick={() => handleAction(row, actions[0])}
                          disabled={busyKey === `cancel:${toStr(latest?.matchId)}`}
                        >
                          {busyKey === `cancel:${toStr(latest?.matchId)}` ? "처리중..." : "요청 철회"}
                        </CancelButton>
                      ) : (
                        <ActionGrid>
                          {actions.map((a) => {
                            const matchId = toStr(latest?.matchId);
                            const disabled = busyKey === `${a.type}:${matchId}`;

                            return (
                              <ActionButtonSm
                                key={a.type}
                                type="button"
                                $variant={a.type}
                                onClick={() => handleAction(row, a)}
                                disabled={disabled}
                              >
                                {disabled ? "처리중..." : a.label}
                              </ActionButtonSm>
                            );
                          })}
                        </ActionGrid>
                      )}
                    </ActionRow>
                  )}
                </ItemCard>
              );
            })}
          </ListCard>
        )}
      </Inner>

      {lineupModalOpen && (
        <Overlay onClick={closeLineupModal}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>라인업 정보</ModalTitle>
              <ModalClose onClick={closeLineupModal}>×</ModalClose>
            </ModalHeader>

            <ModalBody>
              {!lineupModalLatest ? (
                <StateWrap>라인업 정보를 불러올 수 없습니다.</StateWrap>
              ) : (
                <>
                  <LineupBlock>
                    <LineupBlockTitle>보내는 라인업</LineupBlockTitle>
                    <LineupName>{buildLineupLabel(lineupModalLatest?.fromLineupSnapshot)}</LineupName>
                    <LineupMeta>{toStr(lineupModalLatest?.fromTeamSnapshot?.name) || "우리 팀"}</LineupMeta>

                    {rosterLoading ? (
                      <MiniLoading>
                        <Spinner size="sm" fullscreen={false} />
                      </MiniLoading>
                    ) : fromRoster.length > 0 ? (
                      <RosterList>
                        {fromRoster.map((p) => {
                          const src = toStr(p?.photoUrl) || images.profileDefault || images.logo;
                          const name = toStr(p?.nickname) || "이름 없음";
                          return (
                            <PlayerRow key={toStr(p?.userId) || Math.random()}>
                              <PlayerAvatar src={src} alt={name} />
                              <PlayerTexts>
                                <PlayerName>{name}</PlayerName>
                                <PlayerMetaRow>
                                  <PositionChip label={formatPositionKo(p?.mainPosition)} size="sm" />
                                  <PlayerMetaText>{buildBodyText(p)}</PlayerMetaText>
                                </PlayerMetaRow>
                              </PlayerTexts>
                            </PlayerRow>
                          );
                        })}
                      </RosterList>
                    ) : (
                      <EmptyHint>멤버 정보를 불러올 수 없습니다.</EmptyHint>
                    )}
                  </LineupBlock>

                  <LineupDivider />

                  <LineupBlock>
                    <LineupBlockTitle>받는 라인업</LineupBlockTitle>
                    <LineupName>{buildLineupLabel(lineupModalLatest?.toLineupSnapshot)}</LineupName>
                    <LineupMeta>{toStr(lineupModalLatest?.toTeamSnapshot?.name) || "상대 팀"}</LineupMeta>

                    {rosterLoading ? (
                      <MiniLoading>
                        <Spinner size="sm" fullscreen={false} />
                      </MiniLoading>
                    ) : toRoster.length > 0 ? (
                      <RosterList>
                        {toRoster.map((p) => {
                          const src = toStr(p?.photoUrl) || images.profileDefault || images.logo;
                          const name = toStr(p?.nickname) || "이름 없음";
                          return (
                            <PlayerRow key={toStr(p?.userId) || Math.random()}>
                              <PlayerAvatar src={src} alt={name} />
                              <PlayerTexts>
                                <PlayerName>{name}</PlayerName>
                                <PlayerMetaRow>
                                  <PositionChip label={formatPositionKo(p?.mainPosition)} size="sm" />
                                  <PlayerMetaText>{buildBodyText(p)}</PlayerMetaText>
                                </PlayerMetaRow>
                              </PlayerTexts>
                            </PlayerRow>
                          );
                        })}
                      </RosterList>
                    ) : (
                      <EmptyHint>멤버 정보를 불러올 수 없습니다.</EmptyHint>
                    )}
                  </LineupBlock>
                </>
              )}
            </ModalBody>
          </ModalCard>
        </Overlay>
      )}
    </Page>
  );
}
