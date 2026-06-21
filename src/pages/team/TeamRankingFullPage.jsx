/* eslint-disable */
// src/pages/ranking/TeamRankingFullPage.jsx
// ✅ 팀랭킹 필터: regionSido/regionGu(2단계) + winRate만 적용
// ✅ 배치/랭킹: 점수(승리 +5점, 무승부 +2점, 패배 +1점) desc → 승률 desc → 승수 desc → 경기수 desc → 이름 asc 기준 정렬
// ✅ 카드형 리스트: 좌측 등수 → 아바타(1~3위 로고 오버레이) → 팀명/점수·지역·전적/최근5경기

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { images, teamLogoSrc } from "../../utils/imageAssets";
import { listAllTeamsForRanking } from "../../services/teamRankingService";
import Spinner from "../../components/common/Spinner";
import { WinChip, DrawChip, LoseChip } from "../../components/common/ResultChip";

import FilterSearchBar from "../../components/common/FilterSearchBar";
import TeamRankingFilterBottomSheet from "../../components/common/TeamRankingFilterBottomSheet";

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

/* ===== 목업 카드형 랭킹 리스트 ===== */
const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const RowCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 16px;
  box-shadow: ${({ theme }) => theme.shadows?.card || "0 1px 3px rgba(15,23,42,0.06)"};
  padding: 14px 16px;
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
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#ede9fe"};
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

/* 1~3위: 아바타(프로필) 위에 겹쳐 배치되는 로고 */
const CrownOver = styled.img`
  position: absolute;
  top: -16px;
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

const TeamName = styled.div`
  min-width: 0;
  font-size: 15px;
  font-weight: 700;
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

const RegionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PinIcon = styled.span`
  font-size: 11px;
  line-height: 1;
`;

const Stats = styled.div`
  font-size: 12.5px;
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
  gap: 4px;
`;

const EmptySlot = styled.div`
  width: 22px;
  height: 20px;
  border-radius: 4px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#eef0f4"};
`;

const Center = styled.div`
  margin: 14px 16px 0;
  display: flex;
  justify-content: center;
`;

