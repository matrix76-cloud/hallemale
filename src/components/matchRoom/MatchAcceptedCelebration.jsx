/* eslint-disable */
// src/components/matchRoom/MatchAcceptedCelebration.jsx
// 매칭 수락 직후 뜨는 "매칭 성사!" 모달. (디자인: 목업 2026-06-24)
// - 보라 체크 + 팀 vs 팀(우리팀 배지) + "조율 시작하기 / 나중에 하기"
// - 자동 닫힘 없음(버튼/X로만 닫힘)

import React from "react";
import styled, { keyframes } from "styled-components";
import { images } from "../../utils/imageAssets";

export default function MatchAcceptedCelebration({
  open,
  onStart, // "조율 시작하기" — 닫고 현재(조율) 화면에 머무름
  onLater, // "나중에 하기"
  onClose, // X
  myName = "우리팀",
  myLogoUrl = "",
  myRank = 0, // 우리팀 전역 랭킹 (1~3위면 왕관 표시)
  oppName = "상대팀",
  oppLogoUrl = "",
  oppRank = 0, // 상대팀 전역 랭킹 (1~3위면 왕관 표시)
  title = "매칭 성사!", // 제목 (재사용 시 커스텀 가능)
  sub = null, // 본문 텍스트(문자열). null이면 기본 "매칭 성사" 문구 사용
  primaryLabel = "조율 시작하기  ›", // 기본 버튼 라벨
  laterLabel = "나중에 하기", // 보조 버튼 라벨
}) {
  if (!open) return null;

  const pieces = Array.from({ length: 28 });
  const burst = Array.from({ length: 24 }); // 중앙 축포(방사형 버스트)
  const colors = ["#6c5ce7", "#a78bfa", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899"];

  const close = onClose || onLater || onStart;

  return (
    <Overlay>
      {pieces.map((_, i) => {
        // 조각마다 위치·딜레이·낙하속도를 제각각 → 묶음(동기화) 없이 따로따로 떨어짐
        const left = (i * 41 + ((i * 7) % 13) * 3) % 100;
        const delay = ((i * 0.27 + ((i * i) % 11) * 0.05) % 2.6).toFixed(2);
        const dur = (2.2 + ((i * 0.19) % 1.6)).toFixed(2);
        return (
          <Confetti
            key={i}
            style={{
              left: `${left}%`,
              background: colors[i % colors.length],
              animationDelay: `${delay}s`,
              animationDuration: `${dur}s`,
            }}
          />
        );
      })}

      <CloseBtn type="button" aria-label="닫기" onClick={close}>
        ×
      </CloseBtn>

      <Card>
        <CheckWrap>
          {/* 축포: 체크 원 중심에서 방사형으로 터지는 컨페티 */}
          <BurstLayer>
            {burst.map((_, i) => {
              const a = (i / burst.length) * Math.PI * 2;
              const dist = 30 + ((i * 11) % 14); // vmin
              return (
                <Burst
                  key={`b${i}`}
                  style={{
                    background: colors[i % colors.length],
                    "--tx": `${Math.cos(a) * dist}vmin`,
                    "--ty": `${Math.sin(a) * dist}vmin`,
                    animationDelay: `${(i % 5) * 0.03}s`,
                  }}
                />
              );
            })}
          </BurstLayer>

          {/* 바깥으로 확산되는 링 */}
          <Ring style={{ animationDelay: "0.05s" }} />
          <Ring style={{ animationDelay: "0.22s" }} />
          <Ring style={{ animationDelay: "0.4s" }} />

          <CheckCircle>
            <Check>✓</Check>
          </CheckCircle>
        </CheckWrap>

        <Title>{title}</Title>
        <Sub>
          {sub != null ? (
            sub
          ) : (
            <>
              <strong>{oppName}</strong> 팀과 매칭이 성사됐어요.
              {"\n"}이제 경기를 조율해요!
            </>
          )}
        </Sub>

        <Teams>
          <TeamCol $side="left">
            <LogoBob style={{ animationDelay: "1.0s" }}>
              <LogoWrap>
                {myRank >= 1 && myRank <= 3 ? (
                  <CrownImg src={images.logo} alt={`${myRank}위`} />
                ) : null}
                <TeamLogo src={myLogoUrl || images.logo} alt={myName} />
              </LogoWrap>
            </LogoBob>
            <TeamNm>{myName}</TeamNm>
            <MyBadge>우리팀</MyBadge>
          </TeamCol>

          <Vs>VS</Vs>

          <TeamCol $side="right">
            <LogoBob style={{ animationDelay: "1.12s" }}>
              <LogoWrap>
                {oppRank >= 1 && oppRank <= 3 ? (
                  <CrownImg src={images.logo} alt={`${oppRank}위`} />
                ) : null}
                <TeamLogo src={oppLogoUrl || images.logo} alt={oppName} />
              </LogoWrap>
            </LogoBob>
            <TeamNm>{oppName}</TeamNm>
            <BadgeSpacer />
          </TeamCol>
        </Teams>

        <PrimaryBtn type="button" onClick={onStart || close}>
          {primaryLabel}
        </PrimaryBtn>
        <LaterBtn type="button" onClick={onLater || close}>
          {laterLabel}
        </LaterBtn>
      </Card>
    </Overlay>
  );
}

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`;
const pop = keyframes`
  0% { transform: scale(0); }
  60% { transform: scale(1.18); }
  100% { transform: scale(1); }
`;
const fall = keyframes`
  0% { transform: translateY(-12vh) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  100% { transform: translateY(110vh) rotate(540deg); opacity: 0.9; }
`;
const rise = keyframes`
  from { transform: translateY(14px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

// 중앙에서 방사형으로 터진 뒤 중력으로 떨어짐(축포)
const burstFly = keyframes`
  0%   { transform: translate(0, 0) scale(0.3); opacity: 1; }
  55%  { transform: translate(var(--tx), var(--ty)) scale(1); opacity: 1; }
  100% { transform: translate(calc(var(--tx) * 1.08), calc(var(--ty) + 44vh)) scale(0.85) rotate(420deg); opacity: 0; }
`;

// 링이 바깥으로 확산되며 사라짐
const ringExpand = keyframes`
  0%   { transform: scale(0.55); opacity: 0.5; }
  70%  { opacity: 0.16; }
  100% { transform: scale(2.5); opacity: 0; }
`;

// 양 팀 좌/우에서 통통 튀어 등장
const bounceInLeft = keyframes`
  0%   { transform: translateX(-70px) scale(0.4); opacity: 0; }
  55%  { transform: translateX(8px) scale(1.12); opacity: 1; }
  72%  { transform: translateX(-4px) scale(0.97); }
  100% { transform: translateX(0) scale(1); opacity: 1; }
`;
const bounceInRight = keyframes`
  0%   { transform: translateX(70px) scale(0.4); opacity: 0; }
  55%  { transform: translateX(-8px) scale(1.12); opacity: 1; }
  72%  { transform: translateX(4px) scale(0.97); }
  100% { transform: translateX(0) scale(1); opacity: 1; }
`;

// 등장 후 통통 튀는 루프
const bob = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-7px); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 4000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.colors.bg || "#ffffff"};
  overflow: hidden;
  animation: ${fadeIn} 0.2s ease;
`;

const Confetti = styled.span`
  position: absolute;
  top: -5vh;
  width: 9px;
  height: 14px;
  border-radius: 2px;
  animation: ${fall} 2.6s linear infinite;
  opacity: 0.85;
`;

const CloseBtn = styled.button`
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textWeak || "#9ca3af"};
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
`;

const Card = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 320px;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  animation: ${rise} 0.35s ease both;
`;

const CheckWrap = styled.div`
  position: relative;
  width: 88px;
  height: 88px;
  display: grid;
  place-items: center;
`;

const BurstLayer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  pointer-events: none;
`;

const Burst = styled.span`
  position: absolute;
  top: 0;
  left: 0;
  width: 10px;
  height: 10px;
  margin: -5px;
  border-radius: 2px;
  animation: ${burstFly} 1.5s cubic-bezier(0.15, 0.7, 0.35, 1) forwards;
`;

const Ring = styled.span`
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 3px solid #6c5ce7;
  animation: ${ringExpand} 1.5s ease-out infinite;
`;

const CheckCircle = styled.div`
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7c6cf0, #6c5ce7);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 28px -8px rgba(108, 92, 231, 0.6);
  animation: ${pop} 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28) both;
