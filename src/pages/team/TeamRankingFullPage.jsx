/* eslint-disable */
// src/pages/ranking/TeamRankingFullPage.jsx
// ✅ 팀랭킹 필터: regionSido/regionGu(2단계) + winRate만 적용

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { images } from "../../utils/imageAssets";
import { listTeamRankingPage } from "../../services/teamRankingService";
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

const Card = styled.div`
  background: #ffffff;
  border-radius: 16px;
  padding: 4px 0;
  display: flex;
  flex-direction: column;
`;

const TeamBlock = styled.div`
  padding: 10px 10px 12px;
  cursor: pointer;
`;

const Row = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
`;

const LogoArea = styled.div`
  width: 96px;
  display: flex;
  justify-content: center;
`;

const LogoOuter = styled.div`
  position: relative;
  width: 80px;
  height: 80px;
  flex-shrink: 0;
`;

const LogoWrap = styled.div`
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #e5e7eb;
  border-radius: 15px;
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
`;

const RankBadge = styled.div`
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #6366f1;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ContentArea = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const TeamNameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
`;

const TeamName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MedalInline = styled.span`
  font-size: 14px;
  line-height: 1;
`;

const TeamRegion = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SummaryRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 13px;
`;

const SummaryText = styled.span`
  color: #4b5563;
`;

const WinRateBadge = styled.span`
  padding: 3px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 500;
`;

const RecentLabel = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const RecentDots = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const SoonDot = styled.div`
  width: 14px;
  height: 14px;
  background: #d1d5db;
  border: 1px dashed #cbd5e1;
  box-sizing: border-box;
`;

const Center = styled.div`
  margin: 14px 16px 0;
  display: flex;
  justify-content: center;
`;

const ErrorText = styled.div`
  margin: 20px 16px 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
  text-align: center;
  line-height: 1.5;
`;

const statMedal = (rank) => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
};

function toNum(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function calcWinRatePercent({ wins, losses, draws }) {
  const w = toNum(wins, 0);
  const l = toNum(losses, 0);
  const d = toNum(draws, 0);
  const total = w + l + d;
  if (total <= 0) return 100;
  return Math.round((w / total) * 100);
}

function normalizeRecentResult(x) {
  const v = String(x || "").trim();

  // ✅ 이미 W/L/D 로 저장된 케이스
  if (v === "W" || v.toLowerCase() === "w" || v.toLowerCase() === "win") return "W";
  if (v === "L" || v.toLowerCase() === "l" || v.toLowerCase() === "lose") return "L";
  if (v === "D" || v.toLowerCase() === "d" || v.toLowerCase() === "draw") return "D";

  // ✅ 한글/기타 케이스 (실데이터에서 흔함)
  if (v.includes("승")) return "W";
  if (v.includes("패")) return "L";
  if (v.includes("무")) return "D";

  return null;
}

function getRecentFormsSafe(t, count = 5) {
  // ✅ 실데이터는 stats.recentResults에 들어가는 경우가 많음
  const src =
    (Array.isArray(t?.stats?.recentResults) && t.stats.recentResults) ||
    (Array.isArray(t?.recentResults) && t.recentResults) ||
    (Array.isArray(t?.recentForms) && t.recentForms) ||
    [];

  const norm = src.map(normalizeRecentResult).filter(Boolean);
  return norm.slice(0, count);
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
      const res = await listTeamRankingPage({
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

      if (!nextCursor || nextRows.length < pageSize) setDone(true);
    } catch (e) {
      console.warn("[TeamRankingFullPage] listTeamRankingPage failed:", e?.code || "", e?.message || e);
      setError("인덱스가 필요합니다. 콘솔에 뜬 인덱스 생성 링크를 눌러 생성해 주세요.");
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage({ reset: true });
  }, []);

  const rankedRows = useMemo(() => {
    const base = (rows || []).map((t, idx) => ({ ...t, rank: idx + 1 }));

    // 상단 검색(팀명/지역 문자열)
    const queryText = safeString(q).toLowerCase();
    const searched = queryText
      ? base.filter((t) => {
          const name = safeString(t?.name).toLowerCase();
          const region = buildRegionText(t).toLowerCase();
          return name.includes(queryText) || region.includes(queryText);
        })
      : base;

    // 지역 필터(2단계)
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

    // 승률 필터
    const filtered = regionFiltered.filter((t) => {
      const wins = toNum(t?.stats?.wins ?? t?.wins, 0);
      const losses = toNum(t?.stats?.losses ?? t?.losses, 0);
      const draws = toNum(t?.stats?.draws ?? t?.draws, 0);
      const winRate = calcWinRatePercent({ wins, losses, draws });

      if (filters.winRate === "70" && winRate < 70) return false;
      if (filters.winRate === "50" && winRate < 50) return false;
      return true;
    });

    return filtered;
  }, [rows, q, filters]);

  const handleTeamClick = (clubId) => {
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
            setDraft({ ...filters });
            setSheetOpen(true);
          }}
          appliedCount={appliedCount}
          placeholder="팀명/지역 검색"
        />

        <Card>
          {rankedRows.map((t, index) => {
            const medal = statMedal(t.rank);

            const wins = toNum(t?.stats?.wins ?? t?.wins, 0);
            const losses = toNum(t?.stats?.losses ?? t?.losses, 0);
            const draws = toNum(t?.stats?.draws ?? t?.draws, 0);

            const winRatePercent = calcWinRatePercent({ wins, losses, draws });
            const recentForms = getRecentFormsSafe(t, 5);

            const logoSrc = (t.logoUrl && String(t.logoUrl).trim()) || images.logo;
            const regionText = buildRegionText(t);

            return (
              <React.Fragment key={t.clubId || t.id || index}>
                <TeamBlock onClick={() => handleTeamClick(t.clubId)}>
                  <Row>
                    <LogoArea>
                      <LogoOuter>
                        <LogoWrap>
                          <LogoImg src={logoSrc} alt={t.name || "team"} />
                        </LogoWrap>
                        <RankBadge>{t.rank}위</RankBadge>
                      </LogoOuter>
                    </LogoArea>

                    <ContentArea>
                      <TeamNameRow>
                        <TeamName title={t.name}>{t.name || "팀"}</TeamName>
                        {medal && <MedalInline>{medal}</MedalInline>}
                      </TeamNameRow>

                      <TeamRegion>{regionText || "지역 미등록"}</TeamRegion>

                      <SummaryRow>
                        <SummaryText>
                          {wins}승 {losses}패 {draws}무
                        </SummaryText>
                        <WinRateBadge>승률 {winRatePercent}%</WinRateBadge>
                      </SummaryRow>

                      <SummaryRow>
                        <RecentLabel>최근 경기기록</RecentLabel>
                        <RecentDots>
                          {recentForms.length > 0 ? (
                            recentForms.map((r, idx2) => {
                              if (r === "W") return <WinChip key={`${t.clubId}-rf${idx2}`} size="sm" />;
                              if (r === "L") return <LoseChip key={`${t.clubId}-rf${idx2}`} size="sm" />;
                              return <DrawChip key={`${t.clubId}-rf${idx2}`} size="sm" />;
                            })
                          ) : (
                            <>
                              <SoonDot />
                              <SoonDot />
                              <SoonDot />
                              <SoonDot />
                              <SoonDot />
                            </>
                          )}
                        </RecentDots>
                      </SummaryRow>
                    </ContentArea>
                  </Row>
                </TeamBlock>
              </React.Fragment>
            );
          })}
        </Card>

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
