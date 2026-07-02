/* eslint-disable */
// src/pages/player/PlayerProfilePage.jsx
// ✅ HeroName 옆 "팀장" pill 추가 (player.isTeamCaptain === true)

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import { FiStar, FiMapPin, FiUser, FiShield, FiBarChart2, FiClock, FiImage } from "react-icons/fi";

import { images } from "../../utils/imageAssets";
import { getPlayerProfile } from "../../services/playerService";
import { getPlayerRankMap } from "../../services/rankingService";
import { getTeamRankMap } from "../../services/teamRankingService";

import { useAuth } from "../../hooks/useAuth";
import { setFavoritePlayer } from "../../services/favoriteService";
import { createUserReport } from "../../services/userReportService";
import BlockedOverlay from "../../components/common/BlockedOverlay";
import PlayerActivitySection from "../../components/player/PlayerActivitySection";
import PlayerHealthSection from "../../components/player/PlayerHealthSection";
import PlayerMonthlyActivitySection from "../../components/player/PlayerMonthlyActivitySection";
import EmptyState from "../../components/common/EmptyState";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";
import TeamStatsSection from "../../components/team/TeamStatsSection";
import TeamMatchHistorySection from "../../components/team/TeamMatchHistorySection";
import { loadPlayerFinishedMatches, loadPlayerMonthlyActivity } from "../../services/matchRoomService";

/* =============== 헬퍼: 포지션/실력 라벨 =============== */

const POSITION_LABEL = {
  guard: "가드",
  forward: "포워드",
  center: "센터",
};

const SKILL_LABEL = {
  beginner: "입문",
  amateur: "아마추어",
  intermediate: "중급",
  advanced: "상급",
  pro: "프로급",
};

const SKILL_COLOR = {
  beginner: { bg: "#e5e7eb", color: "#4b5563" },
  amateur: { bg: "#dbeafe", color: "#1d4ed8" },
  intermediate: { bg: "#dcfce7", color: "#15803d" },
  advanced: { bg: "#fee2e2", color: "#b91c1c" },
  pro: { bg: "#fef3c7", color: "#92400e" },
};

const getAge = (birthYear) => {
  if (!birthYear) return null;
  const now = new Date();
  const year = now.getFullYear();
  const age = year - birthYear;
  if (age < 0 || age > 80) return null;
  return age;
};

/* =============== 레이아웃 공통 =============== */

const Page = styled.div`
  min-height: ${({ $embed }) => ($embed ? "auto" : "100vh")};
  background: ${({ $embed, theme }) => ($embed ? "transparent" : theme.colors.bg)};
  display: flex;
  flex-direction: column;
`;

const ScrollArea = styled.div`
  flex: 1;
  overflow-y: ${({ $embed }) => ($embed ? "visible" : "auto")};
  padding-bottom: ${({ $embed }) => ($embed ? "0" : "110px")};
`;

/* =============== 상단 히어로 (선수 프로필) =============== */

const HeroWrap = styled.div`
  position: relative;
  width: 100%;
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.textStrong};
  overflow: hidden;
`;

const HeroTeamBgCircle = styled.div`
  position: absolute;
  right: -40px;
  bottom: -40px;
  width: 190px;
  height: 190px;
  border-radius: 999px;
  overflow: hidden;
  opacity: 0.22;
  pointer-events: none;
  filter: blur(0.5px);
  z-index: 1;
`;

const HeroTeamBgImg = styled.img`
  width: 120%;
  height: 120%;
  object-fit: cover;
  transform: scale(1.03);
`;

const HeroInner = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  padding: 24px 16px 10px;
  gap: 16px;
  z-index: 2;
`;

const HeroLeftCol = styled.div`
  flex: 1.8;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const HeroRightCol = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-end;
  height: 100%;
  gap: 8px;
`;

const HeroTopBlock = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

/* 1~3위: 프로필 아바타 위에 겹쳐 배치되는 로고 */
const AvatarBox = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const AvatarCrown = styled.img`
  position: absolute;
  top: -23px;
  left: 50%;
  transform: translateX(-50%);
  width: 37px;
  height: 37px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.3));
`;

const AvatarCircle = styled.div`
  width: 62px;
  height: 62px;
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f4f4ff"};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

