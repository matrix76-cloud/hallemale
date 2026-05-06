/* eslint-disable */
// src/pages/admin/AdminTeamsRankingPage.jsx
// 사용자의 팀 랭킹 페이지를 어드민 안에서 그대로 보여줌
import React from "react";
import styled from "styled-components";
import TeamRankingFullPage from "../team/TeamRankingFullPage";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
`;

const H1 = styled.h1`
  margin: 0;
  font-size: 18px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const Sub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

const Card = styled.div`
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 8px;
  box-shadow: ${({ theme }) =>
    theme?.shadows?.card || "0 6px 14px rgba(15, 23, 42, 0.04)"};
  overflow: hidden;
`;

export default function AdminTeamsRankingPage() {
  return (
    <Page>
      <TitleRow>
        <div>
          <H1>팀 순위</H1>
          <Sub>사용자 화면과 동일한 팀 랭킹</Sub>
        </div>
      </TitleRow>
      <Card>
        <TeamRankingFullPage />
      </Card>
    </Page>
  );
}
