/* eslint-disable */
// src/components/admin/AdminPager.jsx
// jogun 스타일 페이저: [이전] [page / total] [다음] (가운데 정렬, 기본 25개)
import React from "react";
import styled from "styled-components";

const Row = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
`;

const PageBtn = styled.button`
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 4px;
  background: ${({ theme }) => theme?.colors?.card || "#fff"};
  color: ${({ theme }) => theme?.colors?.textStrong || "#1f2937"};
  cursor: pointer;
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const PageInfo = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme?.colors?.textStrong || "#1f2937"};
`;

/**
 * @param {object} props
 * @param {number} props.totalCount
 * @param {number} props.page                 1-based
 * @param {number} props.pageSize             default 25
 * @param {(p:number)=>void} props.onPageChange
 */
export default function AdminPager({
  totalCount = 0,
  page = 1,
  pageSize = 25,
  onPageChange,
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), totalPages);

  return (
    <Row>
      <PageBtn
        type="button"
        disabled={safePage <= 1}
        onClick={() => onPageChange?.(Math.max(1, safePage - 1))}
      >
        이전
      </PageBtn>
      <PageInfo>
        {safePage} / {totalPages}
      </PageInfo>
      <PageBtn
        type="button"
        disabled={safePage >= totalPages}
        onClick={() => onPageChange?.(Math.min(totalPages, safePage + 1))}
      >
        다음
      </PageBtn>
    </Row>
  );
}
