/* eslint-disable */
// src/pages/matching/MatchingHomePage.jsx
// 전체 팀 매칭 관리 페이지
// - 모든 팀 리스트
// - 팀별 매칭 상태 + 액션 버튼 (매칭 신청 / 다시 요청하기)

import React from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { TEAMS } from "../../mock/teamsMock";
import { images } from "../../utils/imageAssets";

/* =============== 페이지 레이아웃 =============== */

const Page = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.bg || "#f3f4f6"};
`;

const Inner = styled.div`
  padding: 16px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SectionTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.fontSizes.titleSm || 16}px;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textStrong};
  font-family:"GmarketSans"
`;

const SectionDesc = styled.p`
  margin: 4px 0 0;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

/* =============== 리스트 컨테이너 =============== */

const ListCard = styled.div`
  margin-top: 8px;
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  padding: 8px 0;
`;

const HeaderRow = styled.div`
  display: grid;
  grid-template-columns: 2.5fr 1fr 1.4fr;
  align-items: center;
  padding: 8px 16px;
  font-size: 11px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.muted || "#9ca3af"};
  background: #eef2ff;
  border-radius: 16px 16px 12px 12px;
`;

const HeaderCol = styled.div`
  text-align: ${({ $align }) => $align || "left"};
`;

/* =============== 팀 row =============== */

const Row = styled.div`
  display: grid;
  grid-template-columns: 2.5fr 1fr 1.4fr;
  align-items: center;
  padding: 10px 16px;
  column-gap: 8px;
  border-bottom: 1px solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }
`;

const TeamInfoCell = styled.button`
  border: none;
  background: transparent;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  cursor: pointer;
`;

const LogoWrap = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 12px;
  overflow: hidden;
  background: #e5e7eb;
  flex-shrink: 0;
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const TeamTexts = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const TeamName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const TeamRegion = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.muted || "#6b7280"};
`;

const StatCell = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textStrong};
  text-align: center;
`;

/* 상태 + 버튼 */

const StatusCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
`;

const StatusBadge = styled.span`
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 500;
  ${({ $kind }) => {
    if ($kind === "pending") {
      return `
        background: #dbeafe;
        color: #1d4ed8;
      `;
    }
    if ($kind === "rejected") {
      return `
        background: #fee2e2;
        color: #b91c1c;
      `;
    }
    return `
      background: transparent;
      color: #6b7280;
    `;
  }}
`;

const ActionButton = styled.button`
  border-radius: 999px;
  border: none;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;

  ${({ $variant }) => {
    if ($variant === "primary") {
      return `
        background: #2563eb;
        color: #ffffff;
      `;
    }
    return `
      background: #f3f4f6;
      color: #111827;
    `;
  }}
`;

/* =============== 매칭 상태 Mock =============== */
/**
 * status: "none" | "pending" | "rejected"
 * direction: "sent" | "received"
 */
const MATCH_RELATIONS = {
  li_lion: { status: "pending", direction: "sent" }, // LI이언
  deokso_eagles: { status: "pending", direction: "received" },
  hangang_bulldogs: { status: "rejected", direction: "sent" },
  // 나머지는 기본 "none"
};

function getRelation(clubId) {
  return (
    MATCH_RELATIONS[clubId] || {
      status: "none",
      direction: "sent",
    }
  );
}

function getStatusLabel(status, direction) {
  if (status === "pending") {
    return "매칭 진행중";
  }
  if (status === "rejected") {
    return "매칭 거부";
  }
  // none
  return "";
}

function getButtonConfig(status, direction) {
  if (status === "none") {
    return {
      label: "매칭 신청",
      variant: "primary",
    };
  }
  if (status === "pending") {
    return {
      label: "다시 요청하기",
      variant: "default",
    };
  }
  if (status === "rejected") {
    return {
      label: "다시 요청하기",
      variant: "default",
    };
  }
  return {
    label: "매칭 신청",
    variant: "primary",
  };
}

/* =============== 컴포넌트 =============== */

export default function MatchingHomePage() {
  const nav = useNavigate();

  const handleTeamClick = (clubId) => {
    if (!clubId) return;
    nav(`/team/${clubId}`);
  };

  const handleActionClick = (team, relation) => {
    const { status, direction } = relation;
    // TODO: 여기서 실제 매칭 신청/재요청 API 호출 연결
    console.log("[MatchAction]", {
      clubId: team.clubId,
      teamName: team.name,
      status,
      direction,
    });
    alert(
      `${team.name} 팀에 "${
        status === "none" ? "매칭 신청" : "다시 요청"
      }" 액션을 보냈다고 가정합니다.`
    );
  };

  return (
    <Page>
      <Inner>
    

        <ListCard>
          <HeaderRow>
            <HeaderCol>팀명</HeaderCol>
            <HeaderCol $align="center">승률</HeaderCol>
            <HeaderCol $align="center">매칭 상태</HeaderCol>
          </HeaderRow>

          {TEAMS.map((team) => {
            const relation = getRelation(team.clubId);
            const statusLabel = getStatusLabel(
              relation.status,
              relation.direction
            );
            const { label: btnLabel, variant } = getButtonConfig(
              relation.status,
              relation.direction
            );

            const logoSrc = team.logoKey
              ? images[team.logoKey]
              : images.logo;

            return (
              <Row key={team.clubId}>
                {/* 팀 정보 + 클릭 시 팀 프로필로 이동 */}
                <TeamInfoCell onClick={() => handleTeamClick(team.clubId)}>
                  <LogoWrap>
                    <LogoImg src={logoSrc} alt={team.name} />
                  </LogoWrap>
                  <TeamTexts>
                    <TeamName>{team.name}</TeamName>
                    <TeamRegion>{team.region}</TeamRegion>
                  </TeamTexts>
                </TeamInfoCell>

                {/* 승률 */}
                <StatCell>{Math.round(team.stats.winRate * 100)}%</StatCell>

                {/* 상태 + 액션 */}
                <StatusCell>
                  {statusLabel && (
                    <StatusBadge $kind={relation.status}>
                      {statusLabel}
                    </StatusBadge>
                  )}
                  <ActionButton
                    type="button"
                    $variant={variant}
                    onClick={() => handleActionClick(team, relation)}
                  >
                    {btnLabel}
                  </ActionButton>
                </StatusCell>
              </Row>
            );
          })}
        </ListCard>
      </Inner>
    </Page>
  );
}
