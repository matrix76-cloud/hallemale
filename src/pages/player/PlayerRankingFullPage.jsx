/* eslint-disable */
// src/pages/ranking/PlayerRankingFullPage.jsx
// ✅ 이름 옆 "팀장" pill 추가 (p.isTeamCaptain === true)
// ✅ 점수 표시: "등수 뱃지(RankBadge)" 내부 2줄(등수/점수)
// ✅ 점수 규칙: 승 +5, 무 +2, 패 +1

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { images } from "../../utils/imageAssets";
import { listPlayerRankingPage } from "../../services/rankingService";
import Spinner from "../../components/common/Spinner";
import { WinChip, DrawChip, LoseChip } from "../../components/common/ResultChip";
import PositionChip from "../../components/common/PositionChip";

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

const PlayerBlock = styled.div`
  padding: 10px 10px 12px;
  cursor: pointer;
`;

const Divider = styled.div`
  height: 1px;
  margin: 2px 10px 0;
  background: ${({ theme }) => theme.colors.border};
`;

const Row = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
`;

const AvatarArea = styled.div`
  width: 78px;
  display: flex;
  justify-content: center;
`;

const AvatarOuter = styled.div`
  position: relative;
  width: 80px;
  height: 80px;
  flex-shrink: 0;
`;

const AvatarWrap = styled.div`
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#e5e7eb"};
  border-radius: 8px;
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
`;

/* ✅ 등수 뱃지: 2줄(등수/점수) */
const RankBadge = styled.div`
  position: absolute;
  right: 5px;
  bottom: 5px;
  padding: 4px 8px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  line-height: 1.05;
`;

const RankBadgeTop = styled.div`
  font-size: 10px;
  font-weight: 700;
`;

const RankBadgeBottom = styled.div`
  font-size: 10px;
  font-weight: 700;
  opacity: 0.92;
`;

const Card = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border-radius: 8px;
  margin: 0 16px;
  padding: 4px 0;
  display: flex;
  flex-direction: column;
`;

const ContentArea = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const PlayerNameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
`;

const PlayerName = styled.span`
  font-size: 14px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/* ✅ 팀장 pill */
const CaptainPill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
`;

const TeamPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#ffffff"};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const TeamLogoWrap = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 999px;
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
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const BodyRow = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const SummaryRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 13px;
`;

const SummaryText = styled.span`
  color: ${({ theme }) => theme.colors.textNormal};
`;

const WinRateBadge = styled.span`
  padding: 3px 8px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(99,102,241,0.18)" : "#eef2ff"};
  color: ${({ theme }) => (theme.mode === "dark" ? "#a5b4fc" : "#2563eb")};
  font-size: 12px;
  font-weight: 500;
`;

const RecentLabel = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const RecentDots = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const SoonDot = styled.div`
  width: 14px;
  height: 14px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#d1d5db"};
  border: 1px dashed ${({ theme }) => theme.colors.border};
  box-sizing: border-box;
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
  if (total <= 0) return 100;
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
  const parts = [];
  if (p.heightCm) parts.push(`키 ${p.heightCm}cm`);
  if (p.weightKg) parts.push(`${p.weightKg}kg`);
  if (!parts.length && p.positionLabel) parts.push(p.positionLabel);
  return parts.join(" · ") || "프로필 정보 미등록";
}

function resolveAvatarUrl(row) {
  if (row?.avatarUrl) return row.avatarUrl;
  return images.profileDefault || images.logo;
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

        <Card>
          {rankedRows.map((p, index) => {
            const avatarUrl = resolveAvatarUrl(p);
            const bodyText = buildBodyText(p);
            const clubLogo = (p.clubLogoUrl && String(p.clubLogoUrl).trim()) || images.logo;

            const wins = toNum(p.wins, 0);
            const losses = toNum(p.losses, 0);
            const draws = toNum(p.draws, 0);
            const winRatePercent = calcWinRatePercent({ wins, losses, draws });

            const points = calcPointsFromPlayer(p);

            const recentForms = getRecentFormsSafe(p, 5);

            return (
              <React.Fragment key={p.userId || index}>
                <PlayerBlock onClick={() => handlePlayerClick(p.userId)}>
                  <Row>
                    <AvatarArea>
                      <AvatarOuter>
                        <AvatarWrap>
                          <AvatarImg src={avatarUrl} alt={p.name || "player"} />
                        </AvatarWrap>

                        <RankBadge>
                          <RankBadgeTop>{p.rank}위</RankBadgeTop>
                          <RankBadgeBottom>{points}점</RankBadgeBottom>
                        </RankBadge>
                      </AvatarOuter>
                    </AvatarArea>

                    <ContentArea>
                      <PlayerNameRow>
                        <PlayerName title={p.name}>{p.name || "사용자"}</PlayerName>

                        {p.isTeamCaptain === true ? <CaptainPill>팀장</CaptainPill> : null}

                        {p.positionLabel && <PositionChip label={p.positionLabel} size="sm" onlyAbbr />}

                        <TeamPill onClick={(e) => handleTeamClick(p.clubId, e)}>
                          <TeamLogoWrap>
                            <TeamLogoImg src={clubLogo} alt={p.clubName || "팀"} />
                          </TeamLogoWrap>
                          <TeamNameText>{p.clubName || "소속 없음"}</TeamNameText>
                        </TeamPill>
                      </PlayerNameRow>

                      <BodyRow>{bodyText}</BodyRow>

                      <SummaryRow>
                        <SummaryText>
                          {wins}승 {losses}패 {draws}무
                        </SummaryText>

                        <WinRateBadge>승률 {winRatePercent}%</WinRateBadge>

                        <RecentLabel>최근 경기기록</RecentLabel>

                        <RecentDots>
                          {recentForms.length > 0 ? (
                            recentForms.map((r, idx) => {
                              if (r === "W") return <WinChip key={`${p.userId}-rf${idx}`} size="sm" />;
                              if (r === "L") return <LoseChip key={`${p.userId}-rf${idx}`} size="sm" />;
                              return <DrawChip key={`${p.userId}-rf${idx}`} size="sm" />;
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
                </PlayerBlock>

                {index < rankedRows.length - 1 && <Divider />}
              </React.Fragment>
            );
          })}
        </Card>

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
