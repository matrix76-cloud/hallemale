/* eslint-disable */
// src/pages/owner/components/OwnerFooter.jsx
// 사업자 정보 푸터 — 전자상거래법 제10조(사업자 정보 표시) 이행.
import React from "react";
import styled from "styled-components";
import { C } from "./od";

const Wrap = styled.footer`
  padding: 20px 4px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Brand = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: ${C.slate500};
`;

const Lines = styled.div`
  font-size: 11.5px;
  line-height: 1.7;
  color: ${C.slate400};
`;

const Disclaimer = styled.div`
  font-size: 11px;
  line-height: 1.6;
  color: ${C.slate400};
  padding-top: 8px;
  border-top: 1px solid ${C.slate200};
`;

export const OWNER_BUSINESS = {
  company: "일생",
  ceo: "한주성",
  bizNo: "225-06-57521",
  commerceNo: "제2026-화도수동-0449호",
  address: "경기도 남양주시 화도읍 마석중앙로37번길 45, 504호-N141호(별나라프라자)",
  tel: "070-8065-7687",
  email: "hallae@ilsaeng.com",
};

export default function OwnerFooter() {
  const b = OWNER_BUSINESS;
  return (
    <Wrap>
      <Brand>할래말래 구장 관리자</Brand>
      <Lines>
        {b.company} · 대표 {b.ceo}
        <br />
        사업자등록번호 {b.bizNo}
        <br />
        통신판매업 신고번호 {b.commerceNo}
        <br />
        {b.address}
        <br />
        고객문의 {b.tel} · {b.email}
      </Lines>
      <Disclaimer>
        회사는 회원과 구장 관리자 간 예약 거래를 중개하는 통신판매중개자이며, 예약 거래의 당사자가 아닙니다.
        구장 시설 및 예약 이행에 관한 책임은 각 구장 관리자에게 있습니다.
      </Disclaimer>
    </Wrap>
  );
}
