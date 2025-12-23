/* eslint-disable */
// src/pages/matching/components/AiRecommendedTeamsSection.jsx
// ✅ 변경점: state로 로고/이름 넘기지 않음
// - 버튼 클릭 시 opponentClubId만 넘김
// - 분석 페이지가 clubId로 실데이터 로드해서 풍성하게 보여줌

import React, { useMemo } from "react";
import styled from "styled-components";
import { images } from "../../../utils/imageAssets";
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
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
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
  border-radius: 18px;
  background: #eee;
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

const Btn = styled.button`
  height: 34px;
  border-radius: 999px;
  border: 1px solid rgba(79, 70, 229, 0.28);
  background: rgba(79, 70, 229, 0.08);
  color: #3730a3;
  font-size: 12px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }
`;

function hashInt(str) {
  const s = String(str || "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function mockWinProb({ myClubId, opponentClubId }) {
  const h = hashInt(`${myClubId}::${opponentClubId}`);
  return 55 + (h % 24);
}

function pickTwoTeams({ myTeam, opponentTeams }) {
  const list = Array.isArray(opponentTeams) ? opponentTeams : [];
  if (!myTeam || list.length === 0) return [];

  const myId = String(myTeam.clubId || myTeam.id || "").trim();
  const mySido = String(myTeam.regionSido || "").trim();

  const withoutMe = list.filter((t) => String(t.clubId || t.id || "").trim() !== myId);

  const same = mySido
    ? withoutMe.filter((t) => String(t.regionSido || "").trim() === mySido)
    : [];

  const base = same.length >= 2 ? same : withoutMe;

  const sorted = [...base].sort((a, b) =>
    String(a.clubId || "").localeCompare(String(b.clubId || ""))
  );

  return sorted.slice(0, 2);
}

export default function AiRecommendedTeamsSection({
  myTeam,
  opponentTeams,
  onOpenAnalysis,
}) {
  const picks = useMemo(() => pickTwoTeams({ myTeam, opponentTeams }), [myTeam, opponentTeams]);

  return (
    <AiSection>
      <AiHeaderRow>
        <AiTitle>AI가 추천한 매칭 팀</AiTitle>
        <AiSub>내 팀과 같은 지역의 팀을 우선으로 분석해요.</AiSub>
      </AiHeaderRow>

      <AiScrollRow>
        {picks.map((team, idx) => {
          const myId = String(myTeam?.clubId || myTeam?.id || "").trim();
          const oppId = String(team.clubId || team.id || "").trim();
          const prob = mockWinProb({ myClubId: myId, opponentClubId: oppId });

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
