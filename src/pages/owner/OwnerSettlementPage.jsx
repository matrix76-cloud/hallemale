/* eslint-disable */
// src/pages/owner/OwnerSettlementPage.jsx
// 정산 — 실제 확정 예약 기준 수수료 분해 (P1: 정산예정액/내역, 추후 정산신청 연동)
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import { LuWallet } from "react-icons/lu";
import { useOwner } from "../../context/OwnerContext";
import { useUIActions } from "../../hooks/useUI";
import { listReservations } from "../../services/ownerVenueService";
import { Page, Card, ScreenTitle, SecTitle, Caption, PrimaryBtn, StatBadge, C } from "./components/od";
import VenueGateNotice from "./components/VenueGateNotice";
import OwnerSpinner from "./components/OwnerSpinner";
import ConfirmDialog from "./components/ConfirmDialog";
import { useConfirm } from "./components/useConfirm";

// 수수료율 (명세서 7.1 예시값 — 추후 어드민/PG 계약 요율로 교체)
const PG_RATE = 0.029;
const HM_RATE = 0.03;

const HeroCard = styled(Card)`
  background: linear-gradient(135deg, ${C.violet600}, ${C.violet700});
  border: none;
  color: #fff;
  & * { color: #fff; }
`;
const BigMoney = styled.div`font-size: 28px; font-weight: 800;`;
const Line = styled.div`display: flex; justify-content: space-between; font-size: 13px; opacity: 0.92;`;
const ListItem = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 11px 0; border-bottom: 1px solid ${C.slate200};
  &:last-child { border-bottom: none; }
`;
const ItemL = styled.div`display: flex; flex-direction: column; gap: 2px;`;
const ItemT = styled.div`font-size: 13.5px; font-weight: 700; color: ${C.slate800};`;
const ItemS = styled.div`font-size: 11.5px; color: ${C.slate500};`;

export default function OwnerSettlementPage() {
  const navigate = useNavigate();
  const { venue, loading: ownerLoading, refresh } = useOwner();
  const { showToast } = useUIActions() || {};
  const toast = (m) => { if (showToast) showToast({ message: m }); };
  const { confirmState, ask, closeConfirm } = useConfirm();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const requestSettlement = async (amount) => {
    const ok = await ask({
      title: "정산 신청",
      message: `정산 예정 금액 ${amount.toLocaleString()}원을 신청할까요?\n등록된 정산 계좌로 영업일 2일 내 입금돼요.`,
      confirmLabel: "정산 신청",
    });
    if (!ok) return;
    // PG(이노페이) 연동 전까지는 접수만 안내
    toast("정산 신청이 접수됐어요. PG 연동 후 실제 입금이 진행돼요.");
  };

  useEffect(() => {
    if (!venue?.id) return;
    setLoading(true);
    listReservations({ venueId: venue.id })
      // 정산 대상은 앱 결제분만 — 구장주 현장결제(현금·카드)는 플랫폼을 거치지 않아 제외
      .then((rs) => setRows(rs.filter((r) => ["confirmed", "done"].includes(r.status) && r.source !== "owner")))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [venue?.id]);

  const gross = rows.reduce((s, r) => s + (r.price || 0), 0);
  const pgFee = Math.round(gross * PG_RATE);
  const hmFee = Math.round(gross * HM_RATE);
  const net = gross - pgFee - hmFee;

  const recent = useMemo(
    () => [...rows].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20),
    [rows]
  );

  if (ownerLoading) return <OwnerSpinner label="불러오는 중…" />;
  if (!venue || venue.status !== "approved")
    return <Page><VenueGateNotice venue={venue} refresh={refresh} /></Page>;

  // 사업자 인증 게이트 (명세서 2.1 — 인증 전 정산 불가)
  if (venue.business?.status !== "verified") {
    return (
      <Page>
        <ScreenTitle>정산</ScreenTitle>
        <Card>
          <SecTitle>사업자 인증이 필요해요</SecTitle>
          <Caption>정산을 받으려면 먼저 사업자 인증을 완료해야 해요. '구장정보' 탭 하단에서 사업자 정보를 등록해주세요.</Caption>
          <PrimaryBtn type="button" onClick={() => navigate("/owner/venue")}>구장정보에서 인증하기</PrimaryBtn>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <ScreenTitle>정산</ScreenTitle>

      <HeroCard>
        <Caption style={{ color: "rgba(255,255,255,0.85)" }}>정산 예정 금액</Caption>
        <BigMoney>{net.toLocaleString()}원</BigMoney>
        <div style={{ height: 8 }} />
        <Line><span>결제액</span><span>{gross.toLocaleString()}원</span></Line>
        <Line><span>PG 수수료 ({(PG_RATE * 100).toFixed(1)}%)</span><span>−{pgFee.toLocaleString()}원</span></Line>
        <Line><span>할래말래 수수료 ({(HM_RATE * 100).toFixed(0)}%)</span><span>−{hmFee.toLocaleString()}원</span></Line>
      </HeroCard>

      <PrimaryBtn type="button" disabled={net <= 0} onClick={() => requestSettlement(net)}>
        정산 신청 (영업일 2일 내 입금)
      </PrimaryBtn>
      <Caption>※ 카드결제(PG)·정산 신청은 이노페이 연동 후 활성화돼요. 앱 결제분만 정산 대상이며, 현장결제(현금·카드)는 매출분석에만 반영돼요.</Caption>

      <Card>
        <SecTitle><LuWallet size={16} /> 결제·정산 내역</SecTitle>
        {loading ? (
          <Caption>불러오는 중…</Caption>
        ) : recent.length === 0 ? (
          <Caption>아직 정산 내역이 없어요.</Caption>
        ) : (
          recent.map((r) => (
            <ListItem key={r.id}>
              <ItemL>
                <ItemT>{r.teamName || r.userName || "예약"}</ItemT>
                <ItemS>{r.date} {r.startTime}~{r.endTime}{r.courtName ? ` · ${r.courtName}` : ""}</ItemS>
              </ItemL>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                <span style={{ fontWeight: 800, color: C.slate800, fontSize: 14 }}>{(r.price || 0).toLocaleString()}원</span>
                <StatBadge $tone={r.status === "done" ? "done" : "confirmed"}>{r.status === "done" ? "완료" : "확정"}</StatBadge>
              </div>
            </ListItem>
          ))
        )}
      </Card>

      <ConfirmDialog state={confirmState} onConfirm={() => closeConfirm(true)} onCancel={() => closeConfirm(false)} />
    </Page>
  );
}
