/* eslint-disable */
// src/pages/matching/MatchRoomListPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { images } from "../../utils/imageAssets";
import { WinChip, DrawChip, LoseChip } from "../../components/common/ResultChip";
import Spinner from "../../components/common/Spinner";
import { loadMatchRoomListPageData } from "../../services/matchRoomService";
import { useClub } from "../../hooks/useClub";

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

  if (status === "accepted") {
    return { text: "제안 필요", tone: "accepted" };
  }

  if (status === "proposed") {
    return { text: "확정 대기", tone: "proposed" };
  }

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

  if (status === "cancelled") {
    return { text: "취소된 매칭", tone: "cancelled" };
  }

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

const TabsWrap = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  width: 100%;
  gap: 6px;
  padding: 6px;
  margin: 5px auto;
  border-radius: 999px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
`;

const TabButton = styled.button`
  min-width: 0;
  border: none;
  border-radius: 999px;
  background: ${({ $active }) => ($active ? "#ffffff" : "transparent")};
  box-shadow: ${({ $active }) => ($active ? "0 6px 16px rgba(15, 23, 42, 0.08)" : "none")};

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 11px 8px;
  cursor: pointer;
  font-family: "GmarketSans";

  color: ${({ $active }) => ($active ? "#111827" : "#6b7280")};
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;

  &:active {
    transform: translateY(1px);
  }
`;

const TabLabel = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  white-space: nowrap;
`;

const TabCount = styled.span`
  font-size: 11px;
  opacity: 0.9;
`;

const RoomList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 6px;
`;

const RoomCard = styled.div`
  width: 100%;
  background: #ffffff;
  border-radius: 18px;
  padding: 6px 0;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  border: 1px solid #eef2f7;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05);
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
  color: #6b7280;
  white-space: nowrap;
`;

const VsStatusPill = styled.div`
  padding: 7px 12px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #111827;
  font-size: 13px;
  font-weight: 600;
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
  background: #f3f4f6;
  border-radius: 14px;
`;

const TeamName = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SectionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const EmptyText = styled.div`
  padding: 32px 4px 0;
  font-size: 13px;
  color: #9ca3af;
  text-align: center;
`;

const Row = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
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

const TeamRegion = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
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
  color: #4b5563;
`;

const WinRateBadge = styled.span`
  padding: 3px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 500;
`;

const RecentLabel = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
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
  background: #d1d5db;
  border: 1px dashed #cbd5e1;
  box-sizing: border-box;
`;

const Divider = styled.div`
  height: 1px;
  background: #eef2f7;
  margin: 2px 14px;
`;

const StateWrap = styled.div`
  padding: 32px 4px;
  display: flex;
  justify-content: center;
`;

/* ==================== 페이지 ==================== */

export default function MatchRoomListPage() {
  const navigate = useNavigate();
  const { club } = useClub();
  const myClubId = toStr(club?.clubId || club?.id);

  const [activeTab, setActiveTab] = useState("adjusting"); // adjusting | confirmed | past
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const adjustingRooms = useMemo(
    () => rooms.filter((r) => r.status === "accepted" || r.status === "proposed"),
    [rooms]
  );

  const confirmedRooms = useMemo(() => rooms.filter((r) => r.status === "confirmed"), [rooms]);

  const pastRooms = useMemo(
    () => rooms.filter((r) => r.status === "finished" || r.status === "cancelled"),
    [rooms]
  );

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

  const renderRoomCard = (room) => {
    const { myTeam, oppTeam } = room || {};
    const { text } = getVsStatus(room);

    return (
      <RoomCard key={room.id} onClick={() => handleClickRoom(room.id)} role="button" tabIndex={0}>
        <MatchHeader>
          <MatchTitle>
            {(toStr(myTeam?.name) || "우리팀")} vs {(toStr(oppTeam?.name) || "상대팀")}
          </MatchTitle>
          <VsStatusPill>{text || "일정 조율중"}</VsStatusPill>
        </MatchHeader>

        {renderTeamBlock({ team: myTeam, recent: room?.myRecent, fallbackName: "우리팀" })}

        <Divider />

        {renderTeamBlock({ team: oppTeam, recent: room?.oppRecent, fallbackName: "상대팀" })}
      </RoomCard>
    );
  };

  const isAdjustingTab = activeTab === "adjusting";
  const isConfirmedTab = activeTab === "confirmed";

  const adjustingCount = adjustingRooms.length;
  const confirmedCount = confirmedRooms.length;
  const pastCount = pastRooms.length;

  return (
    <PageWrap>
      <Inner>
        <TabsWrap>
          <TabButton type="button" $active={isAdjustingTab} onClick={() => setActiveTab("adjusting")}>
            <TabLabel>
              조율중 게임 <TabCount>({adjustingCount})</TabCount>
            </TabLabel>
          </TabButton>

          <TabButton type="button" $active={isConfirmedTab} onClick={() => setActiveTab("confirmed")}>
            <TabLabel>
              확정된 게임 <TabCount>({confirmedCount})</TabCount>
            </TabLabel>
          </TabButton>

          <TabButton type="button" $active={!isAdjustingTab && !isConfirmedTab} onClick={() => setActiveTab("past")}>
            <TabLabel>
              지난 게임 <TabCount>({pastCount})</TabCount>
            </TabLabel>
          </TabButton>
        </TabsWrap>

        {loading ? (
          <StateWrap>
            <Spinner size="lg" />
          </StateWrap>
        ) : (
          <RoomList>
            {activeTab === "adjusting" ? (
              adjustingRooms.length > 0 ? (
                <SectionGroup>{adjustingRooms.map((room) => renderRoomCard(room))}</SectionGroup>
              ) : (
                <EmptyText>조율중인 매칭이 아직 없습니다.</EmptyText>
              )
            ) : activeTab === "confirmed" ? (
              confirmedRooms.length > 0 ? (
                <SectionGroup>{confirmedRooms.map((room) => renderRoomCard(room))}</SectionGroup>
              ) : (
                <EmptyText>확정된 매칭이 아직 없습니다.</EmptyText>
              )
            ) : pastRooms.length > 0 ? (
              <SectionGroup>{pastRooms.map((room) => renderRoomCard(room))}</SectionGroup>
            ) : (
              <EmptyText>지난 게임 기록이 아직 없습니다.</EmptyText>
            )}
          </RoomList>
        )}
      </Inner>
    </PageWrap>
  );
}
