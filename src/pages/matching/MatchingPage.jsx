// src/pages/matching/MatchingPage.jsx
/* eslint-disable */
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

import { images, playerAvatars } from "../../utils/imageAssets";
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
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
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
  border-radius: 14px;
  padding: 10px 12px;
  border: 1px solid
    ${({ "data-active": active, theme }) =>
      active ? theme.colors.primary : theme.colors.border || "#e5e7eb"};
  background: ${({ "data-active": active }) =>
    active ? "rgba(59,130,246,0.12)" : "#f5f7ff"};
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  cursor: pointer;
  position: relative;
  box-shadow: ${({ "data-active": active }) =>
    active ? "0 8px 20px rgba(15,23,42,0.12)" : "0 3px 10px rgba(15,23,42,0.04)"};
`;

const LineupDeleteBtn = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #ffffff;
  color: #111827;
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
  color: ${({ theme }) => theme.colors.muted || "#4b5563"};
`;

const LineupMetaSmall = styled.div`
  margin-top: 2px;
  font-size: 10px;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
`;

const NewLineupCard = styled.button`
  flex: 1 1 calc(50% - 8px);
  min-width: 0;
  border-radius: 14px;
  border: 1px dashed ${({ theme }) => theme.colors.border || "#d4d4d8"};
  background: #f9fafb;
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
`;

const NewLineupText = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const InfoWarn = styled.div`
  padding: 0 16px;
  font-size: 12px;
  color: #ef4444;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
`;

const ModalCard = styled.div`
  width: 94%;
  max-width: 420px;
  max-height: 90vh;
  background: #ffffff;
  border-radius: 18px;
  padding: 16px 16px 20px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.3);
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
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
`;

/* ... (중략: 형이 준 나머지 스타일/로직은 그대로 두면 됨) */

const StateWrap = styled.div`
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: #6b7280;
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
    // ✅ matches가 없다면 훅에서 추가해줘야 함(아래 계산은 안전하게 처리)
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
  const [filters, setFilters] = useState({ position: "", skill: "", winRate: "any" });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(filters);

  const [deleteBusyId, setDeleteBusyId] = useState("");

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

  // ✅ 팀장만 삭제 가능: ownerUid 기반
  const isCaptain = useMemo(() => {


    // userDoc가 내 users/{uid}라고 가정
    const isFlag = userDoc?.isTeamCaptain === true || userDoc?.isCaptain === true;

    // 이 팀의 팀장인지까지 확인(팀 컨텍스트가 있을 때)
    const myClubId = String(userDoc?.clubId || userDoc?.activeTeamId || "").trim();
    const currentClubId = String(activeTeamId || "").trim();

    if (!currentClubId) return false;

    return isFlag && myClubId === currentClubId;
  }, [userDoc, activeTeamId]);

  // ✅ 진행/예정 경기에서 사용 중인 라인업이면 삭제 금지
  const blockedLineupIdSet = useMemo(() => {
    const set = new Set();
    const list = Array.isArray(matches) ? matches : [];

    // match 구조를 모르는 상태라 "가능한 필드들"을 안전하게 체크
    // - status: pending/confirmed
    // - lineupId: match.lineupId or match.myLineupId or match.homeLineupId
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
    setDraftLineup(null);
    setActiveLineupId(lu.id);
    setShowLineupModal(true);
  };

  // ✅ early return은 hook 이후
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

      {/* 이하: 형이 준 모달/멤버/리전 시트 로직은 그대로 유지 */}
      <RegionPickerSheet
        open={showRegionSheet}
        onClose={() => setShowRegionSheet(false)}
        value={regionValue}
        onPick={() => {}}
        title="활동지역 선택"
      />
    </Wrap>
  );
}
