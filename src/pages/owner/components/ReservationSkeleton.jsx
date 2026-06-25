/* eslint-disable */
// src/pages/owner/components/ReservationSkeleton.jsx
// 잠금 미리보기 뒤에 흐릿하게 깔리는 '예약관리 화면' 목업 (정적, 비상호작용)
import React from "react";
import styled from "styled-components";
import { Page, Card } from "./ownerUi";

const Chips = styled.div`
  display: flex;
  gap: 8px;
`;
const Chip = styled.div`
  width: ${({ $w }) => $w || 64}px;
  height: 34px;
  border-radius: 999px;
  background: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.surface)};
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
`;
const Dates = styled.div`
  display: flex;
  gap: 8px;
`;
const DateCell = styled.div`
  width: 52px;
  height: 60px;
  border-radius: 12px;
  background: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.card)};
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
`;
const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
`;
const Slot = styled.div`
  height: 56px;
  border-radius: 10px;
  background: ${({ $tone, theme }) =>
    $tone === "reserved" ? "#eff6ff" : $tone === "blocked" ? "#fef2f2" : theme.colors.card};
  border: 1px solid
    ${({ $tone, theme }) =>
      $tone === "reserved" ? "#bfdbfe" : $tone === "blocked" ? "#fecaca" : theme.colors.border};
`;
const Bar = styled.div`
  height: ${({ $h }) => $h || 12}px;
  width: ${({ $w }) => $w || "40%"};
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.surface};
`;

const SLOT_TONES = ["open", "open", "reserved", "open", "blocked", "open", "reserved", "open"];

export default function ReservationSkeleton() {
  return (
    <Page>
      <Card>
        <Bar $w="30%" />
        <Chips>
          <Chip $w={70} $on />
          <Chip $w={70} />
        </Chips>
        <Dates>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <DateCell key={i} $on={i === 0} />
          ))}
        </Dates>
      </Card>
      <Card>
        <Bar $w="24%" />
        <Grid>
          {SLOT_TONES.map((t, i) => (
            <Slot key={i} $tone={t} />
          ))}
        </Grid>
      </Card>
      <Card>
        <Bar $w="40%" />
        <Bar $h={44} $w="100%" />
      </Card>
    </Page>
  );
}
