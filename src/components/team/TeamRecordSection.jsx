/* eslint-disable */
// src/components/team/TeamRecordSection.jsx
// 팀 프로필: 팀 전적 상세 (승률 헤드라인 + 승/무/패 비율 + 최근 폼 + 평균 득실)
//  - stats: clubs/{clubId}.stats (SSOT)
//  - matches: 무효 제외 + 스코어 확정된 finished 경기 (최신순) — 평균 득실/최근 폼 산출용
//  - rating: { avg, count } 참가자 리뷰 평균 (평판 SSOT)
import React, { useMemo } from "react";
import styled from "styled-components";
import { WinChip, DrawChip, LoseChip } from "../common/ResultChip";

const WIN = "#16a34a";
const DRAW = "#9ca3af";
const LOSE = "#dc2626";

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
`;

const HeadRow = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
`;

const RateBlock = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
`;

const RateNum = styled.span`
  font-size: 38px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const RateUnit = styled.span`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const RateCaption = styled.span`
  margin-left: 2px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const HeadRight = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
`;

const RecordText = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textNormal};
  white-space: nowrap;
`;

const StreakPill = styled.span`
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  white-space: nowrap;
  background: ${({ $tone, theme }) =>
    theme.mode === "dark"
      ? $tone === "W"
        ? "rgba(22,163,74,0.20)"
        : $tone === "L"
        ? "rgba(220,38,38,0.20)"
        : "rgba(255,255,255,0.08)"
      : $tone === "W"
      ? "#ecfdf5"
      : $tone === "L"
      ? "#fef2f2"
      : "#f3f4f6"};
  color: ${({ $tone, theme }) =>
    $tone === "W" ? WIN : $tone === "L" ? LOSE : theme.colors.textWeak};
`;

/* 승/무/패 비율 바 */
const Bar = styled.div`
  margin-top: 14px;
  display: flex;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "#eef0f4"};
`;

const BarSeg = styled.div`
  width: ${({ $pct }) => `${$pct}%`};
  background: ${({ $color }) => $color};
`;

const Legend = styled.div`
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 14px;
`;

const LegendItem = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Dot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: ${({ $color }) => $color};
`;

const LegendNum = styled.span`
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

/* 구분선 */
const Divider = styled.div`
  height: 1px;
  margin: 14px 0;
  background: ${({ theme }) => theme.colors.border};
`;

/* 최근 폼 */
const FormRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const RowLabel = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const RowHint = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const FormChips = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

/* 평균 득실 */
const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
`;

const MetricCell = styled.div`
  padding: 11px 10px;
  border-radius: 8px;
  text-align: center;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.04)" : "#f7f8fa"};
`;

const MetricLabel = styled.div`
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const MetricValue = styled.div`
  margin-top: 5px;
  font-size: 19px;
  font-weight: 800;
  line-height: 1;
  color: ${({ $tone, theme }) =>
    $tone === "up" ? WIN : $tone === "down" ? LOSE : theme.colors.textStrong};
`;