const ErrorText = styled.div`
  margin: 20px 16px 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  text-align: center;
  line-height: 1.5;
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

function normalizeRecentResult(x) {
  const v = String(x || "").trim();

  if (v === "W" || v.toLowerCase() === "w" || v.toLowerCase() === "win") return "W";
  if (v === "L" || v.toLowerCase() === "l" || v.toLowerCase() === "lose") return "L";
  if (v === "D" || v.toLowerCase() === "d" || v.toLowerCase() === "draw") return "D";

  if (v.includes("승")) return "W";
  if (v.includes("패")) return "L";
  if (v.includes("무")) return "D";

  return null;
}

function getRecentFormsSafe(t, count = 5) {
  const src =
    (Array.isArray(t?.stats?.recentResults) && t.stats.recentResults) ||
    (Array.isArray(t?.recentResults) && t.recentResults) ||
    (Array.isArray(t?.recentForms) && t.recentForms) ||
    [];

  const norm = src.map(normalizeRecentResult).filter(Boolean);
  return norm.slice(-count).reverse();
}

function buildRegionText(t) {
  const region = String(t?.region || "").trim();
  if (region) return region;
  const sido = String(t?.regionSido || "").trim();
  const gu = String(t?.regionGu || "").trim();
  return `${sido} ${gu}`.trim();
}

function safeString(v) {
  return String(v || "").trim();
}

function countAppliedFilters(f) {
  if (!f) return 0;
  let c = 0;
  if (f.winRate && f.winRate !== "any") c += 1;
  if (safeString(f.regionSido) && f.regionSido !== "all") c += 1;
  if (safeString(f.regionGu) && f.regionGu !== "all") c += 1;
  return c;
}

/* ✅ 점수 계산: 승 +5, 무 +2, 패 +1 */
function calcPointsFromTeam(t) {
  const wins = toNum(t?.stats?.wins ?? t?.wins, 0);
  const losses = toNum(t?.stats?.losses ?? t?.losses, 0);
  const draws = toNum(t?.stats?.draws ?? t?.draws, 0);
  return wins * 5 + draws * 2 + losses * 1;
}

// ✅ 점수/승률/승수/경기수/이름 기반 퍼포먼스 키
function getPerfKey(t) {
  const wins = toNum(t?.stats?.wins ?? t?.wins, 0);
  const losses = toNum(t?.stats?.losses ?? t?.losses, 0);
  const draws = toNum(t?.stats?.draws ?? t?.draws, 0);
  const total = wins + losses + draws;

  const points = wins * 5 + draws * 2 + losses * 1;

  const rawWinRate = typeof t?.stats?.winRate === "number" ? t.stats.winRate : null;
  const winRatePct = rawWinRate != null ? Math.round(rawWinRate * 100) : calcWinRatePercent({ wins, losses, draws });

  return {
    points,
    winRatePct,
    wins,
    total,
    name: safeString(t?.name).toLowerCase(),
  };
}

export default function TeamRankingFullPage() {
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const pageSize = 30;

  const [q, setQ] = useState("");

  const [filters, setFilters] = useState({
    winRate: "any",
    regionSido: "all",
    regionGu: "all",
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(filters);

  const appliedCount = useMemo(() => countAppliedFilters(filters), [filters]);

  const loadPage = async ({ reset = false } = {}) => {
    if (loading) return;
    if (!reset && done) return;

    setLoading(true);
    setError("");
    try {
      const res = await listAllTeamsForRanking({ debugLog: false });
      const nextRows = Array.isArray(res?.rows) ? res.rows : [];

      setRows(nextRows);
      setCursor(null);
      setDone(true);
    } catch (e) {
      console.warn("[TeamRankingFullPage] listAllTeamsForRanking failed:", e?.code || "", e?.message || e);
      setError("팀 랭킹을 불러오지 못했습니다.");
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage({ reset: true });
  }, []);

  const rankedRows = useMemo(() => {
    const base = Array.isArray(rows) ? rows : [];

    const queryText = safeString(q).toLowerCase();
    const searched = queryText
      ? base.filter((t) => {
          const name = safeString(t?.name).toLowerCase();
          const region = buildRegionText(t).toLowerCase();
          return name.includes(queryText) || region.includes(queryText);
        })
      : base;

    const sido = safeString(filters.regionSido);
    const gu = safeString(filters.regionGu);

    const regionFiltered = searched.filter((t) => {
      if (!sido || sido === "all") return true;

      const tsido = safeString(t?.regionSido) || safeString(buildRegionText(t)).split(" ")[0];
      if (tsido !== sido) return false;

      if (!gu || gu === "all") return true;

      const text = buildRegionText(t);
      return text.includes(gu);
    });

    const rateFiltered = regionFiltered.filter((t) => {
      const wins = toNum(t?.stats?.wins ?? t?.wins, 0);
      const losses = toNum(t?.stats?.losses ?? t?.losses, 0);
      const draws = toNum(t?.stats?.draws ?? t?.draws, 0);

      const rawWinRate = typeof t?.stats?.winRate === "number" ? t.stats.winRate : null;
      const winRate = rawWinRate != null ? Math.round(rawWinRate * 100) : calcWinRatePercent({ wins, losses, draws });

      if (filters.winRate === "70" && winRate < 70) return false;
      if (filters.winRate === "50" && winRate < 50) return false;
      return true;
    });

    // ✅ 정렬: 점수 desc → 승률 desc → 승수 desc → 경기수 desc → 이름 asc
    const sorted = [...rateFiltered].sort((a, b) => {
      const ka = getPerfKey(a);
      const kb = getPerfKey(b);

      if (kb.points !== ka.points) return kb.points - ka.points;
      if (kb.winRatePct !== ka.winRatePct) return kb.winRatePct - ka.winRatePct;
      if (kb.wins !== ka.wins) return kb.wins - ka.wins;
      if (kb.total !== ka.total) return kb.total - ka.total;
      if (ka.name === kb.name) return 0;
      return ka.name > kb.name ? 1 : -1;
    });

    return sorted.map((t, idx) => ({ ...t, rank: idx + 1 }));
  }, [rows, q, filters]);

  const handleTeamClick = (clubId) => {
    if (!clubId) return;
    nav(`/team/${clubId}`);
  };

  const crownSrc = images.logo || "";

  return (
    <PageWrap>
      <Inner>
        <FilterSearchBar
          value={q}
          onChange={setQ}
          onOpenFilter={() => {
            setDraft({ ...filters });
            setSheetOpen(true);
          }}
          appliedCount={appliedCount}
          placeholder="팀명/지역 검색"
        />

        <RankInfoBox>
          <strong>랭킹 산정 기준</strong>
          <br />
          경기 승리 시 +5점, 무승부 시 +2점, 패배 시 +1점이 누적되며 총 점수 기준으로 순위가 계산됩니다.
        </RankInfoBox>

        <List>
          {rankedRows.map((t, index) => {
            const wins = toNum(t?.stats?.wins ?? t?.wins, 0);
            const losses = toNum(t?.stats?.losses ?? t?.losses, 0);
            const draws = toNum(t?.stats?.draws ?? t?.draws, 0);

            const points = calcPointsFromTeam(t);

            const rawWinRate = typeof t?.stats?.winRate === "number" ? t.stats.winRate : null;
            const winRatePercent =
              rawWinRate != null ? Math.round(rawWinRate * 100) : calcWinRatePercent({ wins, losses, draws });

            const recentForms = getRecentFormsSafe(t, 5);
            const regionText = buildRegionText(t);

            const showCrown = t.rank <= 3;

            return (
              <RowCard key={t.clubId || t.id || index} onClick={() => handleTeamClick(t.clubId)}>
                <Row>
                  <RankCol>
                    <RankNum $top={showCrown}>{t.rank}</RankNum>
                    <RankUnit>위</RankUnit>
                  </RankCol>

                  <AvatarCol>
                    {showCrown && crownSrc ? (
                      <CrownOver src={crownSrc} alt={`${t.rank}위`} />
                    ) : null}
                    <Avatar>
                      <AvatarImg src={teamLogoSrc(t.logoUrl)} alt={t.name || "team"} />
                    </Avatar>
                  </AvatarCol>

                  <ContentArea>
                    <LineBetween>
                      <TeamName title={t.name}>{t.name || "팀"}</TeamName>
                      <Points>
                        {points}
                        <PointUnit>점</PointUnit>
                      </Points>
                    </LineBetween>

                    <RegionRow>
                      <PinIcon>📍</PinIcon>
                      {regionText || "지역 미등록"}
                    </RegionRow>

                    <LineBetween>
                      <Stats>
                        <b>{wins}</b>승 <b>{losses}</b>패 <b>{draws}</b>무 · 승률 <b>{winRatePercent}</b>%
                      </Stats>
                      <RecentDots>
                        {Array.from({ length: 5 }).map((_, idx2) => {
                          const r = recentForms[idx2];
                          if (r === "W") return <WinChip key={`${t.clubId}-rf${idx2}`} size="sm" />;
                          if (r === "L") return <LoseChip key={`${t.clubId}-rf${idx2}`} size="sm" />;
                          if (r === "D") return <DrawChip key={`${t.clubId}-rf${idx2}`} size="sm" />;
                          return <EmptySlot key={`${t.clubId}-rf${idx2}`} />;
                        })}
                      </RecentDots>
                    </LineBetween>
                  </ContentArea>
                </Row>
              </RowCard>
            );
          })}
        </List>

        {loading && (
          <Center>
            <Spinner />
          </Center>
        )}

        {!loading && error && <ErrorText>{error}</ErrorText>}
      </Inner>

      <TeamRankingFilterBottomSheet
        open={sheetOpen}
        title="팀 랭킹 필터"
        draft={draft}
        setDraft={setDraft}
        onClose={() => setSheetOpen(false)}
        onReset={() => setDraft({ winRate: "any", regionSido: "all", regionGu: "all" })}
        onApply={() => {
          setFilters({
            winRate: draft?.winRate || "any",
            regionSido: draft?.regionSido || "all",
            regionGu: draft?.regionGu || "all",
          });
          setSheetOpen(false);
        }}
      />
    </PageWrap>
  );
}
