/* eslint-disable */
// src/admin/components/AdminFilterSummaryBar.jsx
import React, { useMemo } from "react";
import styled from "styled-components";

/**
 * Props
 * - title?: string
 * - subtitle?: string
 *
 * - dateFrom: string (YYYY-MM-DD)
 * - dateTo: string (YYYY-MM-DD)
 * - onChangeDateFrom: (v: string) => void
 * - onChangeDateTo: (v: string) => void
 *
 * - keyword: string
 * - onChangeKeyword: (v: string) => void
 *
 * - onSubmit?: () => void          // 엔터/검색 버튼
 * - onReset?: () => void           // 필터 초기화
 *
 * - summaries?: Array<{ label: string, value: string|number, tone?: "primary"|"neutral"|"good"|"warn"|"danger", onClick?: () => void }>
 * - extraFilters?: React.ReactNode // Select/Checkbox 등 확장 필터
 * - rightActions?: React.ReactNode // 우측 액션(엑셀, 생성 등)
 */

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const TopRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Title = styled.div`
  font-size: 16px;
  color: #111827;
`;

const Sub = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const Card = styled.div`
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.04);
  overflow: hidden;
`;

const CardBody = styled.div`
  padding: 12px 12px;
`;

const FilterGrid = styled.div`
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 10px 12px;
  align-items: center;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const Label = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const FieldRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
`;

const Input = styled.input`
  height: 34px;
  border-radius: 10px;
  padding: 0 10px;
  border: 1px solid #e5e7eb;
  font-size: 13px;
  outline: none;
  min-width: 220px;
  background: #ffffff;

  &:focus {
    border-color: ${({ theme }) => theme?.colors?.primary || theme?.primary || "#4f46e5"};
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
  }

  @media (max-width: 860px) {
    min-width: 0;
    width: 100%;
  }
`;

const DateInput = styled(Input)`
  min-width: 160px;
`;

const Btn = styled.button`
  height: 34px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: ${({ $primary, theme }) =>
    $primary ? theme?.colors?.primary || theme?.primary || "#4f46e5" : "#ffffff"};
  color: ${({ $primary }) => ($primary ? "#ffffff" : "#111827")};
  cursor: pointer;
  font-size: 12px;
  padding: 0 12px;

  &:active {
    transform: translateY(1px);
  }
`;

const SummaryGrid = styled.div`
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(4, minmax(0, 1fr));

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const SummaryCard = styled.button`
  width: 100%;
  text-align: left;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  border-radius: 14px;
  padding: 12px 12px;
  cursor: ${({ $clickable }) => ($clickable ? "pointer" : "default")};

  &:active {
    ${({ $clickable }) => ($clickable ? "transform: translateY(1px);" : "")}
  }
`;

const SummaryLabel = styled.div`
  font-size: 12px;
  color: #6b7280;
`;

const SummaryValue = styled.div`
  margin-top: 6px;
  font-size: 18px;
  color: #111827;
`;

const toneStyle = (tone, theme) => {
  const primary = theme?.colors?.primary || theme?.primary || "#4f46e5";
  if (tone === "primary") return { bg: primary, fg: "#ffffff" };
  if (tone === "good") return { bg: "rgba(16,185,129,0.12)", fg: "#047857" };
  if (tone === "warn") return { bg: "rgba(245,158,11,0.14)", fg: "#b45309" };
  if (tone === "danger") return { bg: "rgba(239,68,68,0.14)", fg: "#b91c1c" };
  return { bg: "#ffffff", fg: "#111827" };
};

export default function AdminFilterSummaryBar({
  title = "",
  subtitle = "",
  dateFrom,
  dateTo,
  onChangeDateFrom,
  onChangeDateTo,
  keyword,
  onChangeKeyword,
  onSubmit,
  onReset,
  summaries = [],
  extraFilters = null,
  rightActions = null,
}) {
  const hasSummaries = Array.isArray(summaries) && summaries.length > 0;

  return (
    <Wrap>
      {(title || subtitle || rightActions) && (
        <TopRow>
          <TitleBlock>
            {title ? <Title>{title}</Title> : null}
            {subtitle ? <Sub>{subtitle}</Sub> : null}
          </TitleBlock>
          <Actions>{rightActions}</Actions>
        </TopRow>
      )}

      <Card>
        <CardBody>
          <FilterGrid>
            <Label>기간</Label>
            <FieldRow>
              <DateInput
                type="date"
                value={dateFrom || ""}
                onChange={(e) => onChangeDateFrom && onChangeDateFrom(e.target.value)}
              />
              <DateInput
                type="date"
                value={dateTo || ""}
                onChange={(e) => onChangeDateTo && onChangeDateTo(e.target.value)}
              />
              <Btn type="button" onClick={() => onReset && onReset()}>
                초기화
              </Btn>
            </FieldRow>

            <Label>검색</Label>
            <FieldRow>
              <Input
                placeholder="검색어"
                value={keyword || ""}
                onChange={(e) => onChangeKeyword && onChangeKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSubmit && onSubmit();
                  }
                }}
              />
              <Btn type="button" $primary onClick={() => onSubmit && onSubmit()}>
                검색
              </Btn>
              {extraFilters}
            </FieldRow>
          </FilterGrid>
        </CardBody>
      </Card>

      {hasSummaries && (
        <SummaryGrid>
          {summaries.map((s, idx) => (
            <SummaryItem key={`${s.label}-${idx}`} item={s} />
          ))}
        </SummaryGrid>
      )}
    </Wrap>
  );
}

function SummaryItem({ item }) {
  const { label, value, tone = "neutral", onClick } = item || {};
  const clickable = typeof onClick === "function";

  return (
    <SummaryCard type="button" onClick={clickable ? onClick : undefined} $clickable={clickable}>
      <SummaryLabel>{label}</SummaryLabel>
      <SummaryValue>{value}</SummaryValue>
    </SummaryCard>
  );
}
