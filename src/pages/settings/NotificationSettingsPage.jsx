/* eslint-disable */
// src/pages/settings/NotificationSettingsPage.jsx
import React from "react";
import styled from "styled-components";

const Wrap = styled.div`
  padding: 16px;
`;

export default function NotificationSettingsPage() {
  return (
    <Wrap>
      <h2>알림 설정</h2>
      <p style={{ fontSize: 13, color: "#6b7280" }}>
        나중에 알림 ON/OFF 옵션들을 추가할 예정입니다.
      </p>
    </Wrap>
  );
}
