/* eslint-disable */
// src/components/team/TeamScoutingSection.jsx
// 팀 프로필: 상대 분석 — 우리 팀과의 상대 전적 + 주 경기 형식 + 활동 빈도
//  - matches: 이 팀의 finished(무효 제외) 경기 (이 팀 관점의 myScore/oppScore)
//  - myClubId: 보는 사람의 소속 팀 — 있으면 맞대결 전적 계산
import React, { useMemo } from "react";
import styled from "styled-components";

const WIN = "#16a34a";
const LOSE = "#dc2626";

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
`;

const H2H = styled.div`
  padding: 12px 13px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.04)" : "#f7f8fa"};
`;

const H2HTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const H2HLabel = styled.span`
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const H2HRecord = styled.span`
  font-size: 15px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};

  & b {
    color: ${({ $tone }) => ($tone === "up" ? WIN : $tone === "down" ? LOSE : "inherit")};
  }
`;

const H2HLast = styled.div`
  margin-top: 7px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const List = styled.div`
  margin-top: ${({ $gap }) => ($gap ? "12px" : "0")};
  display: flex;
  flex-direction: column;
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

const RowSub = styled.span`
  margin-left: 6px;
  font-size: 11.5px;
  font-weight: 400;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Empty = styled.div`
  padding: 14px 0 2px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  text-align: center;
`;

const toStr = (v) => String(v || "").trim();

const tsMs = (v) => {
  if (!v) return 0;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.toDate === "function") return v.toDate().getTime();
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
};

const MATCH_SIZE_LABEL = {
  "3v3": "3 vs 3",
  "4v4": "4 vs 4",
  "5v5": "5 vs 5",
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

const formatShortDate = (ms) => {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getMonth() + 1}.${d.getDate()}`;
};

export default function TeamScoutingSection({ matches = [], myClubId = "", teamName = "" }) {
  const now = useMemo(() => Date.now(), []);
  const list = Array.isArray(matches) ? matches : [];

  // 우리 팀과의 맞대결 (보는 사람 관점으로 승패 반전 — matches는 이 팀 관점)
  const h2h = useMemo(() => {
    const mine = toStr(myClubId);
    if (!mine) return null;

    const games = list.filter((m) => toStr(m?.oppTeam?.clubId || m?.oppTeam?.id) === mine);
    if (!games.length) return null;

    let wins = 0;
    let draws = 0;
    let losses = 0;
    games.forEach((m) => {
      const them = Number(m?.myScore);
      const us = Number(m?.oppScore);
      if (!Number.isFinite(them) || !Number.isFinite(us)) return;
      if (us > them) wins += 1;
      else if (us < them) losses += 1;
      else draws += 1;
    });

    const latest = [...games].sort((a, b) => tsMs(b?.scheduledAt) - tsMs(a?.scheduledAt))[0];
    const lm = tsMs(latest?.scheduledAt);
    const them = Number(latest?.myScore);
    const us = Number(latest?.oppScore);
    const lastText =
      Number.isFinite(them) && Number.isFinite(us)
        ? `${formatShortDate(lm)} ${us} : ${them} ${us > them ? "승" : us < them ? "패" : "무"}`
        : "";

    return { total: games.length, wins, draws, losses, lastText };
  }, [list, myClubId]);

  // 주 경기 형식
  const sizeTop = useMemo(() => {
    const counter = new Map();
    list.forEach((m) => {
      const key = toStr(m?.matchSizeKey);
      if (!MATCH_SIZE_LABEL[key]) return;
      counter.set(key, (counter.get(key) || 0) + 1);
    });
    if (!counter.size) return null;

    let bestKey = "";
    let bestCount = 0;
    let total = 0;
    counter.forEach((cnt, key) => {
      total += cnt;
      if (cnt > bestCount) {
        bestCount = cnt;
        bestKey = key;
      }
    });
    return { label: MATCH_SIZE_LABEL[bestKey], count: bestCount, total };
  }, [list]);

  // 활동 빈도
  const activity = useMemo(() => {
    const stamps = list.map((m) => tsMs(m?.scheduledAt)).filter((t) => t > 0);
    if (!stamps.length) return null;

    const last = Math.max(...stamps);
    const in90 = stamps.filter((t) => now - t <= 90 * 86400000).length;
    return { last, in90 };
  }, [list, now]);

  const hasAny = !!h2h || !!sizeTop || !!activity;

  if (!hasAny) {
    return (
      <Empty>
        완료된 경기가 쌓이면 {toStr(teamName) || "이 팀"}의 경기 성향을 여기서 볼 수 있어요.
      </Empty>
    );
  }

  return (
    <Wrap>
      {h2h ? (
        <H2H>
          <H2HTop>
            <H2HLabel>우리 팀과의 상대 전적</H2HLabel>
            <H2HRecord $tone={h2h.wins > h2h.losses ? "up" : h2h.wins < h2h.losses ? "down" : ""}>
              {h2h.total}전 <b>{h2h.wins}승</b> {h2h.draws > 0 ? `${h2h.draws}무 ` : ""}
              {h2h.losses}패
            </H2HRecord>
          </H2HTop>
          {h2h.lastText ? <H2HLast>최근 맞대결 · {h2h.lastText}</H2HLast> : null}
        </H2H>
      ) : null}

      <List $gap={!!h2h}>
        {sizeTop ? (
          <Row>
            <RowKey>주 경기 형식</RowKey>
            <RowVal>
              {sizeTop.label}
              <RowSub>
                {sizeTop.total}경기 중 {sizeTop.count}
              </RowSub>
            </RowVal>
          </Row>
        ) : null}

        {activity ? (
          <>
            <Row>
              <RowKey>최근 3개월 경기</RowKey>
              <RowVal>{activity.in90}경기</RowVal>
            </Row>
            <Row>
              <RowKey>마지막 경기</RowKey>
              <RowVal>
                {formatDayGap(activity.last, now)}
                <RowSub>{formatShortDate(activity.last)}</RowSub>
              </RowVal>
            </Row>
          </>
        ) : null}
      </List>
    </Wrap>
  );
}
