/* eslint-disable */
// src/pages/team/TeamProfilePage.jsx
// ✅ "매칭 신청" = 내 팀 라인업 선택 → match_requests 생성 → notifications(팀단위) 생성
// ✅ 페이지에서 DB 직접 접근 금지: matchingService만 호출

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import { FiStar } from "react-icons/fi";
import { TbBallBasketball } from "react-icons/tb";

import TeamStatsSection from "../../components/team/TeamStatsSection";
import TeamMembersSection from "../../components/team/TeamMembersSection";
import { getTeamProfile } from "../../services/teamService";
import { getTeamRankMap } from "../../services/teamRankingService";
import { images } from "../../utils/imageAssets";
import TeamAvatarPlaceholder from "../../components/common/TeamAvatarPlaceholder";
import { WinChip, DrawChip, LoseChip } from "../../components/common/ResultChip";
import Spinner from "../../components/common/Spinner";

import { useAuth } from "../../hooks/useAuth";
import { setFavoriteTeam } from "../../services/favoriteService";
import { createMatchRequest } from "../../services/matchingService";

import { useClub } from "../../hooks/useClub";
import { MIN_TEAM_MEMBERS } from "../../utils/constants";

import TeamMatchHistorySection from "../../components/team/TeamMatchHistorySection";
import { loadMatchRoomListPageData } from "../../services/matchRoomService";
import { createTeamReport } from "../../services/teamReportService";
import BlockedOverlay from "../../components/common/BlockedOverlay";

/* =============== 상수/헬퍼 =============== */

const SAMPLE_TEAM_MEDIA = [];

const getMediaHref = (m) => {
  const url = String(m?.url || "").trim();
  if (url) return url;

  const legacyYoutube = String(m?.youtubeUrl || "").trim();
  if (legacyYoutube) return legacyYoutube;

  return "";
};

const openExternal = (href) => {
  const url = String(href || "").trim();
  if (!url) return false;

  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (w) return true;

  try {
    window.location.href = url;
    return true;
  } catch (e) {
    return false;
  }
};

const formatUpdateDate = (value) => {
  if (!value) return "";
  let date;

  if (value.toDate && typeof value.toDate === "function") date = value.toDate();
  else if (typeof value === "number") date = new Date(value);
  else if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) date = parsed;
  } else if (value instanceof Date) date = value;

  if (!date || isNaN(date.getTime())) return "";
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd} 업데이트`;
};

/**
 * ✅ 최근 전적 배열 변환
 * - Firestore stats.recentResults: "최신이 index 0(맨 앞)" (matchRoomService.computeNextStats 기준)
 * - UI: "최신이 제일 앞"으로 표시 → 순서 그대로 앞에서 count개
 */
const buildRecentResults = (stats, count = 5) => {
  const s = stats || {};

  const raw =
    (Array.isArray(s?.recentResults) && s.recentResults) ||
    (Array.isArray(s?.recentForms) && s.recentForms) ||
    (Array.isArray(s?.recent) && s.recent) ||
    [];

  const normalizeOne = (x) => {
    if (x && typeof x === "object") {
      return normalizeOne(x.result || x.value || x.r || "");
    }

    const v = String(x || "").trim();

    if (v === "W" || v.toLowerCase() === "w" || v.toLowerCase() === "win") return "W";
    if (v === "L" || v.toLowerCase() === "l" || v.toLowerCase() === "lose") return "L";
    if (v === "D" || v.toLowerCase() === "d" || v.toLowerCase() === "draw") return "D";

    if (v.includes("승")) return "W";
    if (v.includes("패")) return "L";
    if (v.includes("무")) return "D";

    const low = v.toLowerCase();
    if (low.includes("win")) return "W";
    if (low.includes("lose")) return "L";
    if (low.includes("draw")) return "D";

    return null;
  };

  const norm = raw.map(normalizeOne).filter(Boolean);

  // 실제 경기 결과만 사용. 기록 없으면 빈 배열(미표시) — 승률로 가짜(패패패) 생성 안 함
  return norm.length > 0 ? norm.slice(0, count) : [];
};

/* =============== 레이아웃/스타일 =============== */

const Page = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg};
  display: flex;
  flex-direction: column;
`;

const ScrollArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding-bottom: 110px;
`;

const HeroWrap = styled.div`
  position: relative;
  width: 100%;
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.textStrong};
  overflow: hidden;
`;

const HeroInner = styled.div`
  display: flex;
  align-items: center;
  padding: 20px 16px 10px;
  gap: 12px;
`;

const HeroTextCol = styled.div`
  flex: 1.4;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const HeroTopBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const HeroLogoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

