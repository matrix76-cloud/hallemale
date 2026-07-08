/* eslint-disable */
// src/pages/owner/OwnerSalesPage.jsx
// 예약통계 — 확정·완료 예약 기준. 예약 전용(현장 정산) 전환으로 '매출' 대신 예약 건수 중심.
// 금액은 '예상 이용료(참고·현장 정산)'로만 표기 — 앱이 대금을 수금하지 않음.
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { LuChartColumn, LuTrendingUp, LuReceipt, LuChevronLeft, LuChevronRight, LuActivity, LuBan } from "react-icons/lu";
import { useOwner } from "../../context/OwnerContext";
import { listReservations, dowToKey } from "../../services/ownerVenueService";
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

const Row = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 10px;`;
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

export default function OwnerSalesPage() {
  const { venue, loading: ownerLoading, refresh } = useOwner();
  const courts = venue?.courts || [];
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

  if (ownerLoading) return <OwnerSpinner label="불러오는 중…" />;
  if (!venue || venue.status !== "approved")
    return <Page><VenueGateNotice venue={venue} refresh={refresh} /></Page>;

  return (
    <Page>
      <ScreenTitle>예약통계</ScreenTitle>

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

      <Card>
        <SecTitle><LuTrendingUp size={16} /> {ym.y}년 {ym.m}월 예약</SecTitle>
        <Money $lg>{count}건</Money>
        <Caption>확정·완료 예약 · 예상 이용료 {total.toLocaleString()}원 (참고·현장 정산)</Caption>
      </Card>

      <Card>
        <SecTitle><LuActivity size={16} /> 가동률</SecTitle>
        <Row>
          <Money $lg style={{ color: C.violet600 }}>{occupancy}%</Money>
          <Caption style={{ textAlign: "right" }}>예약 {Math.round(bookedMin / 60)}시간 / 운영 {Math.round(operMin / 60)}시간</Caption>
        </Row>
        <WideBar $pct={Math.min(100, occupancy)}><i /></WideBar>
        <Caption>운영시간 대비 실제 예약된 비율이에요. 낮으면 공실 시간대에 정기대관·할인을 유도해보세요.</Caption>
      </Card>

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
            <span>{ym.m}월 예상 이용료</span>
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
              <DRow><span>이용료</span><b>{(r.price || r.splitTotal || 0).toLocaleString()}원 (현장 정산)</b></DRow>
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
