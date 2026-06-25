/* eslint-disable */
// src/pages/owner/OwnerSalesPage.jsx
// 매출분석 — 실제 확정 예약 기준 (P1: 합계/요일별 기본, 추후 보강)
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { LuChartColumn, LuTrendingUp } from "react-icons/lu";
import { useOwner } from "../../context/OwnerContext";
import { listReservations } from "../../services/ownerVenueService";
import { Page, Card, ScreenTitle, SecTitle, Caption, Money, Chip, C } from "./components/od";
import VenueGateNotice from "./components/VenueGateNotice";
import OwnerSpinner from "./components/OwnerSpinner";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

const Row = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 10px;`;
const Bars = styled.div`display: flex; flex-direction: column; gap: 8px; margin-top: 4px;`;
const BarRow = styled.div`display: grid; grid-template-columns: 28px 1fr 70px; align-items: center; gap: 8px; font-size: 12px; color: ${C.slate500};`;
const Bar = styled.div`
  height: 10px; border-radius: 999px; background: ${C.violet50};
  position: relative; overflow: hidden;
  & > i { position: absolute; inset: 0; width: ${({ $pct }) => $pct}%; background: ${C.violet600}; border-radius: 999px; }
`;
const ChipRow = styled.div`display: flex; gap: 8px; overflow-x: auto;`;

export default function OwnerSalesPage() {
  const { venue, loading: ownerLoading, refresh } = useOwner();
  const courts = venue?.courts || [];
  const [courtId, setCourtId] = useState("all");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!venue?.id) return;
    setLoading(true);
    listReservations({ venueId: venue.id })
      .then((rs) => setRows(rs.filter((r) => ["confirmed", "done"].includes(r.status))))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [venue?.id]);

  const filtered = useMemo(
    () => (courtId === "all" ? rows : rows.filter((r) => r.courtId === courtId)),
    [rows, courtId]
  );
  const total = filtered.reduce((s, r) => s + (r.price || 0), 0);
  const count = filtered.length;

  const byDow = useMemo(() => {
    const m = [0, 0, 0, 0, 0, 0, 0];
    filtered.forEach((r) => {
      const d = r.date ? new Date(r.date).getDay() : null;
      if (d != null && !Number.isNaN(d)) m[d] += r.price || 0;
    });
    return m;
  }, [filtered]);
  const maxDow = Math.max(1, ...byDow);

  if (ownerLoading) return <OwnerSpinner label="불러오는 중…" />;
  if (!venue || venue.status !== "approved")
    return <Page><VenueGateNotice venue={venue} refresh={refresh} /></Page>;

  return (
    <Page>
      <ScreenTitle>매출분석</ScreenTitle>

      {courts.length > 1 && (
        <ChipRow>
          <Chip $on={courtId === "all"} onClick={() => setCourtId("all")}>전체</Chip>
          {courts.map((c) => (
            <Chip key={c.id} $on={courtId === c.id} onClick={() => setCourtId(c.id)}>{c.name}</Chip>
          ))}
        </ChipRow>
      )}

      <Card>
        <SecTitle><LuTrendingUp size={16} /> 누적 매출 (확정·완료 기준)</SecTitle>
        <Money $lg>{total.toLocaleString()}원</Money>
        <Caption>확정 예약 {count}건 · 카드결제(PG) 연동 전까지는 앱 내 결제 기준</Caption>
      </Card>

      <Card>
        <SecTitle><LuChartColumn size={16} /> 요일별 매출</SecTitle>
        {loading ? (
          <Caption>불러오는 중…</Caption>
        ) : total === 0 ? (
          <Caption>아직 확정된 예약 매출이 없어요.</Caption>
        ) : (
          <Bars>
            {byDow.map((v, i) => (
              <BarRow key={i}>
                <span style={{ color: i === 0 ? C.red500 : i === 6 ? C.violet600 : C.slate500, fontWeight: 700, textAlign: "center" }}>{WEEK[i]}</span>
                <Bar $pct={Math.round((v / maxDow) * 100)}><i /></Bar>
                <span style={{ textAlign: "right", color: C.slate800, fontWeight: 700 }}>{v.toLocaleString()}</span>
              </BarRow>
            ))}
          </Bars>
        )}
      </Card>
    </Page>
  );
}
