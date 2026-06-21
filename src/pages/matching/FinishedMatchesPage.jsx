/* eslint-disable */
// src/pages/matching/FinishedMatchesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import Spinner from "../../components/common/Spinner";
import { teamLogoSrc } from "../../utils/imageAssets";
import { listFinishedMatchesPage } from "../../services/matchRoomService";
import { getTeamRankMap } from "../../services/teamRankingService";
import { useClub } from "../../hooks/useClub";
import EmptyState from "../../components/common/EmptyState";

const toStr = (v) => String(v || "").trim();

const formatKoreanDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const day = dayNames[d.getDay()];
  const hour = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${month}.${date} (${day}) ${hour}:${min}`;
};

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  padding: 10px 0 24px;
  display: flex;
  flex-direction: column;
`;

const Inner = styled.div`
  padding: 0 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

/* ===== 완료된 경기 카드 (지난 경기 '완료된 경기'와 동일 스타일) ===== */
const CompletedCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 13px;
  padding: 12px 14px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  cursor: pointer;
  &:active {
    transform: translateY(1px);
  }
`;

const CardTopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
`;

const CardDate = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ResultBadge = styled.span`
  font-size: 11px;
  font-weight: 700;
  ${({ $outcome, theme }) => {
    const dark = theme.mode === "dark";
    if ($outcome === "win") return `color:${dark ? "#6ee0ab" : "#1e9e70"};`;
    if ($outcome === "lose") return `color:${dark ? "#f87171" : "#dc2626"};`;
    return `color:${dark ? "#b6b6bf" : "#65656e"};`;
  }}
`;

const TeamsMini = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 8px;
`;

const MiniTeam = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
`;

const MiniLogo = styled.div`
  width: 38px;
  height: 38px;
  border-radius: 10px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
`;

const MiniLogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

/* 팀명(중앙 고정) + 랭킹(그 옆) 한 줄 배치 — 이름이 가운데 칸에 와서 위치가 밀리지 않음 */
const NameRow = styled.div`
  display: grid;
  grid-template-columns: 1fr minmax(0, auto) 1fr;
  align-items: baseline;
  width: 100%;
  column-gap: 4px;
`;

const MiniName = styled.span`
  grid-column: 2;
  justify-self: center;
  min-width: 0;
  max-width: 100%;
  font-size: 11.5px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/* 랭킹 — 배경 없이 회색 텍스트만 */
const RankTag = styled.span`
  grid-column: 3;
  justify-self: start;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ScoreMid = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 9px;
`;

const ScoreNum = styled.span`
  font-size: 21px;
  font-weight: 800;
  ${({ $tone, theme }) => {
    const dark = theme.mode === "dark";
    // 내 팀 점수: 승=초록, 패=빨강. 무승부/상대 점수=기본 글씨색
    if ($tone === "win") return `color:${dark ? "#6ee0ab" : "#1e9e70"};`;
    if ($tone === "lose") return `color:${dark ? "#f87171" : "#dc2626"};`;
    return `color:${theme.colors.textStrong};`;
  }}
`;

const ScoreColon = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const LoadMoreRow = styled.div`
  display: flex;
  justify-content: center;
  padding-top: 4px;
`;

const LoadMoreBtn = styled.button`
  border: none;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 13px;
  padding: 10px 14px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }
`;

const EmptyCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 18px 14px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 13px;
  text-align: center;
`;

const ErrorCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  padding: 18px 14px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  color: ${({ theme }) => theme.colors.danger};
  font-size: 13px;
  line-height: 1.5;
`;

