/* eslint-disable */
// src/pages/owner/OwnerSalesPage.jsx
// 매출·정산 허브 — 운영 지표(예약 건수·가동률·요일별)와 정산 진입점.
//
// 금액 표기는 실제 수금액 기준. 정산 상세는 /owner/settlement (결제 원장 기준).
// 이 화면의 금액은 예약 정가 합계라 환불이 반영되지 않는다 — 정확한 정산액은 정산 화면을 봐야 한다.
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { LuChartColumn, LuTrendingUp, LuReceipt, LuChevronLeft, LuChevronRight, LuActivity, LuBan, LuWallet, LuClock, LuLayoutGrid, LuSplit, LuChevronRight as LuArrowRight } from "react-icons/lu";
import { useOwner } from "../../context/OwnerContext";
import { listReservations, dowToKey } from "../../services/ownerVenueService";
import { listOwnerPayments, summarize, filterMonth, todayKst } from "../../services/ownerSettlementService";
import { nextPayoutDate } from "../../constants/payments";
import { Page, Card, ScreenTitle, SecTitle, Caption, Money, Chip, C } from "./components/od";
import VenueGateNotice from "./components/VenueGateNotice";
import OwnerSpinner from "./components/OwnerSpinner";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function toMin(h){const[a,b]=String(h||"0:0").split(":").map(x=>parseInt(x,10)||0);return a*60+b;}
// 코트의 해당 월 운영 가능 시간(분) 합계 — 요일별 운영시간 × 그 달 날짜수
function courtMonthOperatingMin(court, y, m){
  if(!court) return 0;
  const daysInMonth = new Date(y, m, 0).getDate();
  let total = 0;
  for(let day=1; day<=daysInMonth; day++){
    const dk = dowToKey(new Date(y, m-1, day).getDay());
    const h = court.hours?.[dk];
    if(!h || h.closed) continue;
    total += Math.max(0, toMin(h.close) - toMin(h.open));
  }
  return total;
}

// 전월 대비 — 오르면 보라, 내리면 빨강. 방향을 못 재면(전월 0) 아예 안 그린다.
function Delta({ cur, prev, unit = "" }) {
  if (!Number.isFinite(prev) || prev <= 0) return null;
  const diff = cur - prev;
  if (diff === 0) return <DeltaTxt $flat>전월과 같음</DeltaTxt>;
  const pct = Math.round((diff / prev) * 100);
  return (
    <DeltaTxt $up={diff > 0}>
      전월 대비 {diff > 0 ? "+" : "−"}
      {Math.abs(pct)}% ({diff > 0 ? "+" : "−"}
      {Math.abs(diff).toLocaleString()}
      {unit})
    </DeltaTxt>
  );
}

const Row = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 10px;`;
const DeltaTxt = styled.div`
  font-size: 11.5px;
  font-weight: 700;
  margin-top: 3px;
  color: ${({ $up, $flat }) => ($flat ? C.slate400 : $up ? C.violet600 : C.red500)};
`;
// 핵심 지표 4칸 — 사업 판단에 먼저 필요한 숫자만 위로 올린다.
const KpiGrid = styled.div`display:grid;grid-template-columns:1fr 1fr;gap:8px;`;
const Kpi = styled.div`
  background: #fff; border: 1px solid ${C.slate200}; border-radius: 14px; padding: 14px;
  display: flex; flex-direction: column; gap: 2px; min-width: 0;
`;
const KpiL = styled.div`font-size:11.5px;color:${C.slate500};font-weight:700;display:flex;align-items:center;gap:4px;& > svg{color:${C.violet600};}`;
const KpiV = styled.div`
  font-size: 20px; font-weight: 800; letter-spacing: -0.4px;
  font-variant-numeric: tabular-nums; color: ${({ $c }) => $c || C.slate800};
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  & > small { font-size: 12px; font-weight: 700; color: ${C.slate500}; margin-left: 2px; }
`;
// 시간대별 — 공실 시간을 찾는 용도라 값이 0인 칸도 그려야 의미가 있다.
const HourRow = styled.div`display:grid;grid-template-columns:44px 1fr 34px;align-items:center;gap:8px;font-size:12px;color:${C.slate500};`;
const HourBar = styled.div`
  height: 9px; border-radius: 999px; background: ${C.violet50};
  position: relative; overflow: hidden;
  & > i { position: absolute; inset: 0; width: ${({ $pct }) => $pct}%; background: ${({ $cold }) => ($cold ? C.slate200 : C.violet600)}; border-radius: 999px; }
