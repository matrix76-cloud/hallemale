/* eslint-disable */
// src/components/player/PlayerAbilitySection.jsx
// 선수 능력치 — OVR + 레이더차트 + 스탯바 (순수 SVG)

import React, { useMemo } from "react";
import styled from "styled-components";
import { TbBallBasketball } from "react-icons/tb";
import { calcAbility, getTier } from "../../services/playerAbilityCalculator";

const Section = styled.section`
  margin-top: 12px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f766e 100%);
  border-radius: 8px;
  padding: 16px;
  color: #ecfeff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.25);
  position: relative;
  overflow: hidden;
`;

const BgGlow = styled.div`
  position: absolute;
  inset: -40px;
  background: radial-gradient(circle at 80% 20%, rgba(20, 184, 166, 0.3), transparent 60%);
  pointer-events: none;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 2;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const MockBadge = styled.span`
  background: rgba(255,255,255,0.15);
  color: #a5f3fc;
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 999px;
`;

const OvrRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 14px;
  position: relative;
  z-index: 2;
`;

const OvrCircle = styled.div`
  width: 74px;
  height: 74px;
  border-radius: 999px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(251, 191, 36, 0.4);
  flex-shrink: 0;
`;

const OvrLabel = styled.div`
  font-size: 10px;
  color: #78350f;
  font-weight: 700;
  letter-spacing: 1px;
`;

const OvrValue = styled.div`
  font-size: 30px;
  font-weight: 900;
  color: #451a03;
  line-height: 1;
  margin-top: -2px;
`;

const TierPill = styled.div`
  background: ${({ $color }) => $color};
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  margin-top: 4px;
`;

const RadarWrap = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
`;

const StatsGrid = styled.div`
  margin-top: 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  position: relative;
  z-index: 2;
`;

const StatRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const StatHead = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 11px;
`;

const StatLabel = styled.span`
  color: #cbd5e1;
`;

const StatValue = styled.span`
  font-weight: 700;
  color: #fde68a;
`;

const BarTrack = styled.div`
  height: 6px;
  background: rgba(255,255,255,0.1);
  border-radius: 999px;
  overflow: hidden;
`;

const BarFill = styled.div`
  height: 100%;
  width: ${({ $v }) => $v}%;
  background: linear-gradient(90deg, #14b8a6, #fbbf24);
  border-radius: 999px;
  transition: width 0.8s ease;
`;

const MetaRow = styled.div`
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.1);
  position: relative;
  z-index: 2;
`;

const MetaItem = styled.div`
  text-align: center;
`;

const MetaVal = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: #a5f3fc;
`;

const MetaLbl = styled.div`
  font-size: 10px;
  color: #94a3b8;
  margin-top: 2px;
`;

function RadarChart({ values }) {
  // values: { stamina, intensity, recovery, burst, volume } 각 0~99
  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const R = 55;
  const axes = [
    { key: "stamina", label: "지구력" },
    { key: "intensity", label: "강도" },
    { key: "recovery", label: "회복력" },
    { key: "burst", label: "순발력" },
    { key: "volume", label: "활동량" },
  ];
  const pt = (i, r) => {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  };

  // 백그라운드 오각형 (3중)
  const bgRings = [0.33, 0.66, 1].map((ratio) =>
    axes.map((_, i) => pt(i, R * ratio).join(",")).join(" ")
  );

  // 실제 값 폴리곤
  const valPts = axes
    .map((a, i) => pt(i, (R * (values[a.key] || 0)) / 99).join(","))
    .join(" ");

  return (
    <svg width={size} height={size}>
      {bgRings.map((p, i) => (
        <polygon
          key={i}
          points={p}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.1)" />;
      })}
      <polygon
        points={valPts}
        fill="rgba(251, 191, 36, 0.35)"
        stroke="#fbbf24"
        strokeWidth="2"
      />
      {axes.map((a, i) => {
        const [x, y] = pt(i, R + 14);
        return (
          <text
            key={a.key}
            x={x}
            y={y}
            fontSize="9"
            fill="#e0f2fe"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}

export default function PlayerAbilitySection({ sessions = [], userProfile = {} }) {
  const ability = useMemo(() => calcAbility(sessions, userProfile), [sessions, userProfile]);

  if (!ability) {
    return (
      <Section>
        <BgGlow />
        <HeaderRow>
          <Title>
            <TbBallBasketball size={18} color="#fbbf24" />
            선수 능력치
          </Title>
        </HeaderRow>
        <div style={{ padding: "28px 0", textAlign: "center", color: "#94a3b8", fontSize: 12, position: "relative", zIndex: 2 }}>
          워치 연결 후 경기를 기록하면 능력치가 분석됩니다.
        </div>
      </Section>
    );
  }

  const tier = getTier(ability.ovr);

  const STATS = [
    { key: "stamina", label: "🏃 지구력" },
    { key: "intensity", label: "🔥 강도" },
    { key: "recovery", label: "🔋 회복력" },
    { key: "burst", label: "⚡ 순발력" },
    { key: "volume", label: "⏱ 활동량" },
  ];

  return (
    <Section>
      <BgGlow />
      <HeaderRow>
        <Title>
          <TbBallBasketball size={18} color="#fbbf24" />
          선수 능력치
        </Title>
      </HeaderRow>

      <OvrRow>
        <div>
          <OvrCircle>
            <OvrLabel>OVR</OvrLabel>
            <OvrValue>{ability.ovr}</OvrValue>
          </OvrCircle>
          <TierPill $color={tier.color}>{tier.label} 급</TierPill>
        </div>
        <RadarWrap>
          <RadarChart values={ability} />
        </RadarWrap>
      </OvrRow>

      <StatsGrid>
        {STATS.map((s) => (
          <StatRow key={s.key}>
            <StatHead>
              <StatLabel>{s.label}</StatLabel>
              <StatValue>{ability[s.key]}</StatValue>
            </StatHead>
            <BarTrack>
              <BarFill $v={ability[s.key]} />
            </BarTrack>
          </StatRow>
        ))}
      </StatsGrid>

      <MetaRow>
        <MetaItem>
          <MetaVal>{ability.meta.sessionCount}</MetaVal>
          <MetaLbl>누적 경기</MetaLbl>
        </MetaItem>
        <MetaItem>
          <MetaVal>{Math.round(ability.meta.totalMinutes / 60)}h</MetaVal>
          <MetaLbl>총 시간</MetaLbl>
        </MetaItem>
        <MetaItem>
          <MetaVal>{ability.meta.avgHR}</MetaVal>
          <MetaLbl>평균 HR</MetaLbl>
        </MetaItem>
      </MetaRow>
    </Section>
  );
}