`;
const Check = styled.div`
  color: #fff;
  font-size: 44px;
  font-weight: 900;
  line-height: 1;
`;
const Title = styled.div`
  margin-top: 22px;
  font-size: 24px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong || "#111827"};
`;
const Sub = styled.div`
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.55;
  color: ${({ theme }) => theme.colors.textNormal || "#4b5563"};
  white-space: pre-line;

  strong {
    color: ${({ theme }) => theme.colors.primary || "#6c5ce7"};
    font-weight: 800;
  }
`;

const Teams = styled.div`
  margin-top: 28px;
  margin-bottom: 32px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 22px;
`;
const TeamCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 84px;
  animation: ${({ $side }) => ($side === "right" ? bounceInRight : bounceInLeft)}
    0.7s cubic-bezier(0.18, 0.89, 0.32, 1.28) both;
  animation-delay: ${({ $side }) => ($side === "right" ? "0.42s" : "0.3s")};
`;
const LogoBob = styled.div`
  animation: ${bob} 1.1s ease-in-out infinite;
`;
/* 1~3위 팀: 로고 위에 얹는 왕관 (앱 전체 공통 비율 — 사진의 약 59%, 위로 ~38% 돌출) */
const LogoWrap = styled.div`
  position: relative;
  display: inline-flex;
`;
const CrownImg = styled.img`
  position: absolute;
  top: -21px;
  left: 50%;
  transform: translateX(-50%);
  width: 33px;
  height: 33px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.25));
`;
const TeamLogo = styled.img`
  width: 56px;
  height: 56px;
  border-radius: 16px;
  object-fit: cover;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#eef0f6"};
`;
const TeamNm = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong || "#111827"};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 84px;
`;
const MyBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  padding: 0 8px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary || "#6c5ce7"};
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
`;
const BadgeSpacer = styled.span`
  height: 18px;
`;
const Vs = styled.div`
  margin-top: 16px;
  font-size: 14px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textWeak || "#9ca3af"};
`;

const PrimaryBtn = styled.button`
  width: 100%;
  height: 52px;
  border: none;
  border-radius: 14px;
  background: ${({ theme }) => theme.colors.primary || "#6c5ce7"};
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }
`;
const LaterBtn = styled.button`
  margin-top: 14px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textWeak || "#9ca3af"};
  font-size: 14px;
  cursor: pointer;
`;
