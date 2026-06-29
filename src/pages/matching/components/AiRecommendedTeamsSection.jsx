/* eslint-disable */
// src/pages/matching/components/AiRecommendedTeamsSection.jsx
// ✅ 변경점: state로 로고/이름 넘기지 않음
// - 버튼 클릭 시 opponentClubId만 넘김
// - 분석 페이지가 clubId로 실데이터 로드해서 풍성하게 보여줌

import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { images, teamLogoSrc } from "../../../utils/imageAssets";
import {
  estimateWinProbability,
  recommendationScore,
  buildRecommendBlurb,
} from "../../../utils/matchAnalysis";
import { getClubMemberCounts } from "../../../services/matchingHomeService";
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

const AiEmpty = styled.div`
  padding: 16px 12px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  box-shadow: ${({ theme }) => theme.shadows.card};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  text-align: center;
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

const MIN_MEMBERS = 3; // ✅ AI 추천 노출 최소 인원(3대3 한 팀 구성 가능)
const CANDIDATE_POOL = 16; // 점수 상위 후보만 멤버 수 조회(쿼리 절감)
const PICK_COUNT = 2;

// ✅ 추천 후보 정렬: 지역+전력유사도+활동량 점수(recommendationScore)로 정렬 (멤버 수 필터 전)
function scoreOpponents({ myTeam, opponentTeams }) {
  const list = Array.isArray(opponentTeams) ? opponentTeams : [];
  if (!myTeam || list.length === 0) return [];

  const myId = String(myTeam.clubId || myTeam.id || "").trim();
  const withoutMe = list.filter((t) => String(t.clubId || t.id || "").trim() !== myId);

  return withoutMe
    .map((t) => ({ team: t, score: recommendationScore(myTeam, t) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // 동점이면 clubId로 안정 정렬(결정적)
      return String(a.team.clubId || a.team.id || "").localeCompare(
        String(b.team.clubId || b.team.id || "")
      );
    })
    .map((x) => x.team);
}

export default function AiRecommendedTeamsSection({
  myTeam,
  opponentTeams,
  onOpenAnalysis,
}) {
  // 1) 점수 상위 후보(멤버 수 필터 전)
  const candidates = useMemo(
    () => scoreOpponents({ myTeam, opponentTeams }).slice(0, CANDIDATE_POOL),
    [myTeam, opponentTeams]
  );

  // 2) 후보 팀의 실제 멤버 수 조회 (clubs/{id}/members 집계)
  const [memberCounts, setMemberCounts] = useState(null); // Map | null(로딩 중)

  useEffect(() => {
    let alive = true;
    setMemberCounts(null);

    const ids = candidates
      .map((t) => String(t.clubId || t.id || "").trim())
      .filter(Boolean);

    if (ids.length === 0) {
      setMemberCounts(new Map());
      return;
    }

    getClubMemberCounts(ids)
      .then((map) => {
        if (alive) setMemberCounts(map);
      })
      .catch((e) => {
        console.warn("[AiRecommendedTeamsSection] getClubMemberCounts failed:", e?.message || e);
        if (alive) setMemberCounts(new Map());
      });

    return () => {
      alive = false;
    };
  }, [candidates]);

  // 3) 팀원 3명 이상만 추천(멤버 수를 승률 추정에도 반영) → 상위 2팀
  const picks = useMemo(() => {
    if (!memberCounts) return null; // 로딩 중
    return candidates
      .map((t) => ({
        ...t,
        memberCount: memberCounts.get(String(t.clubId || t.id || "").trim()) || 0,
      }))
      .filter((t) => t.memberCount >= MIN_MEMBERS)
      .slice(0, PICK_COUNT);
  }, [candidates, memberCounts]);

  const loading = picks === null;

  return (
    <AiSection>
      <AiHeaderRow>
        <AiTitle>AI가 추천한 매칭 팀</AiTitle>
        <AiSub>지역·전력·활동량을 종합해 해볼 만한 팀을 추천해요.</AiSub>
      </AiHeaderRow>

      {loading ? (
        <AiEmpty>추천 팀을 분석하고 있어요…</AiEmpty>
      ) : picks.length === 0 ? (
        <AiEmpty>지금은 추천할 팀이 없어요. (팀원 3명 이상인 팀이 모이면 추천돼요)</AiEmpty>
      ) : (
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
                  src={teamLogoSrc(team.logoUrl || images[team.logoKey])}
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
      )}
    </AiSection>
  );
}
