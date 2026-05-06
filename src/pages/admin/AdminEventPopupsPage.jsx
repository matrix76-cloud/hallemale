/* eslint-disable */
// src/pages/admin/AdminEventPopupsPage.jsx
import React from "react";
import styled from "styled-components";
import AdminEventPopupsSection from "./AdminEventPopupsSection";

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const Sub = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
`;

export default function AdminEventPopupsPage() {
  return (
    <Page>
      <HeaderRow>
        <div>
          <Title>이벤트 팝업</Title>
          <Sub style={{ marginTop: 4 }}>
            홈 진입 시 노출되는 이벤트 팝업을 등록·수정·삭제합니다.
          </Sub>
        </div>
      </HeaderRow>

      <AdminEventPopupsSection />
    </Page>
  );
}
