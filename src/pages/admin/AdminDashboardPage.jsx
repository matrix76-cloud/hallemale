/* eslint-disable */
// src/pages/admin/AdminDashboardPage.jsx
import React, { useMemo, useState } from "react";
import styled from "styled-components";

/* ===================== Layout ===================== */

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
`;

const H1 = styled.h1`
  margin: 0;
  font-size: 22px;
  color: #111827;
`;

const Sub = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: #f3f4f6;
  color: #374151;
`;

const Row2 = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
`;

const Chips = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const Chip = styled.button`
  border: 1px solid ${({ $active }) => ($active ? "transparent" : "#e5e7eb")};
  background: ${({ $active, theme }) =>
    $active ? theme?.colors?.primary || theme?.primary || "#4f46e5" : "#ffffff"};
  color: ${({ $active }) => ($active ? "#ffffff" : "#111827")};
  border-radius: 999px;
  padding: 7px 10px;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &:active {
    transform: translateY(1px);
  }
`;

const ChipCount = styled.span`
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  line-height: 1;
`;

const ChipCountOff = styled.span`
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #4b5563;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  line-height: 1;
`;

const Grid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  align-items: start;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
  @media (max-width: 720px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const Card = styled.div`
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.04);
  overflow: hidden;
`;

const CardBody = styled.div`
  padding: 14px;
`;

/* ===================== KPI Cards ===================== */

const StatCard = styled(Card)`
  grid-column: span 3;
  min-height: 104px; /* ✅ 높이 통일 */

  @media (max-width: 1100px) {
    grid-column: span 3;
  }
  @media (max-width: 720px) {
    grid-column: span 2;
  }
`;

const AccentStat = styled(StatCard)`
  background: ${({ theme }) => theme?.colors?.primary || theme?.primary || "#4f46e5"};
  color: #fff;
  border-color: transparent;
`;

const StatTop = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
`;

const StatTitle = styled.div`
  font-size: 12px;
  color: #6b7280;

  ${AccentStat} & {
    color: rgba(255, 255, 255, 0.85);
  }
`;

const StatValue = styled.div`
  font-size: 38px;
  color: #111827;
  white-space: nowrap;
  font-weight :600;

  ${AccentStat} & {
    color: #ffffff;
  }
`;

const StatSub = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;

  ${AccentStat} & {
    color: rgba(255, 255, 255, 0.85);
  }
`;

/* ===================== Match Block ===================== */

const MatchCard = styled(Card)`
  grid-column: span 12;

  @media (max-width: 1100px) {
    grid-column: span 6;
  }
  @media (max-width: 720px) {
    grid-column: span 2;
  }
`;

const MatchTabs = styled.div`
  display: flex;
  gap: 6px;
  margin-bottom: 10px;

  button {
    border: 1px solid #e5e7eb;
    background: #fff;
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
    color: #111827;
  }

  button.on {
    background: ${({ theme }) => theme?.colors?.primary || theme?.primary || "#4f46e5"};
    color: #fff;
    border-color: transparent;
  }
`;

const MatchList = styled.div`
  display: grid;
  gap: 10px;
  border-top: 1px dashed #e5e7eb;
  padding-top: 12px;
`;

const MatchRow = styled.div`
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) 88px;
  gap: 10px;
  align-items: center;
  padding: 10px 10px;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: #ffffff;
`;

const MatchTime = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const MatchMain = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MatchTeams = styled.div`
  font-size: 13px;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MatchMeta = styled.div`
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StatusPill = styled.div`
  justify-self: end;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: ${({ $tone }) =>
    $tone === "scheduled"
      ? "rgba(37, 99, 235, 0.10)"
      : $tone === "done"
      ? "rgba(16, 185, 129, 0.10)"
      : "rgba(107, 114, 128, 0.12)"};
  color: ${({ $tone }) =>
    $tone === "scheduled" ? "#1d4ed8" : $tone === "done" ? "#047857" : "#374151"};
`;

/* ===================== Bottom Blocks ===================== */

const Wide = styled(Card)`
  grid-column: span 8;

  @media (max-width: 1100px) {
    grid-column: span 6;
  }
  @media (max-width: 720px) {
    grid-column: span 2;
  }
`;

const Side = styled(Card)`
  grid-column: span 4;

  @media (max-width: 1100px) {
    grid-column: span 6;
  }
  @media (max-width: 720px) {
    grid-column: span 2;
  }
