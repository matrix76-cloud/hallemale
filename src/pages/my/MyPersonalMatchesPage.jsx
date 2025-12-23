// src/pages/my/MyPersonalMatchesPage.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { images } from "../../utils/imageAssets";
import { TEAMS } from "../../mock/teamsMock";
import SubHeaderBar from "../../layouts/components/SubHeaderBar";

/**
 * 개인 활동 경기 목록 페이지
 * - 픽업게임, 개인 참가 경기 기록
 */

const dummyPersonalMatches = [
  {
    id: "pm-1",
    myTeamId: "cheongcho_tigers",
    oppTeamId: "deokso_eagles",
    date: "2025.11.21 (금)",
    time: "19:00",
    place: "덕소 체육관 A코트",
    result: "win",
    score: "68 : 62",
    status: "done",
  },
  {
    id: "pm-2",
    myTeamId: "cheongcho_tigers",
    oppTeamId: "li_lion",
    date: "2025.11.15 (토)",
    time: "17:00",
    place: "마포 실내체육관 B코트",
    result: "lose",
    score: "54 : 60",
    status: "done",
  },
  {
    id: "pm-3",
    myTeamId: "cheongcho_tigers",
    oppTeamId: "shinchon_sharks",
    date: "2025.11.10 (월)",
    time: "20:00",
    place: "신촌 실내 코트",
    result: "none",
    score: "-",
    status: "cancelled",
  },
];

function findTeamById(id) {
  return TEAMS.find((t) => t.clubId === id) || TEAMS[0];
}

export default function MyPersonalMatchesPage() {
  const navigate = useNavigate();
  const handleBack = () => navigate(-1);

  const handleClickMatch = (id) => {
    // TODO: 상세 페이지로 이동
    console.log("go personal match detail:", id);
  };

  return (
    <PageWrap>


      <Inner>
        {dummyPersonalMatches.length === 0 ? (
          <EmptyWrap>아직 기록된 개인 활동 경기가 없습니다.</EmptyWrap>
        ) : (
          <MatchList>
            {dummyPersonalMatches.map((m) => {
              const myTeam = findTeamById(m.myTeamId);
              const oppTeam = findTeamById(m.oppTeamId);

              return (
                <MatchCard
                  key={m.id}
                  type="button"
                  onClick={() => handleClickMatch(m.id)}
                >
                  <TopRow>
                    <TeamRow>
                      <TeamSide>
                        <TeamLogoWrap>
                          <TeamLogo
                            src={images[myTeam.logoKey] || images.logo}
                            alt={myTeam.name}
                          />
                        </TeamLogoWrap>
                        <TeamName>{myTeam.name}</TeamName>
                      </TeamSide>
                      <VsText>VS</VsText>
                      <TeamSide style={{ justifyContent: "flex-end" }}>
                        <TeamName style={{ textAlign: "right" }}>
                          {oppTeam.name}
                        </TeamName>
                        <TeamLogoWrap>
                          <TeamLogo
                            src={images[oppTeam.logoKey] || images.logo}
                            alt={oppTeam.name}
                          />
                        </TeamLogoWrap>
                      </TeamSide>
                    </TeamRow>
                  </TopRow>

                  <MiddleRow>
                    <InfoCol>
                      <InfoLabel>경기 일시</InfoLabel>
                      <InfoValue>
                        {m.date} {m.time}
                      </InfoValue>
                    </InfoCol>
                    <InfoCol>
                      <InfoLabel>장소</InfoLabel>
                      <InfoValue>{m.place}</InfoValue>
                    </InfoCol>
                  </MiddleRow>

                  <BottomRow>
                    <ResultBadge result={m.result}>
                      {m.status === "cancelled"
                        ? "취소"
                        : m.result === "win"
                        ? "승"
                        : m.result === "lose"
                        ? "패"
                        : "-"}
                    </ResultBadge>
                    <ScoreText>
                      {m.status === "cancelled" ? "-" : m.score}
                    </ScoreText>
                  </BottomRow>
                </MatchCard>
              );
            })}
          </MatchList>
        )}
      </Inner>
    </PageWrap>
  );
}

/* ============ styled ============ */

const PageWrap = styled.div`
  min-height: calc(100vh - 56px);
  background: ${({ theme }) => theme.colors.bg || "#f5f6fa"};
  display: flex;
  flex-direction: column;
`;

const HeaderBar = styled.div`
  height: 48px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const IconButton = styled.button`
  border: none;
  background: transparent;
  padding: 4px;
  cursor: pointer;
  color: #4b5563;
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const HeaderRightPlaceholder = styled.div`
  width: 24px;
`;

const Inner = styled.div`
  padding: 0 14px 20px;
`;

const EmptyWrap = styled.div`
  margin-top: 20px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
  text-align: center;
`;

const MatchList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
`;

const MatchCard = styled.button`
  width: 100%;
  border: none;
  border-radius: 18px;
  background: #ffffff;
  padding: 10px 12px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  text-align: left;
`;

const TopRow = styled.div``;

const TeamRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
`;

const TeamSide = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const TeamLogoWrap = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 999px;
  overflow: hidden;
  background: #e5e7eb;
  flex-shrink: 0;
`;

const TeamLogo = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TeamName = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const VsText = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: #2563eb;
`;

const MiddleRow = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 4px;
`;

const InfoCol = styled.div`
  flex: 1;
  min-width: 0;
`;

const InfoLabel = styled.div`
  font-size: 10px;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
  margin-bottom: 2px;
`;

const InfoValue = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const BottomRow = styled.div`
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ResultBadge = styled.div`
  min-width: 40px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  color: #ffffff;

  ${({ result }) => {
    if (result === "win") return `background:#22c55e;`;
    if (result === "lose") return `background:#ef4444;`;
    return `background:#9ca3af;`;
  }}
`;

const ScoreText = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textStrong};
`;
