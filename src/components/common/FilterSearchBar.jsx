/* eslint-disable */
// src/components/common/FilterSearchBar.jsx
import React from "react";
import styled from "styled-components";
import { FiSearch, FiFilter } from "react-icons/fi";

const Wrap = styled.div`
  margin: ${({ $noMargin }) => ($noMargin ? "0" : "0 16px")};
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SearchBox = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  border-radius: 999px;
  padding: 8px 10px;
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 13px;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const FilterBtn = styled.button`
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;

  &:active {
    transform: translateY(1px);
  }
`;

const CountBadge = styled.span`
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primary};
  color: #ffffff;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

export default function FilterSearchBar({
  value,
  onChange,
  onOpenFilter,
  appliedCount = 0,
  placeholder = "검색",
  showFilter = true,
}) {
  return (
    <Wrap $noMargin={!showFilter}>
      <SearchBox>
        <FiSearch size={16} />
        <SearchInput
          placeholder={placeholder}
          value={value || ""}
          onChange={(e) => onChange && onChange(e.target.value)}
        />
      </SearchBox>

      {showFilter && (
        <FilterBtn type="button" onClick={onOpenFilter}>
          <FiFilter size={16} />
          필터
          {appliedCount > 0 && <CountBadge>+{appliedCount}</CountBadge>}
        </FilterBtn>
      )}
    </Wrap>
  );
}

