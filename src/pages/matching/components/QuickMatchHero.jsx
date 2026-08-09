/* eslint-disable */
// src/pages/matching/components/QuickMatchHero.jsx
// 매칭하기 상단 빠른 매칭 히어로 카드
// - 예전엔 제목 + 한 줄 캡션 + 버튼뿐이라, 버튼을 누르면 무슨 일이 일어나는지 알 수 없었다.
//   "지역·전력·활동량을 종합해요"라고만 하고 무엇을 어떻게 보는지는 안 보여줬다.
// - 지금은 내 팀 현황과 실제 정렬 기준(matchmaking.WEIGHTS)을 그대로 펼쳐 보여준다.
//   화면의 숫자와 알고리즘의 가중치가 같은 출처라 서로 어긋나지 않는다.

import React from "react";
import styled from "styled-components";
import { teamLogoSrc } from "../../../utils/imageAssets";
import { WEIGHTS } from "../../../utils/matchmaking";

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Card = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  padding: 22px 20px 18px;
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

/* 우상단 장식 원 (은은한 브랜드색) */
const Blob = styled.div`
  position: absolute;
  top: -40px;
  right: -30px;
  width: 150px;
  height: 150px;
  border-radius: 999px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(157,134,220,0.12)" : "rgba(124,92,201,0.07)"};
  pointer-events: none;
`;

const Title = styled.h2`
  position: relative;
  margin: 0 0 14px;
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 22px;
  font-weight: 800;
  line-height: 1.32;
  letter-spacing: -0.4px;
`;

/* ===== 내 팀 현황 ===== */
const MyRow = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 14px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.bg};
`;

const MyLogo = styled.img`
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 10px;
  object-fit: cover;
  background: ${({ theme }) => theme.colors.surface};
`;

const MyTexts = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const MyName = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MyMeta = styled.div`
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* ===== 정렬 기준 ===== */
const CriteriaLabel = styled.div`
  position: relative;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textNormal};
`;

const Criteria = styled.div`
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
`;

const Chip = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};

  b {
    font-size: 12px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const StartBtn = styled.button`
  position: relative;
  width: 100%;
  height: 56px;
  border: none;
  border-radius: 16px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 17px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(124, 92, 201, 0.3);
  transition: transform 0.12s ease, box-shadow 0.12s ease;

  &:active {
    transform: translateY(1px);
    box-shadow: 0 3px 10px rgba(124, 92, 201, 0.28);
  }
`;

const Caption = styled.p`
  position: relative;
  margin: 10px 0 0;
  text-align: center;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.textWeak};
`;

function BoltIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M13 2 4.5 13.5H11l-1 8.5 9-12H12.5L13 2Z" fill={color} />
    </svg>
  );
}

/* 화면 문구와 실제 가중치를 한 곳에서 만든다 — 표가 바뀌면 화면도 같이 바뀐다 */
const CRITERIA = [
  ["balance", "전력 균형"],
  ["region", "지역 근접"],
  ["activity", "활동량"],
  ["size", "인원"],
  ["rank", "랭킹"],
];

export default function QuickMatchHero({ onStart, myTeam, myRank, opponentCount = 0 }) {
  const stats = myTeam?.stats || null;
  const memberCount = Array.isArray(myTeam?.members) ? myTeam.members.length : 0;

  const metaParts = [];
  if (myRank) metaParts.push(`${myRank}위`);
  if (stats?.totalMatches) metaParts.push(`${stats.wins}승 ${stats.losses}패`);
  else metaParts.push("전적 없음");
  if (memberCount) metaParts.push(`${memberCount}명`);

  return (
    <Section>
      <Card>
        <Blob />

        <Title>
          우리 팀에 맞는 상대를
          <br />
          계산해서 찾아드려요
        </Title>

        {myTeam ? (
          <MyRow>
            <MyLogo src={teamLogoSrc(myTeam.logoUrl)} alt={myTeam.name || "우리팀"} />
            <MyTexts>
              <MyName>{myTeam.name || "우리팀"}</MyName>
              <MyMeta>{metaParts.join(" · ")}</MyMeta>
            </MyTexts>
          </MyRow>
        ) : null}

        <CriteriaLabel>이런 기준으로 상대 순서를 정해요</CriteriaLabel>
        <Criteria>
          {CRITERIA.map(([key, label]) => (
            <Chip key={key}>
              {label}
              <b>{WEIGHTS[key]}</b>
            </Chip>
          ))}
        </Criteria>

        <StartBtn type="button" onClick={onStart}>
          <BoltIcon size={20} color="#ffffff" />
          매칭 찾기
        </StartBtn>

        {opponentCount > 0 ? (
          <Caption>지금 등록된 상대 팀 {opponentCount}팀에서 찾아요</Caption>
        ) : null}
      </Card>
    </Section>
  );
}
