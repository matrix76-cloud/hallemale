/* eslint-disable */
// src/pages/matching/MatchRoomDetailPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import { images, playerAvatars } from "../../utils/imageAssets";
import {
  loadMatchRoomDetail,
  proposeMatchSchedule,
  confirmProposedSchedule,
  cancelMatchRequest,
  submitMatchResultWithMedia,
  acceptMatchResult,
  disputeMatchResult,
} from "../../services/matchRoomService";
import PositionChip from "../../components/common/PositionChip";
import { useClub } from "../../hooks/useClub";

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
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 10px 0 24px;
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
  background: #ffffff;
  border-radius: 22px;
  padding: 14px 14px 16px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const TeamBlock = styled.div`
  padding: 8px 0 4px;
  border-bottom: ${({ $withDivider }) => ($withDivider ? "1px solid #edf0f5" : "none")};
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
  background: #e5e7eb;
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
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const WinRatePill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 10px;
`;

const TeamHeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TogglePlayersBtn = styled.button`
  border: none;
  background: #f3f4f6;
  color: #111827;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
`;

const LineupBox = styled.div`
  margin-top: 10px;
  padding: 10px 10px;
  border-radius: 14px;
  background: #f9fafb;
  border: 1px solid #eef2f7;
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
  color: #6b7280;
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
    border-top: 1px solid #eef2f7;
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
  background: #e5e7eb;
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
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
  white-space: nowrap;
`;

const VsDivider = styled.div`
  padding: 6px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2563eb;
`;

const SectionCard = styled.div`
  background: #ffffff;
  border-radius: 22px;
  padding: 14px 14px 16px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SectionTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const SectionIcon = styled.span`
  font-size: 16px;
`;

const MapBox = styled.div`
  margin-top: 4px;
  width: 100%;
  height: 140px;
  border-radius: 14px;
  overflow: hidden;
  background: #e5e7eb;
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
  background: #111827;
  color: #ffffff;
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 999px;
  cursor: pointer;
`;

const DateTimeRow = styled.div`
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TimeInput = styled.input.attrs({ type: "time" })`
  width: 120px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  padding: 8px 10px;
  font-size: 13px;
  color: #111827;
  background: #f9fafb;
`;

const DateValue = styled.div`
  margin-top: 2px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const CalendarWrap = styled.div`
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
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
  color: #111827;
`;

const MonthNavButton = styled.button`
  border: none;
  background: transparent;
  font-size: 16px;
  line-height: 1;
  padding: 4px;
  cursor: pointer;
  color: #6b7280;
`;

const WeekRow = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  font-size: 11px;
  color: #9ca3af;
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

  ${({ $isToday, $isSelected }) => {
    if ($isSelected) {
      return `
        background:#2563eb;
        color:#ffffff;
      `;
    }
    if ($isToday) {
      return `
        border:1px solid #2563eb;
        color:#2563eb;
      `;
    }
    return `
      color:#111827;
    `;
  }}
`;

const NoticeText = styled.div`
  margin: 4px 10px 0;
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
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
  background: ${({ theme, disabled }) => (disabled ? "#cbd5f5" : theme.colors.primary || "#2563eb")};
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
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
  font-size: 13px;
  cursor: pointer;
`;

const MutedButton = styled.button`
  width: 100%;
  padding: 10px 0;
  border-radius: 999px;
  border: none;
  background: #f3f4f6;
  color: #111827;
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
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const ScoreInput = styled.input`
  width: 100%;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 10px 12px;
  font-size: 16px;
  text-align: center;
`;

const ScoreSeparator = styled.div`
  font-size: 18px;
  color: #6b7280;
