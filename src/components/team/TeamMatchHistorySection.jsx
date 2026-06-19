/* eslint-disable */
// src/components/team/TeamMatchHistorySection.jsx
import React, { useMemo } from "react";
import styled from "styled-components";
import { WinChip, DrawChip, LoseChip } from "../common/ResultChip";
import EmptyState from "../common/EmptyState";

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Card = styled.button`
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 12px 12px;
  text-align: left;
  cursor: pointer;
  box-shadow: ${({ theme }) => theme.shadows.card};
  color: ${({ theme }) => theme.colors.textNormal};

  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const Title = styled.div`
  min-width: 0;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DateText = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
`;

const MidRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const ScoreText = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const Right = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const StatusPill = styled.div`
  padding: 4px 10px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "#f3f4f6"};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 12px;
  white-space: nowrap;
`;

const EmptyText = styled.div`
  padding: 8px 2px 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  text-align: center;
`;

const toStr = (v) => String(v || "").trim();

const formatKoreanDate = (isoOrDate) => {
  if (!isoOrDate) return "";
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return "";
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const day = dayNames[d.getDay()];
  return `${month}.${date} (${day})`;
};

const normalizeResult = (myScore, oppScore) => {
  if (myScore == null || oppScore == null) return null;
  if (myScore > oppScore) return "W";
  if (myScore < oppScore) return "L";
  return "D";
};

export default function TeamMatchHistorySection({
  teamClubId,
  teamName,
  matches,
  onClickMatch,
}) {
  const list = useMemo(() => {
    const arr = Array.isArray(matches) ? matches : [];
    const myId = toStr(teamClubId);

    const pickTeamId = (t) => toStr(t?.clubId || t?.id);
    const pickTeamName = (t) => toStr(t?.name) || "팀";
    const getTimeKey = (room) => {
    const v = room?.scheduledAt || room?.confirmedAt || room?.finishedAt || room?.updatedAt || room?.createdAt || null;
    if (!v) return 0;

    // Firestore Timestamp 대응
    if (v?.toDate && typeof v.toDate === "function") return v.toDate().getTime();

    const d = new Date(v);
    const t = d.getTime();
    return Number.isFinite(t) ? t : 0;
    };

    const getTieKey = (room) => {
    // 같은 시간일 때도 순서 고정(문자열 비교)
    const id = String(room?.id || "").trim();
    return id;
    };

    const sorted = [...arr].sort((a, b) => {
    const tb = getTimeKey(b);
    const ta = getTimeKey(a);
    if (tb !== ta) return tb - ta;

    const bi = getTieKey(b);
    const ai = getTieKey(a);
    // id 기준 역순(최근 생성이 위로 오게 보정 느낌)
    if (bi === ai) return 0;
    return bi > ai ? 1 : -1;
    });


    return sorted.map((room) => {
      const myTeam = room?.myTeam || null;
      const oppTeam = room?.oppTeam || null;

      const myTeamId = pickTeamId(myTeam);
      const oppTeamId = pickTeamId(oppTeam);

      const isMyTeamOnMySlot = myId && myTeamId && myId === myTeamId;
      const isMyTeamOnOppSlot = myId && oppTeamId && myId === oppTeamId;

      const opponent = isMyTeamOnMySlot ? oppTeam : isMyTeamOnOppSlot ? myTeam : oppTeam;
      const opponentName = pickTeamName(opponent);

      const baseDate = room?.scheduledAt || room?.createdAt || room?.updatedAt || null;
      const dateLabel = baseDate ? formatKoreanDate(baseDate) : "";

      const myScore = room?.myScore;
      const oppScore = room?.oppScore;

      // 점수 입력 방향이 “내 팀 기준”이 아니라면, 팀 위치에 따라 스왑
      const displayMyScore =
        isMyTeamOnOppSlot && !isMyTeamOnMySlot ? oppScore : myScore;
      const displayOppScore =
        isMyTeamOnOppSlot && !isMyTeamOnMySlot ? myScore : oppScore;

      const res = normalizeResult(displayMyScore, displayOppScore);

      const scoreText =
        displayMyScore != null && displayOppScore != null
          ? `${displayMyScore} : ${displayOppScore}`
          : "결과 입력 대기";

      const status = toStr(room?.status);

      const statusText =
        status === "finished" ? "종료" : status === "cancelled" ? "취소" : "기록";

      return {
        id: room?.id,
        opponentName,
        dateLabel,
        scoreText,
        result: res,
        statusText,
      };
    });
  }, [matches, teamClubId]);

  if (!list.length) return <EmptyState compact text="지난 경기 기록이 아직 없습니다." />;

  return (
    <Wrap>
      <List>
        {list.map((m) => (
          <Card key={m.id} type="button" onClick={() => onClickMatch && onClickMatch(m.id)}>
            <TopRow>
              <Title title={`${toStr(teamName) || "팀"} vs ${m.opponentName}`}>
                {toStr(teamName) || "팀"} vs {m.opponentName}
              </Title>
              <DateText>{m.dateLabel}</DateText>
            </TopRow>

            <MidRow>
              <ScoreText>{m.scoreText}</ScoreText>
              <Right>
                {m.result === "W" ? (
                  <WinChip size="sm" />
                ) : m.result === "D" ? (
                  <DrawChip size="sm" />
                ) : m.result === "L" ? (
                  <LoseChip size="sm" />
                ) : null}
                <StatusPill>{m.statusText}</StatusPill>
              </Right>
            </MidRow>
          </Card>
        ))}
      </List>
    </Wrap>
  );
}
