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

// 구장주는 사무실 PC로도 쓴다 — 넓은 화면에서는 본문 폭을 넓혀 시간표·목록이 숨 쉬게 한다.
// (모바일 폭 448px 은 그대로 유지)
export const OWNER_WIDE_MIN = 900; // px — 이 이상이면 데스크톱 폭
export const OWNER_MAX_W = 760;    // px — 데스크톱에서의 본문 폭

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

  @media (min-width: ${OWNER_WIDE_MIN}px) {
    max-width: ${OWNER_MAX_W}px;
    padding: 20px 24px 24px;
  }
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

/* ── 폼 프리미티브 ────────────────────────────────────────────
 * 예전엔 ownerUi.js(테마 기반)와 od.js(고정색)가 따로 있어 같은 워크스페이스 안에서
 * 화면마다 톤이 달랐다. 구장주 앱은 고정 팔레트를 쓰기로 했으므로 여기로 합치고,
 * ownerUi.js 는 이 파일을 다시 내보내는 얇은 껍데기로 남긴다.
 */
export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;
export const Label = styled.span`
  font-size: 12.5px;
  font-weight: 700;
  color: ${C.slate500};
`;
/** 입력값에서 파생된 안내 (예: 요금 입력 → 정산 예정액) */
export const FieldHint = styled.span`
  font-size: 11.5px;
  color: ${C.slate500};
  line-height: 1.5;
`;
export const Textarea = styled.textarea`
  width: 100%;
  box-sizing: border-box;
  min-height: 80px;
  padding: 12px 13px;
  border-radius: 12px;
  border: 1px solid ${C.slate200};
  background: #fff;
  color: ${C.slate800};
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  line-height: 1.5;
  &:focus { outline: none; border-color: ${C.violet300}; }
  &::placeholder { color: ${C.slate400}; }
`;
export const Select = styled.select`
  width: 100%;
  box-sizing: border-box;
  height: 44px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid ${C.slate200};
  background: #fff;
  color: ${C.slate800};
  font-size: 14px;
  font-family: inherit;
  &:focus { outline: none; border-color: ${C.violet300}; }
`;
export const Row = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: ${({ $nowrap }) => ($nowrap ? "nowrap" : "wrap")};
  & > * { flex: 1; min-width: 0; }
`;
export const ChipWrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;
/** 심사 상태 뱃지 (approved | pending | rejected) */
export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid ${({ $tone }) =>
    $tone === "approved" ? C.green600
    : $tone === "pending" ? C.amber400
    : $tone === "rejected" ? C.red200
    : C.slate200};
  color: ${({ $tone }) =>
    $tone === "approved" ? C.green600
    : $tone === "pending" ? C.amber500
    : $tone === "rejected" ? C.red500
    : C.slate500};
`;

// 예전 이름(ownerUi) 호환 — 같은 것을 두 이름으로 부르던 흔적.
export const SectionTitle = SecTitle;
export const SectionDesc = Caption;
