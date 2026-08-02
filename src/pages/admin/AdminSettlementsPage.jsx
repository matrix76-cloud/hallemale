/* eslint-disable */
// src/pages/admin/AdminSettlementsPage.jsx
// 결제 정산 관리 — 구장별 지급액 집계 + 지급 완료 처리.
// 집계 기준은 결제 원장(payments)의 netVenueAmount 다 — 예약 정가로 더하면 환불분이 빠지지 않아
// 구장주에게 과지급된다(구장주 앱의 정산 화면과도 금액이 어긋난다).
import { showAlert, showConfirm } from "../../utils/appDialog";
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import AdminLoading from "../../components/admin/AdminLoading";
import {
  listPayments, groupByVenue, calcSettlement,
  markPaymentSettled, markManySettled,
} from "../../services/settlementService";

const PAGE_SIZE = 8;
const won = (n) => `${(Number(n) || 0).toLocaleString()}원`;
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function periodRange(key) {
  const now = new Date();
  if (key === "this") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: ymd(from), to: ymd(to) };
  }
  if (key === "last") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: ymd(from), to: ymd(to) };
  }
  return { from: "", to: "" }; // all
}

const PERIODS = [
  { key: "this", label: "이번 달" },
  { key: "last", label: "지난 달" },
  { key: "all", label: "전체" },
];

