/* eslint-disable */
// src/components/player/PlayerImpactSection.jsx
// 개인 선수 프로필: 팀 기여도 — 이 선수가 뛴 경기와 안 뛴 경기의 팀 승률 비교
//  - games: 소속 팀의 완료 경기 [{ id, scheduledAt, memberIds, myScore, oppScore }]
//           (loadTeamMonthlyActivity → 무효 경기는 이미 빠져 있음)
//  - myUid: 이 선수의 uid
import React, { useMemo } from "react";
import styled from "styled-components";

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
`;

const CmpRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  & + & {
    margin-top: 11px;
  }
`;

const CmpLabel = styled.span`
  flex-shrink: 0;
  width: 58px;
  font-size: 12.5px;
  font-weight: ${({ $me }) => ($me ? 700 : 500)};
  color: ${({ $me, theme }) => ($me ? theme.colors.textStrong : theme.colors.textWeak)};
`;

const Track = styled.div`
  flex: 1;
  height: 9px;
  border-radius: 999px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "#edeef2"};
`;

const Fill = styled.div`
  height: 100%;
  border-radius: 999px;
  width: ${({ $pct }) => `${$pct}%`};
  background: ${({ $me, theme }) =>
    $me
      ? theme.colors.primary
      : theme.mode === "dark"
      ? "rgba(255,255,255,0.28)"
      : "#c7cad1"};
`;

const CmpVal = styled.span`
  flex-shrink: 0;
  width: 62px;
  text-align: right;
  font-size: 13px;
  font-weight: 800;
  color: ${({ $me, theme }) => ($me ? theme.colors.textStrong : theme.colors.textWeak)};

  & small {
    margin-left: 4px;
    font-size: 11px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Divider = styled.div`
  height: 1px;
  margin: 14px 0;
  background: ${({ theme }) => theme.colors.border};
`;

const Row = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;

  & + & {
    border-top: 1px solid ${({ theme }) => theme.colors.divider};
  }
`;

const RowKey = styled.span`
  flex-shrink: 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const RowVal = styled.span`
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
  text-align: right;
`;

const Note = styled.div`
  margin-top: 12px;
  font-size: 12.5px;
  line-height: 1.55;
  color: ${({ theme }) => theme.colors.textWeak};

  & b {
    font-weight: 800;
    color: ${({ theme }) => theme.colors.textStrong};
  }
`;

const Empty = styled.div`
  padding: 14px 0 2px;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const toStr = (v) => String(v || "").trim();

const tsMs = (v) => {
  if (!v) return 0;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.toDate === "function") return v.toDate().getTime();
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
};

const formatDayGap = (ms, now) => {
  if (!ms) return "";
  const days = Math.floor((now - ms) / 86400000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 30) return `${days}일 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전`;
  return `${Math.floor(months / 12)}년 전`;
};

const tally = (arr) => {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  arr.forEach((g) => {
    const my = Number(g?.myScore);
    const opp = Number(g?.oppScore);
    if (!Number.isFinite(my) || !Number.isFinite(opp)) return;
    if (my > opp) wins += 1;
    else if (my < opp) losses += 1;
    else draws += 1;
  });
  const total = wins + draws + losses;
  return { wins, draws, losses, total, rate: total ? Math.round((wins / total) * 100) : 0 };
};

export default function PlayerImpactSection({
  games = [],
  myUid = "",
  playerName = "",
  isSelf = true,
}) {
  const now = useMemo(() => Date.now(), []);
  const me = toStr(myUid);

  const v = useMemo(() => {
    const scored = (Array.isArray(games) ? games : []).filter(
      (g) => Number.isFinite(Number(g?.myScore)) && Number.isFinite(Number(g?.oppScore))
    );

    const onGames = scored.filter((g) => (g?.memberIds || []).map(toStr).includes(me));
    const offGames = scored.filter((g) => !(g?.memberIds || []).map(toStr).includes(me));

    const lastOn = onGames.reduce((acc, g) => Math.max(acc, tsMs(g?.scheduledAt)), 0);

    return { on: tally(onGames), off: tally(offGames), teamTotal: scored.length, lastOn };
  }, [games, me]);

  if (v.on.total === 0) {
    return (
      <Empty>
        {isSelf ? "출전한" : `${toStr(playerName) || "이 선수"}가 출전한`} 경기 기록이 아직 없어요.
      </Empty>
    );
  }

  const diff = v.off.total > 0 ? v.on.rate - v.off.rate : null;
  const who = isSelf ? "내가" : `${toStr(playerName) || "이 선수"}가`;

  return (
    <Wrap>
      <CmpRow>
        <CmpLabel $me>출전 시</CmpLabel>
        <Track>
          <Fill $me $pct={v.on.rate} />
        </Track>
        <CmpVal $me>
          {v.on.rate}%<small>{v.on.total}경기</small>
        </CmpVal>
      </CmpRow>
      <CmpRow>
        <CmpLabel>미출전 시</CmpLabel>
        <Track>
          <Fill $pct={v.off.rate} />
        </Track>
        <CmpVal>
          {v.off.total > 0 ? `${v.off.rate}%` : "-"}
          <small>{v.off.total}경기</small>
        </CmpVal>
      </CmpRow>

      <Divider />

      <Row>
        <RowKey>출전 / 팀 전체</RowKey>
        <RowVal>
          {v.on.total} / {v.teamTotal}경기 (
          {v.teamTotal ? Math.round((v.on.total / v.teamTotal) * 100) : 0}%)
        </RowVal>
      </Row>
      <Row>
        <RowKey>출전 경기 전적</RowKey>
        <RowVal>
          {v.on.wins}승 {v.on.draws}무 {v.on.losses}패
        </RowVal>
      </Row>
      {v.lastOn ? (
        <Row>
          <RowKey>마지막 출전</RowKey>
          <RowVal>{formatDayGap(v.lastOn, now)}</RowVal>
        </Row>
      ) : null}

      <Note>
        {diff === null ? (
          <>팀의 모든 경기에 출전해 미출전 경기와 비교할 수 없어요.</>
        ) : diff > 0 ? (
          <>
            {who} 뛴 경기의 팀 승률이 <b>{diff}%p</b> 높아요.
          </>
        ) : diff < 0 ? (
          <>
            {who} 뛴 경기의 팀 승률이 <b>{Math.abs(diff)}%p</b> 낮아요.
          </>
        ) : (
          <>출전 여부에 따른 팀 승률 차이가 거의 없어요.</>
        )}
      </Note>
    </Wrap>
  );
}