/* 프로필 없을 때: 사람 실루엣 placeholder (라운드 사각) */
const SquareAvatarPlaceholder = styled(AvatarPlaceholder)`
  width: 100% !important;
  height: 100% !important;
  border-radius: 8px;
`;

const HeroTitleBlock = styled.div`
  min-width: 0;
`;

/* ✅ 이름 + 팀장 뱃지 Row */
const HeroNameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const HeroName = styled.h1`
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/* ✅ 팀장 pill */
const CaptainPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
`;

const HeroMetaRow = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const HeroChipRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
  margin-top: 10px;

  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const HeroChip = styled.span`
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f1f5f9"};
  color: ${({ theme }) => theme.colors.textNormal};
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
`;

const SkillChip = styled.span`
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
  ${({ $skill }) => {
    const style = SKILL_COLOR[$skill] || {
      bg: "#f1f5f9",
      color: "#475569",
    };
    return `
      background: ${style.bg};
      color: ${style.color};
    `;
  }}
`;

const FavoriteButton = styled.button`
  border: none;
  border-radius: 999px;
  padding: 6px 6px;
  font-size: 11px;
  font-weight: 500;
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

/* =============== 컨텐츠 래퍼 =============== */

const ContentWrap = styled.div`
  padding: 16px 16px 0;
`;

const Section = styled.section`
  margin-top: 12px;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 14px 16px 16px;
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const SectionHeaderRow = styled.div`
  margin-bottom: 8px;
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
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 16px;
`;

/* 섹션 헤더 3D 아이콘 */
const Ico3D = styled.img`
  width: 26px;
  height: 26px;
  object-fit: contain;
  transform: translateY(-2px);
  filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.16));
`;

const SectionTitleText = styled.h2`
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const SectionMeta = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const AboutText = styled.p`
  margin: 4px 0 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textNormal};
  line-height: 1.6;
  white-space: pre-line;
`;

const MetaGrid = styled.div`
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const MetaLabel = styled.span`
  color: ${({ theme }) => theme.colors.textWeak};
`;

const MetaValue = styled.span`
  color: ${({ theme }) => theme.colors.textNormal};
  font-weight: 500;
`;


const TeamInfoRow = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textNormal};
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
`;

const TeamBasicRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

/* 소속팀 1~3위: 팀 로고 위 왕관 (로고는 overflow:hidden이라 밖에서 얹음) */
const TeamLogoWrap = styled.div`
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
`;

const TeamCrown = styled.img`
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 20px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 2px 5px rgba(15, 23, 42, 0.2));
`;

const TeamLogoCircle = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 8px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const TeamLogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

/* 팀명 + 랭킹 칩 한 줄 */
const TeamNameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

const TeamNameText = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

/* 소속팀 전체 랭킹 순위 */
const TeamRankChip = styled.span`
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary || "#7c5cc9"};
`;

const TeamMetaText = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  display: flex;
  align-items: center;
  gap: 4px;
`;

/* 3열 그리드(최대 3x3 = 9개) — 팀 프로필 사진/영상과 동일 레이아웃 */
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
  background: rgba(0, 0, 0, 0.18);
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

const PlaceholderText = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  margin-top: 4px;
`;

/* 하단 CTA */

const StateWrap = styled.div`
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* =============== 신고 =============== */

const ReportRow = styled.div`
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

const ReportOverlay = styled.div`
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

/* =============== 페이지 컴포넌트 =============== */