`;

const ResultStatusText = styled.div`
  margin-top: 8px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
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

  ${({ variant }) =>
    variant === "primary"
      ? `
    background:#2563eb;
    color:#ffffff;
  `
      : `
    background:#f3f4f6;
    color:#4b5563;
  `}
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 84px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 10px 12px;
  font-size: 13px;
  background: #ffffff;
  outline: none;
  resize: none;

  &:focus {
    border-color: #2563eb;
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
  border-radius: 14px;
  overflow: hidden;
  background: #e5e7eb;
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
  background: rgba(15, 23, 42, 0.7);
  color: #ffffff;
  cursor: pointer;
`;

const PhotoAdd = styled.button`
  width: 74px;
  height: 74px;
  border-radius: 14px;
  border: 1px dashed #d1d5db;
  background: #ffffff;
  flex: 0 0 auto;
  cursor: pointer;
  display: grid;
  place-items: center;
  color: #6b7280;
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

/* ==================== 페이지 ==================== */

export default function MatchRoomDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const { club } = useClub();

  const myClubId = toStr(club?.clubId || club?.id);
  const roomId = toStr(params?.roomId || params?.matchId);

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const [myLineupOpen, setMyLineupOpen] = useState(false);
  const [oppLineupOpen, setOppLineupOpen] = useState(false);

  const [fieldAddress, setFieldAddress] = useState("");
  const [fieldLatLng, setFieldLatLng] = useState(null); // { lat, lng }
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const markerRef = useRef(null);

  const [editMode, setEditMode] = useState(false);
  const initOnceRef = useRef(false);

  // ✅ 결과 입력 UI 상태
  const [myScoreInput, setMyScoreInput] = useState("");
  const [oppScoreInput, setOppScoreInput] = useState("");
  const [resultComment, setResultComment] = useState("");
  const [resultFiles, setResultFiles] = useState([]); // File[]
  const [resultBusy, setResultBusy] = useState(false);

  const fileRef = useRef(null);

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

    // ✅ editMode 초기값
    const st = toStr(room?.status);
    const proposer = toStr(room?.proposedByClubId);
    if (st === "accepted") setEditMode(true);
    else if (st === "proposed") setEditMode(!!myClubId && proposer === myClubId);
    else setEditMode(false);

    // ✅ 결과 입력 초기값(confirmed/finished에서)
    if (room.myScore != null) setMyScoreInput(String(room.myScore));
    if (room.oppScore != null) setOppScoreInput(String(room.oppScore));

    const savedComment = toStr(room?.result?.comment);
    if (savedComment) setResultComment(savedComment);
  }, [room, myClubId]);

  // ✅ 지도 초기화
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
        : new kakao.maps.LatLng(37.5665, 126.9780);

      const map = new kakao.maps.Map(mapRef.current, { center, level: 4 });
      const marker = new kakao.maps.Marker({ position: center });
      marker.setMap(map);

      mapObjRef.current = map;
      markerRef.current = marker;
    };

    if (typeof kakao.maps.load === "function") kakao.maps.load(runInit);
    else runInit();
  }, [room?.status, fieldLatLng]);

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

  // ✅ 화면용 우리/상대 팀(우리팀 기준)
  const myTeamView = isActor ? room.myTeam : room.oppTeam;
  const oppTeamView = isActor ? room.oppTeam : room.myTeam;

  // ✅ score SSOT는 actor/target로 저장되어 있음
  const actorScoreSaved = room.myScore;
  const targetScoreSaved = room.oppScore;

  const myStats = (myTeamView?.stats || {});
  const oppStats = (oppTeamView?.stats || {});
  const myRecord = `${myStats.wins ?? 0}승 ${myStats.losses ?? 0}패`;
  const oppRecord = `${oppStats.wins ?? 0}승 ${oppStats.losses ?? 0}패`;
  const myWinRate = Math.round((myStats.winRate ?? 0) * 100);
  const oppWinRate = Math.round((oppStats.winRate ?? 0) * 100);

  const myPlayers = Array.isArray((isActor ? room.myLineup?.players : room.oppLineup?.players)) ? (isActor ? room.myLineup.players : room.oppLineup.players).slice(0, 10) : [];
  const oppPlayers = Array.isArray((isActor ? room.oppLineup?.players : room.myLineup?.players)) ? (isActor ? room.oppLineup.players : room.myLineup.players).slice(0, 10) : [];

  const isAdjusting = status === "accepted" || status === "proposed";
  const proposerClubId = toStr(room.proposedByClubId);
  const iAmProposer = !!myClubId && !!proposerClubId && myClubId === proposerClubId;
  const canEdit = status === "accepted" ? true : status === "proposed" ? editMode : false;
  const canConfirm = status === "proposed" && !!myClubId && !iAmProposer;

  const isConfirmed = status === "confirmed";
  const isFinished = status === "finished";
  const isCancelled = status === "cancelled";

  // ✅ 결과 상태
  const resultState = toStr(room.resultState);
  const resultSubmittedBy = toStr(room?.result?.submittedByClubId);
  const iSubmittedResult = !!myClubId && !!resultSubmittedBy && myClubId === resultSubmittedBy;

  const savedPhotoUrls = Array.isArray(room?.result?.photoUrls) ? room.result.photoUrls : [];
  const savedComment = toStr(room?.result?.comment);

  const canSubmitResult = isConfirmed && !resultBusy && !resultState;
  const canAcceptResult = isConfirmed && resultState === "waiting_accept" && !iSubmittedResult && !resultBusy;

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
      navigate(-1);
    } catch (e) {
      window.alert(e?.message || "매칭 취소에 실패했습니다.");
    }
  };

  // ✅ 사진 선택
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

  // ✅ 결과 제출
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

    // ✅ SSOT 변환: actorScore/targetScore로 저장
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

  // ✅ 결과 인정(=status finished + stats 반영)
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
    <PageWrap>
      <Inner>
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

        {/* ✅ 조율중 (accepted/proposed): 지도/시간 */}
        {isAdjusting && (
          <>
            <SectionCard>
              <SectionTitleRow>
                <SectionIcon>🏟️</SectionIcon>
                <span>구장</span>
              </SectionTitleRow>

              <MapBox ref={mapRef} />

              <FieldRow>
                <FieldName>{toStr(fieldAddress) || "구장 주소를 선택해 주세요."}</FieldName>

                {canEdit ? (
                  <FieldEditButton type="button" onClick={openAddressSearch}>
                    수정
                  </FieldEditButton>
                ) : (
                  <FieldEditButton type="button" onClick={() => setEditMode(true)}>
                    수정 제안
                  </FieldEditButton>
                )}
              </FieldRow>
            </SectionCard>

            {canEdit ? (
              <SectionCard>
                <SectionTitleRow>
                  <SectionIcon>📅</SectionIcon>
                  <span>날짜 선택</span>
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
                  <SectionIcon>🕒</SectionIcon>
                  <span>제안된 일정</span>
                </SectionTitleRow>
                <ResultStatusText>{room.scheduledAt ? `${formatKoreanDateTime(room.scheduledAt)} 예정` : "일정 정보가 없습니다."}</ResultStatusText>
              </SectionCard>
            )}
          </>
        )}

        {/* ✅ 확정(confirmed): 일정은 읽기 + 결과 입력 UI */}
        {isConfirmed && (
          <>
            <SectionCard>
              <SectionTitleRow>
                <SectionIcon>✅</SectionIcon>
                <span>확정된 일정</span>
              </SectionTitleRow>
              <ResultStatusText>{room.scheduledAt ? `${formatKoreanDateTime(room.scheduledAt)} 예정` : "일정 정보가 없습니다."}</ResultStatusText>
              <ResultStatusText>{toStr(fieldAddress) ? `구장: ${fieldAddress}` : "구장 정보가 없습니다."}</ResultStatusText>
            </SectionCard>

            <SectionCard>
              <SectionTitleRow>
                <SectionIcon>📊</SectionIcon>
                <span>경기 결과</span>
              </SectionTitleRow>

              {/* 1) 아직 제출 전 */}
              {!resultState && (
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
                      <PhotoAdd type="button" onClick={onPickPhotos}>
                        ＋
                      </PhotoAdd>
                    )}
                  </PhotoRow>

                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={onFilesChanged}
                  />

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

              {/* 2) 승인 대기 */}
              {resultState === "waiting_accept" && (
                <>
                  <ResultScoreRow>
                    <ScoreBlock>
                      <ScoreTeamLabel>actor(제출기준) 점수</ScoreTeamLabel>
                      <ScoreInput value={String(actorScoreSaved ?? "")} disabled />
                    </ScoreBlock>
                    <ScoreSeparator>:</ScoreSeparator>
                    <ScoreBlock>
                      <ScoreTeamLabel>target 점수</ScoreTeamLabel>
                      <ScoreInput value={String(targetScoreSaved ?? "")} disabled />
                    </ScoreBlock>
                  </ResultScoreRow>

                  {savedComment ? <ResultStatusText>코멘트: {savedComment}</ResultStatusText> : null}

                  {savedPhotoUrls.length > 0 ? (
                    <PhotoRow>
                      {savedPhotoUrls.map((url, idx) => (
                        <PhotoThumb key={`${url}-${idx}`}>
                          <PhotoImg src={url} alt="result" />
                        </PhotoThumb>
                      ))}
                    </PhotoRow>
                  ) : null}

                  {iSubmittedResult ? (
                    <ResultStatusText>상대팀 승인을 기다리는 중입니다.</ResultStatusText>
                  ) : (
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
                  )}
                </>
              )}

              {/* 3) 이의 제기 */}
              {resultState === "disputed" && (
                <ResultStatusText>이의 제기 상태입니다. 관리자 검토 후 처리됩니다.</ResultStatusText>
              )}
            </SectionCard>
          </>
        )}

        {/* ✅ finished: 읽기 전용 */}
        {isFinished && (
          <SectionCard>
            <SectionTitleRow>
              <SectionIcon>🏁</SectionIcon>
              <span>확정된 경기 결과</span>
            </SectionTitleRow>
            <ResultStatusText>
              점수: {String(actorScoreSaved ?? "-")} : {String(targetScoreSaved ?? "-")}
            </ResultStatusText>
            {savedComment ? <ResultStatusText>코멘트: {savedComment}</ResultStatusText> : null}
            {savedPhotoUrls.length > 0 ? (
              <PhotoRow>
                {savedPhotoUrls.map((url, idx) => (
                  <PhotoThumb key={`${url}-${idx}`}>
                    <PhotoImg src={url} alt="result" />
                  </PhotoThumb>
                ))}
              </PhotoRow>
            ) : null}
          </SectionCard>
        )}

        {isCancelled && (
          <SectionCard>
            <SectionTitleRow>
              <SectionIcon>⚠️</SectionIcon>
              <span>취소된 매칭</span>
            </SectionTitleRow>
            <ResultStatusText>이 매칭은 취소 처리되었습니다.</ResultStatusText>
          </SectionCard>
        )}
      </Inner>

      {/* ✅ 하단 액션 */}
      {status === "accepted" && (
        <>
          <NoticeText>제안하면 상대팀이 확인 후 확정할 수 있어요.</NoticeText>
          <ActionsWrap>
            <PrimaryButton
              type="button"
              onClick={handlePropose}
              disabled={!selectedDate || !selectedTime || !toStr(fieldAddress) || !fieldLatLng}
            >
              매칭 일정·장소 제안
            </PrimaryButton>
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
                  <PrimaryButton
                    type="button"
                    onClick={handlePropose}
                    disabled={!selectedDate || !selectedTime || !toStr(fieldAddress) || !fieldLatLng}
                  >
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
    </PageWrap>
  );
}
