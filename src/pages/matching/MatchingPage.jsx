// src/pages/matching/MatchingPage.jsx
/* eslint-disable */
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

import { images, playerAvatars } from "../../utils/imageAssets";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";
import { useClubContext } from "../../context/ClubContext";
import PositionChip from "../../components/common/PositionChip";
import RegionPickerSheet from "../../components/common/RegionPickerSheet";
import { upsertClubLineup, deleteClubLineup } from "../../services/lineupService";

import AiRecommendedTeamsSection from "./components/AiRecommendedTeamsSection";
import TeamOpponentListSection from "./components/TeamOpponentListSection";
import Spinner from "../../components/common/Spinner";
import { useMatchingData } from "../../hooks/useMatchingData";
import { useAuth } from "../../hooks/useAuth";

/* ==================== 상수/헬퍼 ==================== */

const MATCH_SIZES = [
  { key: "3v3", label: "3 vs 3", size: 3 },
  { key: "4v4", label: "4 vs 4", size: 4 },
  { key: "5v5", label: "5 vs 5", size: 5 },
];

const POSITION_LABEL = { guard: "가드", forward: "포워드", center: "센터" };
const SKILL_LABEL = {
  beginner: "입문",
  amateur: "아마추어",
  intermediate: "중급",
  advanced: "중급",
  pro: "프로",
};

function needCountByKey(key) {
  if (key === "5v5") return 5;
  if (key === "4v4") return 4;
  if (key === "3v3") return 3;
  return 5;
}

function pickDefaultMatchKeyByCount(count) {
  if (count >= 5) return "5v5";
  if (count === 4) return "4v4";
  if (count === 3) return "3v3";
  return "";
}

function pickMatchSizeByKey(key) {
  return MATCH_SIZES.find((m) => m.key === key) || MATCH_SIZES[2];
}

function defaultLineupName(teamName, key) {
  const base = String(teamName || "우리팀").trim() || "우리팀";
  if (key === "5v5") return `${base} 5:5 라인업`;
  if (key === "4v4") return `${base} 4:4 라인업`;
  if (key === "3v3") return `${base} 3:3 라인업`;
  return `${base} 라인업`;
}

function countAppliedFilters(f) {
  if (!f) return 0;
  let c = 0;
  if (f.position) c += 1;
  if (f.skill) c += 1;
  if (f.winRate && f.winRate !== "any") c += 1;
  if (f.regionSido && f.regionSido !== "all") c += 1;
  if (f.regionGu && f.regionGu !== "all") c += 1;
  return c;
}

function toNum(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function calcWinRatePercentFromTeam(t) {
  const wins = toNum(t?.stats?.wins ?? t?.wins, 0);
  const losses = toNum(t?.stats?.losses ?? t?.losses, 0);
  const draws = toNum(t?.stats?.draws ?? t?.draws, 0);
  const total = wins + losses + draws;
  if (total <= 0) return 0;
  return Math.round((wins / total) * 100);
}

function safeStr(v) {
  return String(v || "").trim();
}

function buildRegionLabelFromValue(v) {
  const s = safeStr(v?.sido);
  const g = safeStr(v?.gu);
  const merged = `${s} ${g}`.trim();
  return merged;
}

function parseRegionLabelToValue(label) {
  const x = safeStr(label);
  if (!x) return { sido: "", gu: "" };
  const parts = x.split(" ").filter(Boolean);
  if (parts.length <= 1) return { sido: parts[0] || "", gu: "" };
  return { sido: parts[0] || "", gu: parts.slice(1).join(" ") || "" };
}

/* ==================== Styled ==================== */

const Wrap = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 16px 10px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Inner = styled.div`
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const LoadingCenter = styled.div`
  flex: 1;
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const MyLineupSection = styled.section`
  padding: 0 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const MyLineupHeaderRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MyLineupTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
`;

const MyLineupSub = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const MyLineupListRow = styled.div`
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const LineupCard = styled.button`
  flex: 1 1 calc(50% - 8px);
  min-width: 0;
  border-radius: 8px;
  padding: 10px 12px;
  border: 1px solid
    ${({ "data-active": active, theme }) =>
      active ? theme.colors.primary : theme.colors.border};
  background: ${({ "data-active": active, theme }) =>
    active
      ? theme.mode === "dark"
        ? "rgba(99,102,241,0.18)"
        : "rgba(59,130,246,0.12)"
      : theme.mode === "dark"
        ? theme.colors.surface
        : "#f5f7ff"};
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  cursor: pointer;
  position: relative;
  box-shadow: ${({ "data-active": active, theme }) =>
    active ? theme.shadows.card : "none"};
`;

const LineupDeleteBtn = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const LineupName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const LineupMeta = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const LineupMetaSmall = styled.div`
  margin-top: 2px;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const NewLineupCard = styled.button`
  flex: 1 1 calc(50% - 8px);
  min-width: 0;
  border-radius: 8px;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
`;

const NewLineupPlus = styled.span`
  font-size: 18px;
  line-height: 1;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const NewLineupText = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const InfoWarn = styled.div`
  padding: 0 16px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.danger};
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0,0,0,0.65)" : "rgba(15, 23, 42, 0.35)"};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
`;

const ModalCard = styled.div`
  width: 94%;
  max-width: 420px;
  max-height: 90vh;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 16px 16px 20px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const LineupNameInput = styled.input`
  flex: 1;
  border: none;
  background: transparent;
  font-size: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  padding: 0;
  margin: 0;
  outline: none;
`;

