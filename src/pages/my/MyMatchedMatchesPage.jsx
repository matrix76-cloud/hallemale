// src/pages/my/MyMatchedMatchesPage.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { images } from "../../utils/imageAssets";
import { TEAMS } from "../../mock/teamsMock";
import SubHeaderBar from "../../layouts/components/SubHeaderBar";

/**
 * 매칭된 경기 목록 페이지
 * - 팀 매칭을 통해 생성된 경기 기록
 */

const dummyMatchedMatches = [
  {
    id: "mm-1",
    myTeamId: "cheongcho_tigers",
    oppTeamId: "deokso_eagles",
    date: "2025.11.21 (목)",
    time: "15:00",
    place: "성북구 스카이 풋살파크",
    status: "confirmed", // confirmed | pending | cancelled | finished
    result: "none",
    score: "-",
  },
  {
    id: "mm-2",
    myTeamId: "cheongcho_tigers",
    oppTeamId: "li_lion",
    date: "2025.11.25 (화)",
    time: "16:00",
    place: "마포 농구장 A코트",
    status: "pending",
    result: "none",
    score: "-",
  },
  {
    id: "mm-3",
    myTeamId: "cheongcho_tigers",
    oppTeamId: "shinchon_sharks",
    date: "2025.11.26 (수)",
    time: "19:00",
    place: "신촌 실내체육관",
    status: "finished",
    result: "win",
    score: "62 : 57",
  },
  {
    id: "mm-4",
    myTeamId: "cheongcho_tigers",
    oppTeamId: "hangang_bulldogs",
    date: "2025.11.21 (목)",
    time: "19:00",
    place: "여의도 실내 코트",
    status: "cancelled",
    result: "none",
    score: "-",
  },
];

function findTeamById(id) {
  return TEAMS.find((t) => t.clubId === id) || TEAMS[0];
}

const statusLabelTone = (status) => {
  if (status === "pending") return { label: "매칭 신청중", tone: "pending" };
  if (status === "confirmed") return { label: "확정", tone: "confirmed" };
  if (status === "finished") return { label: "종료", tone: "finished" };
  if (status === "cancelled") return { label: "취소", tone: "cancelled" };
  return { label: "미정", tone: "default" };
};

export default function MyMatchedMatchesPage() {
  const navigate = useNavigate();
  const handleBack = () => navigate(-1);

  const handleClickMatch = (id) => {
    // TODO: 매칭룸 상세로 이동
    console.log("go matched match detail:", id);
    navigate(`/match-room/${id}`);
  };

  return (
    <PageWrap>




      <Inner>
        {dummyMatchedMatches.length === 0 ? (
          <EmptyWrap>아직 매칭된 경기 기록이 없습니다.</EmptyWrap>
        ) : (
          <MatchList>
            {dummyMatchedMatches.map((m) => {
              const myTeam = findTeamById(m.myTeamId);
              const oppTeam = findTeamById(m.oppTeamId);
              const { label: statusLabel, tone } = statusLabelTone(m.status);

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
                    <StatusBadge tone={tone}>{statusLabel}</StatusBadge>
                    <ResultRight>
                      <ResultLabel>결과</ResultLabel>
                      <ResultValue>
                        {m.status === "finished" ? m.score : "-"}
                      </ResultValue>
                    </ResultRight>
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

const StatusBadge = styled.div`
  min-width: 60px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;

  ${({ tone }) => {
    if (tone === "pending")
      return `background:#fef3c7;color:#b45309;`;
    if (tone === "confirmed")
      return `background:#dcfce7;color:#166534;`;
    if (tone === "finished")
      return `background:#e5e7eb;color:#111827;`;
    if (tone === "cancelled")
      return `background:#fee2e2;color:#b91c1c;`;
    return `background:#e5e7eb;color:#4b5563;`;
  }}
`;

const ResultRight = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
`;

const ResultLabel = styled.div`
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
`;

const ResultValue = styled.div`
  color: ${({ theme }) => theme.colors.textStrong};
`;
