/* eslint-disable */
import React from "react";
import styled from "styled-components";
import { images } from "../../../utils/imageAssets";
import { WinChip, DrawChip, LoseChip } from "../../../components/common/ResultChip";

import FilterSearchBar from "../../../components/common/FilterSearchBar";
import FilterBottomSheet from "../../../components/common/FilterBottomSheet";
import TeamRankingFilterBottomSheet from "../../../components/common/TeamRankingFilterBottomSheet";

const TeamListSection = styled.section`
  padding-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TeamListHeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-direction: column;
`;

const TeamListTitle = styled.span`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const TeamListSub = styled.span`
  font-size: 12px;
  margin-top:5px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const TeamListCard = styled.div`
  background: #ffffff;
  border-radius: 16px;
  padding: 4px 0;
  display: flex;
  flex-direction: column;
`;

const TeamBlock = styled.div`
  padding: 10px 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
`;

const Divider = styled.div`
  height: 1px;
  margin: 0 10px;
  background: #e5e7eb;
`;

const Row = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
`;

const LogoArea = styled.div`
  width: 80px;
  display: flex;
  justify-content: center;
`;

const LogoOuter = styled.div`
  width: 68px;
  height: 68px;
  border-radius: 999px;
  overflow: hidden;
  flex-shrink: 0;
  background: #e5e7eb;
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const ContentArea = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const TeamNameRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
`;

const TeamNameText = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TeamRegionText = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SummaryRow = styled.div`
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
`;

const SummaryText = styled.span`
  color: #4b5563;
`;

const WinRateBadge = styled.span`
  padding: 3px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #2563eb;
  font-size: 11px;
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

function buildSummaryText(t) {
  const wins = t?.stats?.wins ?? 0;
  const losses = t?.stats?.losses ?? 0;
  const draws = t?.stats?.draws ?? 0;
  if (draws > 0) return `${wins}승 ${losses}패 ${draws}무`;
  return `${wins}승 ${losses}패`;
}

function getWinRatePercent(t) {
  const wins = t?.stats?.wins ?? 0;
  const losses = t?.stats?.losses ?? 0;
  const draws = t?.stats?.draws ?? 0;
  const total = wins + losses + draws;
  if (!total) return 0;
  return Math.round((wins / total) * 100);
}

function getRecentResults(t, count = 5) {
  const wins = t?.stats?.wins ?? 0;
  const losses = t?.stats?.losses ?? 0;
  const draws = t?.stats?.draws ?? 0;
  const total = wins + losses + draws;
  if (!total) return [];
  const winRate = wins / total;
  const winCount = Math.round(winRate * count);
  const arr = [];
  for (let i = 0; i < winCount && arr.length < count; i += 1) arr.push("W");
  while (arr.length < count) arr.push("L");
  return arr;
}

export default function TeamOpponentListSection({
  teams,
  teamQ,
  setTeamQ,
  appliedCount,
  filters,
  setFilters,
  draft,
  setDraft,
  sheetOpen,
  setSheetOpen,
  onTeamClick,
}) {
  const list = Array.isArray(teams) ? teams : [];

  return (
    <TeamListSection>
      <TeamListHeaderRow>
        <TeamListTitle>전체 팀 리스트</TeamListTitle>
        <TeamListSub>상대 팀을 골라 매칭을 신청하세요.</TeamListSub>
      </TeamListHeaderRow>

      <FilterSearchBar
        value={teamQ}
        onChange={setTeamQ}
        placeholder="팀명/지역 검색"
        showFilter
        appliedCount={appliedCount}
        onOpenFilter={() => {
          setDraft(filters);
          setSheetOpen(true);
        }}
      />

      <TeamListCard>
        {list.map((team, index) => {
          const summaryText = buildSummaryText(team);
          const winRatePercent = getWinRatePercent(team);
          const recentResults = getRecentResults(team, 5);

          return (
            <React.Fragment key={team.clubId || index}>
              <TeamBlock onClick={() => onTeamClick && onTeamClick(team.clubId)}>
                <Row>
                  <LogoArea>
                    <LogoOuter>
                      <LogoImg
                        src={team.logoUrl || images[team.logoKey] || images.logo}
                        alt={team.name}
                      />
                    </LogoOuter>
                  </LogoArea>

                  <ContentArea>
                    <TeamNameRow>
                      <TeamNameText>{team.name}</TeamNameText>
                      <TeamRegionText>{team.region}</TeamRegionText>
                    </TeamNameRow>

                    <SummaryRow>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 6,
                        }}
                      >
                        <SummaryText>{summaryText}</SummaryText>
                        <WinRateBadge>승률 {winRatePercent}%</WinRateBadge>
                      </div>
                    </SummaryRow>

                    <SummaryRow>
                      <RecentLabel>최근 경기기록</RecentLabel>
                      {recentResults.length > 0 ? (
                        <RecentDots>
                          {recentResults.map((r, idx2) => {
                            if (r === "W")
                              return <WinChip key={`${team.clubId}-r${idx2}`} size="sm" />;
                            if (r === "D")
                              return <DrawChip key={`${team.clubId}-r${idx2}`} size="sm" />;
                            return <LoseChip key={`${team.clubId}-r${idx2}`} size="sm" />;
                          })}
                        </RecentDots>
                      ) : (
                        <RecentDots>
                          <SoonDot />
                          <SoonDot />
                          <SoonDot />
                          <SoonDot />
                          <SoonDot />
                        </RecentDots>
                      )}
                    </SummaryRow>
                  </ContentArea>
                </Row>
              </TeamBlock>

              {index < list.length - 1 ? <Divider /> : null}
            </React.Fragment>
          );
        })}
      </TeamListCard>



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

    </TeamListSection>
  );
}
