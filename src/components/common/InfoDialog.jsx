/* eslint-disable */
// src/components/common/InfoDialog.jsx
import React, { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import styled, { keyframes } from "styled-components";
import Button from "./Button";

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const popIn = keyframes`
  from { transform: translateY(10px) scale(.98); opacity: 0; }
  to { transform: translateY(0px) scale(1); opacity: 1; }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5000;
  animation: ${fadeIn} 120ms ease-out;
  padding: 16px;
`;

const Dialog = styled.div`
  width: 100%;
  max-width: 320px;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 18px 60px rgba(0,0,0,.22);
  position: relative;
  overflow: hidden;
  animation: ${popIn} 160ms ease-out;
`;

const CloseBtn = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  display: grid;
  place-items: center;

  &:hover {
    background: rgba(0,0,0,.05);
  }

  &::before {
    content: "×";
    font-size: 22px;
    line-height: 1;
    color: rgba(0,0,0,.55);
    transform: translateY(-1px);
  }
`;

const Body = styled.div`
  padding: 24px 22px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const IconCircle = styled.div`
  width: 72px;
  height: 72px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  margin-top: 6px;
  margin-bottom: 14px;

  background: ${({ $tone }) => {
    if ($tone === "success") return "rgba(59,130,246,.12)";
    if ($tone === "warning") return "rgba(245,158,11,.14)";
    if ($tone === "danger") return "rgba(239,68,68,.12)";
    return "rgba(99,102,241,.12)";
  }};
`;

const IconInner = styled.div`
  width: 46px;
  height: 46px;
  border-radius: 999px;
  background: ${({ $tone }) => {
    if ($tone === "success") return "rgba(59,130,246,.85)";
    if ($tone === "warning") return "rgba(245,158,11,.90)";
    if ($tone === "danger") return "rgba(239,68,68,.88)";
    return "rgba(99,102,241,.85)";
  }};
  display: grid;
  place-items: center;

  &::after {
    content: ${({ $tone }) => {
      if ($tone === "success") return '"✓"';
      if ($tone === "warning") return '"!"';
      if ($tone === "danger") return '"!"';
      return '"i"';
    }};
    color: #fff;
    font-size: 22px;
    font-weight: 800;
    transform: translateY(-1px);
  }
`;

const Title = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors?.textStrong || "#111827"};
  text-align: center;
`;

const Message = styled.p`
  margin: 10px 0 0;
  font-size: 13.5px;
  line-height: 1.55;
  color: ${({ theme }) => theme.colors?.text || "#374151"};
  text-align: center;
  white-space: pre-line;
`;

const Actions = styled.div`
  padding: 0 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const SecondaryBtn = styled.button`
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors?.muted || "#6b7280"};

  &:hover {
    background: rgba(0,0,0,.05);
  }
`;

const ensureModalRoot = () => {
  if (typeof document === "undefined") return null;
  let el = document.getElementById("modal-root");
  if (!el) {
    el = document.createElement("div");
    el.id = "modal-root";
    document.body.appendChild(el);
  }
  return el;
};

export default function InfoDialog({
  open,
  tone = "info", // "success" | "info" | "warning" | "danger"
  title,
  message,
  primaryText = "확인",
  onPrimary,
  secondaryText = "닫기",
  onClose,
  hideSecondary = false,
  showClose = true,
  closeOnOverlay = true,
  disablePrimary = false,
}) {
  const root = useMemo(() => ensureModalRoot(), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  if (!root) return null;

  return createPortal(
    <Overlay
      onMouseDown={(e) => {
        if (!closeOnOverlay) return;
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <Dialog role="dialog" aria-modal="true">
        {showClose ? <CloseBtn type="button" onClick={() => onClose?.()} /> : null}

        <Body>
          <IconCircle $tone={tone}>
            <IconInner $tone={tone} />
          </IconCircle>

          <Title>{title || "TITLE"}</Title>
          <Message>{message || "Informative Text"}</Message>
        </Body>

        <Actions>
          <Button
            fullWidth
            type="button"
            onClick={() => onPrimary?.()}
            disabled={disablePrimary}
          >
            {primaryText}
          </Button>

          {!hideSecondary ? (
            <SecondaryBtn type="button" onClick={() => onClose?.()}>
              {secondaryText}
            </SecondaryBtn>
          ) : null}
        </Actions>
      </Dialog>
    </Overlay>,
    root
  );
}
