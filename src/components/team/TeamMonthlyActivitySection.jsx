/* eslint-disable */
// src/components/team/TeamMonthlyActivitySection.jsx
// 팀 프로필: 월별 활동 기록(최근 6개월) + 선수 참여율
//  - games: [{ id, scheduledAt, memberIds }] (loadTeamMonthlyActivity)
//  - members: 팀원 목록 [{ userId/id, nickname/name, avatarUrl }]
//  - captainUid: 주장(ownerUid) — [주장] 배지 표시
import React, { useMemo } from "react";
import styled, { useTheme } from "styled-components";
import { FiBarChart2, FiCalendar, FiTrendingUp, FiPercent } from "react-icons/fi";

const PURPLE = "#6c5ce7";

const Section = styled.section`
  margin-top: 12px;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 14px;
  padding: 16px;
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const HeaderHint = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 16px;
`;

const SumCard = styled.div`
  border-radius: 14px;
  padding: 14px;
  background: ${({ $accent, theme }) =>
    $accent ? PURPLE : theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
  color: ${({ $accent, theme }) =>
    $accent ? "#fff" : theme.colors.textStrong};
`;

const SumTop = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 700;
  opacity: ${({ $accent }) => ($accent ? 1 : 0.85)};
  color: ${({ $accent, theme }) => ($accent ? "rgba(255,255,255,0.95)" : theme.colors.textWeak)};
`;

const SumVal = styled.div`
  margin-top: 8px;
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
  & span {
    font-size: 13px;
    font-weight: 700;
    margin-left: 4px;
    opacity: 0.85;
  }
`;

const ChartWrap = styled.div`
  margin-top: 2px;
`;

const ChartLbl = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  margin-bottom: 4px;
`;

const Divider = styled.div`
  height: 1px;
  margin: 16px 0;
  background: ${({ theme }) => theme.colors.border};
`;

const ParticHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const ParticTitle = styled.div`
  font-size: 15px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ParticHint = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  & + & {
    margin-top: 14px;
  }
`;

const Avatar = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 999px;
  flex-shrink: 0;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#eef0f4"};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const RowBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const RowTop = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
`;

const PName = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CaptainPill = styled.span`
  flex-shrink: 0;
  font-size: 10.5px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(124,92,201,0.25)" : "#efe9ff"};
  color: ${PURPLE};
`;

const RowMeta = styled.div`
  margin-left: auto;
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-shrink: 0;
`;

const PCount = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const PPct = styled.span`
  font-size: 14px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Track = styled.div`
  height: 7px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "#edeef2"};
  overflow: hidden;
`;

const Fill = styled.div`
  height: 100%;
  border-radius: 999px;
  background: ${PURPLE};
  width: ${({ $pct }) => `${$pct}%`};
`;

