// src/components/home/HomeClubCard.jsx
import React from "react";
import styled from "styled-components";

const Card = styled.section`
  padding: 14px 12px;
  border-radius: 16px;
  background: ${({ theme }) => theme.colors.card};
  box-shadow: ${({ theme }) => theme.shadows.card};
  margin-bottom: 16px;
`;

const DebugName = styled.div`
  font-size: 10px;
  opacity: 0.7;
  margin-bottom: 4px;
`;

const Label = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  margin-bottom: 4px;
`;

const Name = styled.div`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
`;

const Meta = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.4;
`;

export default function HomeClubCard() {
  // TODO: 나중에 useClub에서 실제 데이터 가져오면 교체
  return (
    <Card>
      <DebugName>[HomeClubCard]</DebugName>
      <Label>내 클럽팀</Label>
      <Name>청춘호랑이 (예시)</Name>
      <Meta>12승 6패 · 승률 66.7%</Meta>
      <Meta>성북구 · 2연승 중</Meta>
    </Card>
  );
}
