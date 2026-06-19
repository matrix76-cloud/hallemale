/* eslint-disable */
// src/pages/matching/MatchRoomListPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";
import { images } from "../../utils/imageAssets";
import { WinChip, DrawChip, LoseChip } from "../../components/common/ResultChip";
import Spinner from "../../components/common/Spinner";
import { loadMatchRoomListPageData, cancelMatchRequest } from "../../services/matchRoomService";
import { useClub } from "../../hooks/useClub";
import EmptyState from "../../components/common/EmptyState";

/* ==================== 헬퍼 ==================== */

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

const getVsStatus = (room) => {
  const { status, scheduledAt, myScore, oppScore } = room || {};

  if (status === "accepted") return { text: "제안 필요", tone: "accepted" };
  if (status === "proposed") return { text: "확정 대기", tone: "proposed" };

  if (status === "confirmed") {
    if (scheduledAt) {
      const label = formatKoreanDateTime(scheduledAt);
      return { text: `${label} 예정`, tone: "confirmed" };
    }
    return { text: "확정됨(시간 미정)", tone: "confirmed" };
  }

  if (status === "finished") {
    const label = scheduledAt ? formatKoreanDate(scheduledAt) : "종료";
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

const getStatsNumbers = (stats) => {
  const s = stats || {};
  const wins = clampNumber(typeof s.wins === "number" ? s.wins : s.totalWins, 0);
  const losses = clampNumber(typeof s.losses === "number" ? s.losses : s.totalLoses, 0);
  const draws = clampNumber(typeof s.draws === "number" ? s.draws : s.totalDraws, 0);

  const total = wins + losses + draws;
  const rawRate = typeof s.winRate === "number" ? s.winRate : total > 0 ? wins / total : 0;
  const pct = Math.max(0, Math.min(100, Math.round(clampNumber(rawRate, 0) * 100)));

  return { wins, losses, draws, winRatePct: pct };
};

const resolveLogoSrc = (team) => {
  const url = toStr(team?.logoUrl || team?.photoUrl);
  if (url) return url;
  return images.logo;
};

const resolveRegionText = (team) => {
  return (
    toStr(team?.region) ||
    toStr(team?.regionText) ||
    toStr(team?.areaText) ||
    toStr(team?.location) ||
    `${toStr(team?.regionSido)} ${toStr(team?.regionGu)}`.trim() ||
    ""
  );
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

const RoomList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 6px;
`;

const RoomCard = styled.div`
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

const MatchHeader = styled.div`
  padding: 10px 14px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const MatchTitle = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
`;

const VsStatusPill = styled.div`
  padding: 7px 12px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "#f3f4f6"};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 13px;
  white-space: nowrap;
`;

const TeamBlock = styled.div`
  padding: 10px 12px 12px;
`;

const LogoArea = styled.div`
  width: 78px;
  display: flex;
  justify-content: center;
`;

const LogoOuter = styled.div`
  position: relative;
  width: 64px;
  height: 64px;
  flex-shrink: 0;
`;

const LogoWrap = styled.div`
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
  border-radius: 8px;
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
`;

const ContentArea = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const TeamNameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
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

const SummaryRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 13px;
`;

const SummaryText = styled.span`
  color: ${({ theme }) => theme.colors.textNormal};
`;

const WinRateBadge = styled.span`
  padding: 3px 8px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99,102,241,0.18)" : "#eef2ff"};
  color: ${({ theme }) =>
    theme.mode === "dark" ? "#a5b4fc" : "#2563eb"};
  font-size: 12px;
`;

const RecentLabel = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const RecentDots = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: nowrap;
  overflow: hidden;
`;

const SoonDot = styled.div`
  width: 14px;
  height: 14px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#d1d5db"};
  border: 1px dashed ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "#cbd5e1"};
  box-sizing: border-box;
`;

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.divider};
  margin: 2px 14px;
`;

const CancelBtn = styled.button`
  margin: 8px 12px 4px;
  width: calc(100% - 24px);
  padding: 10px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border || "#e5e7eb"};
  background: transparent;
  color: ${({ theme }) => (theme.mode === "dark" ? "#fca5a5" : "#dc2626")};
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  &:active {
    opacity: 0.8;
  }
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