const EmptyHint = styled.div`
  padding: 8px 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

function BarChart({ data, avg, color, labelColor, axisColor, avgColor, activeKey }) {
  const W = 320;
  const H = 150;
  const padX = 16;
  const padTop = 24;
  const padBottom = 26;
  const max = Math.max(...data.map((d) => d.count), avg, 1);
  const slot = (W - padX * 2) / data.length;
  const bw = Math.min(slot - 14, 30);
  const avgY = H - padBottom - (avg / max) * (H - padTop - padBottom);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {avg > 0 && (
        <>
          <line
            x1={padX}
            x2={W - padX}
            y1={avgY}
            y2={avgY}
            stroke={avgColor}
            strokeWidth="1.4"
            strokeDasharray="5 4"
          />
          <text x={W - padX} y={avgY - 5} fontSize="10" fill={avgColor} textAnchor="end" fontWeight="800">
            평균 {avg.toFixed(1)}
          </text>
        </>
      )}
      {data.map((d, i) => {
        const h = (d.count / max) * (H - padTop - padBottom);
        const x = padX + i * slot + (slot - bw) / 2;
        const y = H - padBottom - h;
        const isActive = d.key === activeKey;
        return (
          <g key={d.key}>
            {d.count > 0 && (
              <>
                <rect x={x} y={y} width={bw} height={Math.max(h, 3)} fill={color} rx="5" />
                <text x={x + bw / 2} y={y - 5} fontSize="11" fill={labelColor} fontWeight="800" textAnchor="middle">
                  {d.count}
                </text>
              </>
            )}
            {d.count === 0 && (
              <circle cx={x + bw / 2} cy={H - padBottom} r="2.5" fill={axisColor} opacity="0.5" />
            )}
            <text
              x={x + bw / 2}
              y={H - 8}
              fontSize="11"
              fill={isActive ? color : axisColor}
              fontWeight={isActive ? 800 : 500}
              textAnchor="middle"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function TeamMonthlyActivitySection({ games = [], members = [], captainUid = "" }) {
  const theme = useTheme();

  const { months, total, avg, partic, activeKey } = useMemo(() => {
    // 최근 6개월(현재월 포함) 고정 축
    const base = new Date();
    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth() + 1}`,
        label: `${d.getMonth() + 1}월`,
        count: 0,
      });
    }
    const activeKey = months[months.length - 1].key;
    const idx = new Map(months.map((m, i) => [m.key, i]));

    const windowKeys = new Set(months.map((m) => m.key));
    const inWindow = [];
    for (const g of games || []) {
      const d = new Date(g?.scheduledAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (!windowKeys.has(key)) continue;
      months[idx.get(key)].count += 1;
      inWindow.push(g);
    }

    const total = inWindow.length;
    const monthsWithData = months.filter((m) => m.count > 0).length;
    const avg = monthsWithData ? total / monthsWithData : 0;

    const capId = String(captainUid || "").trim();
    const partic = (members || [])
      .map((m) => {
        const uid = String(m?.userId || m?.id || "").trim();
        const cnt = uid ? inWindow.filter((g) => (g.memberIds || []).includes(uid)).length : 0;
        return {
          uid,
          name: String(m?.nickname || m?.name || "선수").trim() || "선수",
          avatar: String(m?.avatarUrl || "").trim(),
          isCaptain: !!uid && uid === capId,
          games: cnt,
          pct: total ? Math.round((cnt / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));

    return { months, total, avg, partic, activeKey };
  }, [games, members, captainUid]);

  return (
    <Section>
      <HeaderRow>
        <Title>
          <FiBarChart2 size={18} color={PURPLE} />
          월별 활동 기록
        </Title>
        <HeaderHint>최근 6개월</HeaderHint>
      </HeaderRow>

      <SummaryGrid>
        <SumCard>
          <SumTop>
            <FiCalendar size={14} />
            총 경기 수
          </SumTop>
          <SumVal>
            {total}
            <span>경기</span>
          </SumVal>
        </SumCard>
        <SumCard $accent>
          <SumTop $accent>
            <FiTrendingUp size={14} />
            월 평균
          </SumTop>
          <SumVal>
            {avg.toFixed(1)}
            <span>경기</span>
          </SumVal>
        </SumCard>
      </SummaryGrid>

      <ChartWrap>
        <ChartLbl>월별 경기 수</ChartLbl>
        <BarChart
          data={months}
          avg={avg}
          color={PURPLE}
          labelColor={theme.colors.textStrong}
          axisColor={theme.colors.textWeak}
          avgColor={PURPLE}
          activeKey={activeKey}
        />
      </ChartWrap>

      <Divider />

      <ParticHeader>
        <ParticTitle>
          <FiPercent size={16} color={PURPLE} />
          선수 참여율
        </ParticTitle>
        <ParticHint>팀 총 {total}경기 기준</ParticHint>
      </ParticHeader>

      {partic.length === 0 ? (
        <EmptyHint>팀원 정보가 없습니다.</EmptyHint>
      ) : total === 0 ? (
        <EmptyHint>최근 6개월간 완료된 경기가 없어요.</EmptyHint>
      ) : (
        partic.map((p) => (
          <Row key={p.uid || p.name}>
            <Avatar>
              {p.avatar ? (
                <AvatarImg src={p.avatar} alt={p.name} />
              ) : (
                p.name.charAt(0)
              )}
            </Avatar>
            <RowBody>
              <RowTop>
                <PName>{p.name}</PName>
                {p.isCaptain ? <CaptainPill>주장</CaptainPill> : null}
                <RowMeta>
                  <PCount>
                    {p.games}/{total}경기
                  </PCount>
                  <PPct>{p.pct}%</PPct>
                </RowMeta>
              </RowTop>
              <Track>
                <Fill $pct={p.pct} />
              </Track>
            </RowBody>
          </Row>
        ))
      )}
    </Section>
  );
}
