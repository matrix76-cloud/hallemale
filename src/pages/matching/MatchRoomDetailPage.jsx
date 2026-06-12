/* eslint-disable */
// src/pages/matching/MatchRoomDetailPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { goBackOrHome } from "../../utils/navigation";
import { images, playerAvatars } from "../../utils/imageAssets";
import {
  loadMatchRoomDetail,
  proposeMatchSchedule,
  confirmProposedSchedule,
  cancelMatchRequest,
  submitMatchResultWithMedia,
  acceptMatchResult,
  disputeMatchResult,
  appendMatchResultComment,
  appendMatchResultPhotos,
} from "../../services/matchRoomService";
import PositionChip from "../../components/common/PositionChip";
import { useClub } from "../../hooks/useClub";
import { useAuth } from "../../hooks/useAuth";
import { useUIContext } from "../../context/UIContext";
import VenuePickerSheet from "../../components/common/VenuePickerSheet";
import MatchRoomChat from "../../components/matchRoom/MatchRoomChat";
import MapLocationPicker from "../../components/matchRoom/MapLocationPicker";
import { getOrCreateDmRoom } from "../../services/chatService";
import { getClubById } from "../../services/clubManageService";
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

/* ==================== 스타일 ==================== */

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme, $dark }) =>
    $dark ? mrp(theme.mode).bg : theme.colors.bg || "#f5f6fa"};
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

const VsDivider = styled.div`
  padding: 6px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.primary};
`;

const SectionCard = styled.div`
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

const AddMiniButton = styled.button`
  border: none;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 13px;
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
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
  padding: 14px 12px 0;
`;

const MatchInfoBar = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  margin-bottom: 10px;
  border: none;
  border-radius: 12px;
  background: ${({ theme }) => mrp(theme.mode).surface2};
  cursor: pointer;
`;

const MatchInfoBarTitle = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => mrp(theme.mode).t2};
  letter-spacing: -0.02em;
`;

const MatchInfoToggle = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => mrp(theme.mode).puD};
  flex-shrink: 0;
`;

const VsCard = styled.div`
  background: ${({ theme }) => mrp(theme.mode).vsCardBg};
  box-shadow: ${({ theme }) => mrp(theme.mode).vsCardShadow};
  border: 0.5px solid ${({ theme }) => mrp(theme.mode).line2};
  border-radius: 18px;
  padding: 20px 16px 16px;
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
  align-items: center;
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
  border: 0.5px solid ${({ theme }) => mrp(theme.mode).line2};
  background: ${({ theme, $home }) =>
    $home ? mrp(theme.mode).crestHomeBg : mrp(theme.mode).crestBg};
  color: ${({ theme, $home }) => ($home ? "#fff" : mrp(theme.mode).t2)};
`;

const CrestImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
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

const VsMid = styled.div`
  flex-shrink: 0;
  text-align: center;
  padding-bottom: 22px;
`;

const VsX = styled.div`
  font-size: 24px;
  font-weight: 900;
  color: ${({ theme }) => mrp(theme.mode).puL};
  line-height: 1;
`;

const Stepper = styled.div`
  display: flex;
  align-items: flex-start;
  padding: 18px 4px 2px;
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
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => mrp(theme.mode).t2};
  margin: 8px 0 2px;
`;

/* 게이트 항목 (카드 스타일 제거 — 평평한 리스트) */
const OptCard = styled.button`
  width: 100%;
  text-align: left;
  padding: 14px 2px;
  display: flex;
  gap: 12px;
  align-items: center;
  transition: 0.15s;
  background: none;
  border: none;
  border-bottom: 0.5px solid ${({ theme }) => mrp(theme.mode).line};
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};
  opacity: ${({ disabled }) => (disabled ? 0.55 : 1)};
`;
const Oic = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 11px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: ${({ theme, $primary }) =>
    $primary
      ? `linear-gradient(145deg, ${mrp(theme.mode).pu}, ${mrp(theme.mode).puD})`
      : mrp(theme.mode).surface2};
`;
const Ob = styled.div`
  flex: 1;
  min-width: 0;
`;
const OptT = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => mrp(theme.mode).t1};
`;
const OptD = styled.div`
  font-size: 10px;
  color: ${({ theme }) => mrp(theme.mode).t3};
  margin-top: 2px;
`;
const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
`;
const Pill = styled.span`
  font-size: 8.5px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 20px;
  white-space: nowrap;
  ${({ theme, $tone }) => {
    const c = mrp(theme.mode);
    const map = {
      p: [c.puBg, c.puL],
      g: [c.grBg, c.grL],
      y: [c.yeBg, c.yeL],
      b: [c.blBg, c.blL],
    };
    const [bg, fg] = map[$tone] || map.p;
    return `background:${bg};color:${fg};`;
  }}
`;
const Arr = styled.span`
  font-size: 15px;
  color: ${({ theme }) => mrp(theme.mode).t3};
  flex-shrink: 0;
