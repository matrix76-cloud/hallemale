// src/pages/matching/MatchRoomDetailPage.jsx
/* eslint-disable */
import React, { useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import { images, playerAvatars } from "../../utils/imageAssets";
import { TEAMS } from "../../mock/teamsMock";
import SubHeaderBar from "../../layouts/components/SubHeaderBar";

/* ==================== 헬퍼 ==================== */

const POSITION_LABEL = {
  guard: "가드",
  forward: "포워드",
  center: "센터",
};

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

const buildRoomsFromTeams = () => {
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
    };
  });
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

/* 상단 팀 vs 팀 카드 */

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
  border-bottom: ${({ withDivider }) => (withDivider ? "1px solid #edf0f5" : "none")};
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

const RankBadgeWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
`;

const RankLabel = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const RankMedal = styled.div`
  font-size: 16px;
`;

/* 라인업 리스트 */

const LineupList = styled.div`
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const PlayerRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const PlayerLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PlayerAvatar = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 999px;
  object-fit: cover;
  background: #e5e7eb;
`;

const PlayerText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const PlayerName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const PositionBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: #e0ebff;
  color: #2563eb;
  font-size: 10px;
`;

/* 개인 키/몸무게 */

const PlayerBodyMeta = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
  white-space: nowrap;
`;

/* VS 구분 */

const VsDivider = styled.div`
  padding: 6px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2563eb;
  font-weight: 700;
