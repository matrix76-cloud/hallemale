/* eslint-disable */
// src/pages/owner/OwnerSettlementPage.jsx
// 정산 — 앱에서 결제된 구장 이용료를 언제 얼마 받는지.
//
// 집계는 결제 원장(payments) 기준이다. 예약 문서의 price 로 집계하면 환불·부분취소가
// 반영되지 않아 장부가 어긋난다(ownerSettlementService 주석 참고).
//
// 수수료: 총액 표시 모델이라 손님 결제액에서 플랫폼 이용료를 떼고 남은 몫(netVenueAmount)이
// 정산액이다. 이 화면 숫자는 전부 "떼고 남은 금액" 이므로 따로 차감 표시를 하지 않는다.
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { LuWallet, LuChevronLeft, LuChevronRight, LuLandmark } from "react-icons/lu";
import { useOwner } from "../../context/OwnerContext";
import { listOwnerPayments, summarize, filterMonth, todayKst } from "../../services/ownerSettlementService";
import { Page, Card, ScreenTitle, SecTitle, Caption, Money, PrimaryBtn, StatBadge, C } from "./components/od";
import VenueGateNotice from "./components/VenueGateNotice";
import OwnerSpinner from "./components/OwnerSpinner";
import { PLATFORM_FEE_LABEL } from "../../constants/payments";

const won = (v) => `${Number(v || 0).toLocaleString()}원`;

const MonthNav = styled.div`display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid ${C.slate200};border-radius:14px;padding:8px 6px;`;
const NavBtn = styled.button`border:none;background:transparent;color:${C.slate500};cursor:pointer;display:flex;padding:6px;`;
const MonthLabel = styled.div`font-size:15px;font-weight:800;color:${C.slate800};`;
const Line = styled.div`display:flex;justify-content:space-between;align-items:center;font-size:13.5px;color:${C.slate500};& > b{color:${C.slate800};font-weight:700;}`;
const ListItem = styled.div`display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 0;border-bottom:1px solid ${C.slate200};&:last-child{border-bottom:none;}`;
const ItemL = styled.div`display:flex;flex-direction:column;gap:2px;min-width:0;`;
const ItemT = styled.div`font-size:13.5px;font-weight:700;color:${C.slate800};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
const ItemS = styled.div`font-size:11.5px;color:${C.slate500};`;
const Amt = styled.div`font-size:14px;font-weight:800;color:${({ $off }) => ($off ? C.slate400 : C.slate800)};flex-shrink:0;text-decoration:${({ $off }) => ($off ? "line-through" : "none")};`;

export default function OwnerSettlementPage() {
  const navigate = useNavigate();
  const { uid, venue, loading: ownerLoading, refresh } = useOwner();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const now = useMemo(() => new Date(), []);
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });

  const shiftMonth = (d) => setYm(({ y, m }) => {
    let mm = m + d, yy = y;
    if (mm < 1) { mm = 12; yy -= 1; }
    if (mm > 12) { mm = 1; yy += 1; }
    return { y: yy, m: mm };
  });

  useEffect(() => {
    if (!uid || !venue?.id) return;
    setLoading(true);
    listOwnerPayments(uid, { venueId: venue.id })
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [uid, venue?.id]);

  const monthKey = `${ym.y}-${String(ym.m).padStart(2, "0")}`;
  const monthRows = useMemo(() => filterMonth(rows, monthKey), [rows, monthKey]);
  // 받을 돈은 월과 무관하게 "아직 안 받은 전부"를 보여준다 — 월별로 쪼개면 실제 입금액과 안 맞는다.
  const all = useMemo(() => summarize(rows), [rows]);
  const month = useMemo(() => summarize(monthRows), [monthRows]);
  const today = todayKst();

  if (ownerLoading) return <OwnerSpinner label="불러오는 중…" />;
  if (!venue || venue.status !== "approved")
    return <Page><VenueGateNotice venue={venue} refresh={refresh} /></Page>;

  const acct = venue.settlement || {};
  const hasAcct = !!(acct.bank && acct.account);

  return (
    <Page>
      <ScreenTitle>정산</ScreenTitle>

      {!hasAcct && (
        <Card>
          <SecTitle><LuLandmark size={16} /> 정산 계좌를 등록해주세요</SecTitle>
          <Caption>계좌가 없으면 정산금을 보내드릴 수 없어요. 구장정보 탭에서 등록해주세요.</Caption>
          <PrimaryBtn type="button" onClick={() => navigate("/owner/venue")}>구장정보에서 등록하기</PrimaryBtn>
        </Card>
      )}

      <Card>
        <SecTitle><LuWallet size={16} /> 받을 정산금</SecTitle>
        <Money $lg>{won(all.payable)}</Money>
        <Caption>이용이 끝난 예약의 결제분이에요. 경기가 끝난 뒤 정산해요.</Caption>
        {all.upcoming > 0 && (
          <>
            <div style={{ height: 6 }} />
            <Line><span>이용 예정 (아직 정산 대상 아님)</span><b>{won(all.upcoming)}</b></Line>
          </>
        )}
        {all.paid > 0 && <Line><span>지급 완료 누적</span><b>{won(all.paid)}</b></Line>}
      </Card>

      <MonthNav>
        <NavBtn onClick={() => shiftMonth(-1)}><LuChevronLeft size={20} /></NavBtn>
        <MonthLabel>{ym.y}년 {ym.m}월</MonthLabel>
        <NavBtn onClick={() => shiftMonth(1)}><LuChevronRight size={20} /></NavBtn>
      </MonthNav>

      <Card>
        <SecTitle>{ym.m}월 앱 결제 매출</SecTitle>
        <Money $lg>{won(month.gross)}</Money>
        <Caption>
          결제 {month.count}건 · 플랫폼 이용료 {PLATFORM_FEE_LABEL}를 뺀 실지급액이에요
          {month.refunded > 0 ? ` · 환불 ${won(month.refunded)} 차감됨` : ""}
        </Caption>
      </Card>

      <Card>
        <SecTitle>{ym.m}월 결제 내역</SecTitle>
        {loading ? (
          <Caption>불러오는 중…</Caption>
        ) : monthRows.length === 0 ? (
          <Caption>이 달에는 앱으로 결제된 예약이 없어요.</Caption>
        ) : (
          monthRows.map((r) => {
            const dead = r.netVenueAmount <= 0;
            return (
              <ListItem key={r.id}>
                <ItemL>
                  <ItemT>{r.venueName || "예약"}{r.matchId ? " · 매칭" : ""}{r.side === "A" || r.side === "B" ? ` (${r.side}팀 몫)` : ""}</ItemT>
                  <ItemS>{r.date}</ItemS>
                </ItemL>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                  <Amt $off={dead}>{won(dead ? r.venueAmount : r.netVenueAmount)}</Amt>
                  <StatBadge $tone={dead ? "refund" : r.payoutId ? "done" : r.date >= today ? "pending" : "confirmed"}>
                    {dead ? "환불" : r.payoutId ? "지급완료" : r.date >= today ? "이용예정" : "정산대기"}
                  </StatBadge>
                </div>
              </ListItem>
            );
          })
        )}
      </Card>

      <Caption>
        정산금은 등록하신 계좌로 지급해요. 이용이 끝난 예약만 정산 대상이며, 이용 전 취소·환불된 건은 자동으로 빠져요.
      </Caption>
    </Page>
  );
}