/* 1~3위: 팀 로고 위에 겹쳐 배치되는 로고 */
const HeroLogoBox = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const HeroCrown = styled.img`
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  width: 32px;
  height: 32px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.3));
`;

const HeroLogoCircle = styled.div`
  width: 84px;
  height: 84px;
  border-radius: 20px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f4f4ff"};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const HeroLogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

/* 로고 미등록 시 기본 그룹 placeholder — 컨테이너에 맞게 채움 */
const HeroLogoPlaceholder = styled(TeamAvatarPlaceholder)`
  width: 100% !important;
  height: 100% !important;
  border-radius: 0;
`;

const HeroTitleBlock = styled.div`
  min-width: 0;
`;

const HeroTitle = styled.h1`
  margin: 0;
  font-size: 23px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const HeroMeta = styled.div`
  margin-top: 2px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const HeroChipRow = styled.div`
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  overflow-x: visible;
  padding-bottom: 0;
`;

const HeroChip = styled.span`
  font-size: 12px;
  padding: 4px 0;
  background: transparent;
  color: ${({ theme }) => theme.colors.textStrong};
  font-weight: 600;
  white-space: nowrap;
`;

const HeroIllustWrap = styled.div`
  flex: 0.7;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-end;
  height: 100%;
  gap: 8px;
`;

const HeroIllustImg = styled.img`
  width: 150px;
  max-width: 70%;
  height: auto;
  object-fit: contain;
  transform: translateY(4px);
`;

const FavoriteButton = styled.button`
  border: none;
  border-radius: 999px;
  padding: 7px 6px;
  font-size: 12px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(245,158,11,0.22)" : "#fef3c7"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#fbbf24" : "#92400e")};
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  box-shadow: ${({ theme }) => theme.shadows.card};

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const ContentWrap = styled.div`
  padding: 16px 16px 0;
`;

const Section = styled.section`
  margin-top: 12px;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 15px 17px 17px;
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const SectionHeaderRow = styled.div`
  margin-bottom: 9px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SectionHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SectionIconCircle = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 999px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SectionIconImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

const SectionTitleText = styled.h2`
  margin: 0;
  font-size: 16px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const SectionMeta = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const AboutText = styled.p`
  margin: 4px 0 0;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textNormal};
  line-height: 1.5;
`;

const AboutMetaList = styled.div`
  margin-top: 9px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const AboutMetaRow = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const RecentResultsRow = styled.div`
  margin-top: 11px;
  padding-top: 9px;
  border-top: 1px dashed ${({ theme }) => theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const RecentResultsLabel = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const RecentDots = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const RepValue = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const RepStars = styled.span`
  font-size: 14px;
  letter-spacing: 1px;
  color: ${({ theme }) => theme.colors.primary};
`;

const RepNum = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const RepCount = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const MediaImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const MediaPlay = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.08));
`;

const PlayCircle = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  display: grid;
  place-items: center;
  font-size: 16px;
`;

/* 3열 그리드(최대 3x3) */
const MediaGrid = styled.div`
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
`;

const MediaCell = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
  cursor: pointer;
`;

/* 전체보기 — 전체화면 뷰어 (한 장씩 좌우 스와이프) */
const Viewer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #000;
  display: flex;
  flex-direction: column;
`;

const ViewerTop = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.55), transparent);
`;

const ViewerClose = styled.button`
  border: none;
  background: none;
  color: #fff;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
`;

const ViewerTrack = styled.div`
  flex: 1;
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;

  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const ViewerSlide = styled.div`
  flex: 0 0 100%;
  scroll-snap-align: center;
  display: grid;
  place-items: center;
  position: relative;
  padding: 0 8px;
`;

const ViewerImg = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
`;

const ViewerPlay = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  cursor: pointer;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.45)"};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
`;

const LineupModalCard = styled.div`
  width: 94%;
  max-width: 420px;
  max-height: 85vh;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 16px 16px 18px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
`;

const LineupModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const LineupModalTitle = styled.div`
  font-size: 18px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const LineupModalClose = styled.button`
  border: none;
  background: none;
  font-size: 20px;
  cursor: pointer;
`;

const LineupModalBody = styled.div`
  margin-top: 10px;
  flex: 1;
  overflow-y: auto;
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 4px;
  }
`;

const LineupModalMeta = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const SelectCard = styled(LineupModalCard)`
  max-height: 70vh;
`;

const SelectBody = styled(LineupModalBody)``;

const SelectList = styled.div`
  margin-top: 10px;
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

const SelectMeta = styled.div`
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

