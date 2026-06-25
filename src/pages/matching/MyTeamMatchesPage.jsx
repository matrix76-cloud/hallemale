/* eslint-disable */
// src/pages/matching/MyTeamMatchesPage.jsx
// 팀원 하단바 전용 "전적" 탭 — 완료된 경기를 커뮤니티처럼 카테고리(리뷰 남길/완료된 경기)로 나누고
// 최신순/오래된순 정렬을 제공. 카드 탭 → 매칭룸 상세에서 리뷰 작성.
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import Spinner from "../../components/common/Spinner";
import EmptyState from "../../components/common/EmptyState";
import { teamLogoSrc } from "../../utils/imageAssets";
import {
  loadMatchRoomListPageData,
  listMyReviewedMatchIds,
} from "../../services/matchRoomService";
import { getTeamRankMap } from "../../services/teamRankingService";
import { useClub } from "../../hooks/useClub";
import { useAuth } from "../../hooks/useAuth";

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
  padding: 0 0 24px;
  display: flex;
  flex-direction: column;
`;

/* =============== 카테고리 탭 (커뮤니티와 동일 패턴) =============== */
const TabBar = styled.div`
  display: flex;
  gap: 8px;
  padding: 14px 12px 4px;
  max-width: 480px;
  width: 100%;
  margin: 0 auto;
`;

const TabButton = styled.button`
  position: relative;
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 999px;
  padding: 9px 14px;
  font-size: 14px;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  cursor: pointer;
  white-space: nowrap;
  border: 1px solid
    ${({ theme, $active }) =>
      $active
        ? theme.colors.primary
        : theme.mode === "dark"
        ? theme.colors.border
        : "rgba(0,0,0,0.10)"};
  background: ${({ theme, $active }) =>
    $active
      ? theme.mode === "dark"
        ? "rgba(124,92,255,0.18)"
        : "#eef2ff"
      : theme.mode === "dark"
      ? theme.colors.surface
      : "#ffffff"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.primary : theme.colors.textNormal};

  &:active {
    transform: translateY(1px);
  }
`;

const TabBadge = styled.span`
  position: absolute;
  top: 4px;
  right: 8px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.danger || "#ef4444"};
`;

const ListHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
`;

const CountText = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  b {
    color: ${({ theme }) => theme.colors.textStrong};
    font-weight: 700;
  }
`;

const SortToggle = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const SortBtn = styled.button`
  border: none;
  cursor: pointer;
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#ffffff"};
  color: ${({ theme, $active }) =>
    $active ? theme.colors.textStrong : theme.colors.textWeak};
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 12px 16px;
`;

/* ===== 경기 카드 ===== */
const PastCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 13px;
  padding: 12px 14px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 10px;
  &:active {
    transform: translateY(1px);
  }
`;

const PastTopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const PastDate = styled.span`
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

const PastMid = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 8px;
`;

const TeamCell = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Logo = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 9px;
  overflow: hidden;
  flex-shrink: 0;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f3f4f6"};
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const TeamName = styled.span`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ScoreNum = styled.span`
  font-size: 20px;
  font-weight: 800;
  ${({ $tone, theme }) => {
    const dark = theme.mode === "dark";
    if ($tone === "win") return `color:${dark ? "#6ee0ab" : "#1e9e70"};`;
    if ($tone === "lose") return `color:${dark ? "#f87171" : "#dc2626"};`;
    return `color:${theme.colors.textStrong};`;
  }}
`;

const ScoreColon = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ReviewCTA = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px;
  border-radius: 10px;
  border: 1px dashed ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(124,108,255,0.10)" : "rgba(108,92,231,0.06)"};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 12.5px;
  font-weight: 700;
`;

const ReviewedTag = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  border-radius: 10px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.05)" : "#f3f4f6"};
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 12px;
  font-weight: 600;
`;

const StateWrap = styled.div`
  padding: 40px 16px;
