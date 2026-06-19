/* eslint-disable */
// src/pages/matching/components/AiRecommendedTeamsSection.jsx
// ✅ 변경점: state로 로고/이름 넘기지 않음
// - 버튼 클릭 시 opponentClubId만 넘김
// - 분석 페이지가 clubId로 실데이터 로드해서 풍성하게 보여줌

import React, { useMemo } from "react";
import styled from "styled-components";
import { images } from "../../../utils/imageAssets";
import {
  estimateWinProbability,
  recommendationScore,
  buildRecommendBlurb,
} from "../../../utils/matchAnalysis";
import AnimatedAiRing from "./AnimatedAiRing";

const AiSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const AiHeaderRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const AiTitle = styled.span`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const AiSub = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const AiScrollRow = styled.div`
  margin-top: 2px;
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;

  &::-webkit-scrollbar {
    height: 4px;
  }
`;

const AiTeamCard = styled.div`
  flex: 0 0 140px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  box-shadow: ${({ theme }) => theme.shadows.card};
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const AiLogoBox = styled.div`
  position: relative;
  width: 100%;
  padding-top: 100%;
  background: #0f172a;
`;

const AiLogoImg = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const RingDock = styled.div`
  position: absolute;
  right: 10px;
  top: 10px;
`;

const AiCardBody = styled.div`
  padding: 10px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TeamNameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

const Crown = styled.span`
  font-size: 12px;
`;

const TeamName = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Blurb = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Btn = styled.button`
  height: 34px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark"
      ? "rgba(99, 102, 241, 0.45)"
      : "rgba(79, 70, 229, 0.28)"};
  background: ${({ theme }) =>
    theme.mode === "dark"
      ? "rgba(99, 102, 241, 0.18)"
      : "rgba(79, 70, 229, 0.08)"};
  color: ${({ theme }) =>
    theme.mode === "dark" ? "#a5b4fc" : "#3730a3"};
  font-size: 12px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }
`;

// ✅ 추천팀 선정: 지역+전력유사도+활동량 점수(recommendationScore)로 정렬
function pickRecommendedTeams({ myTeam, opponentTeams, count = 2 }) {
  const list = Array.isArray(opponentTeams) ? opponentTeams : [];
  if (!myTeam || list.length === 0) return [];

  const myId = String(myTeam.clubId || myTeam.id || "").trim();
  const withoutMe = list.filter((t) => String(t.clubId || t.id || "").trim() !== myId);

  const scored = withoutMe.map((t) => ({
    team: t,
    score: recommendationScore(myTeam, t),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // 동점이면 clubId로 안정 정렬(결정적)
    return String(a.team.clubId || a.team.id || "").localeCompare(
      String(b.team.clubId || b.team.id || "")
    );
  });

  return scored.slice(0, count).map((x) => x.team);
}

export default function AiRecommendedTeamsSection({
  myTeam,
  opponentTeams,
  onOpenAnalysis,
}) {
  const picks = useMemo(
    () => pickRecommendedTeams({ myTeam, opponentTeams }),
    [myTeam, opponentTeams]
  );

  return (
    <AiSection>
      <AiHeaderRow>
        <AiTitle>AI가 추천한 매칭 팀</AiTitle>
        <AiSub>지역·전력·활동량을 종합해 해볼 만한 팀을 추천해요.</AiSub>
      </AiHeaderRow>

      <AiScrollRow>
        {picks.map((team) => {
          const oppId = String(team.clubId || team.id || "").trim();
          // ✅ 실데이터(stats/members) 기반 승률 추정 + 동적 문구
          const est = estimateWinProbability(myTeam, team);
          const prob = est.prob;
          const blurb = buildRecommendBlurb(myTeam, team);

          return (
            <AiTeamCard key={oppId}>
              <AiLogoBox>
                <AiLogoImg
                  src={team.logoUrl || images[team.logoKey] || images.logo}
                  alt={team.name}
                />
                <RingDock>
                  <AnimatedAiRing percent={prob} size={76} label="승리확률" />
                </RingDock>
              </AiLogoBox>

              <AiCardBody>
                <TeamNameRow>
                  <TeamName title={team.name}>{team.name}</TeamName>
                </TeamNameRow>

                <Blurb title={blurb}>{blurb}</Blurb>

                <Btn type="button" onClick={() => onOpenAnalysis && onOpenAnalysis(oppId)}>
                  분석결과 보기
                </Btn>
              </AiCardBody>
            </AiTeamCard>
          );
        })}
      </AiScrollRow>
    </AiSection>
  );
}
