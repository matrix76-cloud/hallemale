/* eslint-disable */
// src/components/common/CaptainPill.jsx
import React from "react";
import styled from "styled-components";

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  background: #4f46e5; /* 보라 */
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
`;

export default function CaptainPill({ label = "팀장" }) {
  return <Pill>{label}</Pill>;
}