`;

const TABS = [
  { key: "needReview", label: "리뷰 남길 경기" },
  { key: "done", label: "완료된 경기" },
];

export default function MyTeamMatchesPage() {
  const nav = useNavigate();
  const { club } = useClub();
  const { firebaseUser, userDoc } = useAuth();
  const myClubId = toStr(club?.clubId || club?.id);
  const myUid = toStr(firebaseUser?.uid || userDoc?.uid || userDoc?.id);

  const [rooms, setRooms] = useState([]);
  const [reviewedSet, setReviewedSet] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rankMap, setRankMap] = useState(null);

  const [activeTab, setActiveTab] = useState("needReview");
  const [sortOrder, setSortOrder] = useState("latest"); // latest | oldest

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const res = await loadMatchRoomListPageData(myClubId);
        const all = Array.isArray(res?.rooms) ? res.rooms : [];
        const finished = all.filter((r) => toStr(r?.status) === "finished");
        if (!alive) return;
        setRooms(finished);

        const reviewed = await listMyReviewedMatchIds({
          matchIds: finished.map((r) => toStr(r.id)),
          raterUid: myUid,
        });
        if (alive) setReviewedSet(reviewed);
      } catch (e) {
        if (alive) setError(e?.message || "경기를 불러오지 못했습니다.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [myClubId, myUid]);

  useEffect(() => {
    let alive = true;
    getTeamRankMap({ debugLog: false })
      .then((map) => alive && setRankMap(map))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const { needReview, done } = useMemo(() => {
    const need = [];
    const fin = [];
    for (const r of rooms || []) {
      if (reviewedSet.has(toStr(r.id))) fin.push(r);
      else need.push(r);
    }
    return { needReview: need, done: fin };
  }, [rooms, reviewedSet]);

  const visibleRows = useMemo(() => {
    const base = (activeTab === "done" ? done : needReview).slice();
    base.sort((a, b) => {
      const ta = a?.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const tb = b?.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return sortOrder === "latest" ? tb - ta : ta - tb;
    });
    return base;
  }, [activeTab, needReview, done, sortOrder]);

  const openDetail = (id) => {
    const rid = toStr(id);
    if (rid) nav(`/match-roomdetail/${rid}`);
  };

  const renderCard = (r, { reviewed }) => {
    const my = r?.myTeam || {};
    const opp = r?.oppTeam || {};
    const when = r?.scheduledAt ? formatKoreanDateTime(r.scheduledAt) : "";
    const myNum = r?.myScore != null && r?.myScore !== "" ? Number(r.myScore) : null;
    const oppNum = r?.oppScore != null && r?.oppScore !== "" ? Number(r.oppScore) : null;
    const hasScore = Number.isFinite(myNum) && Number.isFinite(oppNum);
    const outcome = !hasScore
      ? null
      : myNum > oppNum
      ? "win"
      : myNum < oppNum
      ? "lose"
      : "draw";

    return (
      <PastCard key={r.id} onClick={() => openDetail(r.id)} role="button" tabIndex={0}>
        <PastTopRow>
          {when ? <PastDate>{when}</PastDate> : <span />}
          {outcome && (
            <ResultBadge $outcome={outcome}>
              {outcome === "win" ? "승리" : outcome === "lose" ? "패배" : "무승부"}
            </ResultBadge>
          )}
        </PastTopRow>
        <PastMid>
          <TeamCell>
            <Logo>
              <LogoImg src={teamLogoSrc(toStr(my?.logoUrl))} alt={toStr(my?.name)} />
            </Logo>
            <TeamName title={toStr(my?.name)}>{toStr(my?.name) || "우리팀"}</TeamName>
          </TeamCell>
          <ScoreNum $tone={outcome === "win" ? "win" : outcome === "lose" ? "lose" : "neutral"}>
            {hasScore ? myNum : "-"}
          </ScoreNum>
          <ScoreColon>:</ScoreColon>
          <ScoreNum $tone="neutral">{hasScore ? oppNum : "-"}</ScoreNum>
          <TeamCell style={{ justifyContent: "flex-end" }}>
            <TeamName title={toStr(opp?.name)} style={{ textAlign: "right" }}>
              {toStr(opp?.name) || "상대팀"}
            </TeamName>
            <Logo>
              <LogoImg src={teamLogoSrc(toStr(opp?.logoUrl))} alt={toStr(opp?.name)} />
            </Logo>
          </TeamCell>
        </PastMid>
        {reviewed ? (
          <ReviewedTag>✓ 리뷰 완료 · 다시 보기</ReviewedTag>
        ) : (
          <ReviewCTA>★ 상대 팀 리뷰 남기기 →</ReviewCTA>
        )}
      </PastCard>
    );
  };

  return (
    <PageWrap>
      <TabBar>
        {TABS.map((t) => {
          const count = t.key === "done" ? done.length : needReview.length;
          return (
            <TabButton
              key={t.key}
              type="button"
              $active={activeTab === t.key}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label} ({count})
              {t.key === "needReview" && needReview.length > 0 && activeTab !== "needReview" && (
                <TabBadge />
              )}
            </TabButton>
          );
        })}
      </TabBar>

      <ListHeader>
        <CountText>
          총 <b>{visibleRows.length}</b>경기
        </CountText>
        <SortToggle>
          <SortBtn type="button" $active={sortOrder === "latest"} onClick={() => setSortOrder("latest")}>
            최신순
          </SortBtn>
          <SortBtn type="button" $active={sortOrder === "oldest"} onClick={() => setSortOrder("oldest")}>
            오래된순
          </SortBtn>
        </SortToggle>
      </ListHeader>

      {loading ? (
        <StateWrap style={{ display: "flex", justifyContent: "center" }}>
          <Spinner />
        </StateWrap>
      ) : error ? (
        <StateWrap>
          <EmptyState icon="⚠️" text={error} />
        </StateWrap>
      ) : !myClubId ? (
        <StateWrap>
          <EmptyState icon="🏀" text="아직 소속된 팀이 없어요." sub="팀에 참여하면 전적을 볼 수 있어요." />
        </StateWrap>
      ) : visibleRows.length === 0 ? (
        <StateWrap>
          <EmptyState
            icon="🏀"
            text={activeTab === "needReview" ? "리뷰를 남길 경기가 없어요." : "완료된 경기가 없어요."}
            sub={activeTab === "needReview" ? "경기가 끝나면 여기에서 상대 팀 리뷰를 남길 수 있어요." : undefined}
          />
        </StateWrap>
      ) : (
        <List>{visibleRows.map((r) => renderCard(r, { reviewed: activeTab === "done" }))}</List>
      )}
    </PageWrap>
  );
}
