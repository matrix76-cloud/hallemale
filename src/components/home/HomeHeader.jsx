// src/components/home/HomeHeader.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import { AiOutlineBell } from "react-icons/ai";
import BrandHeader from "../auth/BrandHeader";

const Wrap = styled.header`
  padding: 16px 16px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Left = styled.div`
  display: flex;
  align-items: center;
`;

const Right = styled.button`
  border: none;
  background: transparent;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  color: ${({ theme }) => theme.colors.textStrong || "#111"};
  font-size: 22px;
`;

export default function HomeHeader() {
  const handleBellClick = () => {
    // TODO: 알림 페이지/모달 연결
    // console.log("알림 클릭");
  };

  return (
    <Wrap>
      <Left>
        <BrandHeader />
      </Left>
      <Right type="button" onClick={handleBellClick}>
        <AiOutlineBell />
      </Right>
    </Wrap>
  );
}
