/* eslint-disable */
// src/pages/admin/AdminDashboardPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import {
  fetchAdminDashboardKpi,
  fetchAdminRegionCounts,
  fetchAdminDashboardMatches,
  fetchAdminDashboardActivity,
  fetchAdminDashboardWeekly,
} from "../../services/adminDashboardService";

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
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const Sub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(255,255,255,0.06)" : "#f3f4f6"};
  color: ${({ theme }) => theme?.colors?.textNormal || "#374151"};
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
  border: 1px solid ${({ $active, theme }) =>
    $active ? "transparent" : theme?.colors?.border || "#e5e7eb"};
  background: ${({ $active, theme }) =>
    $active
      ? theme?.colors?.primary || theme?.primary || "#4f46e5"
      : theme?.colors?.card || "#ffffff"};
  color: ${({ $active, theme }) =>
    $active ? "#ffffff" : theme?.colors?.textStrong || "#111827"};
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
  background: ${({ theme }) =>
    theme?.mode === "dark" ? "rgba(255,255,255,0.06)" : "#f3f4f6"};
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
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
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  box-shadow: ${({ theme }) => theme?.shadows?.card || "0 6px 14px rgba(15, 23, 42, 0.04)"};
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
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};

  ${AccentStat} & {
    color: rgba(255, 255, 255, 0.85);
  }
`;

const StatValue = styled.div`
  font-size: 38px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  white-space: nowrap;
  font-weight :600;

  ${AccentStat} & {
    color: #ffffff;
  }
`;

const StatSub = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};

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
    border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
    background: ${({ theme }) => theme?.colors?.card || "#fff"};
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
    color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
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
  border-top: 1px dashed ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  padding-top: 12px;
`;

const MatchRow = styled.div`
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) 88px;
  gap: 10px;
  align-items: center;
  padding: 10px 10px;
  border: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.border : "#f3f4f6"};
  border-radius: 8px;
  background: ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.surface : "#ffffff"};
`;

const MatchTime = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const MatchMain = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MatchTeams = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MatchMeta = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StatusPill = styled.div`
  justify-self: end;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: ${({ $tone, theme }) => {
    if ($tone === "scheduled")
      return theme?.mode === "dark" ? "rgba(99,102,241,0.18)" : "rgba(37, 99, 235, 0.10)";
    if ($tone === "done")
      return theme?.mode === "dark" ? "rgba(34,197,94,0.18)" : "rgba(16, 185, 129, 0.10)";
    return theme?.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(107, 114, 128, 0.12)";
  }};
  color: ${({ $tone, theme }) => {
    if ($tone === "scheduled") return theme?.mode === "dark" ? "#a5b4fc" : "#1d4ed8";
    if ($tone === "done") return theme?.mode === "dark" ? "#86efac" : "#047857";
    return theme?.mode === "dark" ? "#9ca3af" : "#374151";
  }};
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
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  margin-bottom: 10px;
`;

const Table = styled.div`
  border-top: 1px dashed ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
`;

const THead = styled.div`
  display: grid;
  grid-template-columns: 120px repeat(5, 1fr);
  gap: 8px;
  padding: 10px 0;
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const TRow = styled.div`
  display: grid;
  grid-template-columns: 120px repeat(5, 1fr);
  gap: 8px;
  padding: 10px 0;
  border-top: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.divider : "#f3f4f6"};
  font-size: 13px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const TLabel = styled.div`
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const Tabs = styled.div`
  display: flex;
  gap: 6px;
  margin: 0 0 10px;

  button {
    border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
    background: ${({ theme }) => theme?.colors?.card || "#fff"};
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
    color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
  }

  button.on {
    background: ${({ theme }) =>
      theme?.mode === "dark" ? theme?.colors?.primary : "#111827"};
    color: #fff;
    border-color: ${({ theme }) =>
      theme?.mode === "dark" ? theme?.colors?.primary : "#111827"};
  }
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  border-top: 1px dashed ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
`;

const Item = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 2px;
  border-top: 1px solid ${({ theme }) =>
    theme?.mode === "dark" ? theme?.colors?.divider : "#f3f4f6"};

  &:first-child {
    border-top: none;
  }

  .left {
    min-width: 0;
    color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
    font-size: 13px;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .right {
    flex-shrink: 0;
    font-size: 12px;
    color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
    white-space: nowrap;
  }
`;

const fmtKRW = (n) => {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "0원";
  return `${v.toLocaleString()}원`;
};

export default function AdminDashboardPage() {
  // ✅ KPI 실데이터 (Firestore 집계)
  const [stats, setStats] = useState({
    todaySignups: 0,
    todayMatches: 0,
    pendingTeamApprovals: 0,
    pendingPlayerApprovals: 0,
    totalW: 0,
    totalD: 0,
    totalL: 0,
    todayNewTeams: 0,
    totalMatches: 0,
    createdChatRoomsToday: 0,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const k = await fetchAdminDashboardKpi();
        if (!alive) return;
        setStats(k);
      } catch (e) {
        console.error("[AdminDashboardPage] KPI load failed", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ✅ 지역별 등록된 팀 수 (실데이터)
  const [regionCounts, setRegionCounts] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await fetchAdminRegionCounts();
        if (!alive) return;
        setRegionCounts(rows);
      } catch (e) {
        console.error("[AdminDashboardPage] regionCounts load failed", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const [regionKey, setRegionKey] = useState("서울");

  // ✅ 3번째 라인: 총득점 + 누적기부금 (더미)
  const scoreTotal = 32840;
  const donationTotal = scoreTotal * 10;

  const [tab, setTab] = useState("reports");
  const [matchTab, setMatchTab] = useState("today");

  // ✅ 우측 액티비티 (실데이터)
  const [rightList, setRightList] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await fetchAdminDashboardActivity(tab);
        if (!alive) return;
        setRightList(list);
      } catch (e) {
        console.error("[AdminDashboardPage] activity load failed", e);
        if (alive) setRightList([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tab]);

  // ✅ 최근 7일 요약 (실데이터)
  const [weekly, setWeekly] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await fetchAdminDashboardWeekly();
        if (!alive) return;
        setWeekly(rows);
      } catch (e) {
        console.error("[AdminDashboardPage] weekly load failed", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ✅ 최근 매치 (실데이터 — match_requests)
  const [matches, setMatches] = useState({
    today: [],
    last7days: [],
    next7days: [],
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const m = await fetchAdminDashboardMatches();
        if (!alive) return;
        setMatches(m);
      } catch (e) {
        console.error("[AdminDashboardPage] matches load failed", e);
      }
    })();
    return () => {
      alive = false;
    };
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
            <SectionTitle>최근 7일 요약</SectionTitle>
            <Table>
              <THead>
                <div>기간</div>
                <div>가입</div>
                <div>매칭</div>
                <div>신고</div>
                <div>채팅</div>
                <div>공지</div>
              </THead>
              {weekly.map((row, idx) => (
                <TRow key={idx}>
                  <TLabel>{row.label}</TLabel>
                  <div>{row.signups}</div>
                  <div>{row.matches}</div>
                  <div>{row.reports}</div>
                  <div>{row.chats}</div>
                  <div>{row.notices}</div>
                </TRow>
              ))}
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
