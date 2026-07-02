/* eslint-disable */
// src/components/matchRoom/MatchFinalCelebration.jsx
// 최종 "경기 확정!" 축하 — 라이트 테마 매치 티켓 (목업: ㅇㅈㅇㅈ / MATCH CONFIRMED)
// - 양 팀 결제 완료(제휴구장) / 직접입력 일정 확정 공통. 1~3위 팀은 프로필 위 왕관.
// - 절제된 등장 모션: 좌우 팀이 가운데로 모이고 → VS 바운스로 꽂히고 → 티켓이 아래에서 시차로 올라옴.
//   색종이는 강조색+흰색만 소량.
// - open=true 시 표시. CTA/X/배경 탭으로 닫힘(autoMs>0이면 자동 닫힘).
import React, { useEffect } from "react";
import styled, { keyframes } from "styled-components";
import { images } from "../../utils/imageAssets";

export default function MatchFinalCelebration({
  open,
  onClose,
  myName = "우리팀",
  myLogoUrl = "",
  myRank = 0,
  oppName = "상대팀",
  oppLogoUrl = "",
  oppRank = 0,
  dateText = "",
  courtName = "",
  venueName = "",
  payText = "",
  primaryLabel = "확정된 경기 보기",
  onPrimary,
  autoMs = 0, // 0이면 자동 닫힘 없음(티켓을 읽고 CTA를 누르도록)
}) {
  useEffect(() => {
    if (!open || !autoMs) return;
    const t = setTimeout(() => onClose && onClose(), autoMs);
    return () => clearTimeout(t);
  }, [open, onClose, autoMs]);

  if (!open) return null;

  const handlePrimary = (e) => {
    e.stopPropagation();
    if (onPrimary) onPrimary();
    else onClose && onClose();
  };

  // 색종이: 강조색(보라) + 흰색만 소량
  const confetti = Array.from({ length: 14 });
  const confColors = ["#7c5cf0", "#a78bfa", "#c4b5fd", "#ffffff"];

  const renderTeam = (name, logoUrl, rank, side) => {
    const hasLogo = logoUrl && logoUrl !== images.logo;
    const crowned = rank >= 1 && rank <= 3;
    return (
      <TeamCol $side={side}>
        <CircleWrap $side={side}>
          {crowned ? <Crown src={images.logo} alt={`${rank}위`} /> : null}
          <Circle $crowned={crowned}>
            {hasLogo ? (
              <CircleImg src={logoUrl} alt={name} />
            ) : (
              <CircleInitial>{String(name || "").trim().slice(0, 1) || "팀"}</CircleInitial>
            )}
          </Circle>
        </CircleWrap>
        <Name>{name}</Name>
        {rank ? (
          crowned ? (
            <RankChip>랭킹 {rank}위</RankChip>
          ) : (
            <RankPlain>랭킹 {rank}위</RankPlain>
          )
        ) : (
          <RankSpacer />
        )}
      </TeamCol>
    );
  };

  return (
    <Overlay onClick={() => onClose && onClose()}>
      {confetti.map((_, i) => (
        <Confetti
          key={i}
          style={{
            left: `${(i * 31 + 6) % 100}%`,
            background: confColors[i % confColors.length],
            animationDelay: `${0.2 + (i % 7) * 0.22}s`,
            animationDuration: `${2.6 + (i % 4) * 0.5}s`,
          }}
        />
      ))}

      <CloseBtn type="button" aria-label="닫기" onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}>
        ×
      </CloseBtn>

      <Content onClick={(e) => e.stopPropagation()}>
        <Hero3D src={images.emoji3dTrophy} alt="" />
        <Headline>
          <Kicker>MATCH CONFIRMED</Kicker>
          <Title>경기 확정!</Title>
        </Headline>

        <Ticket>
          <TicketTop>
            {renderTeam(myName, myLogoUrl, myRank, "left")}
            <VsBadge>VS</VsBadge>
            {renderTeam(oppName, oppLogoUrl, oppRank, "right")}
          </TicketTop>

          <Perf>
            <Notch $left />
            <Notch />
          </Perf>

          <InfoWrap>
            <InfoGrid>
              <Cell>
                <K>일시</K>
                <V>{dateText || "일정 미정"}</V>
              </Cell>
              {courtName ? (
                <Cell>
                  <K>코트</K>
                  <V>{courtName}</V>
                </Cell>
              ) : null}
              <Cell $full>
                <K>구장</K>
                <V>{venueName || "구장 미정"}</V>
              </Cell>
              {payText ? (
                <Cell $full>
                  <K>결제</K>
                  <PayV>
                    <PayCheck>✓</PayCheck>
                    {payText}
                  </PayV>
                </Cell>
              ) : null}
            </InfoGrid>
          </InfoWrap>
        </Ticket>

        <CtaWrap>
          <Cta type="button" onClick={handlePrimary}>
            {primaryLabel} <span aria-hidden>›</span>
          </Cta>
        </CtaWrap>
      </Content>
    </Overlay>
  );
}

