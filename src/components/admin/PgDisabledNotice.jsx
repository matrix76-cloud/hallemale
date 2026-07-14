/* eslint-disable */
// src/components/admin/PgDisabledNotice.jsx
// PG(카드결제) 개시 전 정산/환불 화면에 표시하는 안내.
// 현재 할래말래는 현장 정산(무결제 예약중개)이라 회사가 대금을 수납하지 않으므로
// 정산/환불 기능이 성립하지 않는다. src/constants/payments.js 의 PG_ENABLED 로 제어.
import React from "react";
import styled from "styled-components";

export default function PgDisabledNotice({ kind = "정산" }) {
  return (
    <Wrap>
      <Card>
        <Emoji>🧾</Emoji>
        <Title>{kind} 기능은 아직 비활성 상태예요</Title>
        <Desc>
          현재 할래말래는 <b>현장 정산(무결제 예약 중개)</b> 방식으로 운영됩니다.
          회사가 이용료를 직접 수납하지 않으므로 결제 {kind} 절차가 발생하지 않아요.
          <br />
          카드결제(PG) 연동을 개시하면 이 화면이 자동으로 활성화됩니다.
        </Desc>
        <Hint>개발자 참고: <code>src/constants/payments.js</code> 의 <code>PG_ENABLED</code> 를 <code>true</code> 로 전환</Hint>
      </Card>
    </Wrap>
  );
}

const Wrap = styled.div`display: grid; place-items: center; padding: 48px 16px;`;
const Card = styled.div`
  width: min(560px, 100%);
  background: ${({ theme }) => theme?.colors?.card || "#fff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 14px; padding: 32px 28px; text-align: center;
`;
const Emoji = styled.div`font-size: 40px; margin-bottom: 12px;`;
const Title = styled.div`font-size: 17px; font-weight: 800; color: ${({ theme }) => theme?.colors?.textStrong || "#111827"}; margin-bottom: 12px;`;
const Desc = styled.p`
  margin: 0 0 16px; font-size: 13.5px; line-height: 1.7; color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
  & b { color: ${({ theme }) => theme?.colors?.textStrong || "#111827"}; }
`;
const Hint = styled.div`
  font-size: 12px; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"};
  background: ${({ theme }) => theme?.colors?.surface || "#f8fafc"}; border-radius: 8px; padding: 10px 12px;
  & code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; }
`;
