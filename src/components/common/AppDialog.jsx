/* eslint-disable */
// src/components/common/AppDialog.jsx
// 공통 팝업 렌더러 — App 루트에 1개만 마운트. showAlert/showConfirm 로 제어.
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { subscribeAppDialog, resolveAppDialog } from "../../utils/appDialog";

export default function AppDialog() {
  const [cur, setCur] = useState(null);

  useEffect(() => subscribeAppDialog(setCur), []);

  useEffect(() => {
    if (!cur) return;
    const onKey = (e) => {
      if (e.key === "Escape") resolveAppDialog(cur.kind === "confirm" ? false : true);
      if (e.key === "Enter") resolveAppDialog(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur]);

  if (!cur) return null;

  const isConfirm = cur.kind === "confirm";
  const danger = cur.tone === "danger";

  return (
    <Overlay onClick={() => resolveAppDialog(isConfirm ? false : true)}>
      <Card onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {cur.title ? <Title>{cur.title}</Title> : null}
        <Msg $noTitle={!cur.title}>{cur.message}</Msg>
        <Actions>
          {isConfirm ? (
            <Btn className="cancel" type="button" onClick={() => resolveAppDialog(false)}>
              {cur.cancelText}
            </Btn>
          ) : null}
          <Btn
            className={danger ? "danger" : "confirm"}
            type="button"
            autoFocus
            onClick={() => resolveAppDialog(true)}
          >
            {cur.confirmText}
          </Btn>
        </Actions>
      </Card>
    </Overlay>
  );
}

/* ================= styled ================= */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 100000; /* 관리자 모달(99999)보다 위 */
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
`;

const Card = styled.div`
  width: 100%;
  max-width: 340px;
  background: ${({ theme }) => theme?.colors?.card || "#ffffff"};
  border-radius: 16px;
  padding: 22px 20px 16px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.28);
  animation: appDialogIn 0.16s ease-out;

  @keyframes appDialogIn {
    from {
      transform: translateY(8px) scale(0.98);
      opacity: 0;
    }
    to {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }
`;

const Title = styled.h2`
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const Msg = styled.p`
  margin: ${({ $noTitle }) => ($noTitle ? "2px 0 18px" : "0 0 18px")};
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-line;
  color: ${({ theme }) => theme?.colors?.textNormal || theme?.colors?.text || "#374151"};
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;

  & > button {
    flex: 1;
    height: 46px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid transparent;
    transition: opacity 0.15s ease;
  }
  & > button:active {
    opacity: 0.85;
  }
`;

const Btn = styled.button`
  &.cancel {
    background: ${({ theme }) => theme?.colors?.surface || "#f1f3f5"};
    color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
    border-color: ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  }
  &.confirm {
    background: ${({ theme }) => theme?.colors?.primary || "#4f46e5"};
    color: #ffffff;
  }
  &.danger {
    background: #dc2626;
    color: #ffffff;
  }
`;