export default function AdminSettlementsPage() {
  const [period, setPeriod] = useState("this");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null); // 선택한 구장 그룹
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [period]);

  const load = async () => {
    setLoading(true);
    try {
      const { from, to } = periodRange(period);
      const data = await listPayments({ from, to });
      setRows(data);
    } catch (e) {
      console.error("[AdminSettlements] load failed", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [period]);

  const groups = useMemo(() => groupByVenue(rows), [rows]);
  const pageCount = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const pagedGroups = groups.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const summary = useMemo(() => {
    // gross = 구장주에게 줄 돈(환불 반영), platformFee = 회사 몫. 둘은 별개 주머니라 빼지 않는다.
    const gross = rows.reduce((s, r) => s + r.netVenueAmount, 0);
    const platformFee = rows.reduce((s, r) => s + r.platformFee, 0);
    const refunded = rows.reduce((s, r) => s + r.refundedVenueAmount, 0);
    const settledNet = rows.filter((r) => r.settled).reduce((s, r) => s + r.netVenueAmount, 0);
    return { gross, platformFee, refunded, settledNet, pendingNet: gross - settledNet };
  }, [rows]);

  // detail 모달을 최신 groups 로 동기화
  const detailGroup = useMemo(() => {
    if (!detail) return null;
    return groups.find((g) => (g.venueId || g.venueName) === (detail.venueId || detail.venueName)) || detail;
  }, [groups, detail]);

  const settleVenue = async (g) => {
    const pending = g.items.filter((r) => !r.settled);
    if (!pending.length) return showAlert("지급할 건이 없습니다.");
    const amount = pending.reduce((s, r) => s + r.netVenueAmount, 0);
    if (!await showConfirm(`"${g.venueName}" 미지급 ${pending.length}건을 지급 완료 처리할까요?\n지급액: ${won(amount)}\n\n실제 이체는 별도로 해야 합니다 — 이 버튼은 장부 표시만 바꿉니다.`)) return;
    setBusy(true);
    try { await markManySettled(pending.map((r) => r.id), true); await load(); }
    catch (e) { showAlert(e?.message || "지급 처리 실패"); }
    finally { setBusy(false); }
  };

  const toggleOne = async (r) => {
    // 지급대행이 채운 건(payoutId)은 장부가 서버 소관이라 손으로 되돌리지 않는다.
    if (r.payoutId) return showAlert("지급대행으로 이미 송금된 건이라 변경할 수 없습니다.");
    setBusy(true);
    try { await markPaymentSettled(r.id, !r.settled); await load(); }
    catch (e) { showAlert(e?.message || "처리 실패"); }
    finally { setBusy(false); }
  };

  return (
    <Page>
      <HeaderRow>
        <div>
          <Title>결제 정산 관리</Title>
          <Sub>결제 원장 기준 · 지급액은 환불분을 뺀 금액(netVenueAmount)입니다. 플랫폼 이용료는 손님 결제액에서 떼며, 구장 지급액은 그만큼 줄어 있습니다.</Sub>
        </div>
        <FilterRow>
          {PERIODS.map((p) => (
            <Chip key={p.key} $on={period === p.key} onClick={() => setPeriod(p.key)}>{p.label}</Chip>
          ))}
        </FilterRow>
      </HeaderRow>

      <Cards>
        <StatCard><CardLabel>구장 지급 대상</CardLabel><CardVal>{won(summary.gross)}</CardVal></StatCard>
        <StatCard><CardLabel>플랫폼 이용료(회사 몫)</CardLabel><CardVal $muted>{won(summary.platformFee)}</CardVal></StatCard>
        <StatCard><CardLabel>미지급액</CardLabel><CardVal $accent>{won(summary.pendingNet)}</CardVal></StatCard>
        <StatCard><CardLabel>지급 완료액</CardLabel><CardVal $done>{won(summary.settledNet)}</CardVal></StatCard>
      </Cards>

      <Card>
        {loading ? (
          <AdminLoading />
        ) : groups.length === 0 ? (
          <EmptyText>해당 기간에 결제 건이 없습니다.</EmptyText>
        ) : (
          <Table>
            <HeadRow>
              <Hide>No.</Hide>
              <span>구장명</span>
              <span>건수</span>
              <Hide>환불분</Hide>
              <Hide>이용료</Hide>
              <span>지급액</span>
              <span>상태</span>
              <span>관리</span>
            </HeadRow>
            {pagedGroups.map((g, i) => (
              <Rowi key={g.venueId || g.venueName}>
                <Hide><Idx>{page * PAGE_SIZE + i + 1}</Idx></Hide>
                <Nm>{g.venueName}</Nm>
                <span>{g.count}건</span>
                <Hide style={{ color: "#9ca3af" }}>{g.refunded > 0 ? `-${won(g.refunded)}` : "-"}</Hide>
                <Hide style={{ color: "#9ca3af" }}>{won(g.platformFee)}</Hide>
                <Strong>{won(g.net)}</Strong>
                <span>
                  {g.fullySettled
                    ? <Badge $done>지급완료</Badge>
                    : <Badge>대기 {g.pendingCount}</Badge>}
                </span>
                <Actions>
                  <SBtn onClick={() => setDetail(g)}>상세</SBtn>
                  {!g.fullySettled && <SBtn $primary onClick={() => settleVenue(g)} disabled={busy}>지급처리</SBtn>}
                </Actions>
              </Rowi>
            ))}
          </Table>
        )}

        {!loading && groups.length > 0 && (
          <Pager>
            <PageNum onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>‹</PageNum>
            {Array.from({ length: pageCount }, (_, i) => (
              <PageNum key={i} $on={i === page} onClick={() => setPage(i)}>{i + 1}</PageNum>
            ))}
            <PageNum onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>›</PageNum>
          </Pager>
        )}
      </Card>

      {detailGroup && (
        <Overlay onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalHead>
              <ModalTitle>{detailGroup.venueName} · 정산 상세</ModalTitle>
              <Close type="button" onClick={() => setDetail(null)}>×</Close>
            </ModalHead>

            <SumRow>
              <SumItem><b>{detailGroup.count}건</b><span>결제</span></SumItem>
              <SumItem><b style={{ color: "#9ca3af" }}>{detailGroup.refunded > 0 ? `-${won(detailGroup.refunded)}` : "-"}</b><span>환불분</span></SumItem>
              <SumItem><b style={{ color: "#9ca3af" }}>{won(detailGroup.platformFee)}</b><span>이용료</span></SumItem>
              <SumItem><b style={{ color: "#4f46e5" }}>{won(detailGroup.net)}</b><span>지급액</span></SumItem>
            </SumRow>

            {!detailGroup.fullySettled && (
              <PrimaryWide onClick={() => settleVenue(detailGroup)} disabled={busy}>
                미지급 {detailGroup.pendingCount}건 일괄 지급완료
              </PrimaryWide>
            )}

            <ResList>
              <ResHead>
                <span>이용일</span>
                <Hide>결제수단</Hide>
                <span>지급액</span>
                <span>지급</span>
              </ResHead>
              {detailGroup.items.map((r) => (
                <ResRow key={r.id}>
                  <div>
                    <ResDate>{r.date || "-"}</ResDate>
                    {/* 분담결제는 한 예약에 결제가 2건(A/B) 붙는다 — 어느 쪽인지 보여야 구분된다 */}
                    <ResTime>{r.side && r.side !== "SINGLE" ? `분담 ${r.side}` : "단독"}{r.refundedVenueAmount > 0 ? ` · 환불 -${won(r.refundedVenueAmount)}` : ""}</ResTime>
                  </div>
                  <Hide>{r.method || "-"}</Hide>
                  <ResPrice>{won(r.netVenueAmount)}</ResPrice>
                  <span>
                    <Mini $on={r.settled} onClick={() => toggleOne(r)} disabled={busy}>
                      {r.payoutId ? "송금됨" : r.settled ? "완료" : "대기"}
                    </Mini>
                  </span>
                </ResRow>
              ))}
            </ResList>
          </Modal>
        </Overlay>
      )}
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
const Cards = styled.div`display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; @media (max-width: 760px) { grid-template-columns: repeat(2, 1fr); }`;
const StatCard = styled.div`
  background: ${({ theme }) => theme?.colors?.card || "#fff"};
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  border-radius: 10px; padding: 14px 16px;
`;
const CardLabel = styled.div`font-size: 12px; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"}; margin-bottom: 6px;`;
const CardVal = styled.div`
  font-size: 20px; font-weight: 800; letter-spacing: -0.02em;
  color: ${({ $muted, $accent, $done }) => ($muted ? "#9ca3af" : $accent ? "#4f46e5" : $done ? "#059669" : "#111827")};
`;
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
const HeadRow = styled.div`
  display: grid; grid-template-columns: 44px 1fr 60px 110px 110px 120px 92px 150px; gap: 10px; align-items: center;
  padding: 0 8px 10px; border-bottom: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  font-size: 11.5px; font-weight: 700; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"};
  @media (max-width: 860px) { grid-template-columns: 1fr 50px 110px 80px 130px; }
`;
const Rowi = styled.div`
  display: grid; grid-template-columns: 44px 1fr 60px 110px 110px 120px 92px 150px; gap: 10px; align-items: center;
  padding: 12px 8px; border-bottom: 1px solid ${({ theme }) => theme?.colors?.divider || "#f1f5f9"}; font-size: 13px;
  @media (max-width: 860px) { grid-template-columns: 1fr 50px 110px 80px 130px; }
`;
const Nm = styled.div`font-weight: 700; color: ${({ theme }) => theme?.colors?.textStrong || "#111827"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Idx = styled.span`font-size: 12.5px; font-weight: 700; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"};`;
const Strong = styled.div`font-weight: 800; color: #4f46e5;`;
const Hide = styled.span`@media (max-width: 860px) { display: none; }`;
const Badge = styled.span`
  display: inline-flex; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 700;
  background: ${({ $done }) => ($done ? "#dcfce7" : "#fef3c7")}; color: ${({ $done }) => ($done ? "#15803d" : "#a16207")};
`;
const Actions = styled.div`display: flex; gap: 6px; flex-wrap: wrap;`;
const SBtn = styled.button`
  height: 30px; padding: 0 10px; border-radius: 7px; font-size: 12px; font-weight: 700; cursor: pointer;
  border: 1px solid ${({ $primary }) => ($primary ? "transparent" : "#e5e7eb")};
  background: ${({ $primary, theme }) => ($primary ? (theme?.colors?.primary || "#4f46e5") : (theme?.colors?.card || "#fff"))};
  color: ${({ $primary }) => ($primary ? "#fff" : "#374151")};
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

/* modal */
const Overlay = styled.div`position: fixed; inset: 0; z-index: 99999; background: rgba(15,23,42,0.45); display: grid; place-items: center; padding: 16px; overflow-y: auto;`;
const Modal = styled.div`width: min(640px, 96vw); max-height: calc(100vh - 32px); overflow-y: auto; background: ${({ theme }) => theme?.colors?.card || "#fff"}; border-radius: 12px; border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"}; padding: 18px;`;
const ModalHead = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px;`;
const ModalTitle = styled.div`font-size: 16px; font-weight: 800; color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};`;
const Close = styled.button`width: 32px; height: 32px; border-radius: 999px; border: 1px solid #e5e7eb; background: transparent; font-size: 18px; cursor: pointer; color: #4b5563;`;
const SumRow = styled.div`display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px;`;
const SumItem = styled.div`
  border: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"}; border-radius: 8px; padding: 10px; text-align: center;
  & > b { display: block; font-size: 15px; font-weight: 800; color: #111827; }
  & > span { font-size: 11px; color: #9ca3af; }
`;
const PrimaryWide = styled.button`
  width: 100%; height: 42px; border-radius: 10px; border: none; cursor: pointer; margin-bottom: 14px;
  background: ${({ theme }) => theme?.colors?.primary || "#4f46e5"}; color: #fff; font-size: 14px; font-weight: 700;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;
const ResList = styled.div`display: flex; flex-direction: column;`;
const ResHead = styled.div`display: grid; grid-template-columns: 1fr 100px 90px 60px; gap: 8px; padding: 0 4px 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 700; color: #9ca3af; @media (max-width: 560px){ grid-template-columns: 1fr 90px 60px; }`;
const ResRow = styled.div`display: grid; grid-template-columns: 1fr 100px 90px 60px; gap: 8px; align-items: center; padding: 10px 4px; border-bottom: 1px solid #f1f5f9; font-size: 13px; @media (max-width: 560px){ grid-template-columns: 1fr 90px 60px; }`;
const ResDate = styled.div`font-weight: 700; color: #111827;`;
const ResTime = styled.div`font-size: 11.5px; color: #9ca3af;`;
const ResPrice = styled.div`font-weight: 700; color: #111827;`;
const Mini = styled.button`
  height: 26px; padding: 0 8px; border-radius: 6px; font-size: 11.5px; font-weight: 700; cursor: pointer;
  border: 1px solid ${({ $on }) => ($on ? "#bbf7d0" : "#fde68a")};
  background: ${({ $on }) => ($on ? "#dcfce7" : "#fffbeb")}; color: ${({ $on }) => ($on ? "#15803d" : "#a16207")};
  &:disabled { opacity: 0.5; }
`;