const BottomBar = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 11px 16px 17px;
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? theme.colors.card
      : "linear-gradient(to top, #ffffff, rgba(249, 250, 251, 0.96))"};
  box-shadow: ${({ theme }) => theme.shadows.card};
  z-index: 10;
`;

const BottomRow = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
`;

const CTAButton = styled.button`
  width: 100%;
  border: none;
  border-radius: 999px;
  height: 52px;
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  background: ${({ $primary, theme }) =>
    $primary
      ? theme.colors.primary
      : theme.mode === "dark"
      ? theme.colors.surface
      : "#f3f4f6"};
  color: ${({ $primary, theme }) =>
    $primary ? "#f9fafa" : theme.colors.textStrong};
`;

const MatchNotice = styled.div`
  margin-bottom: 9px;
  padding: 9px 12px;
  border-radius: 10px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(245,158,11,0.16)" : "#fff7ed"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#fbbf24" : "#9a3412")};
  font-size: 12.5px;
  line-height: 1.5;
  text-align: center;
`;

const ReportLinkRow = styled.div`
  margin-top: 24px;
  padding: 0 4px 8px;
  display: flex;
  justify-content: center;
`;

const ReportLink = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 12px;
  text-decoration: underline;
  cursor: pointer;
  padding: 8px 12px;

  &:hover {
    color: ${({ theme }) =>
      theme.mode === "dark" ? "#fca5a5" : theme.colors.danger};
  }
`;

const ReportOverlayWrap = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1300;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.45)"};
  display: grid;
  place-items: center;
  padding: 16px;
`;

const ReportModal = styled.div`
  width: min(440px, 92vw);
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  border-radius: 12px;
  padding: 18px 18px 16px;
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const ReportTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  margin-bottom: 4px;
`;

const ReportSub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  margin-bottom: 12px;
  line-height: 1.5;
  white-space: pre-line;
`;

const ReportTextarea = styled.textarea`
  width: 100%;
  min-height: 110px;
  padding: 10px 12px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  color: ${({ theme }) => theme.colors.textStrong};
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const ReportActions = styled.div`
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const ReportBtn = styled.button`
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ $danger, theme }) =>
    $danger
      ? theme.mode === "dark"
        ? "rgba(248,113,113,0.18)"
        : "#fef2f2"
      : theme.colors.card};
  color: ${({ $danger, theme }) =>
    $danger
      ? theme.mode === "dark"
        ? "#fca5a5"
        : "#b91c1c"
      : theme.colors.textStrong};
  ${({ $danger, theme }) =>
    $danger
      ? `border-color: ${
          theme.mode === "dark" ? "rgba(248,113,113,0.45)" : "#fecaca"
        };`
      : ""}

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

/* =============== 페이지 컴포넌트 =============== */


const ACTIVITY_DAYS_LABEL = {
  WEEKDAY: "평일 위주",
  WEEKEND: "주말 위주",
  ANY: "상관없음",
};

const ACTIVITY_TIME_LABEL = {
  MORNING: "오전 시간대",
  AFTERNOON: "오후 시간대",
  EVENING: "저녁 시간대",
  NIGHT: "야간 시간대",
  ANY: "상관없음",
};

const resolveActivityLabel = (activity) => {
  const a = activity || {};
  const daysKey = String(a.days || "").trim();
  const timeKey = String(a.time || "").trim();

  const days = ACTIVITY_DAYS_LABEL[daysKey] || "";
  const time = ACTIVITY_TIME_LABEL[timeKey] || "";

  return { days, time };
};



