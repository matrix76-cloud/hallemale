/* eslint-disable */
// src/components/player/PlayerMonthlyStatsSection.jsx
// 월간 활동 집계 — 막대그래프 + 요약 숫자

import React, { useMemo } from "react";
import styled, { useTheme } from "styled-components";
import { FiCalendar, FiZap, FiClock, FiTrendingUp } from "react-icons/fi";
import EmptyState from "../common/EmptyState";

const Section = styled.section`
  margin-top: 12px;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 14px 16px 16px;
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const MockBadge = styled.span`
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(245,158,11,0.16)" : "#fef3c7"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#fbbf24" : "#92400e")};
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 999px;
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 14px;
`;

const SumCard = styled.div`
  background: ${({ $bg }) => $bg};
  border-radius: 8px;
  padding: 10px 8px;
  text-align: center;
  color: ${({ $color }) => $color};
`;

const SumVal = styled.div`
  font-size: 18px;
  font-weight: 800;
  margin-top: 2px;
`;

const SumLbl = styled.div`
  font-size: 10px;
  opacity: 0.85;
  margin-top: 2px;
`;

const Chart = styled.div`
  margin-top: 6px;
`;

const ChartLbl = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
  margin-bottom: 6px;
`;

function BarChart({ data, field, color, labelColor, axisColor }) {
  const W = 300;
  const H = 110;
  const pad = 20;
  const max = Math.max(...data.map((d) => d[field])) || 1;
  const bw = (W - pad * 2) / data.length - 8;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      {data.map((d, i) => {
        const h = ((d[field] / max) * (H - pad * 2));
        const x = pad + i * ((W - pad * 2) / data.length) + 4;
        const y = H - pad - h;
        return (
          <g key={d.month}>
            <rect x={x} y={y} width={bw} height={h} fill={color} rx="4" />
            <text
              x={x + bw / 2}
              y={y - 4}
              fontSize="10"
              fill={labelColor}
              fontWeight="700"
              textAnchor="middle"
            >
              {d[field]}
            </text>
            <text
              x={x + bw / 2}
              y={H - 6}
              fontSize="10"
              fill={axisColor}
              textAnchor="middle"
            >
              {d.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function PlayerMonthlyStatsSection({ sessions = [] }) {
  const theme = useTheme();
  const isDark = theme?.mode === "dark";
  const monthly = useMemo(() => {
    const map = new Map();
    for (const s of sessions) {
      if (!s.startedAt) continue;
      const d = new Date(s.startedAt);
      const key = `${d.getMonth() + 1}월`;
      const cur = map.get(key) || { month: key, sessions: 0, minutes: 0, calories: 0 };
      cur.sessions += 1;
      if (s.endedAt) cur.minutes += (new Date(s.endedAt) - new Date(s.startedAt)) / 60000;
      cur.calories += s.totalCalories || 0;
      map.set(key, cur);
    }
    return Array.from(map.values()).slice(-5);
  }, [sessions]);

  const current = monthly[monthly.length - 1] || { sessions: 0, minutes: 0, calories: 0 };
  const prev = monthly[monthly.length - 2];
  const growth =
    prev && prev.sessions ? Math.round(((current.sessions - prev.sessions) / prev.sessions) * 100) : 0;

  if (monthly.length === 0) {
    return (
      <Section>
        <HeaderRow>
          <Title>
            <FiCalendar size={16} color="#0f766e" />
            이번 달 활동
          </Title>
        </HeaderRow>
        <EmptyState compact text="기록된 활동이 없습니다." />
      </Section>
    );
  }

  return (
    <Section>
      <HeaderRow>
        <Title>
          <FiCalendar size={16} color="#0f766e" />
          이번 달 활동
        </Title>
      </HeaderRow>

      <SummaryGrid>
        <SumCard
          $bg={isDark ? "rgba(34,211,238,0.16)" : "#ecfeff"}
          $color={isDark ? "#67e8f9" : "#0e7490"}
        >
          <FiCalendar size={14} />
          <SumVal>{current.sessions}</SumVal>
          <SumLbl>경기 수</SumLbl>
        </SumCard>
        <SumCard
          $bg={isDark ? "rgba(245,158,11,0.16)" : "#fef3c7"}
          $color={isDark ? "#fbbf24" : "#92400e"}
        >
          <FiClock size={14} />
          <SumVal>{Math.round(current.minutes / 60)}h</SumVal>
          <SumLbl>총 시간</SumLbl>
        </SumCard>
        <SumCard
          $bg={isDark ? "rgba(248,113,113,0.16)" : "#fee2e2"}
          $color={isDark ? "#fca5a5" : "#b91c1c"}
        >
          <FiZap size={14} />
          <SumVal>{(current.calories / 1000).toFixed(1)}k</SumVal>
          <SumLbl>kcal</SumLbl>
        </SumCard>
        <SumCard
          $bg={isDark ? "rgba(34,197,94,0.16)" : "#dcfce7"}
          $color={isDark ? "#86efac" : "#166534"}
        >
          <FiTrendingUp size={14} />
          <SumVal>
            {growth >= 0 ? "+" : ""}
            {growth}%
          </SumVal>
          <SumLbl>전월비</SumLbl>
        </SumCard>
      </SummaryGrid>

      <Chart>
        <ChartLbl>월별 경기 수</ChartLbl>
        <BarChart
          data={monthly}
          field="sessions"
          color="#14b8a6"
          labelColor={theme.colors.textStrong}
          axisColor={theme.colors.textWeak}
        />
      </Chart>
    </Section>
  );
}