const ModalClose = styled.button`
  border: none;
  background: none;
  font-size: 18px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const BlockTitle = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const BlockRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const SegBtn = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ "data-active": a, theme }) =>
    a
      ? theme.mode === "dark"
        ? "rgba(99,102,241,0.18)"
        : "rgba(59,130,246,0.12)"
      : theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 12px;
  cursor: pointer;
`;

const MemberPickBtn = styled.button`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
`;

const MemberPickHint = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const MemberPreviewRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const MemberChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
`;

const Avatar = styled.div`
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? "rgba(255,255,255,0.06)"
      : "rgba(15, 23, 42, 0.06)"};
  overflow: hidden;
  flex: 0 0 26px;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

const MemberName = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const MemberPos = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const RegionBtn = styled.button`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const RegionText = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const RegionHint = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ModalFooter = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 4px;
`;

const GhostBtn = styled.button`
  flex: 1;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  padding: 12px 14px;
  font-size: 13px;
  cursor: pointer;
`;

const PrimaryBtn = styled.button`
  flex: 1;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  padding: 12px 14px;
  font-size: 13px;
  cursor: pointer;
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
`;

const MemberList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const MemberRow = styled.button`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ "data-selected": s, theme }) =>
    s
      ? theme.mode === "dark"
        ? "rgba(99,102,241,0.18)"
        : "rgba(59,130,246,0.10)"
      : theme.colors.card};
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  text-align: left;
`;

const CheckDot = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid ${({ theme }) => theme.colors.border};
  background: ${({ "data-on": on, theme }) =>
    on ? theme.colors.primary : theme.colors.card};
`;

const MemberRowMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const MemberRowName = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const MemberRowSub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const StateWrap = styled.div`
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* ==================== 컴포넌트 ==================== */