`;

/* 구장 / 날짜 섹션 */

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
  font-weight: 600;
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
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #6b7280;
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

/* 날짜/시간 선택 */

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

/* 캘린더 */

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
  font-weight: 600;
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

  ${({ isEmpty }) =>
    isEmpty
      ? `
    background: transparent;
    cursor: default;
  `
      : `
    background: transparent;
  `}

  ${({ isToday, isSelected }) => {
    if (isSelected) {
      return `
        background:#2563eb;
        color:#ffffff;
        font-weight:600;
      `;
    }
    if (isToday) {
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

/* 안내 + 버튼 */

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
  background: ${({ theme, disabled }) =>
    disabled ? "#cbd5f5" : theme.colors.primary || "#2563eb"};
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
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

/* ==================== 페이지 컴포넌트 ==================== */

export default function MatchRoomDetailPage() {
  const navigate = useNavigate();
  const { roomId } = useParams();

  const rooms = useMemo(buildRoomsFromTeams, []);
  const room = rooms.find((r) => r.id === roomId) || rooms[0];

  const { myTeam, oppTeam } = room || {};

  const myStats = myTeam?.stats || {};
  const oppStats = oppTeam?.stats || {};

  const myRecord = `${myStats.wins ?? 0}승 ${myStats.losses ?? 0}패`;
  const oppRecord = `${oppStats.wins ?? 0}승 ${
    oppStats.losses ?? 0
  }패`;
  const myWinRate = Math.round((myStats.winRate ?? 0) * 100);
  const oppWinRate = Math.round((oppStats.winRate ?? 0) * 100);

  const myPlayers = myTeam?.players?.slice(0, 4) || [];
  const oppPlayers = oppTeam?.players?.slice(0, 4) || [];

  // 날짜/시간 초기값
  const initialDate = room?.scheduledAt ? room.scheduledAt.slice(0, 10) : "";
  const initialTime = room?.scheduledAt
    ? new Date(room.scheduledAt).toTimeString().slice(0, 5)
    : "";

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedTime, setSelectedTime] = useState(initialTime);

  // 캘린더 현재 월
  const today = new Date();
  const initialYear = initialDate ? Number(initialDate.slice(0, 4)) : today.getFullYear();
  const initialMonth = initialDate ? Number(initialDate.slice(5, 7)) - 1 : today.getMonth();

  const [calYear, setCalYear] = useState(initialYear);
  const [calMonth, setCalMonth] = useState(initialMonth); // 0-11

  const combinedLabel = useMemo(() => {
    if (!selectedDate || !selectedTime) {
      return "날짜와 시간을 선택해주세요.";
    }
    const iso = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
    return formatKoreanDateTime(iso);
  }, [selectedDate, selectedTime]);

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime) return;
    const iso = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
    console.log("매칭 확정:", {
      roomId: room?.id,
      scheduledAt: iso,
    });
  };

  const handleCancelMatch = () => {
    console.log("매칭 취소:", room?.id);
    navigate(-1);
  };

  const renderPlayerRow = (p, fallbackText) => {
    const avatar =
      playerAvatars[p.userId] || p.photoUrl || images.logo;
    const pos = POSITION_LABEL[p.mainPosition] || "포지션";
    const height = p.heightCm ? `${p.heightCm}cm` : null;
    const weight = p.weightKg ? `${p.weightKg}kg` : null;
    let bodyText = "";
    if (height || weight) {
      bodyText = [height, weight].filter(Boolean).join(" / ");
    }

    return (
      <PlayerRow key={p.userId}>
        <PlayerLeft>
          <PlayerAvatar src={avatar} alt={p.nickname} />
          <PlayerText>
            <div>
              <PositionBadge>{pos}</PositionBadge>
            </div>
            <PlayerName>{p.nickname}</PlayerName>
          </PlayerText>
        </PlayerLeft>
        <PlayerBodyMeta>{bodyText || fallbackText}</PlayerBodyMeta>
      </PlayerRow>
    );
  };

  /* ===== 캘린더 생성 ===== */
  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0(일)~6(토)
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i += 1) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(d);
  }

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

  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  const handleBack = () => {
    navigate(-1);
  };


  return (

    <>
        <SubHeaderBar title="매칭 게임" onBack={handleBack} />
        <PageWrap>
      <Inner>
        {/* 팀 vs 팀 + 라인업 */}
        <MatchCard>
          {/* 우리 팀 */}
          <TeamBlock withDivider>
            <TeamHeaderRow>
              <TeamHeaderLeft>
                <TeamLogoWrap>
                  <TeamLogo
                    src={images[myTeam?.logoKey] || images.logo}
                    alt={myTeam?.name}
                  />
                </TeamLogoWrap>
                <TeamText>
                  <TeamName>{myTeam?.name}</TeamName>
                  <TeamStatsRow>
                    <span>{myRecord}</span>
                    <WinRatePill>승률 {myWinRate}%</WinRatePill>
                  </TeamStatsRow>
                </TeamText>
              </TeamHeaderLeft>
              <RankBadgeWrap>
                <RankLabel>랭크</RankLabel>
                <RankMedal>🥇</RankMedal>
              </RankBadgeWrap>
            </TeamHeaderRow>

            <LineupList>
              {myPlayers.map((p) => renderPlayerRow(p, myRecord))}
            </LineupList>
          </TeamBlock>

          <VsDivider>VS</VsDivider>

          {/* 상대 팀 */}
          <TeamBlock>
            <TeamHeaderRow>
              <TeamHeaderLeft>
                <TeamLogoWrap>
                  <TeamLogo
                    src={images[oppTeam?.logoKey] || images.logo}
                    alt={oppTeam?.name}
                  />
                </TeamLogoWrap>
                <TeamText>
                  <TeamName>{oppTeam?.name}</TeamName>
                  <TeamStatsRow>
                    <span>{oppRecord}</span>
                    <WinRatePill>승률 {oppWinRate}%</WinRatePill>
                  </TeamStatsRow>
                </TeamText>
              </TeamHeaderLeft>
              <RankBadgeWrap>
                <RankLabel>랭크</RankLabel>
                <RankMedal>🥇</RankMedal>
              </RankBadgeWrap>
            </TeamHeaderRow>

            <LineupList>
              {oppPlayers.map((p) => renderPlayerRow(p, oppRecord))}
            </LineupList>
          </TeamBlock>
        </MatchCard>

        {/* 구장 선택 + 지도 */}
        <SectionCard>
          <SectionTitleRow>
            <SectionIcon>🏟️</SectionIcon>
            <span>구장 선택</span>
          </SectionTitleRow>

          <MapBox>이곳에 구장 지도가 들어갑니다.</MapBox>

          <FieldRow>
            <FieldName>성북구 스카이 풋살파크</FieldName>
            <FieldEditButton type="button">수정</FieldEditButton>
          </FieldRow>
        </SectionCard>

        {/* 날짜 + 시간 선택 */}
        <SectionCard>
          <SectionTitleRow>
            <SectionIcon>📅</SectionIcon>
            <span>날짜 선택</span>
          </SectionTitleRow>

          <DateTimeRow>
            {/* 캘린더 */}
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
                  if (!day) {
                    return (
                      <DayCell key={idx} isEmpty>
                        {" "}
                      </DayCell>
                    );
                  }

                  const isToday =
                    calYear === todayY && calMonth === todayM && day === todayD;
                  const dateStr = `${calYear}-${pad2(calMonth + 1)}-${pad2(
                    day
                  )}`;
                  const isSelected = selectedDate === dateStr;

                  return (
                    <DayCell
                      key={idx}
                      type="button"
                      onClick={() => handleDayClick(day)}
                      isToday={isToday}
                      isSelected={isSelected}
                    >
                      {day}
                    </DayCell>
                  );
                })}
              </DaysGrid>
            </CalendarWrap>

            {/* 시간 선택 */}
            <TimeInput
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
            />
          </DateTimeRow>

          <DateValue>{combinedLabel}</DateValue>
        </SectionCard>
      </Inner>

      <NoticeText>
        매칭 확정 시 상대팀에게 확정 메시지가 전달됩니다.
      </NoticeText>

      <ActionsWrap>
        <PrimaryButton
          type="button"
          onClick={handleConfirm}
          disabled={!selectedDate || !selectedTime}
        >
          매칭 확정
        </PrimaryButton>
        <SecondaryButton type="button" onClick={handleCancelMatch}>
          매칭 취소
        </SecondaryButton>
      </ActionsWrap>
        </PageWrap>
    </>

  );
}