export default function TeamProfilePage({ teamId: propTeamId, embed = false } = {}) {
  const nav = useNavigate();
  const params = useParams();
  const teamId = propTeamId || params.teamId;

  const { firebaseUser, userDoc, refreshUser } = useAuth();
  const myUid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";

  // ✅ 우리팀 clubId는 userDoc.myClubId 하나만 SSOT로 사용 (없으면 온보딩/가드)
  const { club, members: myMembers, loading: myClubLoading } = useClub();
  const myClubId = String(club?.clubId || club?.id || "").trim();
  const myMemberCount = Array.isArray(myMembers) ? myMembers.length : 0;

  const [myTeamLoading, setMyTeamLoading] = useState(false);
  const [myTeam, setMyTeam] = useState(null);
  const [myTeamError, setMyTeamError] = useState("");

  // ✅ 매칭 신청: 사이즈만 선택 (라인업은 수락 후 룸에서 각 팀이 확정)
  const [selectedMatchSize, setSelectedMatchSize] = useState(""); // "3v3" | "4v4" | "5v5"

  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState(null);
  const [error, setError] = useState("");
  const [teamRank, setTeamRank] = useState(null);

  const [showLineupSelectModal, setShowLineupSelectModal] = useState(false);

  const [fav, setFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);


  const [pastMatches, setPastMatches] = useState([]);
  const [pastMatchesLoading, setPastMatchesLoading] = useState(false);

  // 팀 사진/영상 전체보기 모달
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  // 팀 신고 모달
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  const openReport = () => {
    if (!myUid) {
      alert("로그인이 필요합니다.");
      return;
    }
    setReportReason("");
    setReportOpen(true);
  };

  const closeReport = () => {
    if (reportBusy) return;
    setReportOpen(false);
    setReportReason("");
  };

  const handleSubmitReport = async () => {
    const reason = String(reportReason || "").trim();
    if (!reason) {
      alert("신고 사유를 입력해주세요.");
      return;
    }
    if (!team?.clubId && !team?.id) return;
    if (!myUid) return;
    setReportBusy(true);
    try {
      await createTeamReport({
        clubId: String(team?.clubId || team?.id || ""),
        clubName: String(team?.name || ""),
        reporterUid: String(myUid),
        reporterNickname: String(userDoc?.nickname || userDoc?.name || ""),
        reason,
      });
      setReportOpen(false);
      setReportReason("");
      alert("신고가 접수되었습니다. 검토 후 조치합니다.");
    } catch (e) {
      console.error("[TeamProfilePage] report failed", e);
      alert(e?.message || "신고 접수에 실패했습니다.");
    } finally {
      setReportBusy(false);
    }
  };

useEffect(() => {
  let cancelled = false;

  const run = async () => {
    const clubId = String(team?.clubId || team?.id || "").trim();
    if (!clubId) return;

    try {
      setPastMatchesLoading(true);

      const data = await loadMatchRoomListPageData(clubId);
      if (cancelled) return;

      const rooms = Array.isArray(data?.rooms) ? data.rooms : [];
      

      const past = rooms.filter((r) => r?.status === "finished");

      setPastMatches(past);
    } catch (e) {
      console.warn("[TeamProfile] load past matches failed:", e?.message || e);
      if (!cancelled) setPastMatches([]);
    } finally {
      if (!cancelled) setPastMatchesLoading(false);
    }
  };

  run();
  return () => {
    cancelled = true;
  };
}, [team?.clubId, team?.id]);


  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        const data = await getTeamProfile(teamId);
        if (cancelled) return;

        if (!data) setError("팀 정보를 불러올 수 없습니다.");
        else setTeam(data);

        console.log("[TeamProfile] activity:", data?.activity, data);

      } catch (err) {
        console.error("[TeamProfile] load error", err);
        if (!cancelled) setError("잠시 후 다시 시도해 주세요.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  // ✅ 팀 전역 랭킹(1~3위 왕관 + 순위 표시용)
  useEffect(() => {
    let alive = true;
    const cid = String(teamId || team?.clubId || team?.id || "").trim();
    if (!cid) return;
    getTeamRankMap()
      .then((map) => {
        if (alive) setTeamRank(map.get(cid) || null);
      })
      .catch((e) => console.warn("[TeamProfile] rank load failed:", e?.message || e));
    return () => {
      alive = false;
    };
  }, [teamId, team?.clubId, team?.id]);

  const isMyTeam = useMemo(() => {
    if (!team || !myUid) return false;
    if (team.ownerUid && String(team.ownerUid) === String(myUid)) return true;

    const members = Array.isArray(team.members) ? team.members : [];
    return members.some((m) => String(m.userId || m.id) === String(myUid));
  }, [team, myUid]);

  useEffect(() => {
    const ids = Array.isArray(userDoc?.favoriteTeamIds) ? userDoc.favoriteTeamIds : [];
    const on = ids.includes(String(teamId));
    setFav(!!on);
  }, [userDoc?.favoriteTeamIds, teamId]);

  const heroIllust = images.teamHeroBasket || images.TeamProfilePage || images.teamActionManage;

  const tags = Array.isArray(team?.tags) && team.tags.length > 0 ? team.tags : [];

  const membersCount =
    Array.isArray(team?.members) && team.members.length > 0 ? `${team.members.length}명` : "";

  // ✅ 매칭 최소 인원(팀장 포함 3명) 가드
  const targetMemberCount = Array.isArray(team?.members) ? team.members.length : 0;
  const targetTeamTooFew = !!team && targetMemberCount < MIN_TEAM_MEMBERS;
  const myTeamTooFew = !myClubLoading && !!myClubId && myMemberCount < MIN_TEAM_MEMBERS;

  const introUpdated = formatUpdateDate(team?.updatedAt || team?.createdAt);
  const statsUpdated = formatUpdateDate(team?.stats?.updatedAt || team?.updatedAt || team?.createdAt);

  const recentResults = buildRecentResults(team?.stats);

  // 상대 팀들이 매긴 별점 평판 (경기 결과 확정 시 집계됨)
  const repCount = Number(team?.reputation?.count) || 0;
  const repAvg = repCount > 0 ? Number(team?.reputation?.avg) || 0 : 0;
  const repRounded = Math.round(repAvg);
  const repStars = "★".repeat(repRounded) + "☆".repeat(Math.max(0, 5 - repRounded));

  const activityLabel = resolveActivityLabel(team?.activity);

  const mediaList = Array.isArray(team?.media) && team.media.length > 0 ? team.media : SAMPLE_TEAM_MEDIA;

  const onFavoriteTeam = async () => {
    if (!myUid) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!teamId) return;
    if (isMyTeam) return;

    const next = !fav;
    setFav(next);

    try {
      setFavBusy(true);
      await setFavoriteTeam({ uid: myUid, clubId: String(teamId), isFavorite: next });
      refreshUser && (await refreshUser());
    } catch (e) {
      console.warn("[TeamProfile] setFavoriteTeam failed:", e?.message || e);
      setFav(!next);
      alert("즐겨찾기 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setFavBusy(false);
    }
  };

  const onMatchRequestClick = async () => {
    if (!team) return;

    if (!myUid) {
      alert("로그인이 필요합니다.");
      return;
    }

    if (!myClubId) {
      alert("내 팀 정보를 확인할 수 없습니다. 팀 생성/가입 후 이용해 주세요.");
      return;
    }

    const opponentClubId = String(team?.clubId || team?.id || "").trim();
    if (!opponentClubId) {
      alert("상대 팀 정보를 확인할 수 없습니다.");
      return;
    }

    if (opponentClubId === myClubId) {
      alert("내 팀에는 매칭 신청을 할 수 없습니다.");
      return;
    }

    // ✅ 상대 팀 최소 인원 체크 (팀장 포함 3명)
    if (targetMemberCount < MIN_TEAM_MEMBERS) {
      alert(`상대 팀이 아직 팀원 ${MIN_TEAM_MEMBERS}명을 채우지 못해 매칭을 받을 수 없어요.`);
      return;
    }

    try {
      setMyTeamError("");
      setMyTeamLoading(true);

      const myData = await getTeamProfile(myClubId);
      if (!myData) {
        setMyTeamError("내 팀 정보를 불러올 수 없습니다.");
        alert("내 팀 정보를 불러올 수 없습니다.");
        return;
      }

      // ✅ 내 팀 최소 인원 체크 (팀장 포함 3명)
      if ((Array.isArray(myData.members) ? myData.members.length : 0) < MIN_TEAM_MEMBERS) {
        alert(`우리 팀원이 ${MIN_TEAM_MEMBERS}명 이상일 때 매칭을 신청할 수 있어요.`);
        return;
      }

      // 라인업은 수락 후 룸에서 확정 → 요청 시엔 사이즈만 고름
      setMyTeam(myData);
      setSelectedMatchSize("");
      setShowLineupSelectModal(true);
    } catch (e) {
      console.warn("[TeamProfile] load myTeam failed:", e?.message || e);
      setMyTeamError("내 팀 정보를 불러올 수 없습니다.");
      alert("내 팀 정보를 불러올 수 없습니다.");
    } finally {
      setMyTeamLoading(false);
    }
  };

  const onPlayerClick = (member) => {
    if (!member || !member.userId) return;
    nav(`/player/${member.userId}`);
  };

  const onMediaClick = (m) => {
    const href = getMediaHref(m);
    if (!href) {
      alert("미디어 링크가 없습니다.");
      return;
    }
    const ok = openExternal(href);
    if (!ok) alert("링크를 열 수 없습니다. 잠시 후 다시 시도해 주세요.");
  };

  const handleSubmitMatchRequest = async () => {
    if (!team) return;

    if (!myTeam || !myClubId) {
      setShowLineupSelectModal(false);
      alert("내 팀 정보를 확인할 수 없습니다.");
      return;
    }

    const opponentClubId = String(team?.clubId || team?.id || "").trim();
    if (!opponentClubId) {
      setShowLineupSelectModal(false);
      alert("상대 팀 정보를 확인할 수 없습니다.");
      return;
    }

    if (!selectedMatchSize) {
      alert("매치 사이즈(3 vs 3 / 4 vs 4 / 5 vs 5)를 선택해 주세요.");
      return;
    }

    try {
      const matchId = await createMatchRequest({
        actorClubId: String(myClubId),
        actorTeam: myTeam,

        targetClubId: opponentClubId,
        targetTeam: team,

        matchSizeKey: selectedMatchSize,
      });

      console.log("[TeamProfile] match request created:", matchId);

      setShowLineupSelectModal(false);
      setSelectedMatchSize("");
      nav("/matchingmanage", { state: { initialTab: "sent" } });
    } catch (e) {
      console.warn("[TeamProfile] create match request failed:", e?.message || e);
      alert(e?.message || "매칭 신청에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setShowLineupSelectModal(false);
    }
  };

  const membersWithCaptain = useMemo(() => {
    const list = Array.isArray(team?.members) ? team.members : [];
    const ownerUid = String(team?.ownerUid || "").trim();

    return list.map((m) => {
      const uid = String(m?.userId || m?.id || "").trim();
      const isCaptain = m?.isTeamCaptain === true || (!!ownerUid && !!uid && ownerUid === uid);
      return { ...(m || {}), isTeamCaptain: isCaptain };
    });
  }, [team?.members, team?.ownerUid]);

  // 차단된 팀에 진입한 경우 — 누구든 가드로 막음
  if (!loading && team?.blocked === true) {
    const goBack = () => {
      try {
        if (window.history.length > 1) {
          nav(-1);
          return;
        }
      } catch (e) {}
      nav("/home");
    };
    return (
      <Page>
        <BlockedOverlay
          title="차단된 팀입니다"
          description="해당 팀은 관리자에 의해 이용이 제한되었습니다."
          reason={team.blockedReason}
          blockedAt={team.blockedAt}
          onBack={goBack}
        />
      </Page>
    );
  }

  return (
    <Page>
      {loading && (
        <StateWrap>
          <Spinner size="lg" />
        </StateWrap>
      )}

      {!loading && error && <StateWrap>{error}</StateWrap>}

      {!loading && !error && team && (
        <>
          <ScrollArea>
            <HeroWrap>
              <HeroInner>
                <HeroTextCol>
                  <HeroTopBlock>
                    <HeroLogoRow>
                      <HeroLogoBox>
                        {teamRank && teamRank <= 3 ? (
                          <HeroCrown src={images.logo} alt={`${teamRank}위`} />
                        ) : null}
                        <HeroLogoCircle>
                          {team.logoUrl && team.logoUrl !== images.logo ? (
                            <HeroLogoImg src={team.logoUrl} alt={`${team.name} 로고`} />
                          ) : (
                            <HeroLogoPlaceholder />
                          )}
                        </HeroLogoCircle>
                      </HeroLogoBox>
                      <HeroTitleBlock>
                        <HeroTitle>{team.name}</HeroTitle>
                        {team.region && <HeroMeta>{team.region} · 생활체육 농구팀</HeroMeta>}
                      </HeroTitleBlock>
                    </HeroLogoRow>

                    <HeroChipRow>
                      {teamRank ? <HeroChip>랭킹 {teamRank}위</HeroChip> : null}
                      {tags.map((tag) => (
                        <HeroChip key={tag}>#{tag}</HeroChip>
                      ))}
                    </HeroChipRow>
                  </HeroTopBlock>
                </HeroTextCol>

                <HeroIllustWrap>
                  <HeroIllustImg src={heroIllust} alt={`${team.name} 히어로 이미지`} />

                  {!isMyTeam && (
                    <FavoriteButton onClick={onFavoriteTeam} disabled={favBusy}>
                      <FiStar size={13} color={fav ? "#f59e0b" : "#92400e"} />
                      {fav ? "즐겨찾기 해제" : "즐겨찾기"}
                    </FavoriteButton>
                  )}
                </HeroIllustWrap>
              </HeroInner>
            </HeroWrap>

            <ContentWrap>
              <Section>
                <SectionHeaderRow>
                  <SectionHeaderLeft>
                    <SectionIconCircle>
                      <SectionIconImg src={images.teamIntroIcon} alt="팀 소개" />
                    </SectionIconCircle>
                    <SectionTitleText>팀 소개</SectionTitleText>
                  </SectionHeaderLeft>
                  {introUpdated && <SectionMeta>{introUpdated}</SectionMeta>}
                </SectionHeaderRow>

                {team.description && <AboutText>{team.description}</AboutText>}

                <AboutMetaList>
                  {team.region && <AboutMetaRow>활동 지역: {team.region}</AboutMetaRow>}
                  {activityLabel.days ? <AboutMetaRow>활동 요일: {activityLabel.days}</AboutMetaRow> : null}
                  {activityLabel.time ? <AboutMetaRow>활동 시간: {activityLabel.time}</AboutMetaRow> : null}
                </AboutMetaList>
              </Section>

              <Section>
                <SectionHeaderRow>
                  <SectionHeaderLeft>
                    <SectionIconCircle>
                      <SectionIconImg src={images.teamStatsIcon} alt="팀 전적" />
                    </SectionIconCircle>
                    <SectionTitleText>팀 전적</SectionTitleText>
                  </SectionHeaderLeft>
                  {statsUpdated && <SectionMeta>{statsUpdated}</SectionMeta>}
                </SectionHeaderRow>

                <TeamStatsSection stats={team.stats} />

                {recentResults.length > 0 && (
                  <RecentResultsRow>
                    <RecentResultsLabel>최근 전적</RecentResultsLabel>
                    <RecentDots>
                      {recentResults.map((r, idx) => {
                        if (r === "W") return <WinChip key={`recent-${idx}`} size="sm" />;
                        if (r === "D") return <DrawChip key={`recent-${idx}`} size="sm" />;
                        return <LoseChip key={`recent-${idx}`} size="sm" />;
                      })}
                    </RecentDots>
                  </RecentResultsRow>
                )}

                {repCount > 0 && (
                  <RecentResultsRow>
                    <RecentResultsLabel>팀 평판</RecentResultsLabel>
                    <RepValue>
                      <RepStars>{repStars}</RepStars>
                      <RepNum>{repAvg.toFixed(1)}</RepNum>
                      <RepCount>({repCount})</RepCount>
                    </RepValue>
                  </RecentResultsRow>
                )}
              </Section>

              <Section>
                <SectionHeaderRow>
                  <SectionHeaderLeft>
                    <SectionIconCircle>
                      <SectionIconImg src={images.teamStatsIcon} alt="경기 기록" />
                    </SectionIconCircle>
                    <SectionTitleText>경기 기록</SectionTitleText>
                  </SectionHeaderLeft>
                </SectionHeaderRow>

                {pastMatchesLoading ? (
                  <StateWrap>
                    <Spinner size="lg" />
                  </StateWrap>
                ) : (
                  <TeamMatchHistorySection
                    teamClubId={String(team?.clubId || team?.id || "").trim()}
                    teamName={team?.name}
                    matches={pastMatches}
                    onClickMatch={(id) =>
                      nav(`/match-roomdetail/${id}`, {
                        state: { viewClubId: String(team?.clubId || team?.id || "").trim() },
                      })
                    }
                  />
                )}
              </Section>

              <Section>
                <SectionHeaderRow>
                  <SectionHeaderLeft>
                    <SectionIconCircle>
                      <SectionIconImg src={images.teamMembersIcon} alt="팀 멤버" />
                    </SectionIconCircle>
                    <SectionTitleText>팀 멤버</SectionTitleText>
                  </SectionHeaderLeft>
                  {membersCount && <SectionMeta>{membersCount}</SectionMeta>}
                </SectionHeaderRow>

                <TeamMembersSection members={membersWithCaptain} onPlayerClick={onPlayerClick} />
              </Section>

              {mediaList.length > 0 && (
                <Section>
                  <SectionHeaderRow>
                    <SectionHeaderLeft>
                      <SectionIconCircle>
                        <SectionIconImg src={images.teamMediaIcon} alt="팀 사진/영상" />
                      </SectionIconCircle>
                      <SectionTitleText>팀 사진/영상</SectionTitleText>
                    </SectionHeaderLeft>
                    <SectionMeta
                      style={{ cursor: "pointer" }}
                      onClick={() => setMediaModalOpen(true)}
                    >
                      전체보기
                    </SectionMeta>
                  </SectionHeaderRow>

                  <MediaGrid>
                    {mediaList.slice(0, 9).map((m) => (
                      <MediaCell
                        key={m.id || m.url || m.youtubeUrl}
                        onClick={() => onMediaClick(m)}
                      >
                        <MediaImg
                          src={m.thumbnailUrl || images.teamMediaFallback || images.logo}
                          alt={m.title || "media"}
                        />
                        {m.type === "video" && (
                          <MediaPlay>
                            <PlayCircle>▶</PlayCircle>
                          </MediaPlay>
                        )}
                      </MediaCell>
                    ))}
                  </MediaGrid>
                </Section>

                
              )}

              {!isMyTeam && (
                <ReportLinkRow>
                  <ReportLink type="button" onClick={openReport}>
                    🚩 부정 팀 신고하기
                  </ReportLink>
                </ReportLinkRow>
              )}

            </ContentWrap>
          </ScrollArea>

          {!isMyTeam && !embed && (
            <BottomBar>
              {targetTeamTooFew ? (
                <MatchNotice>
                  상대 팀이 아직 팀원 {MIN_TEAM_MEMBERS}명을 채우지 못해 매칭을 받을 수 없어요.
                </MatchNotice>
              ) : myTeamTooFew ? (
                <MatchNotice>
                  우리 팀원이 {MIN_TEAM_MEMBERS}명 이상일 때 매칭을 신청할 수 있어요. (현재 {myMemberCount}명)
                </MatchNotice>
              ) : null}
              <BottomRow>
                <CTAButton
                  type="button"
                  $primary
                  onClick={onMatchRequestClick}
                  disabled={myTeamLoading || targetTeamTooFew || myTeamTooFew}
                >
                  <TbBallBasketball size={18} />
                  {myTeamLoading ? "불러오는 중..." : "매칭 신청"}
                </CTAButton>
              </BottomRow>
            </BottomBar>
          )}

          {showLineupSelectModal && (
            <Overlay onClick={() => setShowLineupSelectModal(false)}>
              <SelectCard onClick={(e) => e.stopPropagation()}>
                <LineupModalHeader>
                  <LineupModalTitle>매치 사이즈를 선택해 주세요</LineupModalTitle>
                  <LineupModalClose onClick={() => setShowLineupSelectModal(false)}>×</LineupModalClose>
                </LineupModalHeader>

                <SelectBody>
                  <LineupModalMeta>
                    {team?.name ? `${team.name}에 매칭 신청` : "매칭 신청"} · 라인업은 수락 후 매칭룸에서
                    각 팀이 확정해요
                  </LineupModalMeta>

                  <SelectList>
                    {[
                      { key: "3v3", label: "3 vs 3", desc: "한 팀당 3명" },
                      { key: "4v4", label: "4 vs 4", desc: "한 팀당 4명" },
                      { key: "5v5", label: "5 vs 5", desc: "한 팀당 5명" },
                    ].map((opt) => {
                      const selected = selectedMatchSize === opt.key;
                      return (
                        <SelectItem
                          key={opt.key}
                          type="button"
                          $selected={selected}
                          onClick={() => setSelectedMatchSize(opt.key)}
                        >
                          <SelectTexts>
                            <SelectName>{opt.label}</SelectName>
                            <SelectMeta>{opt.desc}</SelectMeta>
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
                  <SelectButton
                    type="button"
                    $primary
                    disabled={!selectedMatchSize}
                    onClick={handleSubmitMatchRequest}
                  >
                    매칭 신청
                  </SelectButton>
                </SelectActions>
              </SelectCard>
            </Overlay>
          )}
        </>
      )}

      {reportOpen && (
        <ReportOverlayWrap
          onClick={(e) => {
            if (e.target === e.currentTarget) closeReport();
          }}
        >
          <ReportModal onClick={(e) => e.stopPropagation()}>
            <ReportTitle>부정 팀 신고</ReportTitle>
            <ReportSub>
              신고 내용은 관리자가 검토 후 조치합니다.{"\n"}
              허위 신고 시 서비스 이용이 제한될 수 있습니다.
            </ReportSub>

            <ReportTextarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="예: 노쇼 반복, 사기 의심, 욕설/비방 등"
              disabled={reportBusy}
              autoFocus
            />

            <ReportActions>
              <ReportBtn type="button" onClick={closeReport} disabled={reportBusy}>
                취소
              </ReportBtn>
              <ReportBtn
                type="button"
                $danger
                onClick={handleSubmitReport}
                disabled={reportBusy || !reportReason.trim()}
              >
                {reportBusy ? "전송중…" : "신고하기"}
              </ReportBtn>
            </ReportActions>
          </ReportModal>
        </ReportOverlayWrap>
      )}

      {mediaModalOpen && (
        <Viewer>
          <ViewerTop>
            <span>팀 사진/영상</span>
            <ViewerClose type="button" onClick={() => setMediaModalOpen(false)}>
              ×
            </ViewerClose>
          </ViewerTop>
          <ViewerTrack>
            {mediaList.map((m) => (
              <ViewerSlide key={m.id || m.url || m.youtubeUrl}>
                <ViewerImg
                  src={m.thumbnailUrl || images.teamMediaFallback || images.logo}
                  alt={m.title || "media"}
                />
                {m.type === "video" && (
                  <ViewerPlay onClick={() => onMediaClick(m)}>
                    <PlayCircle>▶</PlayCircle>
                  </ViewerPlay>
                )}
              </ViewerSlide>
            ))}
          </ViewerTrack>
        </Viewer>
      )}
    </Page>
  );
}