/* ===================== keyframes ===================== */

const cpFade = keyframes`
  0%   { opacity: 0; transform: translateY(-10px); }
  100% { opacity: 1; transform: translateY(0); }
`;
const cpInL = keyframes`
  0%   { opacity: 0; transform: translateX(-52px) scale(0.86); }
  70%  { opacity: 1; }
  100% { opacity: 1; transform: translateX(0) scale(1); }
`;
const cpInR = keyframes`
  0%   { opacity: 0; transform: translateX(52px) scale(0.86); }
  70%  { opacity: 1; }
  100% { opacity: 1; transform: translateX(0) scale(1); }
`;
const cpCrown = keyframes`
  0%   { opacity: 0; transform: translateX(-50%) scale(0.2); }
  60%  { opacity: 1; transform: translateX(-50%) scale(1.25); }
  80%  { transform: translateX(-50%) scale(0.94); }
  100% { transform: translateX(-50%) scale(1); }
`;
const cpVS = keyframes`
  0%   { opacity: 0; transform: scale(2.4) rotate(-8deg); }
  55%  { opacity: 1; transform: scale(0.84) rotate(3deg); }
  75%  { transform: scale(1.1) rotate(-1deg); }
  100% { transform: scale(1) rotate(0deg); }
`;
const cpUp = keyframes`
  0%   { opacity: 0; transform: translateY(46px); }
  100% { opacity: 1; transform: translateY(0); }
`;
const cpUp2 = keyframes`
  0%   { opacity: 0; transform: translateY(26px); }
  100% { opacity: 1; transform: translateY(0); }
`;
const cpPop = keyframes`
  0%   { opacity: 0; transform: translateY(12px) scale(0.4); }
  60%  { opacity: 1; transform: translateY(0) scale(1.14); }
  80%  { transform: translateY(0) scale(0.96); }
  100% { transform: translateY(0) scale(1); }
`;
const cpFall = keyframes`
  0%   { transform: translateY(-14vh) rotate(0deg); opacity: 0; }
  12%  { opacity: 1; }
  100% { transform: translateY(112vh) rotate(560deg); opacity: 0.9; }
`;