`;
const WideBar = styled.div`height:12px;border-radius:999px;background:${C.violet50};position:relative;overflow:hidden;margin-top:6px;& > i{position:absolute;inset:0;width:${({$pct})=>$pct}%;background:${C.violet600};border-radius:999px;}`;
const TwoCol = styled.div`display:grid;grid-template-columns:1fr 1fr;gap:8px;`;
const Mini = styled.div`border:1px solid ${C.slate200};border-radius:12px;padding:12px;text-align:center;`;
const MiniN = styled.div`font-size:20px;font-weight:800;color:${({$c})=>$c||C.slate800};`;
const MiniL = styled.div`font-size:11.5px;color:${C.slate500};margin-top:2px;`;
const Bars = styled.div`display: flex; flex-direction: column; gap: 8px; margin-top: 4px;`;
const BarRow = styled.div`display: grid; grid-template-columns: 28px 1fr 70px; align-items: center; gap: 8px; font-size: 12px; color: ${C.slate500};`;
const Bar = styled.div`
  height: 10px; border-radius: 999px; background: ${C.violet50};
  position: relative; overflow: hidden;
  & > i { position: absolute; inset: 0; width: ${({ $pct }) => $pct}%; background: ${C.violet600}; border-radius: 999px; }
`;
const ChipRow = styled.div`display: flex; gap: 8px; overflow-x: auto; &::-webkit-scrollbar{display:none;}`;
const ListItem = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 0; border-bottom: 1px solid ${C.slate200}; &:last-child{border-bottom:none;}`;
const ItemL = styled.div`display: flex; flex-direction: column; gap: 2px; min-width: 0;`;
const ItemT = styled.div`font-size: 13.5px; font-weight: 700; color: ${C.slate800}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const ItemS = styled.div`font-size: 11.5px; color: ${C.slate500};`;
const Amt = styled.div`font-size: 14px; font-weight: 800; color: ${C.slate800}; flex-shrink: 0;`;
const TotalRow = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 0 2px; margin-top: 4px; border-top: 2px solid ${C.slate800}; & > span{font-size: 14px; font-weight: 800; color: ${C.slate800};} & > b{font-size: 17px; font-weight: 800; color: ${C.violet600};}`;
const MonthNav = styled.div`display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid ${C.slate200};border-radius:14px;padding:8px 6px;`;
const NavBtn = styled.button`border:none;background:transparent;color:${C.slate500};cursor:pointer;display:flex;padding:6px;`;
const MonthLabel = styled.div`font-size:15px;font-weight:800;color:${C.slate800};`;
const ClickItem = styled(ListItem)`cursor:pointer;&:active{background:#fafafa;}`;
const Overlay = styled.div`position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:flex-end;justify-content:center;z-index:200;`;
const Sheet = styled.div`box-sizing:border-box;width:100%;max-width:448px;max-height:85vh;overflow-y:auto;background:#fff;border-radius:20px 20px 0 0;padding:22px 24px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px;`;
const SheetTitle = styled.div`font-size:17px;font-weight:800;color:${C.slate800};display:flex;align-items:center;justify-content:space-between;`;
const X = styled.button`border:none;background:transparent;color:${C.slate400};font-size:24px;cursor:pointer;line-height:1;`;
const DRow = styled.div`display:flex;justify-content:space-between;gap:10px;font-size:14px;align-items:center;& > span{color:${C.slate500};} & > b{color:${C.slate800};font-weight:700;text-align:right;}`;
const TeamBlock = styled.div`border:1px solid ${C.slate200};border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:6px;`;
const TeamName = styled.div`font-size:14px;font-weight:800;color:${C.slate800};`;
const PayoutCard = styled.button`
  width:100%;box-sizing:border-box;text-align:left;cursor:pointer;
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  background:#fff;border:1px solid ${C.slate200};border-radius:14px;padding:16px;
  &:active{background:#fafafa;}
  & > div{display:flex;flex-direction:column;gap:6px;min-width:0;}
`;

