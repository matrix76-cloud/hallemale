/* eslint-disable */
// src/pages/admin/_AdminPlaceholder.jsx
import React from "react";
import styled from "styled-components";

const Wrap = styled.div`
  background: ${({ theme }) => theme?.colors?.card || "#fff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "rgba(0,0,0,.08)"};
  border-radius: 8px;
  padding: 18px;
`;

const Title = styled.h2`
  margin: 0 0 8px;
  font-size: 18px;
  color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};
`;

const Sub = styled.div`
  color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"};
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
