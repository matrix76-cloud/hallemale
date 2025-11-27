// src/pages/matching/MatchRoomListPage.jsx
/* eslint-disable */
import React, { useMemo } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { images, bottomTabIcons } from "../../utils/imageAssets";
import { TEAMS } from "../../mock/teamsMock";

/* ==================== 헬퍼 ==================== */

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
  const { status, scheduledAt, myScore, oppScore } = room;

  if (status === "requesting") {
    return { text: "매칭 신청중", tone: "pending" };
  }

  if (status === "confirmed") {
    if (scheduledAt) {
      const label = formatKoreanDateTime(scheduledAt);
      return { text: `${label} 예정`, tone: "confirmed" };
    }
    return { text: "일정 조율중", tone: "confirmed" };
  }

  if (status === "finished") {
    const label = scheduledAt ? formatKoreanDate(scheduledAt) : "종료";
    if (myScore != null && oppScore != null) {
      const isWin = myScore > oppScore;
      const isDraw = myScore === oppScore;
      const resultWord = isDraw ? "무" : isWin ? "승" : "패";
      return {
        text: `${label} · ${myScore} : ${oppScore} ${resultWord}`,
        tone: "finished",
      };
    }
    return { text: `${label} · 결과 입력 대기`, tone: "finished" };
  }

  if (status === "cancelled") {
    return { text: "취소된 매칭", tone: "cancelled" };
  }

  return { text: "상태 미지정", tone: "default" };
};

// 더미용 최근 5경기 패턴
const RECENT_PATTERNS = [
  ["W", "W", "W", "L", "L"],
  ["W", "W", "L", "W", "L"],
  ["W", "L", "W", "W", "L"],
  ["L", "W", "W", "L", "W"],
];

const getRecentResults = (index) =>
  RECENT_PATTERNS[index % RECENT_PATTERNS.length];

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

const RoomList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top:30px;
`;

const SectionHeader = styled.div`
  padding: 2px 2px 0;
  font-size: 14px;
  font-weight: 700;
  color: #4b5563;
`;

const RoomCard = styled.button`
  width: 100%;
  border: none;
  border-radius: 22px;
  background: #ffffff;
  padding: 12px 14px;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;
`;

/* 팀 정보 (위/아래 공통) */

const TeamRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const TeamLeftWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
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
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const TeamMetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
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

/* 최근 전적 (승승무패패) */

const RecentFormWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
`;

const RecentLabel = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const RecentDotsRow = styled.div`
  display: flex;
  gap: 4px;
`;

const RecentDot = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: #ffffff;

  ${({ result }) => {
    if (result === "W") {
      return `background:#22c55e;`; // 승 - 초록
    }
    if (result === "D") {
      return `background:#9ca3af;`; // 무 - 회색
    }
    return `background:#ef4444;`; // 패 - 빨강
  }}
`;

/* VS + 상태 (중앙) */

const VsCenterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const VsIcon = styled.img`
  width: 40px;
  height: 40px;
  object-fit: contain;
`;

const VsStatusPill = styled.div`
  max-width: 190px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;

  ${({ tone }) => {
    if (tone === "pending") {
      return `
        background: #fef3c7;
        color: #b45309;
      `;
    }
    if (tone === "confirmed") {
      return `
        background: #dcfce7;
        color: #166534;
      `;
    }
    if (tone === "finished") {
      return `
        background: #e5e7eb;
        color: #111827;
      `;
    }
    if (tone === "cancelled") {
      return `
        background: #fee2e2;
        color: #b91c1c;
      `;
    }
    return `
      background: #e5e7eb;
      color: #4b5563;
    `;
  }}
