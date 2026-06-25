/* eslint-disable */
// src/components/matchRoom/CancelReasonSheet.jsx
// 경기 취소 사유 선택 시트.
// - 프리셋 사유 중 택1 (+ "기타" 선택 시 직접 입력)
// - paid=true(구장 결제 완료)면 환불 안내 추가 표시
// - onConfirm(reasonKey, reasonText) 호출
import React, { useState } from "react";
import styled from "styled-components";
import { MATCH_CANCEL_REASONS } from "../../services/matchRoomService";

export default function CancelReasonSheet({
  open,
  paid = false,
  refundAmount = 0,
  busy = false,
  onConfirm,
  onClose,
}) {
  const [key, setKey] = useState("");
  const [text, setText] = useState("");

  if (!open) return null;

  const isEtc = key === "etc";
  const canSubmit = !!key && (!isEtc || text.trim().length > 0) && !busy;

  const submit = () => {
    if (!canSubmit) return;
    onConfirm && onConfirm(key, isEtc ? text.trim() : "");
  };

  return (
    <Overlay onClick={() => !busy && onClose && onClose()}>
      <Sheet onClick={(e) => e.stopPropagation()}>
        <Title>경기를 취소할까요?</Title>
        <Desc>취소 사유를 선택해 주세요. 선택한 사유는 상대팀에게 표시돼요.</Desc>

        <Options>
          {MATCH_CANCEL_REASONS.map((r) => (
            <Opt key={r.key} type="button" $on={key === r.key} onClick={() => setKey(r.key)}>
              <Dot $on={key === r.key}>{key === r.key ? "✓" : ""}</Dot>
              <span>{r.label}</span>
            </Opt>
          ))}
        </Options>

        {isEtc && (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="취소 사유를 입력해 주세요."
            maxLength={200}
            autoFocus
          />
        )}

        {paid && (
          <RefundNote>
            <b>💳 구장비 결제 안내</b>
            <div>
              이미 결제된 경기예요. 취소 시 결제 금액
              {refundAmount > 0 ? ` ${Number(refundAmount).toLocaleString()}원이` : "이"} 환불
              처리됩니다. (영업일 기준 처리 · 결제 수단으로 환불)
            </div>
          </RefundNote>
        )}

        <Actions>
          <GhostBtn type="button" onClick={() => !busy && onClose && onClose()} disabled={busy}>
            닫기
          </GhostBtn>
          <DangerBtn type="button" onClick={submit} disabled={!canSubmit}>
            {busy ? "취소 처리 중…" : "이 사유로 취소하기"}
          </DangerBtn>
        </Actions>
      </Sheet>
    </Overlay>
  );
}

const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 3000;
  background: rgba(15, 23, 42, 0.5);
  display: flex; align-items: flex-end; justify-content: center;
`;
const Sheet = styled.div`
  width: 100%; max-width: ${({ theme }) => theme?.layout?.maxWidth || 520}px;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 18px 18px 0 0;
  padding: 20px 18px calc(18px + env(safe-area-inset-bottom));
  display: flex; flex-direction: column; gap: 12px;
  max-height: 86vh; overflow-y: auto;
`;
const Title = styled.div`font-size: 17px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};`;
const Desc = styled.div`font-size: 13px; color: ${({ theme }) => theme.colors.textWeak}; line-height: 1.5;`;
const Options = styled.div`display: flex; flex-direction: column; gap: 8px; margin-top: 2px;`;
const Opt = styled.button`
  display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; cursor: pointer;
  padding: 13px 14px; border-radius: 12px; font-size: 14px; font-weight: 600;
  border: 1.5px solid ${({ $on, theme }) => ($on ? "#ef4444" : theme.colors.border)};
  background: ${({ $on, theme }) => ($on ? (theme.mode === "dark" ? "rgba(239,68,68,0.12)" : "#fef2f2") : theme.colors.card)};
  color: ${({ theme }) => theme.colors.textStrong};
`;
const Dot = styled.span`
  width: 20px; height: 20px; flex-shrink: 0; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #fff;
  border: 1.5px solid ${({ $on }) => ($on ? "#ef4444" : "#cbd5e1")};
  background: ${({ $on }) => ($on ? "#ef4444" : "transparent")};
`;
const Textarea = styled.textarea`
  width: 100%; min-height: 72px; resize: vertical; box-sizing: border-box;
  border-radius: 12px; padding: 12px 14px; font-size: 14px; font-family: inherit;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textStrong};
  &:focus { outline: none; border-color: #ef4444; }
`;
const RefundNote = styled.div`
  display: flex; flex-direction: column; gap: 4px;
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(124,58,237,0.12)" : "#f5f3ff")};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px; padding: 12px 14px;
  font-size: 12.5px; line-height: 1.55; color: ${({ theme }) => theme.colors.textNormal};
  & b { font-size: 13px; color: ${({ theme }) => theme.colors.textStrong}; }
`;
const Actions = styled.div`display: flex; gap: 8px; margin-top: 4px;`;
const GhostBtn = styled.button`
  flex: 1; height: 50px; border-radius: 13px; cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textNormal}; font-size: 15px; font-weight: 700;
  &:disabled { opacity: 0.5; }
`;
const DangerBtn = styled.button`
  flex: 1.4; height: 50px; border-radius: 13px; border: none; cursor: pointer;
  background: #ef4444; color: #fff; font-size: 15px; font-weight: 800;
  &:disabled { opacity: 0.45; cursor: default; }
`;
