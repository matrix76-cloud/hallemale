/* eslint-disable */
// src/pages/admin/_AdminPlaceholder.jsx
import React from "react";
import styled from "styled-components";

const Wrap = styled.div`
  background: #fff;
  border: 1px solid rgba(0,0,0,.08);
  border-radius: 14px;
  padding: 18px;
`;

const Title = styled.h2`
  margin: 0 0 8px;
  font-size: 18px;
  color: #111827;
`;

const Sub = styled.div`
  color: #6b7280;
  font-size: 13px;
  line-height: 1.6;
`;

export default function AdminPlaceholder({ title = "준비중", desc = "페이지를 준비 중입니다." }) {
  return (
    <Wrap>
      <Title>{title}</Title>
      <Sub>{desc}</Sub>
    </Wrap>
  );
}
