/* eslint-disable */
// src/components/player/PlayerMonthlyActivitySection.jsx
// 개인 선수 프로필: 월별 활동 기록 + 팀 대비 참여율
//  - games: [{ id, scheduledAt, memberIds }] (loadPlayerMonthlyActivity → 팀 경기)
//  - memberUids: 팀원 uid 목록 (참여율/순위/팀평균 계산용)
//  - myUid: 이 선수의 uid
import React, { useMemo } from "react";
import styled, { useTheme } from "styled-components";
import { FiBarChart2, FiCalendar, FiPercent } from "react-icons/fi";

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
  color: ${({ $accent, theme }) => ($accent ? "#fff" : theme.colors.textStrong)};
`;

const SumTop = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 700;
  color: ${({ $accent, theme }) =>
    $accent ? "rgba(255,255,255,0.95)" : theme.colors.textWeak};
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

const SumSub = styled.div`
  margin-top: 8px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ $accent, theme }) =>
    $accent ? "rgba(255,255,255,0.9)" : theme.colors.textWeak};
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

const CompareTitle = styled.div`
  font-size: 15px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
`;

const CmpRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  & + & {
    margin-top: 12px;
  }
`;

const CmpLabel = styled.span`
  flex-shrink: 0;
  width: 56px;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${({ $me, theme }) => ($me ? theme.colors.textStrong : theme.colors.textWeak)};
`;

const Track = styled.div`
  flex: 1;
  height: 9px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "#edeef2"};
  overflow: hidden;
`;

const Fill = styled.div`
  height: 100%;
  border-radius: 999px;
  width: ${({ $pct }) => `${$pct}%`};
  background: ${({ $me, theme }) =>
    $me ? PURPLE : theme.mode === "dark" ? "rgba(255,255,255,0.28)" : "#c7cad1"};
`;

const CmpPct = styled.span`
  flex-shrink: 0;
  width: 44px;
  text-align: right;
  font-size: 14px;
  font-weight: 800;
  color: ${({ $me, theme }) => ($me ? theme.colors.textStrong : theme.colors.textWeak)};
`;

const NoteBox = styled.div`
  margin-top: 14px;
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 12.5px;
  line-height: 1.55;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(124,92,201,0.14)" : "#f1effe"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#c4b5fd" : "#5b4bd6")};
  & b {
    font-weight: 800;
  }
`;

const EmptyHint = styled.div`
  padding: 18px 0;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

