/* eslint-disable */
// src/components/player/PlayerHealthSection.jsx
// 건강 지표 — HR존 도넛 + 안정시HR/최대HR/VO2max

import React, { useMemo } from "react";
import styled, { useTheme } from "styled-components";
import { FiHeart } from "react-icons/fi";
import {
  calcHRZones,
  estimateHRMax,
  estimateVO2max,
} from "../../services/playerAbilityCalculator";

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

const Body = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  align-items: center;
`;

const LegendList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const LegendRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const Dot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: ${({ $c }) => $c};
`;

const LegendLabel = styled.span`
  flex: 1;
`;

const LegendValue = styled.span`
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const MetricsGrid = styled.div`
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
`;

const Metric = styled.div`
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  border-radius: 8px;
  padding: 10px;
  text-align: center;
`;

const MetricVal = styled.div`
  font-size: 22px;
  font-weight: 800;
  color: ${({ theme }) => (theme.mode === "dark" ? "#5eead4" : "#0f766e")};
`;

const MetricUnit = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
  margin-left: 3px;
  font-weight: 500;
`;

const MetricLbl = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.textWeak};
  margin-top: 4px;
`;

const Advice = styled.div`
  margin-top: 10px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(34,197,94,0.16)" : "#ecfdf5"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#86efac" : "#065f46")};
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 11px;
  line-height: 1.5;
`;

function DonutChart({ zones, size = 120, trackColor, labelColor, subColor }) {
  const r = 48;
  const cx = size / 2;
  const cy = size / 2;
  const total = zones.low + zones.mid + zones.high + zones.peak || 1;

  const segs = [
    { v: zones.low, c: "#86efac", key: "low" },
    { v: zones.mid, c: "#fcd34d", key: "mid" },
    { v: zones.high, c: "#fb923c", key: "high" },
    { v: zones.peak, c: "#ef4444", key: "peak" },
  ];

  let acc = 0;
  const arcs = segs.map((s) => {
    const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += s.v;
    const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + Math.cos(start) * r;
    const y1 = cy + Math.sin(start) * r;
    const x2 = cx + Math.cos(end) * r;
    const y2 = cy + Math.sin(end) * r;
    const large = end - start > Math.PI ? 1 : 0;
    return { ...s, d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}` };
  });

  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth="14" />
      {arcs.map((a) =>
        a.v > 0 ? (
          <path
            key={a.key}
            d={a.d}
            fill="none"
            stroke={a.c}
            strokeWidth="14"
            strokeLinecap="butt"
          />
        ) : null
      )}
      <text x={cx} y={cy - 4} fontSize="20" fontWeight="800" fill={labelColor} textAnchor="middle">
        {total}
      </text>
      <text x={cx} y={cy + 14} fontSize="10" fill={subColor} textAnchor="middle">
        총 분
      </text>
    </svg>
  );
}

export default function PlayerHealthSection({ sessions = [], userProfile = {} }) {
  const theme = useTheme();
  const isDark = theme?.mode === "dark";
  const age =
    userProfile.age ||
    (userProfile.birthYear ? new Date().getFullYear() - userProfile.birthYear : 30);
  const restingHR = userProfile.restingHR || 60;
  const hrMax = estimateHRMax(age);
  const vo2 = estimateVO2max(restingHR, hrMax);

  const zones = useMemo(() => {
    const allSamples = sessions.flatMap((s) => s.heartRateSamples || []);
    const z = calcHRZones(allSamples, restingHR, hrMax);
    return {
      low: Math.round(z.low / 6),
      mid: Math.round(z.mid / 6),
      high: Math.round(z.high / 6),
      peak: Math.round(z.peak / 6),
    };
  }, [sessions, restingHR, hrMax]);

  const total = zones.low + zones.mid + zones.high + zones.peak;
  const highRatio = total > 0 ? ((zones.high + zones.peak) / total) * 100 : 0;

  const advice =
    highRatio > 30
      ? "🔥 고강도 운동 비중이 높아요. 회복 루틴을 챙기세요."
      : highRatio > 15
      ? "💪 적절한 운동 강도예요. 현재 페이스 유지!"
      : "💚 유산소 중심이네요. 인터벌 훈련도 추가해보세요.";

  return (
    <Section>
      <HeaderRow>
        <Title>
          <FiHeart size={16} color="#ef4444" />
          건강 지표
        </Title>
      </HeaderRow>

      <Body>
        <DonutChart
          zones={zones}
          trackColor={isDark ? theme.colors.surface : "#f3f4f6"}
          labelColor={theme.colors.textStrong}
          subColor={theme.colors.textWeak}
        />
        <LegendList>
          <LegendRow>
            <Dot $c="#86efac" />
            <LegendLabel>💚 저강도</LegendLabel>
            <LegendValue>{zones.low}분</LegendValue>
          </LegendRow>
          <LegendRow>
            <Dot $c="#fcd34d" />
            <LegendLabel>💛 중강도</LegendLabel>
            <LegendValue>{zones.mid}분</LegendValue>
          </LegendRow>
          <LegendRow>
            <Dot $c="#fb923c" />
            <LegendLabel>🧡 고강도</LegendLabel>
            <LegendValue>{zones.high}분</LegendValue>
          </LegendRow>
          <LegendRow>
            <Dot $c="#ef4444" />
            <LegendLabel>❤️ 최대강도</LegendLabel>
            <LegendValue>{zones.peak}분</LegendValue>
          </LegendRow>
        </LegendList>
      </Body>

      <MetricsGrid>
        <Metric>
          <MetricVal>
            {restingHR}
            <MetricUnit>bpm</MetricUnit>
          </MetricVal>
          <MetricLbl>안정시 심박</MetricLbl>
        </Metric>
        <Metric>
          <MetricVal>
            {hrMax}
            <MetricUnit>bpm</MetricUnit>
          </MetricVal>
          <MetricLbl>최대 심박</MetricLbl>
        </Metric>
        <Metric>
          <MetricVal>{vo2}</MetricVal>
          <MetricLbl>VO₂max 추정</MetricLbl>
        </Metric>
      </MetricsGrid>

      <Advice>{advice}</Advice>
    </Section>
  );
}