`;

/* ==================== 페이지 컴포넌트 ==================== */

export default function MatchRoomListPage() {
  const navigate = useNavigate();

  // 더미 매칭룸: 내 팀 = TEAMS[0], 나머지 팀들을 상대팀으로 매칭
  const rooms = useMemo(() => {
    const myTeam = TEAMS[0];
    const others = TEAMS.slice(1);

    const statusCycle = ["requesting", "confirmed", "finished", "cancelled"];

    return others.map((opp, idx) => {
      const status = statusCycle[idx % statusCycle.length];

      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + idx + 1);
      baseDate.setHours(16, 0, 0, 0);

      const scheduledAt = baseDate.toISOString();

      let myScore = null;
      let oppScore = null;
      if (status === "finished") {
        myScore = 62;
        oppScore = 57;
      }

      return {
        id: `room-${idx + 1}`,
        myTeam,
        oppTeam: opp,
        status,
        scheduledAt,
        myScore,
        oppScore,
        myRecent: getRecentResults(0),
        oppRecent: getRecentResults(idx + 1),
      };
    });
  }, []);

  // 상태별 그룹
  const pendingRooms = rooms.filter((r) => r.status === "requesting");
  const confirmedRooms = rooms.filter((r) => r.status === "confirmed");
  const pastRooms = rooms.filter(
    (r) => r.status === "finished" || r.status === "cancelled"
  );

  const handleClickRoom = (roomId) => {
    navigate(`/match-room/${roomId}`);
  };

  const vsIconSrc =
    bottomTabIcons?.matching?.active || images.logo || undefined;

  const renderRoomCard = (room, idxForRecent = 0) => {
    const { myTeam, oppTeam } = room;
    const { text, tone } = getVsStatus(room);

    const myStats = myTeam.stats || {};
    const oppStats = oppTeam.stats || {};
    const myRecord = `${myStats.wins ?? 0}승 ${myStats.losses ?? 0}패`;
    const oppRecord = `${oppStats.wins ?? 0}승 ${oppStats.losses ?? 0}패`;
    const myWinRate = Math.round((myStats.winRate ?? 0) * 100);
    const oppWinRate = Math.round((oppStats.winRate ?? 0) * 100);

    const myRecent = room.myRecent || getRecentResults(0);
    const oppRecent = room.oppRecent || getRecentResults(idxForRecent + 1);

    return (
      <RoomCard
        key={room.id}
        type="button"
        onClick={() => handleClickRoom(room.id)}
      >
        {/* 위: 우리 팀 + 최근 5경기 */}
        <TeamRow>
          <TeamLeftWrap>
            <TeamLogoWrap>
              <TeamLogo
                src={images[myTeam.logoKey] || images.logo}
                alt={myTeam.name}
              />
            </TeamLogoWrap>
            <TeamText>
              <TeamName>{myTeam.name}</TeamName>
              <TeamMetaRow>
                <span>{myRecord}</span>
                <WinRatePill>승률 {myWinRate}%</WinRatePill>
              </TeamMetaRow>
            </TeamText>
          </TeamLeftWrap>

          <RecentFormWrap>
            <RecentLabel>최근</RecentLabel>
            <RecentDotsRow>
              {myRecent.map((r, i) => (
                <RecentDot key={i} result={r}>
                  {r === "W" ? "승" : r === "D" ? "무" : "패"}
                </RecentDot>
              ))}
            </RecentDotsRow>
          </RecentFormWrap>
        </TeamRow>

        {/* 가운데: VS 아이콘 + 상태 캡슐 */}
        <VsCenterRow>
          <VsIcon src={vsIconSrc} alt="매칭 VS" />
          <VsStatusPill tone={tone}>{text}</VsStatusPill>
        </VsCenterRow>

        {/* 아래: 상대 팀 + 최근 5경기 */}
        <TeamRow>
          <TeamLeftWrap>
            <TeamLogoWrap>
              <TeamLogo
                src={images[oppTeam.logoKey] || images.logo}
                alt={oppTeam.name}
              />
            </TeamLogoWrap>
            <TeamText>
              <TeamName>{oppTeam.name}</TeamName>
              <TeamMetaRow>
                <span>{oppRecord}</span>
                <WinRatePill>승률 {oppWinRate}%</WinRatePill>
              </TeamMetaRow>
            </TeamText>
          </TeamLeftWrap>

          <RecentFormWrap>
            <RecentLabel>최근</RecentLabel>
            <RecentDotsRow>
              {oppRecent.map((r, i) => (
                <RecentDot key={i} result={r}>
                  {r === "W" ? "승" : r === "D" ? "무" : "패"}
                </RecentDot>
              ))}
            </RecentDotsRow>
          </RecentFormWrap>
        </TeamRow>
      </RoomCard>
    );
  };

  return (
    <PageWrap>
      <Inner>
        <RoomList>
          {pendingRooms.length > 0 && (
            <SectionGroup>
              <SectionHeader>매칭 신청 중인 게임</SectionHeader>
              {pendingRooms.map((room, idx) => renderRoomCard(room, idx))}
            </SectionGroup>
          )}

          {confirmedRooms.length > 0 && (
            <SectionGroup>
              <SectionHeader>매칭 확정된 게임</SectionHeader>
              {confirmedRooms.map((room, idx) => renderRoomCard(room, idx))}
            </SectionGroup>
          )}

          {pastRooms.length > 0 && (
            <SectionGroup>
              <SectionHeader>이미 지난 게임</SectionHeader>
              {pastRooms.map((room, idx) => renderRoomCard(room, idx))}
            </SectionGroup>
          )}
        </RoomList>
      </Inner>
    </PageWrap>
  );
}