const Row = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
`;

/* ==================== 페이지 ==================== */

export default function MatchRoomListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { club } = useClub();
  const myClubId = toStr(club?.clubId || club?.id);

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const cancelledRooms = useMemo(
    () => rooms.filter((r) => r.status === "cancelled").sort(byLatest),
    [rooms]
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

  const renderTeamBlock = ({ team, recent = [], fallbackName = "팀" }) => {
    const name = toStr(team?.name) || fallbackName;
    const regionText = resolveRegionText(team);
    const logoSrc = resolveLogoSrc(team);

    const { wins, losses, draws, winRatePct } = getStatsNumbers(team?.stats);
    const safeRecent = Array.isArray(recent) ? recent : [];

    return (
      <TeamBlock>
        <Row>
          <LogoArea>
            <LogoOuter>
              <LogoWrap>
                <LogoImg src={logoSrc} alt={name} />
              </LogoWrap>
            </LogoOuter>
          </LogoArea>

          <ContentArea>
            <TeamNameRow>
              <TeamName title={name}>{name}</TeamName>
            </TeamNameRow>

            <TeamRegion title={regionText}>{regionText || "지역 미등록"}</TeamRegion>

            <SummaryRow>
              <SummaryText>
                {wins}승 {losses}패 {draws}무
              </SummaryText>
              <WinRateBadge>승률 {winRatePct}%</WinRateBadge>
            </SummaryRow>

            <SummaryRow>
              <RecentLabel>최근 경기기록</RecentLabel>
              <RecentDots>
                {safeRecent.length > 0 ? (
                  safeRecent.slice(0, 5).map((r, idx) => {
                    if (r === "W") return <WinChip key={`${name}-rw-${idx}`} size="sm" />;
                    if (r === "D") return <DrawChip key={`${name}-rd-${idx}`} size="sm" />;
                    return <LoseChip key={`${name}-rl-${idx}`} size="sm" />;
                  })
                ) : (
                  <>
                    <SoonDot />
                    <SoonDot />
                    <SoonDot />
                    <SoonDot />
                    <SoonDot />
                  </>
                )}
              </RecentDots>
            </SummaryRow>
          </ContentArea>
        </Row>
      </TeamBlock>
    );
  };


  const handleCancelRoom = async (e, room) => {
    e.stopPropagation();
    if (!room?.id) return;
    if (!window.confirm("이 확정 경기를 취소할까요? 취소하면 되돌릴 수 없어요.")) return;
    try {
      await cancelMatchRequest({ matchRequestId: room.id });
      // 로컬 상태 즉시 반영 → 취소된 경기로 이동
      setRooms((prev) =>
        prev.map((r) => (r.id === room.id ? { ...r, status: "cancelled" } : r))
      );
    } catch (err) {
      window.alert(err?.message || "경기 취소에 실패했습니다.");
    }
  };

  const renderRoomCard = (room) => {
    const { myTeam, oppTeam } = room || {};
    const { text } = getVsStatus(room);
    // 지난 경기(경기 종료 or finished) = 상태칩·취소버튼 숨김
    const isPast = isEnded(room) || toStr(room?.status) === "finished";
    const canCancel = toStr(room?.status) === "confirmed" && !isPast;

    return (
      <RoomCard key={room.id} onClick={() => handleClickRoom(room.id)} role="button" tabIndex={0}>
        <MatchHeader>
          <MatchTitle>
            {(toStr(myTeam?.name) || "우리팀")} vs {(toStr(oppTeam?.name) || "상대팀")}
          </MatchTitle>
          {!isPast && <VsStatusPill>{text || "일정 조율중"}</VsStatusPill>}
        </MatchHeader>

        {renderTeamBlock({ team: myTeam, recent: room?.myRecent, fallbackName: "우리팀" })}

        <Divider />

        {renderTeamBlock({ team: oppTeam, recent: room?.oppRecent, fallbackName: "상대팀" })}

        {canCancel && (
          <CancelBtn type="button" onClick={(e) => handleCancelRoom(e, room)}>
            경기 취소하기
          </CancelBtn>
        )}
      </RoomCard>
    );
  };

  const listToRender = useMemo(() => {
    if (tab === "adjusting") return adjustingRooms;
    if (tab === "confirmed") return confirmedRooms;
    if (tab === "past") return pastRooms;
    if (tab === "cancelled") return cancelledRooms;
    return [];
  }, [tab, adjustingRooms, confirmedRooms, pastRooms, cancelledRooms]);

  return (
    <PageWrap>
      <Inner>
        <TitleCard>
          <TitleText>{titleText}</TitleText>
          <SubText>{subText}</SubText>
        </TitleCard>

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
                    {cancelledRooms.map((room) => renderRoomCard(room))}
                  </>
                )}
              </RoomList>
            ) : (
              <RoomList>
                {listToRender.length > 0 ? (
                  listToRender.map((room) => renderRoomCard(room))
                ) : (
                  <EmptyState
                    text={
                      tab === "adjusting"
                        ? "조율중인 매칭이 아직 없습니다."
                        : tab === "confirmed"
                        ? "확정된 매칭이 아직 없습니다."
                        : tab === "cancelled"
                        ? "취소된 경기가 없습니다."
                        : "지난 게임 기록이 아직 없습니다."
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
