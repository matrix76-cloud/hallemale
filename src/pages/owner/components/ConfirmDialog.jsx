/* eslint-disable */
// src/pages/owner/components/ConfirmDialog.jsx
// 구장주 앱 전용 확인 다이얼로그 (od.js 디자인) — 위험 액션(취소·환불·노쇼 등) 재확인용.
// useConfirm 훅과 함께 사용: const {confirmState, ask, closeConfirm} = useConfirm();
import React from "react";
import styled from "styled-components";
import { C } from "./od";

const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 300;
  background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
`;
const Card = styled.div`
  width: 100%; max-width: 340px;
  background: #fff; border-radius: 20px;
  padding: 24px 22px 20px;
  display: flex; flex-direction: column; gap: 8px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.2);
`;
const Title = styled.div`font-size: 17px; font-weight: 800; color: ${C.slate800};`;
const Msg = styled.div`font-size: 13.5px; line-height: 1.55; color: ${C.slate500}; white-space: pre-line;`;
const Btns = styled.div`display: flex; gap: 8px; margin-top: 16px;`;
const Btn = styled.button`
  flex: 1; height: 46px; border-radius: 12px;
  font-size: 14.5px; font-weight: 700; cursor: pointer;
  &:active { transform: translateY(1px); }
`;
const Cancel = styled(Btn)`border: 1px solid ${C.slate200}; background: #fff; color: ${C.slate500};`;
const Confirm = styled(Btn)`border: none; color: #fff; background: ${({ $danger }) => ($danger ? C.red500 : C.violet600)};`;

export default function ConfirmDialog({ state, onConfirm, onCancel }) {
  if (!state) return null;
  return (
    <Overlay onClick={onCancel}>
      <Card onClick={(e) => e.stopPropagation()}>
        {state.title && <Title>{state.title}</Title>}
        {state.message && <Msg>{state.message}</Msg>}
        <Btns>
          <Cancel type="button" onClick={onCancel}>{state.cancelLabel || "취소"}</Cancel>
          <Confirm type="button" $danger={state.danger} onClick={onConfirm}>
            {state.confirmLabel || "확인"}
          </Confirm>
        </Btns>
      </Card>
    </Overlay>
  );
}