/* ===================== styled ===================== */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  padding: 40px 22px;
  background: radial-gradient(120% 90% at 50% 28%, #f1effb 0%, #e8e5f7 52%, #e3e0f4 100%);
  animation: ${cpFade} 0.25s ease;
`;

const Confetti = styled.span`
  position: absolute;
  top: -14vh;
  width: 9px;
  height: 14px;
  border-radius: 2px;
  animation: ${cpFall} 3s linear infinite;
  pointer-events: none;
  opacity: 0.9;
`;

const CloseBtn = styled.button`
  position: absolute;
  top: calc(16px + env(safe-area-inset-top));
  right: 18px;
  z-index: 3;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: #ffffff;
  color: #4b5563;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 6px 18px -6px rgba(31, 35, 46, 0.25);
`;

const Content = styled.div`
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Hero3D = styled.img`
  width: 92px;
  height: 92px;
  object-fit: contain;
  margin-bottom: 6px;
  filter: drop-shadow(0 14px 20px rgba(60, 50, 120, 0.32));
  animation: ${cpPop} 0.6s cubic-bezier(0.18, 0.89, 0.32, 1.4) 0.12s both;
`;

const Headline = styled.div`
  text-align: center;
  margin-bottom: 22px;
  animation: ${cpFade} 0.5s ease 0.05s both;
`;
const Kicker = styled.div`
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.22em;
  color: #7c5cf0;
`;
const Title = styled.div`
  margin-top: 8px;
  font-size: 36px;
  font-weight: 900;
  color: #20232e;
  letter-spacing: -0.01em;
`;

const Ticket = styled.div`
  position: relative;
  width: 100%;
  background: #ffffff;
  border-radius: 22px;
  box-shadow: 0 24px 50px -20px rgba(60, 50, 120, 0.35);
  animation: ${cpUp} 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both;
`;

const TicketTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 8px;
  padding: 30px 18px 22px;
`;

const TeamCol = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  animation: ${({ $side }) => ($side === "right" ? cpInR : cpInL)} 0.6s
    cubic-bezier(0.22, 1, 0.36, 1) ${({ $side }) => ($side === "right" ? "0.34s" : "0.3s")} both;
`;
const CircleWrap = styled.div`
  position: relative;
`;
const Circle = styled.div`
  width: 84px;
  height: 84px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eceef3;
  border: ${({ $crowned }) => ($crowned ? "3px solid #7c5cf0" : "3px solid #e5e7eb")};
  box-shadow: ${({ $crowned }) =>
    $crowned ? "0 0 0 4px rgba(124, 92, 240, 0.18)" : "none"};
`;
const CircleImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;
const CircleInitial = styled.span`
  font-size: 30px;
  font-weight: 900;
  color: #4b3fae;
`;
/* 1~3위: 원형 프로필 위 왕관 — 팝 바운스 등장 */
const Crown = styled.img`
  position: absolute;
  top: -26px;
  left: 50%;
  transform: translateX(-50%);
  width: 46px;
  height: 46px;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
  filter: drop-shadow(0 3px 5px rgba(60, 50, 120, 0.28));
  transform-origin: 50% 100%;
  animation: ${cpCrown} 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.4) 0.78s both;
`;
const Name = styled.div`
  font-size: 16px;
  font-weight: 800;
  color: #20232e;
  max-width: 100%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
const RankChip = styled.div`
  font-size: 12px;
  font-weight: 800;
  color: #6d4fe0;
  background: #ece8ff;
  padding: 4px 12px;
  border-radius: 999px;
`;
const RankPlain = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: #9aa0ab;
  padding: 4px 0;
`;
const RankSpacer = styled.div`
  height: 25px;
`;

const VsBadge = styled.div`
  flex-shrink: 0;
  margin-top: 22px;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 8px 20px -6px rgba(60, 50, 120, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 900;
  font-style: italic;
  letter-spacing: -0.02em;
  color: #4b3fae;
  animation: ${cpVS} 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.4) 0.62s both;
`;

/* 티켓 절취선 + 좌우 노치(배경색 원으로 가장자리를 파낸 효과) */
const Perf = styled.div`
  position: relative;
  height: 1px;
  margin: 0 22px;
  border-top: 2px dashed #e5e7eb;
`;
const Notch = styled.span`
  position: absolute;
  top: 50%;
  ${({ $left }) => ($left ? "left: -35px;" : "right: -35px;")}
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #e8e5f7;
`;

const InfoWrap = styled.div`
  padding: 18px 22px 22px;
  animation: ${cpUp2} 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.55s both;
`;
const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px 14px;
`;
const Cell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  grid-column: ${({ $full }) => ($full ? "1 / -1" : "auto")};
`;
const K = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: #9aa0ab;
`;
const V = styled.div`
  font-size: 16px;
  font-weight: 800;
  color: #20232e;
  word-break: keep-all;
  overflow-wrap: anywhere;
`;
const PayV = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 800;
  color: #20232e;
`;
const PayCheck = styled.span`
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #7c5cf0;
  color: #ffffff;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CtaWrap = styled.div`
  width: 100%;
  margin-top: 18px;
  animation: ${cpUp2} 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.66s both;
`;
const Cta = styled.button`
  width: 100%;
  height: 60px;
  border: none;
  border-radius: 16px;
  background: #7c5cf0;
  color: #ffffff;
  font-size: 17px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 14px 28px -12px rgba(124, 92, 240, 0.7);

  span {
    font-weight: 800;
    margin-left: 4px;
  }
  &:active {
    transform: translateY(1px);
  }
`;
