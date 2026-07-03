/* eslint-disable */
// src/pages/admin/AdminRefundsPage.jsx
// 환불 관리 — 결제 완료된 예약을 취소/환불(피지 복구)하고 환불 내역을 관리.
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import {
  listRefundableReservations, listRefundedReservations, processRefund,
} from "../../services/refundService";

const PAGE_SIZE = 10;
const won = (n) => `${(Number(n) || 0).toLocaleString()}원`;
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDT = (d) => (d ? `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}` : "-");

function periodRange(key) {
  const now = new Date();
  if (key === "this") {
    return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  }
  if (key === "last") {
    return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)) };
  }
  return { from: "", to: "" };
}
const PERIODS = [
  { key: "this", label: "이번 달" },
  { key: "last", label: "지난 달" },
  { key: "all", label: "전체" },
];
const TABS = [
  { key: "refundable", label: "환불 가능" },
  { key: "refunded", label: "환불 완료" },
];

export default function AdminRefundsPage() {
  const [tab, setTab] = useState("refundable");
  const [period, setPeriod] = useState("this");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [tab, period]);

  const load = async () => {
    setLoading(true);
    try {
      const { from, to } = periodRange(period);
      const data = tab === "refundable"
        ? await listRefundableReservations({ from, to })
        : await listRefundedReservations({ from, to });
      setRows(data);
    } catch (e) {
      console.error("[AdminRefunds] load failed", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab, period]);

  const summary = useMemo(() => {
    const count = rows.length;
    const amount = rows.reduce((s, r) => s + (tab === "refunded" ? r.refundAmount : r.price), 0);
    return { count, amount };
  }, [rows, tab]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const doRefund = async (r) => {
    const input = window.prompt(
      `"${r.venueName}" 예약 환불액을 입력하세요.\n결제액: ${won(r.price)} (전액 환불은 그대로 확인)`,
      String(r.price)
    );
    if (input === null) return;
    const amount = Number(String(input).replace(/[^0-9]/g, ""));
    if (!amount || amount <= 0) return showAlert("환불액이 올바르지 않습니다.");
    if (amount > r.price) return showAlert("환불액이 결제액보다 클 수 없습니다.");
    const reason = window.prompt("환불 사유 (선택, 비워도 됨):", "") || "";
    if (!await showConfirm(`${r.userName || "이용자"} 님에게 ${won(amount)}을 환불(피지 복구)하고 예약을 취소할까요?`)) return;

    setBusy(true);
    try {
      await processRefund(r, amount, reason);
      showAlert("환불 처리 완료 — 피지가 복구되고 예약이 취소되었습니다.");
      await load();
    } catch (e) {
      showAlert(e?.message || "환불 처리 실패");
    } finally { setBusy(false); }
  };

  return (
    <Page>
      <HeaderRow>
        <div>
          <Title>환불 관리</Title>
          <Sub>결제 완료된 예약을 환불(피지 복구)하고 예약을 취소합니다. 환불 내역은 '환불 완료'에서 확인.</Sub>
        </div>
        <FilterRow>
          {PERIODS.map((p) => (
            <Chip key={p.key} $on={period === p.key} onClick={() => setPeriod(p.key)}>{p.label}</Chip>
          ))}
        </FilterRow>
      </HeaderRow>

      <Tabs>
        {TABS.map((t) => (
          <Tab key={t.key} $on={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</Tab>
        ))}
      </Tabs>

      <Cards>
        <StatCard><CardLabel>{tab === "refunded" ? "환불 완료 건수" : "환불 가능 건수"}</CardLabel><CardVal>{summary.count}건</CardVal></StatCard>
        <StatCard><CardLabel>{tab === "refunded" ? "환불 완료 금액" : "환불 가능 금액"}</CardLabel><CardVal $accent={tab === "refunded"}>{won(summary.amount)}</CardVal></StatCard>
      </Cards>

      <Card>
        {loading ? (
          <AdminLoading />
        ) : rows.length === 0 ? (
          <EmptyText>{tab === "refundable" ? "환불 가능한 결제 예약이 없습니다." : "환불 내역이 없습니다."}</EmptyText>
        ) : (
          <Table>
            <HeadRow $refunded={tab === "refunded"}>
              <Hide>No.</Hide>
              <span>구장 / 코트</span>
              <span>예약일시</span>
              <Hide>이용자</Hide>
              <span>{tab === "refunded" ? "환불액" : "결제액"}</span>
              {tab === "refunded" ? <Hide>환불일</Hide> : <span>관리</span>}
            </HeadRow>
            {pagedRows.map((r, i) => (
              <Rowi key={r.id} $refunded={tab === "refunded"}>
                <Hide><Idx>{page * PAGE_SIZE + i + 1}</Idx></Hide>
                <NameCell>
                  <Nm>{r.venueName}</Nm>
                  <Sub2>{r.courtName}{r.teamName ? ` · ${r.teamName}` : ""}</Sub2>
                </NameCell>
                <span>{r.date}<TimeS>{r.startTime ? ` ${r.startTime}~${r.endTime}` : ""}</TimeS></span>
                <Hide>{r.userName || "-"}{r.phone ? <PhoneS>{r.phone}</PhoneS> : null}</Hide>
                <Strong $danger={tab === "refunded"}>{won(tab === "refunded" ? r.refundAmount : r.price)}</Strong>
                {tab === "refunded" ? (
                  <Hide>
                    <RefDate>{fmtDT(r.refundedAt)}</RefDate>
                    {r.refundReason ? <RefReason>{r.refundReason}</RefReason> : null}
                  </Hide>
                ) : (
                  <Actions>
                    <SBtn $danger onClick={() => doRefund(r)} disabled={busy}>환불 처리</SBtn>
                  </Actions>
                )}
              </Rowi>
            ))}
          </Table>
        )}

        {!loading && rows.length > 0 && (
          <Pager>
            <PageNum onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>‹</PageNum>
            {Array.from({ length: pageCount }, (_, i) => (
              <PageNum key={i} $on={i === page} onClick={() => setPage(i)}>{i + 1}</PageNum>
            ))}
            <PageNum onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>›</PageNum>
          </Pager>
        )}
      </Card>
    </Page>
  );
}

/* ───────────── styles ───────────── */
const Page = styled.div`display: flex; flex-direction: column; gap: 16px;`;
const HeaderRow = styled.div`display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap;`;
const Title = styled.h1`margin: 0; font-size: 18px; font-weight: 700; color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};`;
const Sub = styled.div`font-size: 12px; color: ${({ theme }) => theme?.colors?.textNormal || "#4b5563"}; margin-top: 4px;`;
const FilterRow = styled.div`display: flex; gap: 8px; flex-wrap: wrap;`;
const Chip = styled.button`
  height: 32px; padding: 0 14px; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 600;
  border: 1px solid ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : (theme?.colors?.border || "#e5e7eb"))};
  background: ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : "transparent")};
  color: ${({ $on }) => ($on ? "#fff" : "#4b5563")};
`;
const Tabs = styled.div`display: flex; gap: 6px; border-bottom: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};`;
const Tab = styled.button`
  height: 40px; padding: 0 18px; border: none; background: transparent; cursor: pointer;
  font-size: 14px; font-weight: 700; position: relative;
  color: ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : (theme?.colors?.textWeak || "#9ca3af"))};
  &::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px;
    background: ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : "transparent")}; }
`;
const Cards = styled.div`display: grid; grid-template-columns: repeat(2, minmax(0, 240px)); gap: 12px;`;
const StatCard = styled.div`
  background: ${({ theme }) => theme?.colors?.card || "#fff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"}; border-radius: 10px; padding: 14px 16px;
`;
const CardLabel = styled.div`font-size: 12px; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"}; margin-bottom: 6px;`;
const CardVal = styled.div`font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: ${({ $accent }) => ($accent ? "#b91c1c" : "#111827")};`;
const Card = styled.section`background: ${({ theme }) => theme?.colors?.card || "#fff"}; border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"}; border-radius: 10px; padding: 14px;`;
const EmptyText = styled.div`padding: 28px 0; text-align: center; font-size: 13px; color: #4b5563;`;
const Pager = styled.div`display: flex; justify-content: center; gap: 6px; margin-top: 14px;`;
const PageNum = styled.button`
  min-width: 32px; height: 32px; border-radius: 7px; cursor: pointer; font-size: 13px; font-weight: 600;
  border: 1px solid ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : (theme?.colors?.border || "#e5e7eb"))};
  background: ${({ $on, theme }) => ($on ? (theme?.colors?.primary || "#4f46e5") : "transparent")};
  color: ${({ $on }) => ($on ? "#fff" : "#4b5563")};
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const Table = styled.div`width: 100%; display: flex; flex-direction: column;`;
const cols = (refunded) => (refunded
  ? "44px 1fr 150px 120px 110px 180px"
  : "44px 1fr 150px 120px 110px 110px");
const HeadRow = styled.div`
  display: grid; grid-template-columns: ${({ $refunded }) => cols($refunded)}; gap: 10px; align-items: center;
  padding: 0 8px 10px; border-bottom: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  font-size: 11.5px; font-weight: 700; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"};
  @media (max-width: 860px) { grid-template-columns: 1fr 110px 100px; }
`;
const Rowi = styled.div`
  display: grid; grid-template-columns: ${({ $refunded }) => cols($refunded)}; gap: 10px; align-items: center;
  padding: 11px 8px; border-bottom: 1px solid ${({ theme }) => theme?.colors?.divider || "#f1f5f9"}; font-size: 13px;
  @media (max-width: 860px) { grid-template-columns: 1fr 110px 100px; }
`;
const NameCell = styled.div`min-width: 0;`;
const Idx = styled.span`font-size: 12.5px; font-weight: 700; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"};`;
const Nm = styled.div`font-weight: 700; color: ${({ theme }) => theme?.colors?.textStrong || "#111827"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Sub2 = styled.div`font-size: 11.5px; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const TimeS = styled.span`color: #9ca3af; font-size: 11.5px;`;
const PhoneS = styled.div`font-size: 11px; color: #9ca3af;`;
const Strong = styled.div`font-weight: 800; color: ${({ $danger }) => ($danger ? "#b91c1c" : "#111827")};`;
const Hide = styled.span`@media (max-width: 860px) { display: none; }`;
const RefDate = styled.div`font-size: 12px; color: #4b5563;`;
const RefReason = styled.div`font-size: 11px; color: #9ca3af; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Actions = styled.div`display: flex; gap: 6px;`;
const SBtn = styled.button`
  height: 30px; padding: 0 12px; border-radius: 7px; font-size: 12px; font-weight: 700; cursor: pointer;
  border: 1px solid ${({ $danger }) => ($danger ? "#fecaca" : "#e5e7eb")};
  background: ${({ $danger }) => ($danger ? "#fef2f2" : "#fff")};
  color: ${({ $danger }) => ($danger ? "#b91c1c" : "#374151")};
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;
