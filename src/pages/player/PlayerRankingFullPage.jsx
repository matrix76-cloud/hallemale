/* eslint-disable */
// src/pages/ranking/PlayerRankingFullPage.jsx
// ✅ 카드형 리스트(팀랭킹 전체보기와 동일): 좌측 등수 → 아바타(1~3위 로고 오버레이) → 이름/점수·소속·포지션/전적·최근5경기
// ✅ 점수 규칙: 승 +5, 무 +2, 패 +1

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { images, teamLogoSrc } from "../../utils/imageAssets";
import { listPlayerRankingPage } from "../../services/rankingService";
import { getTeamRankMap } from "../../services/teamRankingService";
import Spinner from "../../components/common/Spinner";
import { WinChip, DrawChip, LoseChip } from "../../components/common/ResultChip";
import AvatarPlaceholder from "../../components/common/AvatarPlaceholder";

import FilterSearchBar from "../../components/common/FilterSearchBar";
import FilterBottomSheet from "../../components/common/FilterBottomSheet";
import EmptyState from "../../components/common/EmptyState";

const PageWrap = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg};
  padding: 12px 0 24px;
`;

const Inner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

/* ===== 팀랭킹 전체보기와 동일한 카드형 리스트 ===== */
const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0 16px;
`;

const RowCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 16px;
  box-shadow: ${({ theme }) => theme.shadows?.card || "0 1px 3px rgba(15,23,42,0.06)"};
  padding: 20px 16px 14px;
  cursor: pointer;
  &:active {
    transform: translateY(1px);
  }
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const RankCol = styled.div`
  flex: 0 0 auto;
  width: 32px;
  display: flex;
  align-items: baseline;
  justify-content: center;
`;

const RankNum = styled.span`
  font-size: 22px;
  font-weight: 800;
  color: ${({ $top, theme }) => ($top ? theme.colors.primary : theme.colors.textStrong)};
`;

const RankUnit = styled.span`
  margin-left: 1px;
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const AvatarCol = styled.div`
  position: relative;
  flex: 0 0 auto;
  width: 52px;
  height: 52px;
`;

const Avatar = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 14px;
  overflow: hidden;
  /* 1~3위: 연보라, 그 외: 회색 */
  background: ${({ $top, theme }) =>
    theme.mode === "dark" ? theme.colors.surface : $top ? "#ede9fe" : "#f1f2f5"};
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
`;

/* ✅ 프로필 없을 때: 사람 실루엣 placeholder */
const SquareAvatarPlaceholder = styled(AvatarPlaceholder)`
  width: 100% !important;
  height: 100% !important;
  border-radius: 14px;
`;

/* 1~3위: 아바타(프로필) 위에 겹쳐 배치되는 로고 */
const CrownOver = styled.img`
  position: absolute;
  top: -13px;
  left: 50%;
  transform: translateX(-50%);
  width: 28px;
  height: 28px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.18));
`;

const ContentArea = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const LineBetween = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
`;

const NameGroup = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const PlayerName = styled.span`
  min-width: 0;
  font-size: 15px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Points = styled.span`
  flex: 0 0 auto;
  font-size: 16px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const PointUnit = styled.span`
  margin-left: 1px;
  font-size: 11px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* 둘째 줄: 소속팀(작은 로고+이름) · 포지션 · 키 · 몸무게 — 박스 없이 인라인 */
const SecondLine = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: visible;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const TeamMini = styled.span`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
`;

/* 소속팀 1~3위: 클럽 로고 위에 겹쳐 배치되는 왕관 */
const TeamLogoBox = styled.span`
  position: relative;
  flex: 0 0 auto;
  display: inline-flex;
`;

const TeamCrown = styled.img`
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 13px;
  height: 13px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 1px 2px rgba(15, 23, 42, 0.25));
`;

const TeamLogoWrap = styled.div`
  width: 16px;
  height: 16px;
  border-radius: 5px;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.bg : "#e5e7eb"};
`;

const TeamLogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TeamNameText = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
`;

const Sep = styled.span`
  flex: 0 0 auto;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const BodyRow = styled.div`
  min-width: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Stats = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textNormal};
  white-space: nowrap;

  b {
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textStrong};
  }
`;

const RecentDots = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 3px;
`;

const EmptySlot = styled.div`
  width: 18px;
  height: 16px;
  border-radius: 3px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#eef0f4"};
`;

const LoadMoreWrap = styled.div`
  margin: 10px 16px 0;
  display: flex;
  justify-content: center;
`;

const LoadMoreBtn = styled.button`
  width: 100%;
  height: 44px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  cursor: pointer;
  font-size: 14px;
`;

const Center = styled.div`
  margin: 14px 16px 0;
  display: flex;
  justify-content: center;
`;

const EmptyText = styled.div`
  margin: 20px 16px 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  text-align: center;
`;

const RankInfoBox = styled.div`
  margin: 6px 16px 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f8fafc"};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.5;
`;

function toNum(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function calcWinRatePercent({ wins, losses, draws }) {
  const w = toNum(wins, 0);
  const l = toNum(losses, 0);
  const d = toNum(draws, 0);
  const total = w + l + d;
  if (total <= 0) return 0;
  return Math.round((w / total) * 100);
}

/* ✅ 점수 계산: 승 +5, 무 +2, 패 +1 */
function calcPointsFromPlayer(p) {
  const wins = toNum(p?.wins, 0);
  const losses = toNum(p?.losses, 0);
  const draws = toNum(p?.draws, 0);
  return wins * 5 + draws * 2 + losses * 1;
}

function normalizeRecentResult(x) {
  const v = String(x || "").toLowerCase();
  if (v === "w" || v === "win") return "W";
  if (v === "l" || v === "lose") return "L";
  if (v === "d" || v === "draw") return "D";
  return null;
}

function getRecentFormsSafe(p, count = 5) {
  const src = Array.isArray(p?.recentForms) ? p.recentForms : [];
  const norm = src.map(normalizeRecentResult).filter(Boolean);
  return norm.slice(0, count);
}

function buildBodyText(p) {
  if (p.positionLabel) return p.positionLabel;
  return "프로필 미등록";
}

function resolveAvatarUrl(row) {
  if (row?.avatarUrl && String(row.avatarUrl).trim()) return row.avatarUrl;
  return "";
}

function countAppliedFilters(f) {
  if (!f) return 0;
  let c = 0;
  if (f.position) c += 1;
  if (f.skill) c += 1;
  if (f.winRate && f.winRate !== "any") c += 1;
  if (f.club) c += 1;
  if (Array.isArray(f.recent) && f.recent.length > 0) c += 1;
  if (f.onlyCaptain === true) c += 1;
  return c;
}

export default function PlayerRankingFullPage() {
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [teamRankMap, setTeamRankMap] = useState(null);

  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({
    position: "",
    skill: "",
    winRate: "any",
    club: "",
    recent: [],
    onlyCaptain: false,
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(filters);

  const pageSize = 30;

  const loadPage = async ({ reset = false } = {}) => {
    if (loading) return;
    if (!reset && done) return;

    setLoading(true);
    try {
      const res = await listPlayerRankingPage({
        pageSize,
        cursor: reset ? null : cursor,
        debugLog: false,
      });

      const nextRows = Array.isArray(res?.rows) ? res.rows : [];
      const nextCursor = res?.nextCursor || null;

      setRows((prev) => {
        const base = reset ? [] : prev;
        return [...base, ...nextRows];
      });

      setCursor(nextCursor);

      if (!nextCursor || nextRows.length < pageSize) {
        setDone(true);
      }
    } catch (e) {
      console.warn("[PlayerRankingFullPage] listPlayerRankingPage failed:", e?.code || "", e?.message || e);
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage({ reset: true });
  }, []);

  // ✅ 팀 전역 랭킹 — 소속팀(클럽) 1~3위면 로고 위에 왕관 표시용
  useEffect(() => {
    let alive = true;
    getTeamRankMap()
      .then((map) => {
        if (alive) setTeamRankMap(map);
      })
      .catch((e) => console.warn("[PlayerRankingFullPage] getTeamRankMap failed:", e?.message || e));
    return () => {
      alive = false;
    };
  }, []);

  const rankedRows = useMemo(() => {
    const base = Array.isArray(rows) ? rows : [];

    const queryText = String(q || "").trim().toLowerCase();

    const searched = queryText
      ? base.filter((p) => {
          const name = String(p.name || "").toLowerCase();
          const club = String(p.clubName || "").toLowerCase();
          const pos = String(p.positionLabel || "").toLowerCase();
          return name.includes(queryText) || club.includes(queryText) || pos.includes(queryText);
        })
      : base;

    const filtered = searched.filter((p) => {
      if (filters.position && String(p.positionLabel || "") !== filters.position) return false;
      if (filters.skill && String(p.skillLabel || "") && String(p.skillLabel || "") !== filters.skill) return false;

      if (filters.club === "소속 있음" && !String(p.clubId || "").trim()) return false;
      if (filters.club === "소속 없음" && String(p.clubId || "").trim()) return false;
      if (filters.onlyCaptain === true && p.isTeamCaptain !== true) return false;

      const wins = toNum(p.wins, 0);
      const losses = toNum(p.losses, 0);
      const draws = toNum(p.draws, 0);
      const winRate = calcWinRatePercent({ wins, losses, draws });

      if (filters.winRate === "70" && winRate < 70) return false;
      if (filters.winRate === "50" && winRate < 50) return false;

      const rf = getRecentFormsSafe(p, 5);
      if (Array.isArray(filters.recent) && filters.recent.length > 0) {
        const ok = filters.recent.some((x) => rf.includes(x));
        if (!ok) return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const pa = calcPointsFromPlayer(a);
      const pb = calcPointsFromPlayer(b);
      if (pb !== pa) return pb - pa;

      const wa = calcWinRatePercent({ wins: toNum(a.wins, 0), losses: toNum(a.losses, 0), draws: toNum(a.draws, 0) });
      const wb = calcWinRatePercent({ wins: toNum(b.wins, 0), losses: toNum(b.losses, 0), draws: toNum(b.draws, 0) });
      if (wb !== wa) return wb - wa;

      const winsA = toNum(a.wins, 0);
      const winsB = toNum(b.wins, 0);
      if (winsB !== winsA) return winsB - winsA;

      const totalA = toNum(a.wins, 0) + toNum(a.losses, 0) + toNum(a.draws, 0);
      const totalB = toNum(b.wins, 0) + toNum(b.losses, 0) + toNum(b.draws, 0);
      if (totalB !== totalA) return totalB - totalA;

      const na = String(a.name || "").toLowerCase();
      const nb = String(b.name || "").toLowerCase();
      if (na === nb) return 0;
      return na > nb ? 1 : -1;
    });

    return sorted.map((r, idx) => ({ ...r, rank: idx + 1 }));
  }, [rows, q, filters]);

  const appliedCount = useMemo(() => countAppliedFilters(filters), [filters]);

  const handlePlayerClick = (userId) => {
    if (!userId) return;
    nav(`/player/${userId}`);
  };

  const handleTeamClick = (clubId, e) => {
    if (e) e.stopPropagation();
    if (!clubId) return;
    nav(`/team/${clubId}`);
  };

  return (
    <PageWrap>
      <Inner>
        <FilterSearchBar
          value={q}
          onChange={setQ}
          onOpenFilter={() => {
            setDraft(filters);
            setSheetOpen(true);
          }}
          appliedCount={appliedCount}
          placeholder="선수/팀/포지션 검색"
        />

        <RankInfoBox>
          <strong>랭킹 산정 기준</strong>
          <br />
          경기 승리 시 +5점, 무승부 시 +2점, 패배 시 +1점이 누적되며 총 점수 기준으로 순위가 계산됩니다.
        </RankInfoBox>

        <List>
          {rankedRows.map((p, index) => {
            const avatarUrl = resolveAvatarUrl(p);
            const bodyText = buildBodyText(p);
            const clubLogo = teamLogoSrc(p.clubLogoUrl && String(p.clubLogoUrl).trim());
            const clubRank = teamRankMap?.get(String(p.clubId || "").trim());

            const wins = toNum(p.wins, 0);
            const losses = toNum(p.losses, 0);
            const draws = toNum(p.draws, 0);
            const winRatePercent = calcWinRatePercent({ wins, losses, draws });

            const points = calcPointsFromPlayer(p);

            const recentForms = getRecentFormsSafe(p, 5);

            const showCrown = p.rank <= 3;

            return (
              <RowCard key={p.userId || index} onClick={() => handlePlayerClick(p.userId)}>
                <Row>
                  <RankCol>
                    <RankNum $top={showCrown}>{p.rank}</RankNum>
                    <RankUnit>위</RankUnit>
                  </RankCol>

                  <AvatarCol>
                    {showCrown ? <CrownOver src={images.logo} alt={`${p.rank}위`} /> : null}
                    <Avatar $top={showCrown}>
                      {avatarUrl ? (
                        <AvatarImg src={avatarUrl} alt={p.name || "player"} />
                      ) : (
                        <SquareAvatarPlaceholder accent={showCrown} />
                      )}
                    </Avatar>
                  </AvatarCol>

                  <ContentArea>
                    <LineBetween>
                      <NameGroup>
                        <PlayerName title={p.name}>{p.name || "사용자"}</PlayerName>
                      </NameGroup>
                      <Points>
                        {points}
                        <PointUnit>점</PointUnit>
                      </Points>
                    </LineBetween>

                    <SecondLine>
                      <TeamMini onClick={(e) => handleTeamClick(p.clubId, e)}>
                        <TeamLogoBox>
                          {clubRank && clubRank <= 3 ? (
                            <TeamCrown src={images.logo} alt={`${clubRank}위`} />
                          ) : null}
                          <TeamLogoWrap>
                            <TeamLogoImg src={clubLogo} alt={p.clubName || "팀"} />
                          </TeamLogoWrap>
                        </TeamLogoBox>
                        <TeamNameText>{p.clubName || "소속 없음"}</TeamNameText>
                      </TeamMini>
                      <Sep>·</Sep>
                      <BodyRow>{bodyText}</BodyRow>
                    </SecondLine>

                    <LineBetween>
                      <Stats>
                        <b>{wins}</b>승 <b>{losses}</b>패 <b>{draws}</b>무 · 승률 <b>{winRatePercent}</b>%
                      </Stats>
                      <RecentDots>
                        {Array.from({ length: 5 }).map((_, idx) => {
                          const r = recentForms[idx];
                          if (r === "W") return <WinChip key={`${p.userId}-rf${idx}`} size="xs" />;
                          if (r === "L") return <LoseChip key={`${p.userId}-rf${idx}`} size="xs" />;
                          if (r === "D") return <DrawChip key={`${p.userId}-rf${idx}`} size="xs" />;
                          return <EmptySlot key={`${p.userId}-rf${idx}`} />;
                        })}
                      </RecentDots>
                    </LineBetween>
                  </ContentArea>
                </Row>
              </RowCard>
            );
          })}
        </List>

        {!rankedRows.length && !loading && <EmptyState text="표시할 랭킹이 없어요." />}

        {loading && (
          <Center>
            <Spinner />
          </Center>
        )}

        {!done && rows.length > 0 && (
          <LoadMoreWrap>
            <LoadMoreBtn type="button" onClick={() => loadPage({ reset: false })} disabled={loading}>
              더보기
            </LoadMoreBtn>
          </LoadMoreWrap>
        )}
      </Inner>

      <FilterBottomSheet
        open={sheetOpen}
        title="랭킹 필터"
        draft={draft}
        setDraft={setDraft}
        onClose={() => setSheetOpen(false)}
        onReset={() => {
          setDraft({
            position: "",
            skill: "",
            winRate: "any",
            club: "",
            recent: [],
            onlyCaptain: false,
          });
        }}
        onApply={() => {
          setFilters(draft);
          setSheetOpen(false);
        }}
      />
    </PageWrap>
  );
}
