// src/components/common/EmptyState.jsx
// 공통 빈 상태(Empty State) 컴포넌트 — 목록/내역이 비었을 때 동일한 모양으로 표시
import React from "react";
import styled from "styled-components";
import { images } from "../../utils/imageAssets";

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 10px;
  width: 100%;
  padding: ${({ $compact }) => ($compact ? "28px 20px" : "48px 20px")};
`;

const IconCircle = styled.div`
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  line-height: 1;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const LogoImg = styled.img`
  width: 64px;
  height: 64px;
  object-fit: contain;
  opacity: 0.4;
  ${({ theme }) => (theme.mode === "dark" ? "filter: brightness(1.6);" : "")}
`;

/* 제목은 굵고 진하게 — 예전엔 500 굵기 + textWeak + opacity 0.85 라
   빈 화면 전체가 흐려 보였다. 무엇이 없다는 건지가 먼저 읽혀야 한다. */
const Title = styled.div`
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.2px;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const Sub = styled.div`
  font-size: 12.5px;
  line-height: 1.6;
  /* 줄바꿈(\n)을 그대로 살린다 — 서브카피는 보통 2~3줄로 끊어 읽힌다 */
  white-space: pre-line;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/* 빈 상태의 CTA 는 아웃라인 — 아직 아무것도 안 한 사용자를 채움 버튼으로 밀지 않는다 */
const ActionBtn = styled.button`
  margin-top: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  padding: 11px 22px;
  background: transparent;
  color: ${({ theme }) => theme.colors.textNormal};
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  &:active { transform: translateY(1px); }
`;

/**
 * @param {string} text   메인 안내 문구 (예: "아직 작성한 게시글이 없습니다.")
 * @param {string} [sub]  보조 안내 문구 (선택)
 * @param {string} [icon] 아이콘(이모지). 안 주면 할래말래 로고 표시
 * @param {boolean} [compact] 패딩 축소 버전
 * @param {string} [actionLabel] CTA 버튼 문구 (onAction과 함께 줄 때만 표시)
 * @param {Function} [onAction] CTA 클릭 핸들러
 */
export default function EmptyState({ text, sub, icon, compact = false, className, actionLabel, onAction }) {
  return (
    <Wrap $compact={compact} className={className}>
      {icon ? <IconCircle>{icon}</IconCircle> : <LogoImg src={images.logo} alt="" />}
      {text ? <Title>{text}</Title> : null}
      {sub ? <Sub>{sub}</Sub> : null}
      {actionLabel && onAction ? (
        <ActionBtn type="button" onClick={onAction}>{actionLabel}</ActionBtn>
      ) : null}
    </Wrap>
  );
}