`;

const SectionTitle = styled.div`
  font-size: 14px;
  color: #111827;
  margin-bottom: 10px;
`;

const Table = styled.div`
  border-top: 1px dashed #e5e7eb;
`;

const THead = styled.div`
  display: grid;
  grid-template-columns: 120px repeat(5, 1fr);
  gap: 8px;
  padding: 10px 0;
  font-size: 12px;
  color: #6b7280;
`;

const TRow = styled.div`
  display: grid;
  grid-template-columns: 120px repeat(5, 1fr);
  gap: 8px;
  padding: 10px 0;
  border-top: 1px solid #f3f4f6;
  font-size: 13px;
  color: #111827;
`;

const Tabs = styled.div`
  display: flex;
  gap: 6px;
  margin: 0 0 10px;

  button {
    border: 1px solid #e5e7eb;
    background: #fff;
    border-radius: 10px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
    color: #111827;
  }

  button.on {
    background: #111827;
    color: #fff;
    border-color: #111827;
  }
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  border-top: 1px dashed #e5e7eb;
`;

const Item = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 2px;
  border-top: 1px solid #f3f4f6;

  &:first-child {
    border-top: none;
  }

  .left {
    min-width: 0;
    color: #111827;
    font-size: 13px;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .right {
    flex-shrink: 0;
    font-size: 12px;
    color: #6b7280;
    white-space: nowrap;
  }
`;

const fmtKRW = (n) => {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "0원";
  return `${v.toLocaleString()}원`;
};