`;
const NoticeInfo = styled.div`
  display: flex;
  gap: 8px;
  font-size: 10px;
  line-height: 1.5;
  padding: 10px 12px;
  border-radius: 11px;
  margin-top: 4px;
  background: ${({ theme }) => mrp(theme.mode).blBg};
  color: ${({ theme }) => mrp(theme.mode).blL};
  border: 0.5px solid ${({ theme }) => mrp(theme.mode).blBorder};

  b {
    font-weight: 700;
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

const SecondaryButton = styled.button`
  width: 100%;
  padding: 10px 0;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 13px;
  cursor: pointer;
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

const PhotoRow = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;

  &::-webkit-scrollbar {
    height: 4px;
  }
`;

const PhotoThumb = styled.div`
  width: 74px;
  height: 74px;
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
  flex: 0 0 auto;
  position: relative;
`;

const PhotoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const PhotoRemove = styled.button`
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: none;
  background: rgba(0, 0, 0, 0.7);
  color: #ffffff;
  cursor: pointer;
`;

const PhotoAdd = styled.button`
  width: 74px;
  height: 74px;
  border-radius: 8px;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  flex: 0 0 auto;
  cursor: pointer;
  display: grid;
  place-items: center;
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
  color: ${({ theme }) => theme.colors.textStrong};
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

const CommentStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const CommentItem = styled.div`
  padding: 12px 12px;
  border-radius: 8px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const CommentHeader = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  margin-bottom: 8px;
`;

const CommentBody = styled.div`
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textStrong};
  line-height: 1.6;
  white-space: pre-wrap;
`;

const FullPhotoList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const FullPhotoItem = styled.div`
  width: 100%;
  aspect-ratio: 4 / 5;
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
`;

const FullPhotoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
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

/* ====== 추가 모달 ====== */

const ModalDim = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.42)"};
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 9999;
`;

const ModalSheet = styled.div`
  width: 100%;
  max-width: 520px;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px 20px 0 0;
  padding: 14px 14px 16px;
  box-shadow: ${({ theme }) =>
    theme.mode === "dark"
      ? "0 -12px 30px rgba(0, 0, 0, 0.5)"
      : "0 -12px 30px rgba(15, 23, 42, 0.18)"};
`;

const ModalTopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const ModalTitle = styled.div`
  font-size: 16px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const ModalClose = styled.button`
  border: none;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "#f3f4f6"};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 12px;
  padding: 7px 10px;
  border-radius: 999px;
  cursor: pointer;
`;

const ModalBody = styled.div`
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ModalActions = styled.div`
  margin-top: 12px;
  display: flex;
  gap: 8px;
`;