function BarChart({ data, teamLine, color, labelColor, axisColor, lineColor, activeKey }) {
  const W = 320;
  const H = 150;
  const padX = 16;
  const padTop = 24;
  const padBottom = 26;
  const max = Math.max(...data.map((d) => d.count), teamLine, 1);
  const slot = (W - padX * 2) / data.length;
  const bw = Math.min(slot - 14, 30);
  const plotH = H - padTop - padBottom;
  // 막대는 점선(teamLine=최댓값) 높이의 80%까지만 그려 점선과 막대 사이 여백 확보
  const barScale = 0.8;
  const lineY = H - padBottom - (teamLine / max) * plotH;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {teamLine > 0 && (
        <>
          <line
            x1={padX}
            x2={W - padX}
            y1={lineY}
            y2={lineY}
            stroke={lineColor}
            strokeWidth="1.4"
            strokeDasharray="5 4"
          />
          <text x={W - padX} y={lineY - 5} fontSize="10" fill={lineColor} textAnchor="end" fontWeight="800">
            팀 경기 {teamLine}
          </text>
        </>
      )}
      {data.map((d, i) => {
        const h = (d.count / max) * plotH * barScale;
        const x = padX + i * slot + (slot - bw) / 2;
        const y = H - padBottom - h;
        const isActive = d.key === activeKey;
        return (
          <g key={d.key}>
            {d.count > 0 ? (
              <>
                <rect x={x} y={y} width={bw} height={Math.max(h, 3)} fill={color} rx="5" />
                <text x={x + bw / 2} y={y - 5} fontSize="11" fill={labelColor} fontWeight="800" textAnchor="middle">
                  {d.count}
                </text>
              </>
            ) : (
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

export default function PlayerMonthlyActivitySection({
  games = [],
  memberUids = [],
  myUid = "",
  isSelf = true,
  playerName = "",
}) {
  const theme = useTheme();
  const me = String(myUid || "").trim();
  // 3자 시점(다른 선수 프로필)에선 "나/내" 대신 선수 이름/중립 표현
  const meLabel = isSelf ? "나" : String(playerName || "").trim() || "이 선수";

  const v = useMemo(() => {
    // 최근 6개월 고정 축
    const base = new Date();
    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth() + 1}`, label: `${d.getMonth() + 1}월`, count: 0 });
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
      inWindow.push({ ...g, _key: key });
    }

    const totalTeam = inWindow.length;

    // 내 월별 경기 수
    for (const g of inWindow) {
      if ((g.memberIds || []).includes(me)) months[idx.get(g._key)].count += 1;
    }
    const myGames = inWindow.filter((g) => (g.memberIds || []).includes(me)).length;
    const myPct = totalTeam ? Math.round((myGames / totalTeam) * 100) : 0;

    // 팀원 명단(나 포함) 기준 참여 수
    const roster = Array.from(new Set([...(memberUids || []).map((x) => String(x || "").trim()).filter(Boolean), me].filter(Boolean)));
    const gamesByMember = roster.map((u) => ({
      uid: u,
      games: inWindow.filter((g) => (g.memberIds || []).includes(u)).length,
    }));

    const memberCount = roster.length;
    const sumGames = gamesByMember.reduce((s, m) => s + m.games, 0);
    const teamAvgPct =
      memberCount && totalTeam ? Math.round((sumGames / memberCount / totalTeam) * 100) : 0;

    // 내 순위 (참여 경기 수 내림차순, 동점은 같은 순위)
    const rank = 1 + gamesByMember.filter((m) => m.games > myGames).length;

    return { months, activeKey, totalTeam, myGames, myPct, teamAvgPct, rank, memberCount };
  }, [games, memberUids, me]);

  const diff = v.myPct - v.teamAvgPct;
  let note = null;
  if (v.totalTeam > 0) {
    if (diff >= 1) {
      note = isSelf ? (
        <>
          팀 평균보다 <b>{diff}%p</b> 더 자주 나왔어요. 꾸준한 참여 중이에요 👍
        </>
      ) : (
        <>
          팀 평균보다 <b>{diff}%p</b> 더 자주 출전했어요. 꾸준히 참여하는 선수예요 👍
        </>
      );
    } else if (diff <= -1) {
      note = isSelf ? (
        <>
          팀 평균보다 <b>{Math.abs(diff)}%p</b> 적게 나왔어요. 조금 더 자주 나와볼까요?
        </>
      ) : (
        <>
          팀 평균보다 <b>{Math.abs(diff)}%p</b> 적게 출전했어요.
        </>
      );
    } else {
      note = <>팀 평균과 비슷한 참여율이에요.</>;
    }
  }

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
            참여 경기
          </SumTop>
          <SumVal>
            {v.myGames}
            <span>경기</span>
          </SumVal>
          <SumSub>팀 {v.totalTeam}경기 중</SumSub>
        </SumCard>
        <SumCard $accent>
          <SumTop $accent>
            <FiPercent size={14} />
            {isSelf ? "내 참여율" : "참여율"}
          </SumTop>
          <SumVal>
            {v.myPct}
            <span>%</span>
          </SumVal>
          <SumSub $accent>
            {v.totalTeam > 0 ? `팀 내 ${v.rank}위 · ${v.memberCount}명 중` : `팀원 ${v.memberCount}명`}
          </SumSub>
        </SumCard>
      </SummaryGrid>

      <ChartWrap>
        <ChartLbl>{isSelf ? "월별 내 경기 수" : "월별 경기 수"}</ChartLbl>
        <BarChart
          data={v.months}
          teamLine={v.totalTeam}
          color={PURPLE}
          labelColor={theme.colors.textStrong}
          axisColor={theme.colors.textWeak}
          lineColor={theme.colors.textWeak}
          activeKey={v.activeKey}
        />
      </ChartWrap>

      <Divider />

      <CompareTitle>
        <FiBarChart2 size={16} color={PURPLE} />
        팀 대비 참여
      </CompareTitle>

      {v.totalTeam === 0 ? (
        <EmptyHint>최근 6개월간 완료된 경기가 없어요.</EmptyHint>
      ) : (
        <>
          <CmpRow>
            <CmpLabel $me title={meLabel}>{meLabel}</CmpLabel>
            <Track>
              <Fill $me $pct={v.myPct} />
            </Track>
            <CmpPct $me>{v.myPct}%</CmpPct>
          </CmpRow>
          <CmpRow>
            <CmpLabel>팀 평균</CmpLabel>
            <Track>
              <Fill $pct={v.teamAvgPct} />
            </Track>
            <CmpPct>{v.teamAvgPct}%</CmpPct>
          </CmpRow>
          {note ? <NoteBox>{note}</NoteBox> : null}
        </>
      )}
    </Section>
  );
}
