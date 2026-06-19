/* eslint-disable */
// src/components/team/TeamStatsSection.jsx
import React, { useMemo } from "react";
import styled from "styled-components";

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 92px 1fr;
  align-items: center;
  gap: 10px;
`;

const Label = styled.div`
  font-size: 14px;
  color: #6b7280;
`;

const Value = styled.div`
  font-size: 16px;
  color: #111827;
  text-align: right;

`;

const ValueSmall = styled.div`
  font-size: 16px;
  color: #111827;
  text-align: right;

`;

const ValueText = styled.div`
  font-size: 16px;
  color: #111827;
  text-align: right;

`;

const safeNumber = (v, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function computeWinRatePercent(stats) {
  const s = stats || {};
  const total = safeNumber(s.totalMatches, 0);
  const wins = safeNumber(s.wins, 0);

  if (typeof s.winRate === "number" && Number.isFinite(s.winRate)) {
    return Math.round(s.winRate * 100);
  }
  if (total > 0) return Math.round((wins / total) * 100);
  return 0;
}

// ✅ 최신이 index 0인 recentResults에서 “최근 상태” 계산 (matchRoomService.computeNextStats 기준)
function computeStreakFromRecentResultsLast(recentResults) {
  const arr = Array.isArray(recentResults) ? recentResults : [];
  if (arr.length === 0) return { type: null, count: 0 };

  const normalize = (x) => {
    const v = String(x || "").trim().toUpperCase();
    if (v === "W") return "W";
    if (v === "L") return "L";
    if (v === "D") return "D";
    if (v.includes("승")) return "W";
    if (v.includes("패")) return "L";
    if (v.includes("무")) return "D";
    return null;
  };

  const latest = normalize(arr[0]);
  if (!latest) return { type: null, count: 0 };

  let count = 0;
  for (let i = 0; i < arr.length; i += 1) {
    const cur = normalize(arr[i]);
    if (cur !== latest) break;
    count += 1;
  }
  return { type: latest, count };
}

function formatStreakText(streakObj) {
  if (!streakObj || !streakObj.type || !streakObj.count) return "-";
  if (streakObj.type === "W") return `${streakObj.count}연승 중`;
  if (streakObj.type === "L") return `${streakObj.count}연패 중`;
  return `${streakObj.count}연무 중`;
}

export default function TeamStatsSection({ stats }) {
  const s = stats || {};

  const computed = useMemo(() => {
    const totalMatches = safeNumber(s.totalMatches, 0);
    const wins = safeNumber(s.wins, 0);
    const losses = safeNumber(s.losses, 0);
    const draws = safeNumber(s.draws, 0);

    const winRatePercent = computeWinRatePercent(s);
    const streakObj = computeStreakFromRecentResultsLast(s.recentResults);

    const detailText = `${totalMatches}전 ${wins}승 ${losses}패 ${draws}무`;

    return {
      totalMatches,
      winRatePercent,
      streakText: formatStreakText(streakObj),
      detailText,
    };
  }, [s]);

  return (
    <Wrap>
      <Row>
        <Label>경기 수</Label>
        <Value>{computed.totalMatches}</Value>
      </Row>

      <Row>
        <Label>승률</Label>
        <ValueSmall>{computed.winRatePercent}%</ValueSmall>
      </Row>

      <Row>
        <Label>최근 상태</Label>
        <ValueText>{computed.streakText}</ValueText>
      </Row>

      <Row>
        <Label>상세</Label>
        <ValueText>{computed.detailText}</ValueText>
      </Row>
    </Wrap>
  );
}