export default function FinishedMatchesPage() {
  const nav = useNavigate();
  const { club } = useClub();
  const myClubId = String(club?.clubId || club?.id || "").trim();

  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [rankMap, setRankMap] = useState(null);

  const load = async ({ reset = false } = {}) => {
    if (busy) return;
    if (!reset && done) return;

    setBusy(true);
    setError("");

    try {
      const res = await listFinishedMatchesPage({
        pageSize: 16,
        cursor: reset ? null : cursor,
        clubId: myClubId,
        debugLog: false,
      });

      const nextRows = Array.isArray(res?.rows) ? res.rows : [];
      const nextCursor = res?.nextCursor || null;

      setRows((prev) => (reset ? nextRows : [...(prev || []), ...nextRows]));
      setCursor(nextCursor);

      if (!nextCursor || nextRows.length < 16) setDone(true);
    } catch (e) {
      setError(
        e?.code === "permission-denied"
          ? "권한 문제로 경기를 불러올 수 없습니다. (Firestore Rules 확인 필요)"
          : e?.message || "불러오기에 실패했습니다."
      );
      setDone(true);
    } finally {
      setBusy(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myClubId]);

  // ✅ 팀 랭킹(전역 등수) 로드 — 팀 이름 옆 "N위" 표시용
  useEffect(() => {
    let alive = true;
    getTeamRankMap({ debugLog: false })
      .then((map) => {
        if (alive) setRankMap(map);
      })
      .catch((e) => {
        console.warn("[FinishedMatchesPage] getTeamRankMap failed:", e?.message || e);
      });
    return () => {
      alive = false;
    };
  }, []);

  const viewRows = useMemo(() => {
    return (rows || []).map((r) => {
      // 내 팀이 왼쪽에 오도록 정렬(완료된 경기 카드와 동일 관점) + 승/패 판정
      const iAmActor = !myClubId || toStr(r?.actorClubId) === toStr(myClubId);
      const myTeam = iAmActor ? r?.actorTeam : r?.targetTeam;
      const oppTeam = iAmActor ? r?.targetTeam : r?.actorTeam;
      const myScoreRaw = iAmActor ? r?.actorScore : r?.targetScore;
      const oppScoreRaw = iAmActor ? r?.targetScore : r?.actorScore;

      const myLogo = teamLogoSrc(toStr(myTeam?.logoUrl));
      const oppLogo = teamLogoSrc(toStr(oppTeam?.logoUrl));
      const myName = toStr(myTeam?.name) || "우리팀";
      const oppName = toStr(oppTeam?.name) || "상대팀";

      const myClubIdRow = toStr(myTeam?.clubId) || (iAmActor ? toStr(r?.actorClubId) : toStr(r?.targetClubId));
      const oppClubIdRow = toStr(oppTeam?.clubId) || (iAmActor ? toStr(r?.targetClubId) : toStr(r?.actorClubId));
      const myRank = rankMap?.get(myClubIdRow) || null;
      const oppRank = rankMap?.get(oppClubIdRow) || null;

      const when = r?.scheduledAt ? formatKoreanDateTime(r.scheduledAt) : "";

      const myNum = myScoreRaw != null && myScoreRaw !== "" ? Number(myScoreRaw) : null;
      const oppNum = oppScoreRaw != null && oppScoreRaw !== "" ? Number(oppScoreRaw) : null;
      const hasScore = Number.isFinite(myNum) && Number.isFinite(oppNum);
      const outcome = !hasScore
        ? null
        : myNum > oppNum
        ? "win"
        : myNum < oppNum
        ? "lose"
        : "draw";

      return {
        ...r,
        myLogo,
        oppLogo,
        myName,
        oppName,
        myRank,
        oppRank,
        when,
        myScore: hasScore ? myNum : "-",
        oppScore: hasScore ? oppNum : "-",
        hasScore,
        outcome,
      };
    });
  }, [rows, myClubId, rankMap]);

  const openDetail = (id) => {
    if (!id) return;
    nav(`/match-roomdetail/${id}`);
  };

  return (
    <PageWrap>
      <Inner>
        {loading ? (
          <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Spinner />
          </div>
        ) : null}

        {!loading && error ? <ErrorCard>{error}</ErrorCard> : null}

        {!loading && !error && viewRows.length === 0 ? (
          <EmptyState text={myClubId ? "내 팀의 완료된 경기가 없습니다." : "완료된 경기가 없습니다."} />
        ) : null}

        {viewRows.map((r) => (
          <CompletedCard
            key={r.id}
            onClick={() => openDetail(r.id)}
            role="button"
            tabIndex={0}
          >
            <CardTopRow>
              {r.when ? <CardDate>{r.when}</CardDate> : <span />}
              {r.outcome && (
                <ResultBadge $outcome={r.outcome}>
                  {r.outcome === "win" ? "승리" : r.outcome === "lose" ? "패배" : "무승부"}
                </ResultBadge>
              )}
            </CardTopRow>

            <TeamsMini>
              <MiniTeam>
                <MiniLogo>
                  <MiniLogoImg src={r.myLogo} alt={r.myName} />
                </MiniLogo>
                <NameRow>
                  <MiniName title={r.myName}>{r.myName}</MiniName>
                  {r.myRank ? <RankTag>{r.myRank}위</RankTag> : null}
                </NameRow>
              </MiniTeam>

              <ScoreMid>
                <ScoreNum
                  $tone={r.outcome === "win" ? "win" : r.outcome === "lose" ? "lose" : "neutral"}
                >
                  {r.myScore}
                </ScoreNum>
                <ScoreColon>:</ScoreColon>
                <ScoreNum $tone="neutral">{r.oppScore}</ScoreNum>
              </ScoreMid>

              <MiniTeam>
                <MiniLogo>
                  <MiniLogoImg src={r.oppLogo} alt={r.oppName} />
                </MiniLogo>
                <NameRow>
                  <MiniName title={r.oppName}>{r.oppName}</MiniName>
                  {r.oppRank ? <RankTag>{r.oppRank}위</RankTag> : null}
                </NameRow>
              </MiniTeam>
            </TeamsMini>
          </CompletedCard>
        ))}

        {!loading && !error && !done ? (
          <LoadMoreRow>
            <LoadMoreBtn type="button" onClick={() => load({ reset: false })} disabled={busy}>
              {busy ? "불러오는 중..." : "더 보기"}
            </LoadMoreBtn>
          </LoadMoreRow>
        ) : null}
      </Inner>
    </PageWrap>
  );
}
