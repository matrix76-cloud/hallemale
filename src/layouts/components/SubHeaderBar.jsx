// src/components/SubHeaderBar.jsx
/* eslint-disable */
import React from "react";
import styled from "styled-components";
import { FiArrowLeft } from "react-icons/fi";

export default function SubHeaderBar({
  title,
  onBack,
  rightContent = null,
  showBack = true,
}) {
  return (
    <HeaderBar>
      <LeftArea>
        {showBack ? (
          <IconButton type="button" onClick={onBack}>
            <FiArrowLeft size={20} />
          </IconButton>
        ) : (
          <LeftPlaceholder />
        )}
      </LeftArea>
      <HeaderTitle>{title}</HeaderTitle>
      <RightArea>{rightContent || <RightPlaceholder />}</RightArea>
    </HeaderBar>
  );
}

/* ================= styled ================= */

const HeaderBar = styled.div`
  height: 48px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const LeftArea = styled.div`
  display: flex;
  align-items: center;
  width: 28px;
`;

const RightArea = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 28px;
`;

const IconButton = styled.button`
  border: none;
  background: transparent;
  padding: 4px;
  cursor: pointer;
  color: #4b5563;
`;

const LeftPlaceholder = styled.div`
  width: 24px;
  height: 24px;
`;

const RightPlaceholder = styled.div`
  width: 24px;
  height: 24px;
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 5px;
  color: ${({ theme }) => theme.colors.textStrong};
`;
