/* eslint-disable */
// src/pages/settings/NoticeListPage.jsx
import React from "react";
import styled from "styled-components";

const Wrap = styled.div`
  padding: 16px;
`;

export default function NoticeListPage() {
  return (
    <Wrap>
      <h2>공지사항</h2>
      <p style={{ fontSize: 13, color: "#6b7280" }}>
        아직 등록된 공지사항이 없습니다.
      </p>
    </Wrap>
  );
}
