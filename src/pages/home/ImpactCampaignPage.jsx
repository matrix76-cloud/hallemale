/* eslint-disable */
// src/pages/ImpactCampaignPage.jsx
// 할래말래 — 누적득점 기부 캠페인 페이지 (티커 클릭 시 진입용)

import React, { useMemo } from "react";
import styled, { keyframes } from "styled-components";
import { useNavigate } from "react-router-dom";
import Spinner from "../../components/common/Spinner";


/**
 * 사용 의도
 * - ImpactTickerBar(한 줄 티커) 클릭 → 이 페이지로 이동
 * - 모바일 화면을 가득 채우는 배너 느낌(=풀 스크린 섹션)
 *
 * props(선택)
 * - totalPoints: number
 * - wonPerPoint: number
 * - loading: boolean (실데이터 붙일 때)
 * - monthlyGoalWon?: number
 */

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
`;

const bounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
`;

const Page = styled.div`
  min-height: 100vh;
  background: #ffffff;
`;

const Inner = styled.div`
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;

  display: flex;
  flex-direction: column;
  gap: 12px;
`;


const TopTitle = styled.div`
  font-family: "GmarketSans";
  font-size: 16px;
  color: #111827;
`;

const Banner = styled.section`
  flex: 1;

  overflow: hidden;
  background: linear-gradient(180deg, #efe6ff 0%, #dbc7ff 55%, #c9a9ff 100%);
  box-shadow: 0 18px 50px rgba(74, 60, 125, 0.22);
  position: relative;
  padding: 18px 16px 18px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  animation: ${fadeIn} 520ms ease-out;
`;

const BrandRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 14px;
`;

const BrandName = styled.div`
  font-family: "GmarketSans";
  font-size: 22px;
  color: #3f2b72;
  letter-spacing: -0.2px;
`;

const Card = styled.div`
  background: rgba(255, 255, 255, 0.96);
  border-radius: 22px;
  padding: 22px 18px;
  box-shadow: 0 16px 46px rgba(74, 60, 125, 0.26);
  text-align: center;
`;

const Badge = styled.div`
  display: inline-block;
  background: linear-gradient(135deg, #7c3fed, #a78bfa);
  color: #fff;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-family: "GmarketSans";
  letter-spacing: -0.2px;
`;

const Ball = styled.div`
  font-size: 52px;
  margin: 14px 0 10px;
  display: inline-block;
  animation: ${bounce} 1.8s ease-in-out infinite;
`;

const Headline = styled.div`
  font-family: "GmarketSans";
  font-size: 22px;
  color: #1f1144;
  line-height: 1.25;
`;

const Highlight = styled.div`
  margin-top: 6px;
  font-family: "GmarketSans";
  font-size: 26px;
  color: #6d28d9;
`;

const Big = styled.div`
  margin: 14px 0 10px;
  font-family: "GmarketSans";
  font-size: 34px;
  color: #ff6b35;
  letter-spacing: -0.4px;
  text-shadow: 0 8px 18px rgba(255, 107, 53, 0.18);
  animation: ${pulse} 1.8s ease-in-out infinite;
`;

const Sub = styled.div`
  margin-top: 2px;
  font-size: 14px;
  color: #4a3c7d;
`;

const Divider = styled.div`
  margin: 16px 0 12px;
  height: 1px;
  background: rgba(124, 63, 237, 0.14);
`;

const Facts = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 8px;
`;

const Fact = styled.div`
  border-radius: 16px;
  background: rgba(124, 63, 237, 0.06);
  padding: 10px 12px;
  text-align: left;
`;

const FactLabel = styled.div`
  font-size: 11px;
  color: rgba(74, 60, 125, 0.78);
  margin-bottom: 4px;
`;

const FactValue = styled.div`
  font-family: "GmarketSans";
  font-size: 16px;
  color: #2d1f5c;
`;

const Note = styled.div`
  margin-top: 12px;
  font-size: 12px;
  color: rgba(17, 24, 39, 0.62);
  line-height: 1.5;
`;

const BottomActions = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 12px;
`;

const PrimaryBtn = styled.button`
  flex: 1;
  border: none;
  border-radius: 16px;
  padding: 12px 14px;
  background: #111827;
  color: #fff;
  font-size: 14px;
  font-family: "GmarketSans";
  cursor: pointer;

  &:active {
    opacity: 0.9;
  }
`;

const GhostBtn = styled.button`
  flex: 1;
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 16px;
  padding: 12px 14px;
  background: #fff;
  color: #111827;
  font-size: 14px;
  font-family: "GmarketSans";
  cursor: pointer;

  &:active {
    opacity: 0.9;
  }
`;

function fmtInt(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("ko-KR");
}

export default function ImpactCampaignPage({
  totalPoints = 1020,
  wonPerPoint = 10,
  monthlyGoalWon,
  loading = false,
}) {
  const nav = useNavigate();

  const totalWon = useMemo(() => {
    const p = Number(totalPoints);
    const w = Number(wonPerPoint);
    if (!Number.isFinite(p) || !Number.isFinite(w)) return 0;
    return Math.max(0, Math.floor(p * w));
  }, [totalPoints, wonPerPoint]);

  if (loading) {
    return (
      <Page>
        <Inner style={{ alignItems: "center", justifyContent: "center" }}>
          <Spinner />
        </Inner>
      </Page>
    );
  }

  return (
    <Page>
      <Inner>
     

        <Banner>
          <BrandRow>
            <BrandName>할래말래</BrandName>
          </BrandRow>

          <Card>
            <Badge>특별 기부 캠페인</Badge>

            <div>
              <Ball>🏀</Ball>
            </div>

            <Headline>
              당신의 득점이
              <Highlight>세상을 바꿉니다</Highlight>
            </Headline>

            <Big>1점당 {fmtInt(wonPerPoint)}원</Big>

            <Sub>길거리 농구 매칭하고, 누적 득점으로 함께 기부해요</Sub>

            <Divider />

            <Facts>
              <Fact>
                <FactLabel>누적 득점</FactLabel>
                <FactValue>{fmtInt(totalPoints)}점</FactValue>
              </Fact>
              <Fact>
                <FactLabel>누적 기부금</FactLabel>
                <FactValue>{fmtInt(totalWon)}원</FactValue>
              </Fact>
            </Facts>

            <Note>
              누적 득점은 할래말래 경기 기록 기준으로 합산됩니다.
              {Number.isFinite(Number(monthlyGoalWon)) && Number(monthlyGoalWon) > 0 ? (
                <>
                  <br />
                  이번 달 목표: {fmtInt(monthlyGoalWon)}원
                </>
              ) : null}
            </Note>

          
          </Card>
        </Banner>
      </Inner>
    </Page>
  );
}
