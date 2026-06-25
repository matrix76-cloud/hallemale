/* eslint-disable */
// src/pages/owner/components/CourtHoursEditor.jsx
// 코트 요일별 운영시간 편집기 (주중/주말 다르게 설정)
import React from "react";
import styled from "styled-components";
import { DAY_KEYS, DAY_LABELS, defaultCourtHours } from "../../../services/ownerVenueService";

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;
const DayRow = styled.div`
  display: grid;
  grid-template-columns: 30px 56px 1fr;
  align-items: center;
  gap: 8px;
`;
const DayLabel = styled.div`
  font-size: 14px;
  font-weight: 700;
  text-align: center;
  color: ${({ $wd, theme }) =>
    $wd === "sun" ? "#ef4444" : $wd === "sat" ? "#2563eb" : theme.colors.textStrong};
`;
const Toggle = styled.button`
  height: 34px;
  border-radius: 8px;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.card)};
  color: ${({ $on, theme }) => ($on ? "#fff" : theme.colors.textWeak)};
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
`;
const TimeWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: ${({ $closed }) => ($closed ? 0.4 : 1)};
`;
const TimeInput = styled.input`
  flex: 1;
  min-width: 0;
  height: 38px;
  padding: 0 8px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.textStrong};
  font-size: 13px;
  font-family: inherit;
`;
const Tilde = styled.span`
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 12px;
`;
const ClosedText = styled.div`
  flex: 1;
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

/**
 * @param {object} hours  { mon:{open,close,closed}, ... }
 * @param {function} onChange  (nextHours) => void
 */
export default function CourtHoursEditor({ hours, onChange }) {
  const h = hours && hours.mon ? hours : defaultCourtHours();

  const setDay = (key, patch) => {
    onChange({ ...h, [key]: { ...h[key], ...patch } });
  };

  return (
    <Wrap>
      {DAY_KEYS.map((key) => {
        const d = h[key] || {};
        const closed = !!d.closed;
        return (
          <DayRow key={key}>
            <DayLabel $wd={key}>{DAY_LABELS[key]}</DayLabel>
            <Toggle
              type="button"
              $on={!closed}
              onClick={() => setDay(key, { closed: !closed })}
            >
              {closed ? "휴무" : "영업"}
            </Toggle>
            {closed ? (
              <ClosedText>휴무일</ClosedText>
            ) : (
              <TimeWrap $closed={closed}>
                <TimeInput
                  type="time"
                  value={d.open || "09:00"}
                  onChange={(e) => setDay(key, { open: e.target.value })}
                />
                <Tilde>~</Tilde>
                <TimeInput
                  type="time"
                  value={d.close || "22:00"}
                  onChange={(e) => setDay(key, { close: e.target.value })}
                />
              </TimeWrap>
            )}
          </DayRow>
        );
      })}
    </Wrap>
  );
}
