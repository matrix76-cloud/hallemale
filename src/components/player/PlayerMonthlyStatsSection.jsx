/* eslint-disable */
// src/components/player/PlayerMonthlyStatsSection.jsx
// 월별 활동 기록 — 선수가 라인업으로 뛴 경기를 월별로 집계.
//  - 막대그래프: 월별 경기 수 (최근 6개월, 데이터 있는 달 기준)
//  - 요약: 총 경기 수 / 월 평균 경기 수

import React, { useMemo } from "react";
import styled, { useTheme } from "styled-components";
import { FiCalendar, FiBarChart2 } from "react-icons/fi";
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

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 14px;
`;

const SumCard = styled.div`
  background: ${({ $bg }) => $bg};
  border-radius: 8px;
  padding: 12px 10px;
  text-align: center;
  color: ${({ $color }) => $color};
`;

const SumVal = styled.div`
  font-size: 20px;
  font-weight: 800;
  margin-top: 2px;
`;

const SumLbl = styled.div`
  font-size: 11px;
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

function BarChart({ data, color, avg, labelColor, axisColor, avgColor }) {
  const W = 300;
  const H = 120;
  const pad = 22;
  const max = Math.max(...data.map((d) => d.count), 1);
  const slot = (W - pad * 2) / data.length;
  const bw = Math.min(slot - 8, 34);

  // 월 평균 점선 y좌표
  const avgY = H - pad - (avg / max) * (H - pad * 2);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      {/* 월 평균 점선 */}
      {avg > 0 && (
        <>
          <line
            x1={pad}
            x2={W - pad}
            y1={avgY}
            y2={avgY}
            stroke={avgColor}
            strokeWidth="1.2"
            strokeDasharray="4 4"
          />
          <text x={W - pad} y={avgY - 4} fontSize="9.5" fill={avgColor} textAnchor="end" fontWeight="700">
            월 평균 {avg.toFixed(1)}
          </text>
        </>
      )}
      {data.map((d, i) => {
        const h = (d.count / max) * (H - pad * 2);
        const x = pad + i * slot + (slot - bw) / 2;
        const y = H - pad - h;
        return (
          <g key={d.key}>
            <rect x={x} y={y} width={bw} height={Math.max(h, d.count > 0 ? 2 : 0)} fill={color} rx="4" />
            <text x={x + bw / 2} y={y - 4} fontSize="10" fill={labelColor} fontWeight="700" textAnchor="middle">
              {d.count}
            </text>
            <text x={x + bw / 2} y={H - 6} fontSize="10" fill={axisColor} textAnchor="middle">
              {d.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function PlayerMonthlyStatsSection({ matches = [] }) {
  const theme = useTheme();
  const isDark = theme?.mode === "dark";

  const monthly = useMemo(() => {
    const map = new Map(); // "YYYY-M" → { key, month, count, ts }
    for (const m of matches || []) {
      const iso = m?.scheduledAt;
      if (!iso) continue;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const cur = map.get(key) || { key, month: `${d.getMonth() + 1}월`, count: 0, ts: 0 };
      cur.count += 1;
      cur.ts = Math.max(cur.ts, d.getTime());
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => a.ts - b.ts)
      .slice(-6); // 최근 6개월(데이터 있는 달)
  }, [matches]);

  const totalGames = useMemo(
    () => monthly.reduce((sum, m) => sum + m.count, 0),
    [monthly]
  );
  const avg = monthly.length ? totalGames / monthly.length : 0;

  if (monthly.length === 0) {
    return (
      <Section>
        <HeaderRow>
          <Title>
            <FiBarChart2 size={16} color="#0f766e" />
            월별 활동 기록
          </Title>
        </HeaderRow>
        <EmptyState compact text="기록된 경기가 없습니다." />
      </Section>
    );
  }

  return (
    <Section>
      <HeaderRow>
        <Title>
          <FiBarChart2 size={16} color="#0f766e" />
          월별 활동 기록
        </Title>
      </HeaderRow>

      <SummaryGrid>
        <SumCard
          $bg={isDark ? "rgba(34,211,238,0.16)" : "#ecfeff"}
          $color={isDark ? "#67e8f9" : "#0e7490"}
        >
          <FiCalendar size={15} />
          <SumVal>{totalGames}</SumVal>
          <SumLbl>총 경기 수</SumLbl>
        </SumCard>
        <SumCard
          $bg={isDark ? "rgba(20,184,166,0.16)" : "#ccfbf1"}
          $color={isDark ? "#5eead4" : "#0f766e"}
        >
          <FiBarChart2 size={15} />
          <SumVal>{avg.toFixed(1)}</SumVal>
          <SumLbl>월 평균 경기</SumLbl>
        </SumCard>
      </SummaryGrid>

      <Chart>
        <ChartLbl>월별 경기 수</ChartLbl>
        <BarChart
          data={monthly}
          avg={avg}
          color="#14b8a6"
          labelColor={theme.colors.textStrong}
          axisColor={theme.colors.textWeak}
          avgColor={isDark ? "#fbbf24" : "#d97706"}
        />
      </Chart>
    </Section>
  );
}