export default function MatchingPage() {
  const navigate = useNavigate();
  const { firebaseUser, userDoc } = useAuth();
  const { activeTeamId, loading: clubLoading } = useClubContext();

  const {
    myTeam,
    opponentTeams,
    loading: matchingLoading,
    preloadMatchingHomeData,
    matches,
  } = useMatchingData();

  const [lineups, setLineups] = useState([]);
  const [activeLineupId, setActiveLineupId] = useState(null);

  const [showLineupModal, setShowLineupModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showRegionSheet, setShowRegionSheet] = useState(false);

  const [lineupNameDraft, setLineupNameDraft] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [matchSize, setMatchSize] = useState(MATCH_SIZES[2]);
  const [regionValue, setRegionValue] = useState({ sido: "", gu: "" });

  const [draftLineup, setDraftLineup] = useState(null);
  const [lineupBlockedMsg, setLineupBlockedMsg] = useState("");

  const [teamQ, setTeamQ] = useState("");
  const [filters, setFilters] = useState({
    position: "",
    skill: "",
    winRate: "any",
    regionSido: "all",
    regionGu: "all",
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(filters);

  const [deleteBusyId, setDeleteBusyId] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    if (clubLoading) return;
    if (!activeTeamId) return;
    preloadMatchingHomeData(activeTeamId).catch(() => {});
  }, [clubLoading, activeTeamId, preloadMatchingHomeData]);

  const appliedCount = useMemo(() => countAppliedFilters(filters), [filters]);

  const filteredOpponentTeams = useMemo(() => {
    const base = Array.isArray(opponentTeams) ? opponentTeams : [];
    const qText = String(teamQ || "").trim().toLowerCase();

    const searched = qText
      ? base.filter((t) => {
          const name = String(t?.name || "").toLowerCase();
          const region = String(t?.region || "").toLowerCase();
          const region2 = `${String(t?.regionSido || "").trim()} ${String(t?.regionGu || "").trim()}`
            .trim()
            .toLowerCase();
          return name.includes(qText) || region.includes(qText) || region2.includes(qText);
        })
      : base;

    return searched.filter((t) => {
      const winRate = calcWinRatePercentFromTeam(t);
      if (filters.winRate === "70" && winRate < 70) return false;
      if (filters.winRate === "50" && winRate < 50) return false;

      if (filters.regionSido && filters.regionSido !== "all") {
        const tSido = String(t?.regionSido || "").trim();
        if (tSido !== filters.regionSido) return false;
        if (filters.regionGu && filters.regionGu !== "all") {
          const tGu = String(t?.regionGu || "").trim();
          if (tGu !== filters.regionGu) return false;
        }
      }

      if (filters.position) {
        const tags = Array.isArray(t?.positionTags) ? t.positionTags : [];
        if (tags.length > 0 && !tags.includes(filters.position)) return false;
      }

      if (filters.skill) {
        const tags = Array.isArray(t?.skillTags) ? t.skillTags : [];
        if (tags.length > 0 && !tags.includes(filters.skill)) return false;
      }
      return true;
    });
  }, [opponentTeams, teamQ, filters]);

  const myMembers = useMemo(() => (myTeam?.members ? myTeam.members : []), [myTeam]);
  const memberCount = myMembers.length;

  const activeLineup = useMemo(
    () => lineups.find((l) => l.id === activeLineupId) || null,
    [lineups, activeLineupId]
  );

  const isCaptain = useMemo(() => {
    const isFlag = userDoc?.isTeamCaptain === true || userDoc?.isCaptain === true;
    const myClubId = String(userDoc?.clubId || userDoc?.activeTeamId || "").trim();
    const currentClubId = String(activeTeamId || "").trim();
    if (!currentClubId) return false;
    return isFlag && myClubId === currentClubId;
  }, [userDoc, activeTeamId]);

  const blockedLineupIdSet = useMemo(() => {
    const set = new Set();
    const list = Array.isArray(matches) ? matches : [];

    for (const m of list) {
      const status = String(m?.status || m?.phase || "").toLowerCase();
      const active = status === "pending" || status === "confirmed";
      if (!active) continue;

      const lid =
        String(m?.lineupId || "").trim() ||
        String(m?.myLineupId || "").trim() ||
        String(m?.homeLineupId || "").trim() ||
        "";

      if (lid) set.add(lid);
    }
    return set;
  }, [matches]);

  useEffect(() => {
    if (!myTeam) return;

    if (memberCount < 3) {
      setLineupBlockedMsg("라인업을 구성할 수 없습니다. 먼저 팀원을 확보해주세요.");
      setLineups([]);
      setActiveLineupId(null);
      return;
    }

    setLineupBlockedMsg("");

    const real = Array.isArray(myTeam.lineups) ? myTeam.lineups : [];
    if (real.length > 0) {
      const mapped = real.map((l, idx) => ({
        id: String(l.id || `lu-${idx}`),
        name: String(l.name || "라인업").trim() || "라인업",
        memberIds: Array.isArray(l.memberIds) ? l.memberIds : [],
        regionLabel: String(l.regionLabel || "").trim(),
        matchSizeKey: String(l.matchSizeKey || "5v5"),
        isVirtual: false,
      }));
      setLineups(mapped);
      setActiveLineupId(mapped[0]?.id || null);
      return;
    }

    const key = pickDefaultMatchKeyByCount(memberCount);
    const need = needCountByKey(key);
    const ids = myMembers.map((m) => m.userId).filter(Boolean).slice(0, need);

    const v = [
      {
        id: "lu_virtual_default",
        name: defaultLineupName(myTeam?.name || "", key),
        memberIds: ids,
        regionLabel: "",
        matchSizeKey: key,
        isVirtual: true,
      },
    ];
    setLineups(v);
    setActiveLineupId(v[0].id);
  }, [myTeam, memberCount, myMembers]);

  const handleDeleteLineup = async (lu, e) => {
    if (e) e.stopPropagation();
    if (!activeTeamId) return;
    if (!lu?.id) return;

    if (!isCaptain) {
      alert("팀장만 라인업을 삭제할 수 있습니다.");
      return;
    }

    if (lu.isVirtual) return;

    if (blockedLineupIdSet.has(String(lu.id))) {
      alert("진행 중이거나 예정된 경기에서 사용 중인 라인업은 삭제할 수 없습니다.");
      return;
    }

    const ok = window.confirm(`"${lu.name}" 라인업을 삭제할까요?\n삭제하면 복구할 수 없습니다.`);
    if (!ok) return;

    try {
      setDeleteBusyId(String(lu.id));
      const res = await deleteClubLineup({
        clubId: activeTeamId,
        lineupId: String(lu.id),
      });

      const nextLineups = Array.isArray(res?.lineups) ? res.lineups : [];
      const mapped = nextLineups.map((l, idx) => ({
        id: String(l.id || `lu-${idx}`),
        name: String(l.name || "라인업").trim() || "라인업",
        memberIds: Array.isArray(l.memberIds) ? l.memberIds : [],
        regionLabel: String(l.regionLabel || "").trim(),
        matchSizeKey: String(l.matchSizeKey || "5v5"),
        isVirtual: false,
      }));

      setLineups(mapped);

      if (String(activeLineupId) === String(lu.id)) {
        setActiveLineupId(mapped[0]?.id || null);
      }
    } catch (e2) {
      alert(e2?.message || "라인업 삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleteBusyId("");
    }
  };

  const handleCreateNewLineup = () => {
    if (lineupBlockedMsg) return alert(lineupBlockedMsg);

    const key = pickDefaultMatchKeyByCount(memberCount) || "5v5";
    const need = needCountByKey(key);
    const baseIds = myMembers.map((m) => m.userId).filter(Boolean).slice(0, need);

    const draftObj = {
      id: `lu_virtual_${Date.now()}`,
      matchSizeKey: key,
      memberIds: baseIds,
      regionLabel: "",
      isVirtual: true,
    };

    setDraftLineup(draftObj);
    setMatchSize(pickMatchSizeByKey(key));
    setSelectedMemberIds(baseIds);
    setRegionValue({ sido: "", gu: "" });
    setLineupNameDraft("");
    setShowLineupModal(true);
  };

  const openLineupEditor = (lu) => {
    if (lineupBlockedMsg) return alert(lineupBlockedMsg);

    const key = safeStr(lu?.matchSizeKey) || "5v5";
    const ids = Array.isArray(lu?.memberIds) ? lu.memberIds.map(safeStr).filter(Boolean) : [];
    const name = safeStr(lu?.name);
    const regionLabel = safeStr(lu?.regionLabel);

    setDraftLineup(lu || null);
    setActiveLineupId(lu?.id || null);
    setMatchSize(pickMatchSizeByKey(key));
    setSelectedMemberIds(ids.slice(0, needCountByKey(key)));
    setLineupNameDraft(name);
    setRegionValue(parseRegionLabelToValue(regionLabel));
    setShowLineupModal(true);
  };

  const needCount = useMemo(() => needCountByKey(matchSize?.key), [matchSize]);

  useEffect(() => {
    setSelectedMemberIds((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.slice(0, needCount);
    });
  }, [needCount]);

  const selectedMembers = useMemo(() => {
    const set = new Set((selectedMemberIds || []).map((x) => safeStr(x)).filter(Boolean));
    const base = Array.isArray(myMembers) ? myMembers : [];
    return base.filter((m) => set.has(safeStr(m?.userId || m?.uid || m?.id)));
  }, [myMembers, selectedMemberIds]);

  const handleToggleMember = (uid) => {
    const id = safeStr(uid);
    if (!id) return;

    setSelectedMemberIds((prev) => {
      const arr = Array.isArray(prev) ? prev.slice() : [];
      const idx = arr.findIndex((x) => safeStr(x) === id);

      if (idx >= 0) {
        arr.splice(idx, 1);
        return arr;
      }

      if (arr.length >= needCount) {
        alert(`현재 ${matchSize?.label || ""} 라인업은 최대 ${needCount}명까지 선택할 수 있어요.`);
        return arr;
      }

      arr.push(id);
      return arr;
    });
  };

  const closeLineupModal = () => {
    setShowLineupModal(false);
    setShowMemberModal(false);
    setShowRegionSheet(false);
    setSaveBusy(false);
  };

  const handlePickRegion = (next) => {
    const v = next && typeof next === "object" ? next : { sido: "", gu: "" };
    setRegionValue({ sido: safeStr(v.sido), gu: safeStr(v.gu) });
    setShowRegionSheet(false);
  };

  const handleSaveLineup = async () => {
    if (!activeTeamId) return;
    if (saveBusy) return;

    const msKey = safeStr(matchSize?.key) || "5v5";
    const need = needCountByKey(msKey);

    const ids = (selectedMemberIds || []).map(safeStr).filter(Boolean);
    if (ids.length !== need) {
      alert(`${matchSize?.label || ""} 라인업은 ${need}명을 정확히 선택해야 저장할 수 있습니다.`);
      return;
    }

    // ✅ 이름이 비어있으면 저장 금지 (기본값 자동 주입 제거)
    const nameInput = safeStr(lineupNameDraft);
    if (!nameInput) {
      alert("라인업 이름을 입력해주세요.");
      return;
    }

    const regionLabel = buildRegionLabelFromValue(regionValue);

    const isVirtual = !!draftLineup?.isVirtual || String(draftLineup?.id || "") === "lu_virtual_default";

    const draft = {
      id: isVirtual ? "" : safeStr(draftLineup?.id || activeLineupId),
      name: nameInput,
      matchSizeKey: msKey,
      memberIds: ids.slice(0, need),
      regionLabel: regionLabel,
    };

    try {
      setSaveBusy(true);

      const res = await upsertClubLineup({
        clubId: activeTeamId,
        lineupDraft: draft,
        teamName: myTeam?.name || "",
      });

      const nextLineups = Array.isArray(res?.lineups) ? res.lineups : [];
      const mapped = nextLineups.map((l, idx) => ({
        id: String(l.id || `lu-${idx}`),
        name: String(l.name || "라인업").trim() || "라인업",
        memberIds: Array.isArray(l.memberIds) ? l.memberIds : [],
        regionLabel: String(l.regionLabel || "").trim(),
        matchSizeKey: String(l.matchSizeKey || "5v5"),
        isVirtual: false,
      }));

      setLineups(mapped);
      setActiveLineupId(res?.lineup?.id || mapped[0]?.id || null);
      setDraftLineup(null);
      setShowLineupModal(false);
    } catch (e) {
      alert(e?.message || "라인업 저장 중 오류가 발생했습니다.");
    } finally {
      setSaveBusy(false);
    }
  };

  if (clubLoading) {
    return (
      <Wrap>
        <LoadingCenter>
          <Spinner />
        </LoadingCenter>
      </Wrap>
    );
  }

  if (!activeTeamId) {
    return (
      <Wrap>
        <LoadingCenter>
          <Spinner />
        </LoadingCenter>
      </Wrap>
    );
  }

  if (matchingLoading || !myTeam) {
    return (
      <Wrap>
        <LoadingCenter>
          <Spinner />
        </LoadingCenter>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <MyLineupSection>
        <MyLineupHeaderRow>
          <MyLineupTitle>나의 라인업</MyLineupTitle>
          <MyLineupSub>
            자주 쓰는 스쿼드를 라인업으로 저장해 두고, 아래에서 상대 팀을 골라 매칭을 신청해 보세요.
          </MyLineupSub>
        </MyLineupHeaderRow>

        <MyLineupListRow>
          {lineups.map((lu) => {
            const memberCnt = (lu.memberIds || []).length;
            const sizeLabel = MATCH_SIZES.find((m) => m.key === lu.matchSizeKey)?.label || "";
            const canShowDelete = isCaptain && !lu.isVirtual;

            return (
              <LineupCard
                key={lu.id}
                type="button"
                data-active={lu.id === activeLineupId}
                onClick={() => openLineupEditor(lu)}
              >
                {canShowDelete ? (
                  <LineupDeleteBtn
                    type="button"
                    aria-label="라인업 삭제"
                    title="라인업 삭제"
                    onClick={(e) => handleDeleteLineup(lu, e)}
                    disabled={deleteBusyId === String(lu.id)}
                  >
                    ×
                  </LineupDeleteBtn>
                ) : null}

                <LineupName>{lu.name}</LineupName>
                <LineupMeta>
                  {memberCnt}명
                  {sizeLabel && ` · ${sizeLabel}`}
                </LineupMeta>
                {lu.regionLabel ? <LineupMetaSmall>{lu.regionLabel}</LineupMetaSmall> : null}
              </LineupCard>
            );
          })}

          <NewLineupCard type="button" onClick={handleCreateNewLineup}>
            <NewLineupPlus>＋</NewLineupPlus>
            <NewLineupText>새 라인업 만들기</NewLineupText>
          </NewLineupCard>
        </MyLineupListRow>
      </MyLineupSection>

      {lineupBlockedMsg ? <InfoWarn>{lineupBlockedMsg}</InfoWarn> : null}

      <Inner>
        <AiRecommendedTeamsSection
          myTeam={myTeam}
          opponentTeams={opponentTeams}
          onOpenAnalysis={(opponentClubId) => {
            navigate(`/matching/analysis/${opponentClubId}`);
          }}
        />

        <TeamOpponentListSection
          teams={filteredOpponentTeams}
          teamQ={teamQ}
          setTeamQ={setTeamQ}
          appliedCount={appliedCount}
          filters={filters}
          setFilters={setFilters}
          draft={draft}
          setDraft={setDraft}
          sheetOpen={sheetOpen}
          setSheetOpen={setSheetOpen}
          onTeamClick={(clubId) => navigate(`/team/${clubId}`)}
        />
      </Inner>

      {showLineupModal ? (
        <Overlay onClick={closeLineupModal}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <LineupNameInput
                value={lineupNameDraft}
                onChange={(e) => setLineupNameDraft(e.target.value)}
                placeholder="라인업 이름"
              />
              <ModalClose type="button" onClick={closeLineupModal} aria-label="닫기">
                ×
              </ModalClose>
            </ModalHeader>

            <ModalBody>
              <BlockTitle>매치 인원</BlockTitle>
              <BlockRow>
                {MATCH_SIZES.map((m) => (
                  <SegBtn
                    key={m.key}
                    type="button"
                    data-active={m.key === matchSize?.key}
                    onClick={() => setMatchSize(m)}
                  >
                    {m.label}
                  </SegBtn>
                ))}
              </BlockRow>

              <BlockTitle>선수 선택</BlockTitle>
              <MemberPickBtn type="button" onClick={() => setShowMemberModal(true)}>
                <MemberPickHint>
                  {selectedMemberIds.length}/{needCount}명 선택됨
                </MemberPickHint>
                <div>선택하기</div>
              </MemberPickBtn>

              {selectedMembers.length > 0 ? (
                <MemberPreviewRow>
                  {selectedMembers.map((m) => {
                    const uid = safeStr(m?.userId || m?.uid || m?.id);
                    const nickname = safeStr(m?.nickname || m?.name) || "선수";
                    const photoUrl = safeStr(m?.photoUrl || m?.avatarUrl || m?.profileUrl);
                    const pos = safeStr(m?.mainPosition);

                    return (
                      <MemberChip key={uid}>
                        <Avatar>{photoUrl ? <img src={photoUrl} alt="" /> : <AvatarPlaceholder size={26} />}</Avatar>
                        <div>
                          <MemberName>{nickname}</MemberName>
                          <MemberPos>{POSITION_LABEL[pos] || ""}</MemberPos>
                        </div>
                      </MemberChip>
                    );
                  })}
                </MemberPreviewRow>
              ) : (
                <MemberPickHint>아래에서 선수들을 선택해 주세요.</MemberPickHint>
              )}

              <BlockTitle>활동 지역</BlockTitle>
              <RegionBtn type="button" onClick={() => setShowRegionSheet(true)}>
                <div>
                  <RegionText>{buildRegionLabelFromValue(regionValue) || "미선택"}</RegionText>
                  <RegionHint>지역을 선택하면 매칭 품질이 좋아져요</RegionHint>
                </div>
                <div>선택</div>
              </RegionBtn>

              <ModalFooter>
                <GhostBtn type="button" onClick={closeLineupModal}>
                  취소
                </GhostBtn>
                <PrimaryBtn type="button" onClick={handleSaveLineup} disabled={saveBusy}>
                  {saveBusy ? "저장 중..." : "저장"}
                </PrimaryBtn>
              </ModalFooter>
            </ModalBody>
          </ModalCard>
        </Overlay>
      ) : null}

      {showMemberModal ? (
        <Overlay onClick={() => setShowMemberModal(false)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <BlockTitle>
                선수 선택 ({selectedMemberIds.length}/{needCount})
              </BlockTitle>
              <ModalClose type="button" onClick={() => setShowMemberModal(false)} aria-label="닫기">
                ×
              </ModalClose>
            </ModalHeader>

            <MemberList>
              {(myMembers || []).map((m) => {
                const uid = safeStr(m?.userId || m?.uid || m?.id);
                const nickname = safeStr(m?.nickname || m?.name) || "선수";
                const pos = safeStr(m?.mainPosition);
                const photoUrl = safeStr(m?.photoUrl || m?.avatarUrl || m?.profileUrl);
                const selected = (selectedMemberIds || []).some((x) => safeStr(x) === uid);

                return (
                  <MemberRow
                    key={uid}
                    type="button"
                    data-selected={selected}
                    onClick={() => handleToggleMember(uid)}
                  >
                    <CheckDot data-on={selected} />
                    <Avatar>{photoUrl ? <img src={photoUrl} alt="" /> : <AvatarPlaceholder size={26} />}</Avatar>
                    <MemberRowMeta>
                      <MemberRowName>{nickname}</MemberRowName>
                      <MemberRowSub>{POSITION_LABEL[pos] || ""}</MemberRowSub>
                    </MemberRowMeta>
                  </MemberRow>
                );
              })}
            </MemberList>

            <ModalFooter>
              <GhostBtn type="button" onClick={() => setShowMemberModal(false)}>
                닫기
              </GhostBtn>
              <PrimaryBtn type="button" onClick={() => setShowMemberModal(false)} disabled={false}>
                완료
              </PrimaryBtn>
            </ModalFooter>
          </ModalCard>
        </Overlay>
      ) : null}

      <RegionPickerSheet
        open={showRegionSheet}
        onClose={() => setShowRegionSheet(false)}
        value={regionValue}
        onPick={handlePickRegion}
        title="활동지역 선택"
      />
    </Wrap>
  );
}
