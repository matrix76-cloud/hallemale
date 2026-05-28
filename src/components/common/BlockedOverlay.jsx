/* eslint-disable */
// src/components/common/BlockedOverlay.jsx
// 차단된 사용자/팀 등에 진입했을 때 화면 위에 띄우는 반투명 오버레이
// - 사유 + 차단일 표시
// - "새로고침" 버튼으로 차단 상태 재확인

import React from "react";
import styled from "styled-components";

const Wrap = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1500;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(0,0,0,0.78)" : "rgba(15, 23, 42, 0.72)"};
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const Card = styled.div`
  width: min(380px, 100%);
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  border-radius: 16px;
  padding: 26px 22px 22px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  text-align: center;
`;

const IconWrap = styled.div`
  width: 56px;
  height: 56px;
  margin: 0 auto 14px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(248,113,113,0.18)" : "#fef2f2"};
  font-size: 28px;
`;

const Title = styled.div`
  font-size: 17px;
  font-weight: 700;
  color: ${({ theme }) =>
    theme.mode === "dark" ? "#fca5a5" : theme.colors.danger};
  margin-bottom: 6px;
`;

const Sub = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.5;
  margin-bottom: 14px;
`;

const ReasonBox = styled.div`
  text-align: left;
  padding: 12px 14px;
  border-radius: 10px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.surface : "#f9fafb"};
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textNormal};
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.55;
  margin-bottom: 16px;
`;

const ReasonLabel = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textWeak};
  margin-bottom: 4px;
  letter-spacing: 0.04em;
`;

const Meta = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textWeak};
  margin-bottom: 14px;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 8px;
  justify-content: center;
`;

const Btn = styled.button`
  flex: 1;
  height: 42px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ $primary, theme }) =>
    $primary ? theme.colors.primary : theme.colors.card};
  color: ${({ $primary, theme }) =>
    $primary ? "#ffffff" : theme.colors.textStrong};
  ${({ $primary }) => ($primary ? "border-color: transparent;" : "")}

  &:active {
    transform: translateY(1px);
  }
`;

function fmtYmdHm(d) {
  if (!d) return "";
  const t = d?.toDate ? d.toDate() : new Date(d);
  if (Number.isNaN(t.getTime?.())) return "";
  const yy = t.getFullYear();
  const mm = String(t.getMonth() + 1).padStart(2, "0");
  const dd = String(t.getDate()).padStart(2, "0");
  const hh = String(t.getHours()).padStart(2, "0");
  const mi = String(t.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function BlockedOverlay({
  title = "이용이 제한되었습니다",
  description = "관리자에 의해 차단되었습니다.",
  reason,
  blockedAt,
  onBack,
  onRefresh,
}) {
  const handleRefresh = () => {
    if (onRefresh) onRefresh();
    else window.location.reload();
  };

  const at = fmtYmdHm(blockedAt);

  return (
    <Wrap>
      <Card>
        <IconWrap>🚫</IconWrap>
        <Title>{title}</Title>
        <Sub>{description}</Sub>

        {reason ? (
          <ReasonBox>
            <ReasonLabel>차단 사유</ReasonLabel>
            {reason}
          </ReasonBox>
        ) : null}

        {at ? <Meta>차단일시: {at}</Meta> : null}

        <ButtonRow>
          {onBack ? (
            <Btn type="button" onClick={onBack}>
              뒤로가기
            </Btn>
          ) : null}
          <Btn type="button" $primary onClick={handleRefresh}>
            새로고침
          </Btn>
        </ButtonRow>
      </Card>
    </Wrap>
  );
}