const Note = styled.div`
  margin-top: 10px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const safeNum = (v, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// 최신이 index 0인 결과 배열에서 연승/연패 계산
const computeStreak = (results) => {
  const arr = Array.isArray(results) ? results : [];
  if (!arr.length) return null;
  const latest = arr[0];
  let count = 0;
  for (let i = 0; i < arr.length; i += 1) {
    if (arr[i] !== latest) break;
    count += 1;
  }
  return { type: latest, count };
};

const streakText = (s) => {
  if (!s) return "";
  if (s.type === "W") return `${s.count}연승 중`;
  if (s.type === "L") return `${s.count}연패 중`;
  return `${s.count}연무 중`;
};

export default function TeamRecordSection({
  stats,
  matches = [],
  recentResults = [],
  // 선수 프로필에서는 "출전 경기에서 팀이 낸 득실"이라 라벨/각주를 바꿔 쓴다
  forLabel = "평균 득점",
  againstLabel = "평균 실점",
  scoreNote = "",
}) {
  const s = stats || {};

  const base = useMemo(() => {
    const wins = safeNum(s.wins, 0);
    const losses = safeNum(s.losses, 0);
    const draws = safeNum(s.draws, 0);
    const total = safeNum(s.totalMatches, 0) || wins + losses + draws;

    const winRate =
      typeof s.winRate === "number" && Number.isFinite(s.winRate)
        ? Math.round(s.winRate * 100)
        : total > 0
        ? Math.round((wins / total) * 100)
        : 0;

    return { wins, losses, draws, total, winRate };
  }, [s]);

  // 평균 득실 — 스코어가 확정된 경기만
  const scoring = useMemo(() => {
    const arr = (Array.isArray(matches) ? matches : []).filter(
      (m) => Number.isFinite(Number(m?.myScore)) && Number.isFinite(Number(m?.oppScore))
    );
    if (!arr.length) return null;

    const forSum = arr.reduce((acc, m) => acc + Number(m.myScore), 0);
    const againstSum = arr.reduce((acc, m) => acc + Number(m.oppScore), 0);
    const avgFor = forSum / arr.length;
    const avgAgainst = againstSum / arr.length;

    return {
      count: arr.length,
      avgFor,
      avgAgainst,
      margin: avgFor - avgAgainst,
    };
  }, [matches]);

  // recentResults = 최신순 전체 결과. 폼 칩은 앞 5개만, 연승/연패는 전체로 센다.
  const form = useMemo(
    () => (Array.isArray(recentResults) ? recentResults.slice(0, 5) : []),
    [recentResults]
  );
  const streak = computeStreak(recentResults);

  const { winPct, drawPct, losePct } = useMemo(() => {
    const { wins, draws, losses, total } = base;
    if (total <= 0) return { winPct: 0, drawPct: 0, losePct: 0 };
    return {
      winPct: (wins / total) * 100,
      drawPct: (draws / total) * 100,
      losePct: (losses / total) * 100,
    };
  }, [base]);

  const marginText =
    scoring == null
      ? "-"
      : `${scoring.margin > 0 ? "+" : scoring.margin < 0 ? "" : "±"}${scoring.margin.toFixed(1)}`;

  return (
    <Wrap>
      <HeadRow>
        <RateBlock>
          <RateNum>{base.winRate}</RateNum>
          <RateUnit>%</RateUnit>
          <RateCaption>승률</RateCaption>
        </RateBlock>

        <HeadRight>
          <RecordText>
            {base.total}전 {base.wins}승 {base.draws}무 {base.losses}패
          </RecordText>
          {streak ? <StreakPill $tone={streak.type}>{streakText(streak)}</StreakPill> : null}
        </HeadRight>
      </HeadRow>

      <Bar>
        <BarSeg $pct={winPct} $color={WIN} />
        <BarSeg $pct={drawPct} $color={DRAW} />
        <BarSeg $pct={losePct} $color={LOSE} />
      </Bar>

      <Legend>
        <LegendItem>
          <Dot $color={WIN} />승 <LegendNum>{base.wins}</LegendNum>
        </LegendItem>
        <LegendItem>
          <Dot $color={DRAW} />무 <LegendNum>{base.draws}</LegendNum>
        </LegendItem>
        <LegendItem>
          <Dot $color={LOSE} />패 <LegendNum>{base.losses}</LegendNum>
        </LegendItem>
      </Legend>

      {form.length > 0 && (
        <>
          <Divider />
          <FormRow>
            <RowLabel>
              최근 {form.length}경기 <RowHint>(왼쪽이 오래된 경기)</RowHint>
            </RowLabel>
            <FormChips>
              {[...form].reverse().map((r, idx) => {
                if (r === "W") return <WinChip key={`form-${idx}`} size="sm" />;
                if (r === "D") return <DrawChip key={`form-${idx}`} size="sm" />;
                return <LoseChip key={`form-${idx}`} size="sm" />;
              })}
            </FormChips>
          </FormRow>
        </>
      )}

      <Divider />

      <MetricGrid>
        <MetricCell>
          <MetricLabel>{forLabel}</MetricLabel>
          <MetricValue>{scoring ? scoring.avgFor.toFixed(1) : "-"}</MetricValue>
        </MetricCell>
        <MetricCell>
          <MetricLabel>{againstLabel}</MetricLabel>
          <MetricValue>{scoring ? scoring.avgAgainst.toFixed(1) : "-"}</MetricValue>
        </MetricCell>
        <MetricCell>
          <MetricLabel>득실 마진</MetricLabel>
          <MetricValue
            $tone={
              scoring == null ? "" : scoring.margin > 0 ? "up" : scoring.margin < 0 ? "down" : ""
            }
          >
            {marginText}
          </MetricValue>
        </MetricCell>
      </MetricGrid>

      <Note>
        {scoring
          ? scoreNote || `스코어가 확정된 ${scoring.count}경기 기준 (무효 경기 제외)`
          : "스코어가 확정된 경기가 아직 없어 평균 득실을 계산할 수 없어요."}
      </Note>
    </Wrap>
  );
}