export default function AdminDashboardPage() {
  // ✅ KPI 더미 (추후 Firestore/Functions 연결)
  const stats = useMemo(() => {
    return {
      todaySignups: 3,
      todayMatches: 2,
      pendingTeamApprovals: 1,
      pendingPlayerApprovals: 4,

      totalW: 128,
      totalD: 12,
      totalL: 96,

      todayNewTeams: 2,
      totalMatches: 584,

      createdChatRoomsToday: 17,
    };
  }, []);

  // ✅ 지역 버튼(더미): 등록된 팀 수
  const regionCounts = useMemo(() => {
    return [
      { key: "seoul", label: "서울", count: 12 },
      { key: "gyeonggi", label: "경기", count: 18 },
      { key: "incheon", label: "인천", count: 6 },
      { key: "busan", label: "부산", count: 4 },
      { key: "etc", label: "기타", count: 9 },
    ];
  }, []);

  const [regionKey, setRegionKey] = useState("seoul");

  // ✅ 3번째 라인: 총득점 + 누적기부금 (더미)
  const scoreTotal = 32840;
  const donationTotal = scoreTotal * 10;

  const [tab, setTab] = useState("reports");
  const [matchTab, setMatchTab] = useState("today");

  const rightList = useMemo(() => {
    if (tab === "reports") {
      return [
        { left: "신고 접수: 커뮤니티 글 신고", right: "방금" },
        { left: "신고 접수: 유저 차단 요청", right: "10분 전" },
        { left: "신고 접수: 채팅 욕설 신고", right: "1시간 전" },
      ];
    }
    if (tab === "approvals") {
      return [
        { left: "팀 등록 승인 대기: 번개농구단", right: "대기" },
        { left: "선수 등록 승인 대기: 김민준", right: "대기" },
        { left: "선수 등록 승인 대기: 이지훈", right: "대기" },
      ];
    }
    return [
      { left: "공지 발행: 서비스 점검 안내", right: "완료" },
      { left: "푸시 발송: 신규 매칭 기능 안내", right: "완료" },
      { left: "공지 임시저장: 운영 공지 초안", right: "임시" },
    ];
  }, [tab]);

  const matches = useMemo(() => {
    const today = [
      {
        time: "19:00",
        teams: "블루호크 vs 레드폭스",
        meta: "서울 강남 · 잠실체육관 · 5v5",
        status: "scheduled",
        statusLabel: "예정",
      },
      {
        time: "21:00",
        teams: "네오팔콘 vs 타이거즈",
        meta: "서울 송파 · 올림픽공원 · 3v3",
        status: "scheduled",
        statusLabel: "예정",
      },
    ];

    const last7days = [
      {
        time: "어제",
        teams: "레드폭스 vs 네오팔콘",
        meta: "서울 강동 · 천호공원 · 5v5",
        status: "done",
        statusLabel: "완료",
      },
      {
        time: "3일 전",
        teams: "블루호크 vs 타이거즈",
        meta: "서울 강남 · 삼성체육관 · 4v4",
        status: "done",
        statusLabel: "완료",
      },
      {
        time: "6일 전",
        teams: "네오팔콘 vs 블랙팬서",
        meta: "서울 마포 · 상암체육관 · 5v5",
        status: "done",
        statusLabel: "완료",
      },
    ];

    const next7days = [
      {
        time: "내일 20:00",
        teams: "블랙팬서 vs 레드폭스",
        meta: "서울 종로 · 종각코트 · 3v3",
        status: "scheduled",
        statusLabel: "예정",
      },
      {
        time: "D+3 19:30",
        teams: "타이거즈 vs 네오팔콘",
        meta: "서울 강서 · 마곡체육관 · 5v5",
        status: "scheduled",
        statusLabel: "예정",
      },
      {
        time: "D+6 18:00",
        teams: "블루호크 vs 레드폭스",
        meta: "서울 송파 · 잠실체육관 · 5v5",
        status: "scheduled",
        statusLabel: "예정",
      },
    ];

    return { today, last7days, next7days };
  }, []);

  const matchList = useMemo(() => {
    if (matchTab === "today") return matches.today;
    if (matchTab === "past") return matches.last7days;
    return matches.next7days;
  }, [matchTab, matches]);

  const matchTitle = useMemo(() => {
    if (matchTab === "today") return "오늘 예정된 경기";
    if (matchTab === "past") return "지난 경기 (7일)";
    return "예정된 경기 (7일)";
  }, [matchTab]);

  const activeRegion = useMemo(() => {
    return regionCounts.find((r) => r.key === regionKey) || regionCounts[0];
  }, [regionCounts, regionKey]);

  const winDrawLoseText = `${stats.totalW}승 ${stats.totalD}무 ${stats.totalL}패`;

  return (
    <Page>
      <TitleRow>
        <div>
          <H1>대시보드</H1>
          <Sub>운영 현황을 한 눈에 확인하세요.</Sub>
        </div>
        <Pill>오늘</Pill>
      </TitleRow>

      {/* ✅ 2번째 라인: 지역 버튼 */}
      <Row2>
        <Chips>
          {regionCounts.map((r) => {
            const active = r.key === regionKey;
            return (
              <Chip
                key={r.key}
                type="button"
                $active={active}
                onClick={() => setRegionKey(r.key)}
              >
                {r.label}
                {active ? (
                  <ChipCount>{r.count}</ChipCount>
                ) : (
                  <ChipCountOff>{r.count}</ChipCountOff>
                )}
              </Chip>
            );
          })}
        </Chips>

        <Pill>
          선택 지역: {activeRegion.label} · 등록 팀 {activeRegion.count}개
        </Pill>
      </Row2>

      {/* ✅ 3번째 라인: 총득점 + 누적기부금 */}
      <Row2>
        <Chips>
          <Chip type="button" $active={false} onClick={() => {}}>
            총득점 현황{" "}
            <ChipCountOff>{scoreTotal.toLocaleString()}</ChipCountOff>
          </Chip>
          <Chip type="button" $active={false} onClick={() => {}}>
            누적기부금{" "}
            <ChipCountOff>{fmtKRW(donationTotal)}</ChipCountOff>
          </Chip>
        </Chips>

        <Pill>
          득점당 10원 · 누적기부금 {fmtKRW(donationTotal)}
        </Pill>
      </Row2>

      <Grid>
        {/* 1줄 (4개) */}
        <AccentStat>
          <CardBody>
            <StatTop>
              <StatTitle>오늘 신규 가입</StatTitle>
              <StatValue>{stats.todaySignups}</StatValue>
            </StatTop>
            <StatSub>회원 증가 추이를 확인하세요</StatSub>
          </CardBody>
        </AccentStat>

        <StatCard>
          <CardBody>
            <StatTop>
              <StatTitle>오늘 매칭</StatTitle>
              <StatValue>{stats.todayMatches}</StatValue>
            </StatTop>
            <StatSub>신청/확정 포함</StatSub>
          </CardBody>
        </StatCard>

        <StatCard>
          <CardBody>
            <StatTop>
              <StatTitle>팀 등록 </StatTitle>
              <StatValue>{stats.pendingTeamApprovals}</StatValue>
            </StatTop>
            <StatSub></StatSub>
          </CardBody>
        </StatCard>

        <StatCard>
          <CardBody>
            <StatTop>
              <StatTitle>선수 등록 </StatTitle>
              <StatValue>{stats.pendingPlayerApprovals}</StatValue>
            </StatTop>
            <StatSub></StatSub>
          </CardBody>
        </StatCard>

        {/* 2줄 (4개) */}
        <StatCard>
          <CardBody>
            <StatTop>
              <StatTitle>누적 승/무/패</StatTitle>
              <StatValue style={{ fontSize: 18 }}>{winDrawLoseText}</StatValue>
            </StatTop>
            <StatSub>전체 경기 결과 합산</StatSub>
          </CardBody>
        </StatCard>

        <StatCard>
          <CardBody>
            <StatTop>
              <StatTitle>오늘 신규 팀 생성</StatTitle>
              <StatValue>{stats.todayNewTeams}</StatValue>
            </StatTop>
            <StatSub>오늘 생성된 팀</StatSub>
          </CardBody>
        </StatCard>

        <StatCard>
          <CardBody>
            <StatTop>
              <StatTitle>누적경기</StatTitle>
              <StatValue>{stats.totalMatches}</StatValue>
            </StatTop>
            <StatSub>전체 누적 경기 수</StatSub>
          </CardBody>
        </StatCard>

        {/* ✅ 추가: 오늘 생성된 채팅방 수 */}
        <StatCard>
          <CardBody>
            <StatTop>
              <StatTitle>오늘 생성된 채팅방</StatTitle>
              <StatValue>{stats.createdChatRoomsToday}</StatValue>
            </StatTop>
            <StatSub>DM / 팀 채팅 포함</StatSub>
          </CardBody>
        </StatCard>

        {/* 경기 블록 */}
        <MatchCard>
          <CardBody>
            <SectionTitle>{matchTitle}</SectionTitle>

            <MatchTabs>
              <button
                className={matchTab === "today" ? "on" : ""}
                onClick={() => setMatchTab("today")}
              >
                오늘
              </button>
              <button
                className={matchTab === "past" ? "on" : ""}
                onClick={() => setMatchTab("past")}
              >
                지난 7일
              </button>
              <button
                className={matchTab === "next" ? "on" : ""}
                onClick={() => setMatchTab("next")}
              >
                예정 7일
              </button>
            </MatchTabs>

            <MatchList>
              {matchList.map((m, idx) => (
                <MatchRow key={idx}>
                  <MatchTime>{m.time}</MatchTime>
                  <MatchMain>
                    <MatchTeams>{m.teams}</MatchTeams>
                    <MatchMeta>{m.meta}</MatchMeta>
                  </MatchMain>
                  <StatusPill $tone={m.status}>{m.statusLabel}</StatusPill>
                </MatchRow>
              ))}
            </MatchList>
          </CardBody>
        </MatchCard>

        {/* 하단 요약 */}
        <Wide>
          <CardBody>
            <SectionTitle>최근 7일 요약(더미)</SectionTitle>
            <Table>
              <THead>
                <div>기간</div>
                <div>가입</div>
                <div>매칭</div>
                <div>신고</div>
                <div>채팅</div>
                <div>공지</div>
              </THead>
              {["오늘", "어제", "3일", "4일", "5일", "6일", "7일"].map(
                (label, idx) => (
                  <TRow key={idx}>
                    <div style={{ color: "#6b7280" }}>{label}</div>
                    <div>{Math.max(0, 3 - idx)}</div>
                    <div>{Math.max(0, 2 - (idx % 2))}</div>
                    <div>{idx === 0 ? 1 : 0}</div>
                    <div>{18 - idx}</div>
                    <div>{idx === 2 ? 1 : 0}</div>
                  </TRow>
                )
              )}
            </Table>
          </CardBody>
        </Wide>

        <Side>
          <CardBody>
            <SectionTitle>운영 작업</SectionTitle>

            <Tabs>
              <button
                className={tab === "reports" ? "on" : ""}
                onClick={() => setTab("reports")}
              >
                신고
              </button>
              <button
                className={tab === "approvals" ? "on" : ""}
                onClick={() => setTab("approvals")}
              >
                승인
              </button>
              <button
                className={tab === "notify" ? "on" : ""}
                onClick={() => setTab("notify")}
              >
                알림
              </button>
            </Tabs>

            <List>
              {rightList.map((it, idx) => (
                <Item key={idx}>
                  <div className="left">{it.left}</div>
                  <div className="right">{it.right}</div>
                </Item>
              ))}
            </List>
          </CardBody>
        </Side>
      </Grid>
    </Page>
  );
}