const ModalBtn = styled.button`
  flex: 1;
  border: none;
  border-radius: 999px;
  padding: 13px 0;
  font-size: 14px;
  cursor: pointer;

  ${({ theme, $variant, disabled }) => {
    if (disabled) {
      const bg =
        theme.mode === "dark" ? theme.colors.surface : "#e5e7eb";
      return `
        background:${bg};
        color:${theme.colors.textWeak};
        cursor: default;
      `;
    }
    if ($variant === "primary") {
      return `
        background:${theme.colors.primary};
        color:#ffffff;
      `;
    }
    const bg =
      theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "#f3f4f6";
    return `
      background:${bg};
      color:${theme.colors.textStrong};
    `;
  }}
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

function pickNowHHMM() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// ✅ comment 문자열을 "기존/추가" 블록으로 분리 렌더
// - 과거 데이터에 남아있는 "· <clubId/uid>" 같은 토큰은 화면에서 제거/치환
function parseCommentBlocks(raw, { actorClubId = "", targetClubId = "", actorTeamName = "", targetTeamName = "" } = {}) {
  const text = String(raw || "").trim();
  if (!text) return [];

  const isLikelyId = (s) => {
    const v = String(s || "").trim();
    if (!v) return false;
    if (v.length < 12) return false;
    return /^[A-Za-z0-9_-]+$/.test(v);
  };

  const prettifyHeader = (h) => {
    const headerRaw = String(h || "").trim();
    if (!headerRaw) return "추가 기록";

    const parts = headerRaw
      .split("·")
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    const mapped = parts.map((p) => {
      if (actorClubId && p === actorClubId) return actorTeamName || "참가팀";
      if (targetClubId && p === targetClubId) return targetTeamName || "참가팀";
      return p;
    });

    if (mapped.length >= 2 && isLikelyId(mapped[mapped.length - 1])) {
      mapped.pop();
    }

    const cleaned = mapped.filter((p) => !isLikelyId(p));

    return cleaned.join(" · ") || "추가 기록";
  };

  const parts = text.split(/\n\n(?=\[추가 기록\])/g).filter(Boolean);

  return parts.map((p, idx) => {
    const s = String(p || "").trim();
    if (s.startsWith("[추가 기록]")) {
      const lines = s.split("\n");
      const headerLine = String(lines[0] || "").replace("[추가 기록]", "").trim();
      const header = prettifyHeader(headerLine);
      const body = lines.slice(1).join("\n").trim();
      return { key: `add-${idx}`, header: `추가 기록 · ${header}`, body: body || "" };
    }
    return { key: `base-${idx}`, header: "기존 코멘트", body: s };
  });
}

/* ==================== 페이지 ==================== */

export default function MatchRoomDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const { club } = useClub();
  const { firebaseUser, userDoc } = useAuth();
  const myUid = toStr(firebaseUser?.uid || userDoc?.uid || userDoc?.id);
  const { setHeaderSubtitle } = useUIContext() || {};

  const myClubId = toStr(club?.clubId || club?.id);
  const roomId = toStr(params?.roomId || params?.matchId);

  const authorDisplayName = toStr(club?.name) || "참가자";

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const [myLineupOpen, setMyLineupOpen] = useState(false);
  const [oppLineupOpen, setOppLineupOpen] = useState(false);

  // 매치 정보 · 진행 단계 카드 접기/펼치기 (시안 기준 기본 펼침)
  const [matchInfoOpen, setMatchInfoOpen] = useState(true);

  const [fieldAddress, setFieldAddress] = useState("");
  const [fieldLatLng, setFieldLatLng] = useState(null);
  const [venuePickerOpen, setVenuePickerOpen] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [venueImageUrl, setVenueImageUrl] = useState("");
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const markerRef = useRef(null);

  const [editMode, setEditMode] = useState(false);
  const initOnceRef = useRef(false);

  // 구장 정하기 방식 선택 게이트: "none"(아직 선택 전) | "direct"(직접 입력 · 현장 정산)
  const [venueMode, setVenueMode] = useState("none");

  // 매칭룸 탭은 URL로 분리: /match-roomdetail/:id (채팅) vs /:id/venue (구장 정하기 별도 페이지)
  const location = useLocation();
  const isVenue = location.pathname.endsWith("/venue");
  // 상대 팀장과의 DM 채팅방 id (getOrCreateDmRoom으로 확보)
  const [chatId, setChatId] = useState("");

  const [myScoreInput, setMyScoreInput] = useState("");
  const [oppScoreInput, setOppScoreInput] = useState("");
  const [resultComment, setResultComment] = useState("");
  const [resultFiles, setResultFiles] = useState([]);
  const [resultBusy, setResultBusy] = useState(false);

  const fileRef = useRef(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState("");
  const [addText, setAddText] = useState("");
  const [addFiles, setAddFiles] = useState([]);
  const addFileRef = useRef(null);
  const [addBusy, setAddBusy] = useState(false);

  const refresh = async () => {
    if (!roomId) return;
    const res = await loadMatchRoomDetail(roomId);
    setRoom(res?.room || null);
  };

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

  useEffect(() => {
    if (!room) return;
    if (initOnceRef.current) return;
    initOnceRef.current = true;

    const initialDate = room.scheduledAt ? String(room.scheduledAt).slice(0, 10) : "";
    const initialTime = room.scheduledAt ? new Date(room.scheduledAt).toTimeString().slice(0, 5) : "";

    setSelectedDate(initialDate);
    setSelectedTime(initialTime || pickNowHHMM());

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

    const st = toStr(room?.status);
    const proposer = toStr(room?.proposedByClubId);
    if (st === "accepted") setEditMode(true);
    else if (st === "proposed") setEditMode(!!myClubId && proposer === myClubId);
    else setEditMode(false);

    if (room.myScore != null) setMyScoreInput(String(room.myScore));
    if (room.oppScore != null) setOppScoreInput(String(room.oppScore));

    const savedComment = toStr(room?.result?.comment);
    if (savedComment) setResultComment(savedComment);
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
    } else {
      setHeaderSubtitle("");
    }
    return () => setHeaderSubtitle && setHeaderSubtitle("");
  }, [isVenue, room, myClubId, setHeaderSubtitle]);

  // 상대 팀장과의 DM 채팅방 확보 (매칭룸 채팅 탭에서 사용)
  useEffect(() => {
    if (!room || !myUid || !myClubId) return;
    let alive = true;
    (async () => {
      try {
        const actorId = toStr(room.actorClubId);
        const targetId = toStr(room.targetClubId);
        const oppClubId = myClubId === actorId ? targetId : actorId;
        if (!oppClubId) return;
        const oppClub = await getClubById(oppClubId);
        const oppOwnerUid = toStr(oppClub?.ownerUid);
        if (!oppOwnerUid || oppOwnerUid === myUid) return;
        const dm = await getOrCreateDmRoom({
          myUid,
          otherUid: oppOwnerUid,
          createdFrom: "matchRoom",
          createdFromRefId: toStr(roomId),
        });
        if (alive && dm) setChatId(toStr(dm));
      } catch (e) {}
    })();
    return () => {
      alive = false;
    };
  }, [room, myUid, myClubId, roomId]);

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
      setFieldLatLng({ lat, lng });
      if (!toStr(fieldAddress)) setFieldAddress(region);
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
    setMapPickerOpen(false);
  };

  const openAddressSearch = () => {
    const daum = window.daum;
    const kakao = window.kakao;

    if (!daum || !daum.Postcode) {
      window.alert("주소 검색 스크립트가 아직 로드되지 않았습니다.");
      return;
    }
    if (!kakao || !kakao.maps || !kakao.maps.services) {
      window.alert("지도 스크립트가 아직 로드되지 않았습니다.");
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
            window.alert("주소 좌표를 찾을 수 없습니다.");
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
        <Inner>매칭 정보를 불러오는 중입니다…</Inner>
      </PageWrap>
    );
  }

  if (!room) {
    return (
      <PageWrap>
        <Inner>매칭 정보를 찾을 수 없습니다.</Inner>
      </PageWrap>
    );
  }

  const status = toStr(room.status);

  const actorClubId = toStr(room.actorClubId);
  const targetClubId = toStr(room.targetClubId);

  const isActor = !!myClubId && !!actorClubId && myClubId === actorClubId;

  const myTeamView = isActor ? room.myTeam : room.oppTeam;
  const oppTeamView = isActor ? room.oppTeam : room.myTeam;

  const actorScoreSaved = room.myScore;
  const targetScoreSaved = room.oppScore;

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

  const isAdjusting = status === "accepted" || status === "proposed";
  // accepted 상태에서 아직 직접 입력을 고르기 전이면 "구장 정하기 방식 선택" 게이트 노출
  const showVenueGate = status === "accepted" && venueMode !== "direct";
  const proposerClubId = toStr(room.proposedByClubId);
  const iAmProposer = !!myClubId && !!proposerClubId && myClubId === proposerClubId;
  const canEdit = status === "accepted" ? true : status === "proposed" ? editMode : false;
  const canConfirm = status === "proposed" && !!myClubId && !iAmProposer;

  const isConfirmed = status === "confirmed";
  const isFinished = status === "finished";
  const isCancelled = status === "cancelled";

  // 진행단계 스텝퍼 (직접 입력 흐름: 조율 → 구장 → 합의 → 확정)
  const STEP_LABELS = ["조율", "구장", "결제", "확정"];
  const stepStates = (() => {
    if (status === "accepted") return ["done", "cur", "todo", "todo"];
    if (status === "proposed") return ["done", "done", "cur", "todo"];
    if (status === "confirmed") return ["done", "done", "done", "cur"];
    if (status === "finished") return ["done", "done", "done", "done"];
    if (status === "cancelled") return ["done", "todo", "todo", "todo"];
    return ["cur", "todo", "todo", "todo"];
  })();

  const oppName = toStr(oppTeamView?.name) || "상대팀";
  const chatSystemNotice =
    status === "accepted"
      ? `${oppName}와 매칭이 성사됐어요 · 일정을 조율해 보세요`
      : status === "proposed"
      ? "구장·일정이 제안됐어요 · 채팅으로 조율하세요"
      : status === "confirmed"
      ? "경기가 확정됐어요 🎉"
      : status === "finished"
      ? "경기가 종료됐어요 · 수고하셨습니다"
      : status === "cancelled"
      ? "이 매칭은 취소되었습니다"
      : "";

  const resultState = toStr(room.resultState);
  const resultSubmittedBy = toStr(room?.result?.submittedByClubId);
  const iSubmittedResult = !!myClubId && !!resultSubmittedBy && myClubId === resultSubmittedBy;

  const savedPhotoUrls = Array.isArray(room?.result?.photoUrls) ? room.result.photoUrls : [];
  const savedComment = toStr(room?.result?.comment);

  const commentBlocks = parseCommentBlocks(savedComment, {
    actorClubId: toStr(room?.actorClubId),
    targetClubId: toStr(room?.targetClubId),
    actorTeamName: toStr(room?.myTeam?.name),
    targetTeamName: toStr(room?.oppTeam?.name),
  });

  const canAcceptResult = isConfirmed && resultState === "waiting_accept" && !iSubmittedResult && !resultBusy;

  /* ✅ 경기 결과 입력 노출 타이밍: 경기 시작(확정 scheduledAt) + 1시간 후 */
  const scheduledAtMs = (() => {
    const t = room?.scheduledAt ? new Date(room.scheduledAt).getTime() : NaN;
    return Number.isFinite(t) ? t : NaN;
  })();

  const resultOpenAtMs = Number.isFinite(scheduledAtMs) ? scheduledAtMs + 60 * 60 * 1000 : NaN;
  const canOpenResultInput = !resultState && Number.isFinite(resultOpenAtMs) && Date.now() >= resultOpenAtMs;

  const resultOpenAtLabel = Number.isFinite(resultOpenAtMs)
    ? formatKoreanDateTime(new Date(resultOpenAtMs).toISOString())
    : "";

  const openAddComment = () => {
    if (!myClubId) {
      window.alert("팀 정보를 확인할 수 없습니다.");
      return;
    }
    setAddMode("comment");
    setAddText("");
    setAddFiles([]);
    setAddOpen(true);
  };

  const openAddPhotos = () => {
    if (!myClubId) {
      window.alert("팀 정보를 확인할 수 없습니다.");
      return;
    }
    setAddMode("photo");
    setAddText("");
    setAddFiles([]);
    setAddOpen(true);
  };

  const closeAdd = () => {
    if (addBusy) return;
    setAddOpen(false);
    setAddMode("");
    setAddText("");
    setAddFiles([]);
  };

  const onPickAddPhotos = () => {
    if (addBusy) return;
    addFileRef.current?.click();
  };

  const onAddFilesChanged = (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    if (!list.length) return;

    setAddFiles((prev) => {
      const next = [...(prev || []), ...list].slice(0, 6);
      return next;
    });
  };

  const removeAddFile = (idx) => {
    setAddFiles((prev) => (prev || []).filter((_, i) => i !== idx));
  };

  const saveAdd = async () => {
    if (!myClubId) return;
    if (!room?.id) return;

    setAddBusy(true);
    try {
      if (addMode === "comment") {
        const c = String(addText || "").trim();
        if (!c) {
          window.alert("코멘트를 입력해 주세요.");
          return;
        }
        await appendMatchResultComment({
          matchRequestId: room.id,
          comment: c,
          submittedByClubId: myClubId,
          authorDisplayName,
        });
        await refresh();
        closeAdd();
        return;
      }

      if (addMode === "photo") {
        if (!addFiles.length) {
          window.alert("사진을 선택해 주세요.");
          return;
        }
        await appendMatchResultPhotos({
          matchRequestId: room.id,
          files: addFiles,
          submittedByClubId: myClubId,
          authorDisplayName,
        });
        await refresh();
        closeAdd();
        return;
      }
    } catch (e) {
      window.alert(e?.message || "추가 저장에 실패했습니다.");
    } finally {
      setAddBusy(false);
    }
  };

  const handlePropose = async () => {
    if (!myClubId) {
      window.alert("팀 정보를 확인할 수 없습니다.");
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
        proposedByClubId: myClubId,
      });
      await refresh();
      setEditMode(false);
    } catch (e) {
      window.alert(e?.message || "일정 제안에 실패했습니다.");
    }
  };

  const handleConfirmSchedule = async () => {
    if (!myClubId) return;
    try {
      await confirmProposedSchedule({ matchRequestId: room.id, confirmedByClubId: myClubId });
      await refresh();
    } catch (e) {
      window.alert(e?.message || "일정 확정에 실패했습니다.");
    }
  };

  const handleCancelMatch = async () => {
    try {
      await cancelMatchRequest({ matchRequestId: room.id });
      await refresh();
      goBackOrHome(navigate);
    } catch (e) {
      window.alert(e?.message || "매칭 취소에 실패했습니다.");
    }
  };

  const onPickPhotos = () => {
    if (resultBusy) return;
    fileRef.current?.click();
  };

  const onFilesChanged = (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    if (!list.length) return;

    setResultFiles((prev) => {
      const next = [...(prev || []), ...list].slice(0, 6);
      return next;
    });
  };

  const removePickedFile = (idx) => {
    setResultFiles((prev) => (prev || []).filter((_, i) => i !== idx));
  };

  const handleSubmitResult = async () => {
    if (!myClubId) return;

    const myScore = toStr(myScoreInput);
    const oppScore = toStr(oppScoreInput);

    if (!myScore || !oppScore) {
      window.alert("점수를 입력해 주세요.");
      return;
    }

    const myN = Number(myScore);
    const oppN = Number(oppScore);

    if (!Number.isFinite(myN) || !Number.isFinite(oppN)) {
      window.alert("점수는 숫자만 입력해 주세요.");
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
        comment: resultComment,
        files: resultFiles,
        submittedByClubId: myClubId,
        authorDisplayName,
      });

      setResultFiles([]);
      await refresh();
      window.alert("결과를 제출했습니다. 상대팀 승인을 기다립니다.");
    } catch (e) {
      window.alert(e?.message || "결과 제출에 실패했습니다.");
    } finally {
      setResultBusy(false);
    }
  };

  const handleAcceptResult = async () => {
    if (!myClubId) return;
    setResultBusy(true);
    try {
      await acceptMatchResult({ matchRequestId: room.id, confirmedByClubId: myClubId });
      await refresh();
      window.alert("경기 결과가 확정되었습니다.");
      navigate("/match-roomlist");
    } catch (e) {
      window.alert(e?.message || "결과 인정에 실패했습니다.");
    } finally {
      setResultBusy(false);
    }
  };

  const handleDisputeResult = async () => {
    const ok = window.confirm("이의 제기할까요?");
    if (!ok) return;

    setResultBusy(true);
    try {
      await disputeMatchResult({ matchRequestId: room.id });
      await refresh();
    } catch (e) {
      window.alert(e?.message || "이의 제기에 실패했습니다.");
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
    const avatar = playerAvatars?.[p.userId] || p.photoUrl || images.logo;
    const posKo = POSITION_LABEL[p.mainPosition] || "포지션";

    const height = p.heightCm ? `${p.heightCm}cm` : null;
    const weight = p.weightKg ? `${p.weightKg}kg` : null;
    const bodyText = [height, weight].filter(Boolean).join(" / ");

    return (
      <PlayerRow key={p.userId}>
        <PlayerLeft onClick={() => goPlayerDetail(p)}>
          <PlayerAvatar src={avatar} alt={p.nickname} />
          <PlayerText>
            <PlayerTopRow>
              <PositionChip label={formatPositionKo(posKo)} size="sm" showAbbr onlyAbbr={false} />
              <PlayerName>{p.nickname}</PlayerName>
            </PlayerTopRow>
          </PlayerText>
        </PlayerLeft>
        <PlayerBodyMeta>{bodyText || fallbackText}</PlayerBodyMeta>
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

  const handleDayClick = (day) => {
    if (!day) return;
    const dateStr = `${calYear}-${pad2(calMonth + 1)}-${pad2(day)}`;
    setSelectedDate(dateStr);
  };

  const goPrevMonth = () => {
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

  return (
    <>
      <PageWrap $dark={!isVenue}>
        <DarkHeader>
          {isVenue ? null : (
            <>
              <MatchInfoBar
                type="button"
                onClick={() => setMatchInfoOpen((o) => !o)}
                aria-expanded={matchInfoOpen}
              >
                <MatchInfoBarTitle>📋 매치 정보 · 진행 단계</MatchInfoBarTitle>
                <MatchInfoToggle>{matchInfoOpen ? "접기 ▲" : "펼치기 ▼"}</MatchInfoToggle>
              </MatchInfoBar>

              {matchInfoOpen && (
                <VsCard>
                  <VsRow>
                    <VsTeam>
                      <Crest $home>
                        {myTeamView?.logoUrl ? (
                          <CrestImg src={myTeamView.logoUrl} alt={myTeamView?.name} />
                        ) : (
                          toStr(myTeamView?.name)[0] || "R"
                        )}
                      </Crest>
                      <VsNm>{toStr(myTeamView?.name) || "내 팀"}</VsNm>
                    </VsTeam>

                    <VsMid>
                      <VsX>VS</VsX>
                    </VsMid>

                    <VsTeam>
                      <Crest>
                        {oppTeamView?.logoUrl ? (
                          <CrestImg src={oppTeamView.logoUrl} alt={oppTeamView?.name} />
                        ) : (
                          oppName[0] || "F"
                        )}
                      </Crest>
                      <VsNm>{oppName}</VsNm>
                    </VsTeam>
                  </VsRow>

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
                </VsCard>
              )}

              <QuickTabs>
                <QuickTab type="button" $on onClick={() => navigate(`/match-roomdetail/${roomId}`)}>
                  💬 채팅
                </QuickTab>
                <QuickTab
                  type="button"
                  onClick={() => navigate(`/match-roomdetail/${roomId}/venue`)}
                >
                  🏟 구장 정하기
                </QuickTab>
              </QuickTabs>
            </>
          )}
        </DarkHeader>

        {!isVenue ? (
          <MatchRoomChat
            chatId={chatId}
            myUid={myUid}
            opponentName={oppName}
            systemNotice={chatSystemNotice}
          />
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
                </LineupBox>
              )}
            </TeamBlock>
          </MatchCard>
          )}

          {isAdjusting && (
            <>
              {showVenueGate && (
                <>
                  <AskLabel>어떻게 구장을 정할까요?</AskLabel>

                  <OptCard type="button" disabled>
                    <Oic>🏟️</Oic>
                    <Ob>
                      <OptT>제휴구장 예약</OptT>
                      <OptD>앱에서 결제 · 자동 확정</OptD>
                      <Chips>
                        <Pill $tone="p">준비중</Pill>
                        <Pill $tone="g">에스크로 안전결제</Pill>
                      </Chips>
                    </Ob>
                    <Arr>›</Arr>
                  </OptCard>

                  <OptCard
                    type="button"
                    $primary
                    onClick={() => setVenueMode("direct")}
                  >
                    <Oic $primary>📍</Oic>
                    <Ob>
                      <OptT>직접 입력</OptT>
                      <OptD>현장 정산 · 결제 없음</OptD>
                      <Chips>
                        <Pill $tone="y">팀끼리 직접 합의</Pill>
                        <Pill $tone="b">이 흐름 →</Pill>
                      </Chips>
                    </Ob>
                    <Arr>›</Arr>
                  </OptCard>

                  <NoticeInfo>
                    <span>ⓘ</span>
                    <div>
                      직접 입력은 앱 결제 없이 <b>현장에서 정산</b>해요. 수락하면 바로
                      경기가 확정됩니다.
                    </div>
                  </NoticeInfo>
                </>
              )}

              {!showVenueGate && (
                <>
              <BareSection>
                {venueImageUrl ? (
                  <VenueImageBox>
                    <VenueImage src={venueImageUrl} alt="구장 이미지" />
                  </VenueImageBox>
                ) : (
                  <MapBox
                    ref={mapRef}
                    $tappable={canEdit}
                    onClick={canEdit ? () => setMapPickerOpen(true) : undefined}
                  />
                )}

                {canEdit && (
                  <PartnerVenueRow>
                    <PartnerVenueButton
                      type="button"
                      onClick={() => setVenuePickerOpen(true)}
                    >
                      🏟️ 할래말래 제휴구장에서 선택
                    </PartnerVenueButton>
                  </PartnerVenueRow>
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
              </BareSection>

              {canEdit ? (
                <SectionCard>
                  <SectionTitleRow>
                    <SectionTitleLeft>
                      <SectionIcon>📅</SectionIcon>
                      <span>날짜 선택</span>
                    </SectionTitleLeft>
                    <SectionTitleActions />
                  </SectionTitleRow>

                  <DateTimeRow>
                    <CalendarWrap>
                      <CalendarHeader>
                        <MonthNavButton type="button" onClick={goPrevMonth}>
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

                          return (
                            <DayCell
                              key={idx}
                              type="button"
                              onClick={() => handleDayClick(day)}
                              $isToday={isToday}
                              $isSelected={isSelected}
                            >
                              {day}
                            </DayCell>
                          );
                        })}
                      </DaysGrid>
                    </CalendarWrap>

                    <TimeInput value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} />
                  </DateTimeRow>

                  <DateValue>{combinedLabel}</DateValue>
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
                    경기 시작 후 <strong>1시간</strong>이 지나면 경기 결과 입력 화면이 노출됩니다.
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

                    <ResultStatusText>사진(선택)과 코멘트를 남길 수 있어요.</ResultStatusText>

                    <PhotoRow>
                      {resultFiles.map((f, idx) => {
                        const src = URL.createObjectURL(f);
                        return (
                          <PhotoThumb key={`${f.name}-${idx}`}>
                            <PhotoImg src={src} alt="picked" />
                            <PhotoRemove type="button" onClick={() => removePickedFile(idx)}>
                              ×
                            </PhotoRemove>
                          </PhotoThumb>
                        );
                      })}
                      {resultFiles.length < 6 && (
                        <PhotoAdd type="button" onClick={() => fileRef.current?.click()}>
                          ＋
                        </PhotoAdd>
                      )}
                    </PhotoRow>

                    <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={onFilesChanged} />

                    <TextArea
                      value={resultComment}
                      onChange={(e) => setResultComment(e.target.value)}
                      placeholder="코멘트 (예: 매너 좋았습니다. 다음에 또 경기해요!)"
                    />

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

                    {savedComment ? (
                      <CommentStack>
                        {commentBlocks.map((b) => (
                          <CommentItem key={b.key}>
                            <CommentHeader>{b.header}</CommentHeader>
                            <CommentBody>{b.body}</CommentBody>
                          </CommentItem>
                        ))}
                      </CommentStack>
                    ) : null}

                    {savedPhotoUrls.length > 0 ? (
                      <FullPhotoList>
                        {savedPhotoUrls.map((url, idx) => (
                          <FullPhotoItem key={`${url}-${idx}`}>
                            <FullPhotoImg src={url} alt="result" />
                          </FullPhotoItem>
                        ))}
                      </FullPhotoList>
                    ) : null}

                    {!iSubmittedResult ? (
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

              <SectionCard>
                <SectionTitleRow>
                  <SectionTitleLeft>
                    <SectionIcon>📷</SectionIcon>
                    <span>경기 사진</span>
                  </SectionTitleLeft>
                  <SectionTitleActions>
                    <AddMiniButton
                      type="button"
                      onClick={() => {
                        setAddMode("photo");
                        setAddText("");
                        setAddFiles([]);
                        setAddOpen(true);
                      }}
                    >
                      사진 추가하기
                    </AddMiniButton>
                  </SectionTitleActions>
                </SectionTitleRow>

                {savedPhotoUrls.length > 0 ? (
                  <FullPhotoList>
                    {savedPhotoUrls.map((url, idx) => (
                      <FullPhotoItem key={`${url}-${idx}`}>
                        <FullPhotoImg src={url} alt="result" />
                      </FullPhotoItem>
                    ))}
                  </FullPhotoList>
                ) : (
                  <ResultStatusText>아직 등록된 사진이 없습니다.</ResultStatusText>
                )}
              </SectionCard>

              <SectionCard>
                <SectionTitleRow>
                  <SectionTitleLeft>
                    <SectionIcon>💬</SectionIcon>
                    <span>코멘트</span>
                  </SectionTitleLeft>
                  <SectionTitleActions>
                    <AddMiniButton
                      type="button"
                      onClick={() => {
                        setAddMode("comment");
                        setAddText("");
                        setAddFiles([]);
                        setAddOpen(true);
                      }}
                    >
                      글 추가하기
                    </AddMiniButton>
                  </SectionTitleActions>
                </SectionTitleRow>

                {savedComment ? (
                  <CommentStack>
                    {commentBlocks.map((b) => (
                      <CommentItem key={b.key}>
                        <CommentHeader>{b.header}</CommentHeader>
                        <CommentBody>{b.body}</CommentBody>
                      </CommentItem>
                    ))}
                  </CommentStack>
                ) : (
                  <ResultStatusText>아직 등록된 코멘트가 없습니다.</ResultStatusText>
                )}
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
            <ActionsWrap>
              <PrimaryButton type="button" onClick={handlePropose} disabled={!selectedDate || !selectedTime || !toStr(fieldAddress) || !fieldLatLng}>
                매칭 일정·장소 제안
              </PrimaryButton>
              <MutedButton type="button" onClick={() => setVenueMode("none")}>
                구장 방식 다시 선택
              </MutedButton>
              <SecondaryButton type="button" onClick={handleCancelMatch}>
                매칭 취소
              </SecondaryButton>
            </ActionsWrap>
          </>
        )}

        {status === "proposed" && (
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
                  <SecondaryButton type="button" onClick={handleCancelMatch}>
                    매칭 취소
                  </SecondaryButton>
                </ActionsWrap>
              </>
            ) : (
              <>
                <NoticeText>상대팀이 일정/장소를 제안했어요. 확정하거나 수정 제안할 수 있어요.</NoticeText>
                <ActionsWrap>
                  <PrimaryButton type="button" onClick={handleConfirmSchedule} disabled={!canConfirm}>
                    일정 확정
                  </PrimaryButton>
                  <MutedButton type="button" onClick={() => setEditMode(true)}>
                    수정 제안
                  </MutedButton>
                  <SecondaryButton type="button" onClick={handleCancelMatch}>
                    매칭 취소
                  </SecondaryButton>
                </ActionsWrap>
              </>
            )}
          </>
        )}
          </>
        )}
      </PageWrap>

      {addOpen && (
        <ModalDim onClick={closeAdd}>
          <ModalSheet onClick={(e) => e.stopPropagation()}>
            <ModalTopRow>
              <ModalTitle>{addMode === "photo" ? "사진 추가하기" : "글 추가하기"}</ModalTitle>
              <ModalClose type="button" onClick={closeAdd}>
                닫기
              </ModalClose>
            </ModalTopRow>

            <ModalBody>
              {addMode === "photo" ? (
                <>
                  <PhotoRow>
                    {addFiles.map((f, idx) => {
                      const src = URL.createObjectURL(f);
                      return (
                        <PhotoThumb key={`${f.name}-${idx}`}>
                          <PhotoImg src={src} alt="picked" />
                          <PhotoRemove type="button" onClick={() => removeAddFile(idx)}>
                            ×
                          </PhotoRemove>
                        </PhotoThumb>
                      );
                    })}
                    {addFiles.length < 6 && (
                      <PhotoAdd type="button" onClick={onPickAddPhotos}>
                        ＋
                      </PhotoAdd>
                    )}
                  </PhotoRow>

                  <input ref={addFileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={onAddFilesChanged} />

                  <ResultStatusText>최대 6장까지 추가할 수 있어요.</ResultStatusText>
                </>
              ) : (
                <TextArea value={addText} onChange={(e) => setAddText(e.target.value)} placeholder="경기 코멘트를 추가해 주세요." />
              )}
            </ModalBody>

            <ModalActions>
              <ModalBtn type="button" onClick={closeAdd} disabled={addBusy}>
                취소
              </ModalBtn>
              <ModalBtn
                type="button"
                $variant="primary"
                onClick={saveAdd}
                disabled={addBusy || (addMode === "comment" ? !String(addText || "").trim() : addMode === "photo" ? !addFiles.length : true)}
              >
                {addBusy ? "저장중..." : "추가 저장"}
              </ModalBtn>
            </ModalActions>
          </ModalSheet>
        </ModalDim>
      )}

      <VenuePickerSheet
        open={venuePickerOpen}
        onClose={() => setVenuePickerOpen(false)}
        onPick={handlePickVenue}
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
        onClose={() => setMapPickerOpen(false)}
        onConfirm={handleMapPickerConfirm}
      />
    </>
  );
}