export default function OwnerSalesPage() {
  const navigate = useNavigate();
  const { uid, venue, loading: ownerLoading, refresh } = useOwner();
  const courts = venue?.courts || [];
  const [pays, setPays] = useState([]); // 결제 원장 — 실수령 기준 매출·정산 진입점용
  const [courtId, setCourtId] = useState("all");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const now = useMemo(() => new Date(), []);
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [detail, setDetail] = useState(null); // 세부 내역 팝업

  const shiftMonth = (d) => setYm(({ y, m }) => {
    let mm = m + d, yy = y;
    if (mm < 1) { mm = 12; yy -= 1; }
    if (mm > 12) { mm = 1; yy += 1; }
    return { y: yy, m: mm };
  });

  useEffect(() => {
    if (!venue?.id) return;
    setLoading(true);
    listReservations({ venueId: venue.id })
      .then((rs) => setRows(rs))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [venue?.id]);

  // 결제 원장 — 실패해도 통계 화면은 그대로 보여준다(정산은 부가 정보).
  useEffect(() => {
    if (!uid || !venue?.id) return;
    listOwnerPayments(uid, { venueId: venue.id })
      .then((ps) => setPays(Array.isArray(ps) ? ps : []))
      .catch(() => setPays([]));
  }, [uid, venue?.id]);

  const filtered = useMemo(
    () => (courtId === "all" ? rows : rows.filter((r) => r.courtId === courtId)),
    [rows, courtId]
  );

  // 선택한 연·월 기준
  const monthKey = `${ym.y}-${String(ym.m).padStart(2, "0")}`;
  // 그 달 전체(모든 상태) — 취소·노쇼 집계용
  const monthAll = useMemo(() => filtered.filter((r) => (r.date || "").startsWith(monthKey)), [filtered, monthKey]);
  // 통계 대상(확정·완료)
  const monthRows = useMemo(() => monthAll.filter((r) => ["confirmed", "done"].includes(r.status)), [monthAll]);

  const total = monthRows.reduce((s, r) => s + (r.price || 0), 0);
  const count = monthRows.length;

  const cancelCnt = monthAll.filter((r) => ["cancelled", "rejected"].includes(r.status)).length;
  const noshowCnt = monthAll.filter((r) => r.status === "noshow").length;

  // 가동률 — 예약(확정·완료) 시간 / 운영 가능 시간
  const bookedMin = monthRows.reduce((s, r) => s + Math.max(0, toMin(r.endTime) - toMin(r.startTime)), 0);
  const operMin = useMemo(() => {
    const list = courtId === "all" ? courts : courts.filter((c) => c.id === courtId);
    return list.reduce((s, c) => s + courtMonthOperatingMin(c, ym.y, ym.m), 0);
  }, [courts, courtId, ym]);
  const occupancy = operMin > 0 ? Math.round((bookedMin / operMin) * 100) : 0;

  // 요일별 예약 분포(건수)
  const byDow = useMemo(() => {
    const m = [0, 0, 0, 0, 0, 0, 0];
    monthRows.forEach((r) => {
      const d = r.date ? new Date(`${r.date}T00:00:00`).getDay() : null;
      if (d != null && !Number.isNaN(d)) m[d] += 1;
    });
    return m;
  }, [monthRows]);
  const maxDow = Math.max(1, ...byDow);

  // 그 달 예약 내역 (최근순)
  const history = useMemo(
    () => [...monthRows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.startTime < b.startTime ? 1 : -1))),
    [monthRows]
  );

  /* ── 경영 지표 ─────────────────────────────────────────────
   * 금액은 두 축을 구분해서 쓴다.
   *   예약 정가(reservations.price) = 운영 규모. 환불이 안 빠져 매출로 쓰면 틀린다.
   *   정산액(payments.netVenueAmount) = 실제로 받는 돈. 사업 판단은 이쪽이 기준.
   */
  const prevKey = useMemo(() => {
    const mm = ym.m === 1 ? 12 : ym.m - 1;
    const yy = ym.m === 1 ? ym.y - 1 : ym.y;
    return `${yy}-${String(mm).padStart(2, "0")}`;
  }, [ym]);

  const today = todayKst();
  const payAll = useMemo(() => summarize(pays, today), [pays, today]);
  const payMonth = useMemo(() => summarize(filterMonth(pays, monthKey), today), [pays, monthKey, today]);
  const payPrev = useMemo(() => summarize(filterMonth(pays, prevKey), today), [pays, prevKey, today]);

  const prevRows = useMemo(
    () => filtered.filter((r) => (r.date || "").startsWith(prevKey) && ["confirmed", "done"].includes(r.status)),
    [filtered, prevKey]
  );
  const prevCount = prevRows.length;
  const prevTotal = prevRows.reduce((s, r) => s + (r.price || 0), 0);

  const avgTicket = count > 0 ? Math.round(total / count) : 0;

  // 시간대별 예약 — 공실 시간을 찾는 용도. 운영 시간대만 그린다.
  const byHour = useMemo(() => {
    const list = courtId === "all" ? courts : courts.filter((c) => c.id === courtId);
    let lo = 24;
    let hi = 0;
    list.forEach((c) => {
      Object.values(c?.hours || {}).forEach((h) => {
        if (!h || h.closed) return;
        lo = Math.min(lo, Math.floor(toMin(h.open) / 60));
        hi = Math.max(hi, Math.ceil(toMin(h.close) / 60));
      });
    });
    if (lo >= hi) return [];

    const buckets = [];
    for (let h = lo; h < hi; h += 1) buckets.push({ hour: h, count: 0 });
    monthRows.forEach((r) => {
      const s = Math.floor(toMin(r.startTime) / 60);
      const e = Math.ceil(toMin(r.endTime) / 60);
      for (let h = Math.max(lo, s); h < Math.min(hi, e); h += 1) {
        const b = buckets[h - lo];
        if (b) b.count += 1;
      }
    });
    return buckets;
  }, [courts, courtId, monthRows]);
  const maxHour = Math.max(1, ...byHour.map((b) => b.count));
  // 예약이 평균의 30% 미만인 시간대 = 공실 구간
  const hourAvg = byHour.length ? byHour.reduce((s, b) => s + b.count, 0) / byHour.length : 0;
  const coldHours = byHour.filter((b) => hourAvg > 0 && b.count < hourAvg * 0.3);

  // 코트별 — 코트 필터와 무관하게 전 코트를 비교한다
  const byCourt = useMemo(() => {
    if (courts.length < 2) return [];
    const monthAllCourts = rows.filter(
      (r) => (r.date || "").startsWith(monthKey) && ["confirmed", "done"].includes(r.status)
    );
    return courts
      .map((c) => {
        const list = monthAllCourts.filter((r) => r.courtId === c.id);
        return {
          id: c.id,
          name: c.name || "코트",
          count: list.length,
          total: list.reduce((s, r) => s + (r.price || 0), 0),
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [courts, rows, monthKey]);
  const maxCourt = Math.max(1, ...byCourt.map((c) => c.total));

  // 예약 채널 — 돈이 어디서 오는지. match=매칭 제휴, app=사용자 직접, owner=전화·수동
  const bySource = useMemo(() => {
    const acc = { match: { count: 0, total: 0 }, app: { count: 0, total: 0 }, owner: { count: 0, total: 0 } };
    monthRows.forEach((r) => {
      const key = r.matchId ? "match" : acc[r.source] ? r.source : "owner";
      acc[key].count += 1;
      acc[key].total += r.price || 0;
    });
    return [
      { key: "match", label: "매칭 제휴", ...acc.match },
      { key: "app", label: "앱 직접 예약", ...acc.app },
      { key: "owner", label: "전화·수동", ...acc.owner },
    ].filter((x) => x.count > 0);
  }, [monthRows]);

  if (ownerLoading) return <OwnerSpinner label="불러오는 중…" />;
  if (!venue || venue.status !== "approved")
    return <Page><VenueGateNotice venue={venue} refresh={refresh} /></Page>;

  return (
    <Page>
      <ScreenTitle>매출·정산</ScreenTitle>

      {/* 정산 진입점 — 실제 받을 돈은 결제 원장 기준이라 이 화면의 정가 합계와 다를 수 있다. */}
      <PayoutCard type="button" onClick={() => navigate("/owner/settlement")}>
        <div>
          <SecTitle><LuWallet size={16} /> 받을 정산금</SecTitle>
          <Money $lg>{payAll.payable.toLocaleString()}원</Money>
          <Caption>
            {(() => {
              const d = nextPayoutDate(today);
              const [, mm, dd] = String(d || "").split("-");
              return mm && dd ? `${Number(mm)}월 ${Number(dd)}일 지급 예정 · 명세 보기` : "이용이 끝난 예약의 결제분 · 자세히 보기";
            })()}
          </Caption>
        </div>
        <LuArrowRight size={20} color={C.slate400} />
      </PayoutCard>

      {courts.length > 1 && (
        <ChipRow>
          <Chip $on={courtId === "all"} onClick={() => setCourtId("all")}>전체</Chip>
          {courts.map((c) => (
            <Chip key={c.id} $on={courtId === c.id} onClick={() => setCourtId(c.id)}>{c.name}</Chip>
          ))}
        </ChipRow>
      )}

      <MonthNav>
        <NavBtn onClick={() => shiftMonth(-1)}><LuChevronLeft size={20} /></NavBtn>
        <MonthLabel>{ym.y}년 {ym.m}월</MonthLabel>
        <NavBtn onClick={() => shiftMonth(1)}><LuChevronRight size={20} /></NavBtn>
      </MonthNav>

      <KpiGrid>
        <Kpi>
          <KpiL><LuWallet size={13} /> 정산 매출</KpiL>
          <KpiV $c={C.violet600}>{payMonth.net.toLocaleString()}<small>원</small></KpiV>
          <Delta cur={payMonth.net} prev={payPrev.net} unit="원" />
          <Caption>앱 결제 {payMonth.count}건 · 이용료 뗀 실수령</Caption>
        </Kpi>
        <Kpi>
          <KpiL><LuTrendingUp size={13} /> 예약</KpiL>
          <KpiV>{count}<small>건</small></KpiV>
          <Delta cur={count} prev={prevCount} unit="건" />
          <Caption>정가 합계 {total.toLocaleString()}원</Caption>
        </Kpi>
        <Kpi>
          <KpiL><LuActivity size={13} /> 가동률</KpiL>
          <KpiV>{occupancy}<small>%</small></KpiV>
          <Caption>예약 {Math.round(bookedMin / 60)}h / 운영 {Math.round(operMin / 60)}h</Caption>
        </Kpi>
        <Kpi>
          <KpiL><LuReceipt size={13} /> 건당 평균</KpiL>
          <KpiV>{avgTicket.toLocaleString()}<small>원</small></KpiV>
          <Delta cur={avgTicket} prev={prevCount > 0 ? Math.round(prevTotal / prevCount) : 0} unit="원" />
          <Caption>예약 정가 기준</Caption>
        </Kpi>
      </KpiGrid>

      <Card>
        <SecTitle><LuActivity size={16} /> 가동률</SecTitle>
        <Row>
          <Money $lg style={{ color: C.violet600 }}>{occupancy}%</Money>
          <Caption style={{ textAlign: "right" }}>예약 {Math.round(bookedMin / 60)}시간 / 운영 {Math.round(operMin / 60)}시간</Caption>
        </Row>
        <WideBar $pct={Math.min(100, occupancy)}><i /></WideBar>
        <Caption>운영시간 대비 실제 예약된 비율이에요. 낮으면 공실 시간대에 정기대관·할인을 유도해보세요.</Caption>
      </Card>

      {/* 시간대별 — "가동률이 낮다"까지만 알려주면 손을 못 쓴다. 어느 시간이 비는지까지 짚는다. */}
      <Card>
        <SecTitle><LuClock size={16} /> 시간대별 예약</SecTitle>
        {loading ? (
          <Caption>불러오는 중…</Caption>
        ) : byHour.length === 0 ? (
          <Caption>운영 시간이 설정된 코트가 없어요.</Caption>
        ) : count === 0 ? (
          <Caption>아직 확정된 예약이 없어요.</Caption>
        ) : (
          <>
            <Bars>
              {byHour.map((b) => {
                const cold = hourAvg > 0 && b.count < hourAvg * 0.3;
                return (
                  <HourRow key={b.hour}>
                    <span style={{ fontWeight: 700, color: cold ? C.slate400 : C.slate500 }}>
                      {String(b.hour).padStart(2, "0")}시
                    </span>
                    <HourBar $pct={Math.round((b.count / maxHour) * 100)} $cold={cold}><i /></HourBar>
                    <span style={{ textAlign: "right", color: cold ? C.slate400 : C.slate800, fontWeight: 700 }}>{b.count}</span>
                  </HourRow>
                );
              })}
            </Bars>
            {coldHours.length > 0 && (
              <Caption>
                회색 구간({coldHours.map((b) => `${b.hour}시`).join(", ")})이 비어 있어요.
                이 시간대에 정기대관·시간대 할인을 걸면 가동률이 올라갑니다.
              </Caption>
            )}
          </>
        )}
      </Card>

      {byCourt.length > 0 && (
        <Card>
          <SecTitle><LuLayoutGrid size={16} /> 코트별 매출</SecTitle>
          {byCourt.every((c) => c.total === 0) ? (
            <Caption>이 달에는 확정된 예약이 없어요.</Caption>
          ) : (
            <Bars>
              {byCourt.map((c) => (
                <ListItem key={c.id} style={{ borderBottom: "none", padding: "4px 0" }}>
                  <ItemL style={{ flex: 1 }}>
                    <ItemT>{c.name}</ItemT>
                    <Bar $pct={Math.round((c.total / maxCourt) * 100)} style={{ marginTop: 5 }}><i /></Bar>
                  </ItemL>
                  <ItemL style={{ alignItems: "flex-end", flexShrink: 0, marginLeft: 10 }}>
                    <Amt>{c.total.toLocaleString()}원</Amt>
                    <ItemS>{c.count}건</ItemS>
                  </ItemL>
                </ListItem>
              ))}
            </Bars>
          )}
        </Card>
      )}

      {bySource.length > 0 && (
        <Card>
          <SecTitle><LuSplit size={16} /> 예약 채널</SecTitle>
          {bySource.map((s) => (
            <ListItem key={s.key}>
              <ItemL>
                <ItemT>{s.label}</ItemT>
                <ItemS>{s.count}건 · 전체의 {Math.round((s.count / Math.max(1, count)) * 100)}%</ItemS>
              </ItemL>
              <Amt>{s.total.toLocaleString()}원</Amt>
            </ListItem>
          ))}
          <Caption>매칭 제휴는 두 팀이 나눠 결제한 건이에요. 채널별로 어디서 예약이 들어오는지 볼 수 있어요.</Caption>
        </Card>
      )}

      <Card>
        <SecTitle><LuBan size={16} /> 취소·노쇼</SecTitle>
        <TwoCol>
          <Mini><MiniN $c={C.slate500}>{cancelCnt}</MiniN><MiniL>취소·반려</MiniL></Mini>
          <Mini><MiniN $c={C.red500}>{noshowCnt}</MiniN><MiniL>노쇼</MiniL></Mini>
        </TwoCol>
      </Card>

      <Card>
        <SecTitle><LuChartColumn size={16} /> 요일별 예약</SecTitle>
        {loading ? (
          <Caption>불러오는 중…</Caption>
        ) : count === 0 ? (
          <Caption>아직 확정된 예약이 없어요.</Caption>
        ) : (
          <Bars>
            {byDow.map((v, i) => (
              <BarRow key={i}>
                <span style={{ color: i === 0 ? C.red500 : i === 6 ? C.violet600 : C.slate500, fontWeight: 700, textAlign: "center" }}>{WEEK[i]}</span>
                <Bar $pct={Math.round((v / maxDow) * 100)}><i /></Bar>
                <span style={{ textAlign: "right", color: C.slate800, fontWeight: 700 }}>{v}건</span>
              </BarRow>
            ))}
          </Bars>
        )}
      </Card>

      <Card>
        <SecTitle><LuReceipt size={16} /> 예약 내역 {history.length > 0 && `(${history.length})`}</SecTitle>
        {loading ? (
          <Caption>불러오는 중…</Caption>
        ) : history.length === 0 ? (
          <Caption>아직 예약 내역이 없어요.</Caption>
        ) : (
          history.map((r) => (
            <ClickItem key={r.id} onClick={() => setDetail(r)}>
              <ItemL>
                <ItemT>{r.matchId ? `${r.teamAName || "팀A"} vs ${r.teamBName || "팀B"}` : (r.teamName || r.userName || "예약")}</ItemT>
                <ItemS>{r.date} {r.startTime}~{r.endTime}{r.courtName ? ` · ${r.courtName}` : ""}{r.status === "done" ? " · 사용완료" : ""}</ItemS>
              </ItemL>
              <Amt>{(r.price || 0).toLocaleString()}원</Amt>
            </ClickItem>
          ))
        )}
        {history.length > 0 && (
          <TotalRow>
            <span>{ym.m}월 이용료 합계</span>
            <b>{total.toLocaleString()}원</b>
          </TotalRow>
        )}
      </Card>

      {detail && (() => {
        const r = detail;
        const isMatch = !!r.matchId;
        return (
          <Overlay onClick={() => setDetail(null)}>
            <Sheet onClick={(e) => e.stopPropagation()}>
              <SheetTitle>예약 세부 내역 <X onClick={() => setDetail(null)}>×</X></SheetTitle>
              <DRow><span>상태</span><b>{r.status === "done" ? "이용 완료" : "예약 확정"}</b></DRow>
              <DRow><span>일시</span><b>{r.date} {r.startTime}~{r.endTime}</b></DRow>
              <DRow><span>코트</span><b>{r.courtName || "-"}</b></DRow>
              <DRow><span>이용료</span><b>{(r.price || r.splitTotal || 0).toLocaleString()}원</b></DRow>
              {isMatch ? (
                <>
                  <DRow style={{ marginTop: 2 }}><span style={{ fontWeight: 700, color: C.slate800 }}>매칭 · 두 팀</span></DRow>
                  {[
                    { name: r.teamAName || "팀A", who: r.teamAPayerName, phone: r.teamAPayerPhone },
                    { name: r.teamBName || "팀B", who: r.teamBPayerName, phone: r.teamBPayerPhone },
                  ].map((t, i) => (
                    <TeamBlock key={i}>
                      <TeamName>{t.name}</TeamName>
                      <DRow><span>대화명</span><b>{t.who || "-"}</b></DRow>
                      <DRow><span>연락처</span>{t.phone ? <a href={`tel:${t.phone}`} style={{ color: C.violet600, fontWeight: 700, textDecoration: "none" }}>{t.phone}</a> : <b style={{ color: C.slate400 }}>미등록</b>}</DRow>
                    </TeamBlock>
                  ))}
                </>
              ) : (
                <>
                  <DRow><span>팀명</span><b>{r.teamName || "-"}</b></DRow>
                  {r.userName && <DRow><span>예약자(대화명)</span><b>{r.userName}</b></DRow>}
                  <DRow><span>연락처</span>{r.phone ? <a href={`tel:${r.phone}`} style={{ color: C.violet600, fontWeight: 700, textDecoration: "none" }}>{r.phone}</a> : <b style={{ color: C.slate400 }}>미등록</b>}</DRow>
                </>
              )}
            </Sheet>
          </Overlay>
        );
      })()}
    </Page>
  );
}
