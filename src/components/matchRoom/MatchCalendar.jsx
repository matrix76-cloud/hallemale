/* eslint-disable */
// src/components/matchRoom/MatchCalendar.jsx
// 확정/지난 경기 캘린더 뷰 — 경기 있는 날 점 표시, 날짜 선택 시 그 날 경기 카드 목록
import React, { useMemo, useState } from "react";
import styled from "styled-components";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

const toDate = (v) => {
  if (!v) return null;
  if (typeof v?.toDate === "function") {
    try {
      return v.toDate();
    } catch (e) {
      return null;
    }
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export default function MatchCalendar({
  matches = [],
  renderCard,
  emptyText = "이 날은 경기가 없어요",
  todayRef, // 오늘 기준 Date (SSR/테스트 대비, 없으면 new Date())
}) {
  const today = todayRef || new Date();
  const todayKey = ymd(today);

  // 날짜별 그룹
  const byDate = useMemo(() => {
    const m = {};
    (Array.isArray(matches) ? matches : []).forEach((r) => {
      const d = toDate(r?.scheduledAt);
      if (!d) return;
      const k = ymd(d);
      (m[k] = m[k] || []).push(r);
    });
    return m;
  }, [matches]);

  // 기본 포커스: 가장 가까운(미래 우선) 경기 날짜, 없으면 오늘
  const focus = useMemo(() => {
    const dates = (Array.isArray(matches) ? matches : [])
      .map((r) => toDate(r?.scheduledAt))
      .filter(Boolean)
      .sort((a, b) => a - b);
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const future = dates.find((d) => d.getTime() >= t0);
    return future || dates[dates.length - 1] || today;
  }, [matches]);

  const [cursor, setCursor] = useState(() => new Date(focus.getFullYear(), focus.getMonth(), 1));
  const [selected, setSelected] = useState(() => ymd(focus));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startWd = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWd; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const goMonth = (delta) => setCursor(new Date(year, month + delta, 1));

  const selectedMatches = byDate[selected] || [];
  const selDateObj = (() => {
    const [y, m, d] = selected.split("-").map(Number);
    return new Date(y, m - 1, d);
  })();

  return (
    <Wrap>
      <CalCard>
        <MonthRow>
          <NavBtn type="button" onClick={() => goMonth(-1)} aria-label="이전 달">
            <FiChevronLeft size={18} />
          </NavBtn>
          <MonthLabel>
            {year}년 {month + 1}월
          </MonthLabel>
          <NavBtn type="button" onClick={() => goMonth(1)} aria-label="다음 달">
            <FiChevronRight size={18} />
          </NavBtn>
        </MonthRow>

        <WeekHead>
          {WD.map((w, i) => (
            <WdCell key={w} $sun={i === 0} $sat={i === 6}>
              {w}
            </WdCell>
          ))}
        </WeekHead>

        <Grid>
          {cells.map((d, i) => {
            if (!d) return <Empty key={`e${i}`} />;
            const k = ymd(d);
            const has = !!byDate[k];
            const isSel = k === selected;
            const isToday = k === todayKey;
            const wd = d.getDay();
            return (
              <DayCell key={k} type="button" onClick={() => setSelected(k)}>
                <DayNum
                  $sel={isSel}
                  $today={isToday && !isSel}
                  $sun={wd === 0}
                  $sat={wd === 6}
                >
                  {d.getDate()}
                </DayNum>
                <Dot $on={has} $sel={isSel} />
              </DayCell>
            );
          })}
        </Grid>
      </CalCard>

      <DayHead>
        {selDateObj.getMonth() + 1}월 {selDateObj.getDate()}일 ({WD[selDateObj.getDay()]})
        {selectedMatches.length > 0 && <DayCount>{selectedMatches.length}경기</DayCount>}
      </DayHead>

      <DayList>
        {selectedMatches.length ? (
          selectedMatches.map((r) => renderCard(r))
        ) : (
          <EmptyDay>{emptyText}</EmptyDay>
        )}
      </DayList>
    </Wrap>
  );
}

/* ================= styled ================= */

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const CalCard = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) =>
    theme.mode === "dark" ? theme.colors.border : "transparent"};
  border-radius: 18px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  padding: 14px 12px 16px;
`;

const MonthRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 12px;
`;

const MonthLabel = styled.div`
  font-size: 16px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const NavBtn = styled.button`
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 10px;
  background: ${({ theme }) =>
    theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "#f3f4f6"};
  color: ${({ theme }) => theme.colors.textNormal};
  display: grid;
  place-items: center;
  cursor: pointer;
  &:active {
    transform: translateY(1px);
  }
`;

const WeekHead = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 4px;
`;

const WdCell = styled.div`
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 0;
  color: ${({ $sun, $sat, theme }) =>
    $sun ? "#ef4444" : $sat ? "#3b82f6" : theme.colors.textWeak};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  row-gap: 2px;
`;

const Empty = styled.div``;

const DayCell = styled.button`
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 3px 0 2px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
`;

const DayNum = styled.span`
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 13px;
  font-weight: ${({ $sel, $today }) => ($sel || $today ? 800 : 600)};

  ${({ $sel, $today, $sun, $sat, theme }) => {
    if ($sel)
      return `background:${theme.colors.primary}; color:#fff;`;
    if ($today)
      return `background:${
        theme.mode === "dark" ? "rgba(124,110,242,0.18)" : "#f0eeff"
      }; color:${theme.colors.primary};`;
    const c = $sun ? "#ef4444" : $sat ? "#3b82f6" : theme.colors.textStrong;
    return `color:${c};`;
  }}
`;

const Dot = styled.span`
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: ${({ $on, $sel, theme }) =>
    !$on ? "transparent" : $sel ? theme.colors.primary : theme.colors.primary};
  opacity: ${({ $on }) => ($on ? 1 : 0)};
`;

const DayHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
  font-size: 14px;
  font-weight: 800;
  color: ${({ theme }) => theme.colors.textStrong};
`;

const DayCount = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const DayList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const EmptyDay = styled.div`
  padding: 22px 4px;
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;
