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

const Title = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textWeak};
  opacity: 0.85;
`;

const Sub = styled.div`
  font-size: 12.5px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textWeak};
  opacity: 0.7;
`;

const ActionBtn = styled.button`
  margin-top: 6px;
  border: none;
  border-radius: 12px;
  padding: 11px 20px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
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
