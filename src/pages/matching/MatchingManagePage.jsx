/* eslint-disable */
// src/pages/matching/MatchingHomePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate, useLocation } from "react-router-dom";
import { images, teamLogoSrc } from "../../utils/imageAssets";
import Spinner from "../../components/common/Spinner";
import InfoDialog from "../../components/common/InfoDialog";

import { useClub } from "../../hooks/useClub";
import { useAuth } from "../../hooks/useAuth";
import { listMatchInboxForClub } from "../../services/matchingInboxService";
import {
  acceptMatchRequest,
  rejectMatchRequest,
  cancelMatchRequest,
} from "../../services/matchingService";
import { fetchLineupRosterProfiles } from "../../services/lineupRosterService";
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
    return [{ type: "cancel", label: "요청 취소" }];
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
    stateLabel = direction === "sent" ? "상대 거부" : "내가 거부";
    tone = "danger";
  } else if (phase === "cancelled") {
    stateLabel = direction === "sent" ? "내가 취소" : "상대 취소";
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
  margin: 0 auto 80px;
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
  width: 100%;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "#eef2f7"};
  box-shadow: ${({ theme }) => theme.shadows.card};
  overflow: hidden;
  padding: 0px 10px;
`;

const CardInner = styled.div`
  padding: 14px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  justify-content: flex-end;
  flex-wrap: wrap;
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
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 13px;
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
  font-size: 15px;
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
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ $variant, theme }) =>
    $variant === "accept"
      ? theme.colors.primary
      : theme.mode === "dark"
      ? theme.colors.surface
      : "#ffffff"};
  color: ${({ $variant, theme }) =>
    $variant === "accept" ? "#ffffff" : theme.colors.textStrong};
  ${({ $variant }) => ($variant === "accept" ? "border-color: transparent;" : "")}

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
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;

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

  const { club } = useClub();
  const myClubId = toStr(club?.clubId || club?.id);

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

  // ✅ 수락 완료 안내 (매칭룸으로 이동 유도)
  const [acceptDoneOpen, setAcceptDoneOpen] = useState(false);
  const [acceptDoneMatchId, setAcceptDoneMatchId] = useState("");
  const [acceptDoneOppName, setAcceptDoneOppName] = useState("");

  const reload = async () => {
    if (!myClubId) {
      setItems([]);
      setErr("팀 정보를 확인할 수 없습니다.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErr("");
      const list = await listMatchInboxForClub({ clubId: myClubId, limitCount: 300 });
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr("매칭 정보를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myClubId]);

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
      alert("매칭 정보를 확인할 수 없습니다.");
      return;
    }

    const key = `${action.type}:${matchId}`;
    if (busyKey) return;

    try {
      setBusyKey(key);

      if (action.type === "accept") {
        await acceptMatchRequest({ myClubId, latestNoti: latest });
        await reload();

        const opp = row?.opponentSnapshot || {};
        const oppName = toStr(opp?.name) || "상대 팀";

        setAcceptDoneMatchId(matchId);
        setAcceptDoneOppName(oppName);
        setAcceptDoneOpen(true);
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
      alert(e?.message || "처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
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

  const closeAcceptDone = () => {
    setAcceptDoneOpen(false);
    setAcceptDoneMatchId("");
    setAcceptDoneOppName("");
  };

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
              취소 제안 <TabCount>({closedCount})</TabCount>
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
            text={
              activeTab === "closed"
                ? "취소되거나 거부된 제안이 없습니다."
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

              const ts = row.timestamp ? formatDateTime(row.timestamp) : "";
              const badgeMeta = getMatchBadgeMeta(row);

              const actions =
                activeTab === "closed"
                  ? []
                  : getActionsByPhase({ direction: row.direction, phase: row.phase });

              const isSentTab = activeTab === "sent";

              const headerTitle =
                row.direction === "received"
                  ? `${oppName}에서 제안`
                  : row.direction === "sent"
                  ? `${oppName}에 제안`
                  : `${oppName}`;

              return (
                <ItemCard key={row.matchId || latest?.matchId || row.opponentClubId}>
                  <CardInner>
                    <CardHeader>
                      <HeaderLeft>
                        <HeaderTitle title={headerTitle}>{headerTitle}</HeaderTitle>

                        <TeamInfoCell onClick={() => handleTeamClick(row.opponentClubId)}>
                          <LogoWrap>
                            <LogoImg src={logoSrc} alt={oppName} />
                          </LogoWrap>
                          <TeamTexts>
                            <TeamName>{oppName}</TeamName>
                            <TeamRegion>{oppRegion || "지역 미등록"}</TeamRegion>
                          </TeamTexts>
                        </TeamInfoCell>
                      </HeaderLeft>

                      <HeaderRight>
                        <BadgeRow>
                          <Badge $tone={badgeMeta.tone}>
                            {badgeMeta.stateLabel}
                          </Badge>
                        </BadgeRow>
                        {ts ? <BadgeTime>{ts}</BadgeTime> : <div />}
                      </HeaderRight>
                    </CardHeader>

                    <Divider />

                    <LineupTextRow>
                      <LineupText>
                        {(() => {
                          const sz = toStr(latest?.matchSizeKey);
                          const szLabel = ["3v3", "4v4", "5v5"].includes(sz)
                            ? sz.replace("v", " vs ")
                            : "";
                          return szLabel
                            ? `${szLabel} 매칭 · 라인업은 매칭룸에서 확정해요`
                            : "라인업은 매칭룸에서 확정해요";
                        })()}
                      </LineupText>
                    </LineupTextRow>

                    {actions.length > 0 && (
                      <ActionRow $align={isSentTab ? "right" : "stretch"}>
                        {isSentTab && actions.length === 1 && actions[0].type === "cancel" ? (
                          <CancelButton
                            type="button"
                            onClick={() => handleAction(row, actions[0])}
                            disabled={busyKey === `cancel:${toStr(latest?.matchId)}`}
                          >
                            {busyKey === `cancel:${toStr(latest?.matchId)}` ? "처리중..." : "요청 취소"}
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
                  </CardInner>
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

      <InfoDialog
        open={acceptDoneOpen}
        tone="success"
        title="매칭이 수락됐어요"
        message={`이제 매칭룸에서\n일정과 내용을 확정할 수 있습니다.\n\n상대팀: ${acceptDoneOppName || "상대 팀"}`}
        primaryText="매칭룸으로 이동"
        onPrimary={() => {
        closeAcceptDone();
        nav("/match-roomlist");
        }}
        secondaryText="나중에"
        onClose={closeAcceptDone}
        hideSecondary={false}
        showClose={true}
        closeOnOverlay={false}
      />
    </Page>
  );
}
