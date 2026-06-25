/* eslint-disable */
// src/pages/owner/components/od.js
// 구장주 앱 전용 디자인 킷 (명세서 9. 디자인 가이드)
// - violet 포인트 + slate 베이스, 고정색(앱 다크/라이트 테마와 무관)
// - 원칙: 텍스트 뒤 배경색 지양. 강조는 테두리·아이콘·텍스트 색으로.
import styled from "styled-components";

export const C = {
  violet600: "#7C3AED",
  violet700: "#6D28D9",
  violet50: "#F5F3FF",
  violet200: "#DDD6FE",
  violet300: "#C4B5FD",
  slate100: "#F1F5F9",
  slate200: "#E2E8F0",
  slate400: "#94A3B8",
  slate500: "#64748B",
  slate800: "#1E293B",
  white: "#FFFFFF",
  amber400: "#FBBF24",
  amber500: "#F59E0B",
  green600: "#16A34A",
  red500: "#EF4444",
  red200: "#FECACA",
};

export const Page = styled.div`
  width: 100%;
  max-width: 448px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: ${C.slate100};
  min-height: 100%;
  color: ${C.slate800};
`;

export const Card = styled.section`
  background: ${C.white};
  border: 1px solid ${C.slate200};
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export const ScreenTitle = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: ${C.slate800};
`;
export const SecTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${C.slate800};
  display: flex;
  align-items: center;
  gap: 6px;
  & > svg { color: ${C.violet600}; flex-shrink: 0; }
`;
export const Caption = styled.div`
  font-size: 12px;
  color: ${C.slate500};
  line-height: 1.5;
`;

export const PrimaryBtn = styled.button`
  width: 100%;
  border: none;
  border-radius: 12px;
  background: ${C.violet600};
  color: #fff;
  padding: 13px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: ${C.violet700}; }
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;
export const GhostBtn = styled.button`
  border: 1px solid ${C.violet300};
  background: transparent;
  color: ${C.violet600};
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  &:active { transform: translateY(1px); }
`;
export const DangerBtn = styled.button`
  border: 1px solid ${C.red200};
  background: transparent;
  color: ${C.red500};
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  &:active { transform: translateY(1px); }
`;

export const Chip = styled.button`
  border: 1px solid ${({ $on }) => ($on ? C.violet600 : C.violet200)};
  color: ${({ $on }) => ($on ? "#fff" : C.violet600)};
  background: ${({ $on }) => ($on ? C.violet600 : "transparent")};
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
`;

export const Input = styled.input`
  width: 100%;
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  padding: 11px 13px;
  font-size: 14px;
  color: ${C.slate800};
  background: #fff;
  box-sizing: border-box;
  &:focus { outline: none; border-color: ${C.violet300}; }
  &::placeholder { color: ${C.slate400}; }
`;

// 상태 뱃지 (테두리·텍스트색만, 배경 없음)
export const StatBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid ${({ $tone }) =>
    $tone === "confirmed" ? C.violet300
    : $tone === "pending" ? C.amber400
    : $tone === "done" ? C.green600
    : $tone === "refund" ? C.red200
    : C.slate200};
  color: ${({ $tone }) =>
    $tone === "confirmed" ? C.violet600
    : $tone === "pending" ? C.amber500
    : $tone === "done" ? C.green600
    : $tone === "refund" ? C.red500
    : C.slate500};
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 11px;
  font-weight: 700;
`;

export const Money = styled.div`
  font-size: ${({ $lg }) => ($lg ? "24px" : "18px")};
  font-weight: 800;
  color: ${C.slate800};
`;