export default function PlayerProfilePage({ playerId: propPlayerId, embed = false } = {}) {
  const nav = useNavigate();
  const params = useParams();
  const playerId = propPlayerId || params.playerId;

  const { firebaseUser, userDoc, refreshUser } = useAuth();
  const myUid = firebaseUser?.uid || userDoc?.uid || userDoc?.id || "";

  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState(null);
  const [playerRank, setPlayerRank] = useState(null);
  const [teamRank, setTeamRank] = useState(null); // 소속팀 전체 랭킹 등수(1~3위면 왕관)

  // 라인업에 참가한 종료 경기 (전적/경기 기록 카드용)
  const [playerMatches, setPlayerMatches] = useState([]);
  const [playerMatchesLoading, setPlayerMatchesLoading] = useState(false);
  // 월별 활동(팀 대비 참여율)용 — 팀 경기 + 팀원 uid
  const [playerActivity, setPlayerActivity] = useState({ games: [], memberUids: [] });

  const [fav, setFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

  // 사진/영상 전체보기 모달
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  // 신고 모달
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportBusy, setReportBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const p = await getPlayerProfile(playerId);
        if (!alive) return;
        setPlayer(p || null);

        console.log("player information", p);
      } catch (e) {
        console.warn("[PlayerProfilePage] load failed:", e?.message || e);
        if (!alive) return;
        setPlayer(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [playerId]);

  useEffect(() => {
    const ids = Array.isArray(userDoc?.favoritePlayerIds) ? userDoc.favoritePlayerIds : [];
    setFav(ids.includes(String(playerId)));
  }, [userDoc?.favoritePlayerIds, playerId]);

  // 라인업 참가 경기 로드
  useEffect(() => {
    const clubId = String(player?.clubId || "").trim();
    const uid = String(player?.uid || player?.userId || playerId || "").trim();
    if (!clubId || !uid) {
      setPlayerMatches([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        setPlayerMatchesLoading(true);
        const { rooms } = await loadPlayerFinishedMatches({ clubId, uid });
        if (!alive) return;
        setPlayerMatches(Array.isArray(rooms) ? rooms : []);

        // 월별 활동(팀 대비 참여율)용 데이터
        try {
          const act = await loadPlayerMonthlyActivity({ clubId, uid });
          if (alive) setPlayerActivity({
            games: Array.isArray(act?.games) ? act.games : [],
            memberUids: Array.isArray(act?.memberUids) ? act.memberUids : [],
          });
        } catch (e2) {
          if (alive) setPlayerActivity({ games: [], memberUids: [] });
        }
      } catch (e) {
        console.warn("[PlayerProfilePage] load player matches failed:", e?.message || e);
        if (alive) setPlayerMatches([]);
      } finally {
        if (alive) setPlayerMatchesLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [player?.clubId, player?.uid, playerId]);

  // ✅ 선수 전역 랭킹(1~3위 왕관 + 순위 표시용)
  useEffect(() => {
    let alive = true;
    const pid = String(playerId || "").trim();
    if (!pid) return;
    getPlayerRankMap()
      .then((map) => {
        if (alive) setPlayerRank(map.get(pid) || null);
      })
      .catch((e) => console.warn("[PlayerProfilePage] rank load failed:", e?.message || e));
    return () => {
      alive = false;
    };
  }, [playerId]);

  // 소속팀 전체 랭킹 등수 (소속 팀 로고 위 1~3위 왕관 표시용)
  useEffect(() => {
    let alive = true;
    const cid = String(player?.clubId || "").trim();
    if (!cid) {
      setTeamRank(null);
      return;
    }
    getTeamRankMap()
      .then((map) => {
        if (alive) setTeamRank(map?.get?.(cid) || null);
      })
      .catch((e) => console.warn("[PlayerProfilePage] team rank load failed:", e?.message || e));
    return () => {
      alive = false;
    };
  }, [player?.clubId]);

  const isSelf = useMemo(() => {
    if (!myUid || !playerId) return false;
    return String(myUid) === String(playerId);
  }, [myUid, playerId]);

  const onFavoritePlayer = async () => {
    if (!myUid) {
      alert("로그인이 필요합니다.");
      return;
    }
    if (!playerId) return;
    if (isSelf) return;

    const next = !fav;
    setFav(next);

    try {
      setFavBusy(true);
      await setFavoritePlayer({
        uid: myUid,
        playerUid: String(playerId),
        isFavorite: next,
      });
      refreshUser && (await refreshUser());
    } catch (e) {
      console.warn("[PlayerProfilePage] setFavoritePlayer failed:", e?.message || e);
      setFav(!next);
      alert("즐겨찾기 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setFavBusy(false);
    }
  };

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
    if (!playerId || !myUid) return;
    setReportBusy(true);
    try {
      await createUserReport({
        targetUid: String(playerId),
        targetNickname: String(player?.nickname || player?.name || ""),
        reporterUid: String(myUid),
        reporterNickname: String(userDoc?.nickname || userDoc?.name || ""),
        reason,
      });
      setReportOpen(false);
      setReportReason("");
      alert("신고가 접수되었습니다. 검토 후 조치합니다.");
    } catch (e) {
      console.error("[PlayerProfilePage] report failed", e);
      alert(e?.message || "신고 접수에 실패했습니다.");
    } finally {
      setReportBusy(false);
    }
  };

  if (loading) {
    return (
      <Page $embed={embed}>
        <StateWrap>불러오는 중...</StateWrap>
      </Page>
    );
  }

  if (!player) {
    return (
      <Page $embed={embed}>
        <StateWrap>선수 정보를 찾을 수 없습니다.</StateWrap>
      </Page>
    );
  }

  // 다른 사람이 차단된 사용자 프로필에 진입했을 때
  // (자기 자신 프로필은 BlockedGate가 처리하므로 여기선 다른 사람이 보는 케이스만)
  if (player.blocked === true && !isSelf) {
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
          title="차단된 회원입니다"
          description="해당 회원은 관리자에 의해 이용이 제한되었습니다."
          reason={player.blockedReason}
          blockedAt={player.blockedAt}
          onBack={goBack}
        />
      </Page>
    );
  }

  const age = getAge(player.birthYear);
  const positionLabel =
    (player.mainPosition && POSITION_LABEL[player.mainPosition]) || "포지션 미정";
  const skillLabel =
    (player.skillLevel && SKILL_LABEL[player.skillLevel]) || "실력 정보 없음";

  const avatarSrc = player.photoUrl || player.avatarUrl || "";

  // 라인업 참가 경기 기준 전적 (TeamStatsSection stats 형태로 가공)
  // early return 이후 위치라 hook(useMemo) 대신 일반 계산
  const playerStats = (() => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    const recentResults = []; // 최신순(rooms가 이미 최신순)
    (playerMatches || []).forEach((m) => {
      if (m?.myScore == null || m?.oppScore == null) return;
      if (m.myScore > m.oppScore) {
        wins += 1;
        recentResults.push("W");
      } else if (m.myScore < m.oppScore) {
        losses += 1;
        recentResults.push("L");
      } else {
        draws += 1;
        recentResults.push("D");
      }
    });
    const totalMatches = wins + losses + draws;
    return {
      totalMatches,
      wins,
      losses,
      draws,
      winRate: totalMatches > 0 ? wins / totalMatches : 0,
      recentResults: recentResults.slice(0, 5),
    };
  })();

  const teamLogoSrc = player.clubLogoUrl && player.clubLogoUrl !== images.logo ? player.clubLogoUrl : images.teamPlaceholder;

  const mediaList = Array.isArray(player.media) ? player.media : [];
  const playerSessions = Array.isArray(player.sessions) ? player.sessions : [];

  const onViewTeam = () => {
    if (!player.clubId) return;
    nav(`/team/${player.clubId}`);
  };

  const onMediaClick = (m) => {
    if (m?.url) window.open(m.url, "_blank");
  };

  return (
    <Page $embed={embed}>
      <ScrollArea $embed={embed}>
        <HeroWrap>
          <HeroTeamBgCircle>
            <HeroTeamBgImg src={teamLogoSrc} alt={player.clubName || "소속 팀"} />
          </HeroTeamBgCircle>

          <HeroInner>
            <HeroLeftCol>
              <HeroTopBlock>
                <AvatarBox>
                  {playerRank && playerRank <= 3 ? (
                    <AvatarCrown src={images.logo} alt={`${playerRank}위`} />
                  ) : null}
                  <AvatarCircle>
                    {avatarSrc ? (
                      <AvatarImg src={avatarSrc} alt={`${player.nickname} 프로필`} />
                    ) : (
                      <SquareAvatarPlaceholder />
                    )}
                  </AvatarCircle>
                </AvatarBox>

                <HeroTitleBlock>
                  <HeroNameRow>
                    <HeroName>{player.nickname}</HeroName>
                    {player.isTeamCaptain === true ? <CaptainPill>팀장</CaptainPill> : null}
                  </HeroNameRow>

                  <HeroMetaRow>
                    {age && <span>{age}세</span>}
                    {player.heightCm && <span>{player.heightCm}cm</span>}
                    {player.weightKg && <span>{player.weightKg}kg</span>}
                    {player.clubName && <span>{player.clubName}</span>}
                  </HeroMetaRow>
                </HeroTitleBlock>
              </HeroTopBlock>

              <HeroChipRow>
                {playerRank ? <HeroChip>랭킹 {playerRank}위</HeroChip> : null}
                <HeroChip>{positionLabel}</HeroChip>
                <SkillChip $skill={player.skillLevel}>{skillLabel}</SkillChip>
                {player.region && (
                  <HeroChip>
                    <FiMapPin size={10} />
                    {player.region}
                  </HeroChip>
                )}
              </HeroChipRow>
            </HeroLeftCol>

            <HeroRightCol>
              {!isSelf && (
                <FavoriteButton onClick={onFavoritePlayer} disabled={favBusy}>
                  <FiStar size={13} color={fav ? "#f59e0b" : "#92400e"} />
                  {fav ? "즐겨찾기 해제" : "즐겨찾기"}
                </FavoriteButton>
              )}
            </HeroRightCol>
          </HeroInner>
        </HeroWrap>

        <ContentWrap>
          <Section>
            <SectionHeaderRow>
              <SectionHeaderLeft>
                <SectionIconCircle>
                  <Ico3D src={images.emoji3dIdCard} alt="" />
                </SectionIconCircle>
                <SectionTitleText>선수 프로필</SectionTitleText>
              </SectionHeaderLeft>
            </SectionHeaderRow>

            <MetaGrid>
              <MetaItem>
                <MetaLabel>포지션</MetaLabel>
                <MetaValue>{positionLabel}</MetaValue>
              </MetaItem>
              <MetaItem>
                <MetaLabel>실력</MetaLabel>
                <MetaValue>{skillLabel}</MetaValue>
              </MetaItem>
              {player.heightCm && (
                <MetaItem>
                  <MetaLabel>키</MetaLabel>
                  <MetaValue>{player.heightCm}cm</MetaValue>
                </MetaItem>
              )}
              {player.weightKg && (
                <MetaItem>
                  <MetaLabel>체중</MetaLabel>
                  <MetaValue>{player.weightKg}kg</MetaValue>
                </MetaItem>
              )}
            </MetaGrid>

            {player.intro && <AboutText>{player.intro}</AboutText>}
          </Section>

          {player.clubId ? (
            <Section>
              <SectionHeaderRow>
                <SectionHeaderLeft>
                  <SectionIconCircle>
                    <Ico3D src={images.emoji3dShield} alt="" />
                  </SectionIconCircle>
                  <SectionTitleText>소속 팀</SectionTitleText>
                </SectionHeaderLeft>
                <SectionMeta style={{ cursor: "pointer" }} onClick={onViewTeam}>
                  팀 보기
                </SectionMeta>
              </SectionHeaderRow>

              <TeamInfoRow>
                <TeamBasicRow
                  onClick={onViewTeam}
                  style={{ cursor: "pointer" }}
                  role="button"
                >
                  <TeamLogoWrap>
                    {teamRank && teamRank <= 3 ? (
                      <TeamCrown src={images.logo} alt={`${teamRank}위`} />
                    ) : null}
                    <TeamLogoCircle>
                      <TeamLogoImg src={teamLogoSrc} alt={player.clubName || "소속 팀"} />
                    </TeamLogoCircle>
                  </TeamLogoWrap>
                  <div>
                    <TeamNameRow>
                      <TeamNameText>{player.clubName || "팀"}</TeamNameText>
                      {teamRank ? <TeamRankChip>랭킹 {teamRank}위</TeamRankChip> : null}
                    </TeamNameRow>
                    <TeamMetaText>
                      <FiMapPin size={12} />
                      {player.clubRegion || "생활체육 팀"}
                    </TeamMetaText>
                  </div>
                </TeamBasicRow>
              </TeamInfoRow>
            </Section>
          ) : null}

          {/* 전적 카드 (팀 프로필과 동일 — 참가 경기 기준) */}
          <Section>
            <SectionHeaderRow>
              <SectionHeaderLeft>
                <SectionIconCircle>
                  <Ico3D src={images.emoji3dBarchart} alt="" />
                </SectionIconCircle>
                <SectionTitleText>전적</SectionTitleText>
              </SectionHeaderLeft>
            </SectionHeaderRow>

            <TeamStatsSection stats={playerStats} />
          </Section>

          {/* 경기 기록 카드 (팀 프로필과 동일 — 라인업 참가 경기만) */}
          <Section>
            <SectionHeaderRow>
              <SectionHeaderLeft>
                <SectionIconCircle>
                  <Ico3D src={images.emoji3dFlag} alt="" />
                </SectionIconCircle>
                <SectionTitleText>경기 기록</SectionTitleText>
              </SectionHeaderLeft>
            </SectionHeaderRow>

            {playerMatchesLoading ? (
              <StateWrap>불러오는 중...</StateWrap>
            ) : (
              <TeamMatchHistorySection
                teamClubId={String(player.clubId || "").trim()}
                teamName={player.clubName}
                matches={playerMatches}
                onClickMatch={(id) =>
                  nav(`/match-roomdetail/${id}`, {
                    state: { viewClubId: String(player.clubId || "").trim() },
                  })
                }
              />
            )}
          </Section>

          {/* 🔁 App Store 심사(Guideline 2.5.1) 대응: iOS HealthKit 제거에 따라 건강 UI 숨김.
              나중에 HealthKit 복구 시 아래 두 섹션 주석 해제 + RN react-native.config.js / Info.plist 복구. */}
          {/* <PlayerHealthSection sessions={playerSessions} userProfile={player} /> */}
          {/* 월별 활동 기록 — 팀 경기 대비 내 참여율/순위 + 월별 내 경기 수 */}
          <PlayerMonthlyActivitySection
            games={playerActivity.games}
            memberUids={playerActivity.memberUids}
            myUid={String(player?.uid || player?.userId || playerId || "").trim()}
            isSelf={isSelf}
            playerName={String(player?.nickname || player?.name || "").trim()}
          />
          {/* <PlayerActivitySection playerId={playerId} isSelf={isSelf} /> */}

          <Section>
            <SectionHeaderRow>
              <SectionHeaderLeft>
                <SectionIconCircle>
                  <Ico3D src={images.emoji3dPicture} alt="" />
                </SectionIconCircle>
                <SectionTitleText>경기 사진 / 영상</SectionTitleText>
              </SectionHeaderLeft>
              {mediaList.length > 9 ? (
                <SectionMeta
                  style={{ cursor: "pointer" }}
                  onClick={() => setMediaModalOpen(true)}
                >
                  전체보기
                </SectionMeta>
              ) : null}
            </SectionHeaderRow>

            {mediaList.length > 0 ? (
              <MediaGrid>
                {mediaList.slice(0, 9).map((m) => (
                  <MediaCell key={m.id || m.url} onClick={() => onMediaClick(m)}>
                    <MediaImg src={m.thumbnailUrl || m.url} alt={m.title || m.caption || "media"} />
                    {m.type === "video" && (
                      <MediaPlay>
                        <PlayCircle>▶</PlayCircle>
                      </MediaPlay>
                    )}
                  </MediaCell>
                ))}
              </MediaGrid>
            ) : (
              <EmptyState compact text="등록된 미디어가 없습니다." />
            )}
          </Section>

          {!isSelf && (
            <ReportRow>
              <ReportLink type="button" onClick={openReport}>
                🚩 부정 사용자 신고하기
              </ReportLink>
            </ReportRow>
          )}
        </ContentWrap>
      </ScrollArea>

      {mediaModalOpen && (
        <Viewer>
          <ViewerTop>
            <span>경기 사진 / 영상</span>
            <ViewerClose type="button" onClick={() => setMediaModalOpen(false)}>
              ×
            </ViewerClose>
          </ViewerTop>
          <ViewerTrack>
            {mediaList.map((m) => (
              <ViewerSlide key={m.id || m.url}>
                <ViewerImg src={m.thumbnailUrl || m.url} alt={m.title || m.caption || "media"} />
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

      {reportOpen && (
        <ReportOverlay
          onClick={(e) => {
            if (e.target === e.currentTarget) closeReport();
          }}
        >
          <ReportModal onClick={(e) => e.stopPropagation()}>
            <ReportTitle>부정 사용자 신고</ReportTitle>
            <ReportSub>
              신고 내용은 관리자가 검토 후 조치합니다.{"\n"}
              허위 신고 시 서비스 이용이 제한될 수 있습니다.
            </ReportSub>

            <ReportTextarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="예: 욕설/비방, 노쇼 반복, 사기 의심 등"
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
        </ReportOverlay>
      )}
    </Page>
  );
}
