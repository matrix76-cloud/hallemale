/* eslint-disable */
// src/pages/owner/components/ownerUi.js
// 구장 관리자 화면 공용 styled 컴포넌트
import styled from "styled-components";

export const Page = styled.div`
  width: 100%;
  max-width: ${({ theme }) => theme.layout.maxWidth}px;
  margin: 0 auto;
  padding: 16px max(16px, env(safe-area-inset-left)) 24px max(16px, env(safe-area-inset-right));
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

export const Card = styled.section`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 14px;
  box-shadow: ${({ theme }) => theme.shadows?.card || "0 6px 16px rgba(15,23,42,0.06)"};
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export const SectionTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
  display: flex;
  align-items: center;
  gap: 6px;
  & > svg { color: ${({ theme }) => theme.colors.primary}; flex-shrink: 0; }
`;

export const SectionDesc = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.5;
`;

export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export const Label = styled.span`
  font-size: 12.5px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textNormal};
`;

export const Input = styled.input`
  height: 44px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 14px;
  font-family: inherit;
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
  &::placeholder { color: ${({ theme }) => theme.colors.textWeak}; }
`;

export const Textarea = styled.textarea`
  min-height: 80px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  line-height: 1.5;
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

export const Select = styled.select`
  height: 44px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 14px;
  font-family: inherit;
`;

export const Row = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: ${({ $nowrap }) => ($nowrap ? "nowrap" : "wrap")};
  & > * { flex: 1; min-width: 0; }
`;

export const PrimaryBtn = styled.button`
  height: 50px;
  width: 100%;
  border: none;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: filter 0.15s, transform 0.1s;
  &:hover { filter: brightness(0.96); }
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

export const GhostBtn = styled.button`
  height: 44px;
  padding: 0 16px;
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textNormal};
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  &:active { transform: translateY(1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

export const Chip = styled.button`
  padding: 9px 14px;
  border-radius: 999px;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.card)};
  color: ${({ $on, theme }) => ($on ? "#fff" : theme.colors.textNormal)};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
`;

export const ChipWrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  background: ${({ $tone }) =>
    $tone === "approved" ? "#dcfce7"
    : $tone === "pending" ? "#fef3c7"
    : $tone === "rejected" ? "#fee2e2"
    : "#f1f5f9"};
  color: ${({ $tone }) =>
    $tone === "approved" ? "#15803d"
    : $tone === "pending" ? "#a16207"
    : $tone === "rejected" ? "#b91c1c"
    : "#475569"};
`;
