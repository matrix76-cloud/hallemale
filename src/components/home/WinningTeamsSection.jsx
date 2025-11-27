/* eslint-disable */
import React from "react";
import styled from "styled-components";
import { WINNING_TEAMS } from "../../mock/teamsMock";
import { images } from "../../utils/imageAssets";
import { useNavigate } from "react-router-dom";

const SectionWrap = styled.section`
  margin-top: 8px; /* 🔥 위쪽 여백 조금 추가 */
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 15px;
  font-weight: ${({ theme }) => theme.fontWeights.bold};
  color: ${({ theme }) => theme.colors.textStrong};
`;

const MoreButton = styled.button`
  border: none;
  background: none;
  padding: 0;
  color: ${({ theme }) => theme.colors.muted || "#888"};
  font-size: 13px;
  display: flex;
  align-items: center;
  cursor: pointer;
`;

/* 🔥 슬라이드/스크롤 제거 — 고정 3컬럼 그리드 */
const ListGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
`;

// 카드 3장 기준으로 살짝 컴팩트하게



const Card = styled.div`
  padding: 10px 8px 10px;
  border-radius: 14px;
  background: #f9fafb; /* 너무 새하얀 느낌 피해서 살짝 톤다운 */
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.03);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;

/* 로고 + 왕관 */
const LogoOuter = styled.div`
  position: relative;
  width: 52px;
  height: 52px;
`;

const LogoBase = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 18px;
  overflow: hidden;
  background: #f4f4ff;
`;

const LogoImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const CrownWrap = styled.div`
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 32px;
  height: 32px;
`;

const CrownImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

const CrownNumber = styled.span`
  position: absolute;
  bottom: 5px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  font-weight: 700;
  color: #ffffff;
`;

const TeamName = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textStrong};
  font-weight: 500;
  text-align: center;
`;

const StreakText = styled.div`
  font-size: 12px;
  margin-top: 1px;
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 700;
  text-align: center;
`;

const MatchButton = styled.button`
  margin-top: 6px;
  padding: 5px 0;
  width: 100%;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  border: none;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
`;

export default function WinningTeamsSection() {
  const navigate = useNavigate();

  const handleMore = () => {
    // TODO: 전체 연승팀 페이지로 이동
  };

  const handleRequestMatch = (clubId) => {
    // TODO: 매칭 요청 페이지로 이동
  };

  if (!WINNING_TEAMS.length) return null;

  return (
    <SectionWrap>
      <HeaderRow>
        <SectionTitle>연승팀 대결 신청하기</SectionTitle>
        <MoreButton type="button" onClick={handleMore}>
          전체보기
        </MoreButton>
      </HeaderRow>

      <ListGrid>
        {WINNING_TEAMS.slice(0, 3).map((t, idx) => (
          <Card key={t.clubId}>
            <LogoOuter>
              <LogoBase>
                <LogoImg src={images[t.logoKey]} alt={t.name} />
              </LogoBase>

              <CrownWrap>
                <CrownImg src={images.logo} alt="왕관" />
                <CrownNumber>{idx + 1}</CrownNumber>
              </CrownWrap>
            </LogoOuter>

            <TeamName>{t.name}</TeamName>
            <StreakText>{t.streakLabel}</StreakText>

            <MatchButton
              type="button"
              onClick={() => handleRequestMatch(t.clubId)}
            >
              매칭 요청
            </MatchButton>
          </Card>
        ))}
      </ListGrid>
    </SectionWrap>
  );
}
