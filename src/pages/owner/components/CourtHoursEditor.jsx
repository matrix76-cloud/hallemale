/* eslint-disable */
// src/pages/owner/components/CourtHoursEditor.jsx
// 코트 요일별 운영시간 편집기.
// 한 칸 = 1시간. 요일마다 0~23시 버튼 24개를 눌러 운영 시간대를 켜고 끈다.
// 저장: 각 요일에 openHours(선택된 시(時) 배열)를 두고, 호환을 위해 open/close(범위)도 동기화.
import React from "react";
import styled from "styled-components";
import { DAY_KEYS, DAY_LABELS, defaultCourtHours } from "../../../services/ownerVenueService";

const pad = (n) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0..23

function parseHour(hhmm) {
  const h = Number(String(hhmm || "").split(":")[0]);
  return Number.isNaN(h) ? null : h;
}

// 한 요일 데이터 → 선택된 시(時) Set
function dayToSet(d = {}) {
  if (Array.isArray(d.openHours)) return new Set(d.openHours);
  if (d.closed) return new Set();
  const o = parseHour(d.open ?? "09:00");
  const c = parseHour(d.close ?? "22:00");
  const s = new Set();
  if (o != null && c != null) for (let x = o; x < c; x++) s.add(x);
  return s;
}

// 선택 Set → 저장 패치(openHours + open/close + closed 동기화)
function setToPatch(set) {
  const arr = [...set].sort((a, b) => a - b);
  if (!arr.length) return { openHours: [], closed: true };
  const first = arr[0];
  const last = arr[arr.length - 1];
  return {
    openHours: arr,
    open: `${pad(first)}:00`,
    close: `${pad(last + 1)}:00`, // 마지막 시의 끝 (23시 선택 → 24:00)
    closed: false,
  };
}

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;
const DayBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider || theme.colors.border};
  &:last-child { border-bottom: none; padding-bottom: 0; }
`;
const DayTop = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;
const DayLabel = styled.div`
  width: 22px;
  font-size: 14px;
  font-weight: 800;
  color: ${({ $wd, theme }) =>
    $wd === "sun" ? "#ef4444" : $wd === "sat" ? "#2563eb" : theme.colors.textStrong};
`;
const Toggle = styled.button`
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.card)};
  color: ${({ $on, theme }) => ($on ? "#fff" : theme.colors.textWeak)};
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
`;
const RangeText = styled.div`
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const HourGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 4px;
  @media (max-width: 560px) { grid-template-columns: repeat(8, 1fr); }
`;
const HourBtn = styled.button`
  height: 30px;
  border-radius: 6px;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.card)};
  color: ${({ $on, theme }) => ($on ? "#fff" : theme.colors.textWeak)};
  font-size: 11.5px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  padding: 0;
  &:active { transform: translateY(1px); }
`;
const Hint = styled.div`
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.textWeak};
  margin-bottom: 2px;
`;

/**
 * @param {object} hours  { mon:{openHours|open,close,closed}, ... }
 * @param {function} onChange  (nextHours) => void
 */
export default function CourtHoursEditor({ hours, onChange }) {
  const h = hours && hours.mon ? hours : defaultCourtHours();

  const setDay = (key, patch) => {
    onChange({ ...h, [key]: { ...h[key], ...patch } });
  };

  const toggleHour = (key, hour) => {
    const set = dayToSet(h[key]);
    if (set.has(hour)) set.delete(hour);
    else set.add(hour);
    setDay(key, setToPatch(set));
  };

  // 영업/휴무 토글
  const toggleClosed = (key) => {
    const set = dayToSet(h[key]);
    if (set.size > 0) {
      setDay(key, { openHours: [], closed: true });
    } else {
      // 휴무 → 영업: 기본 09~22시(09:00~22:00)
      const def = new Set(Array.from({ length: 13 }, (_, i) => 9 + i)); // 9..21
      setDay(key, setToPatch(def));
    }
  };

  return (
    <Wrap>
      <Hint>한 칸 = 1시간. 운영하는 시간대를 눌러서 켜고 끄세요.</Hint>
      {DAY_KEYS.map((key) => {
        const set = dayToSet(h[key]);
        const closed = set.size === 0;
        const arr = [...set].sort((a, b) => a - b);
        const rangeText = closed
          ? "휴무"
          : `${pad(arr[0])}:00 ~ ${pad(arr[arr.length - 1] + 1)}:00${
              // 비연속(중간에 빠진 시간) 표시
              arr.length !== arr[arr.length - 1] - arr[0] + 1 ? " (일부)" : ""
            }`;
        return (
          <DayBlock key={key}>
            <DayTop>
              <DayLabel $wd={key}>{DAY_LABELS[key]}</DayLabel>
              <Toggle type="button" $on={!closed} onClick={() => toggleClosed(key)}>
                {closed ? "휴무" : "영업"}
              </Toggle>
              <RangeText>{rangeText}</RangeText>
            </DayTop>
            <HourGrid>
              {HOURS.map((hr) => (
                <HourBtn
                  key={hr}
                  type="button"
                  $on={set.has(hr)}
                  onClick={() => toggleHour(key, hr)}
                  title={`${pad(hr)}:00 ~ ${pad(hr + 1)}:00`}
                >
                  {hr}
                </HourBtn>
              ))}
            </HourGrid>
          </DayBlock>
        );
      })}
    </Wrap>
  );
}
