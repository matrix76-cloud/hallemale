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
import {
  fetchBalance, requestPayout, getSellerStatus, registerSeller, syncSeller,
  SELLER_STATUS_LABEL, canPayout, PAYOUTS_DISABLED,
} from "../../services/payoutService";
import {
  buildInvoiceTargets, listTaxInvoices, upsertDraft, markIssued,
  buildTaxInvoiceCsv, exportCsv, issuableCheck, TAX_INVOICE_STATUS_LABEL, invoiceId,
} from "../../services/taxInvoiceService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../services/firebase";

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

  // 지급대행 — PG 계약이 선행조건이라 아직 안 열려 있을 수 있다.
  // "오류"와 "아직 안 열림"은 다르게 보여줘야 한다(전자는 고칠 것이 있고, 후자는 기다릴 것이다).
  const [payoutInfo, setPayoutInfo] = useState({ enabled: false, available: 0, error: "" });
  const [sellers, setSellers] = useState({});      // venueId → 셀러 상태
  const [invoices, setInvoices] = useState([]);    // 이 기간 세금계산서

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

  // 잔액 조회는 지급대행이 열렸는지 확인하는 역할도 겸한다(503 = 아직 안 열림).
  useEffect(() => {
    let alive = true;
    fetchBalance()
      .then((b) => { if (alive) setPayoutInfo({ enabled: true, available: b.available || 0, error: "" }); })
      .catch((e) => {
        if (!alive) return;
        setPayoutInfo({ enabled: false, available: 0, error: e?.code === PAYOUTS_DISABLED ? "" : (e?.message || "") });
      });
    return () => { alive = false; };
  }, []);

  // 구장별 셀러 등록 상태 — 등록이 안 됐거나 본인인증 전이면 지급 버튼을 눌러도 막힌다.
  useEffect(() => {
    const ids = [...new Set(rows.map((r) => r.venueId).filter(Boolean))];
    if (!ids.length) return;
    let alive = true;
    Promise.all(ids.map((id) => getSellerStatus(id).catch(() => null))).then((list) => {
      if (!alive) return;
      const map = {};
      ids.forEach((id, i) => { if (list[i]) map[id] = list[i]; });
      setSellers(map);
    });
    return () => { alive = false; };
  }, [rows]);

  const invPeriod = useMemo(() => {
    const { from } = periodRange(period);
    return from ? from.slice(0, 7) : ymd(new Date()).slice(0, 7);
  }, [period]);

  const loadInvoices = async () => {
    try { setInvoices(await listTaxInvoices(invPeriod)); }
    catch (e) { console.warn("[AdminSettlements] taxInvoices load failed", e?.message || e); setInvoices([]); }
  };
  useEffect(() => { loadInvoices(); /* eslint-disable-next-line */ }, [invPeriod]);

  const groups = useMemo(() => groupByVenue(rows), [rows]);
  const pageCount = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const pagedGroups = groups.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const summary = useMemo(() => {
    // gross = 구장주에게 줄 돈(환불 반영), platformFee = 회사 몫. 둘은 별개 주머니라 빼지 않는다.
    const gross = rows.reduce((s, r) => s + r.netVenueAmount, 0);
    const platformFee = rows.reduce((s, r) => s + r.platformFee, 0);
    const refunded = rows.reduce((s, r) => s + r.refundedVenueAmount, 0);
    const settledNet = rows.filter((r) => r.settled).reduce((s, r) => s + r.netVenueAmount, 0);
    // 회사 매출·부가세는 환불 반영 후(netPlatformFee)로 잡는다 — platformFee 는 환불 전 스냅샷이라
    // 전액 환불된 건의 이용료까지 매출로 잡히고, 받지도 않은 돈에 부가세를 매기게 된다.
    const netFee = rows.reduce((s, r) => s + r.netPlatformFee, 0);
    const netFeeSupply = rows.reduce((s, r) => s + r.netFeeSupply, 0);
    const netFeeVat = rows.reduce((s, r) => s + r.netFeeVat, 0);
    return { gross, platformFee, refunded, settledNet, pendingNet: gross - settledNet, netFee, netFeeSupply, netFeeVat };
  }, [rows]);

  // detail 모달을 최신 groups 로 동기화
  const detailGroup = useMemo(() => {
    if (!detail) return null;
    return groups.find((g) => (g.venueId || g.venueName) === (detail.venueId || detail.venueName)) || detail;
  }, [groups, detail]);

  /**
   * 지급 처리. 지급대행이 열려 있으면 **실제로 돈이 나간다** — 확인 문구부터 달라야 한다.
   * 닫혀 있으면 예전처럼 장부 표시만 바꾼다(수동 이체 운영).
   */
  const settleVenue = async (g) => {
    const pending = g.items.filter((r) => !r.settled);
    if (!pending.length) return showAlert("지급할 건이 없습니다.");
    const amount = pending.reduce((s, r) => s + r.netVenueAmount, 0);

    if (!payoutInfo.enabled) {
      if (!await showConfirm(`"${g.venueName}" 미지급 ${pending.length}건을 지급 완료 처리할까요?\n지급액: ${won(amount)}\n\n실제 이체는 별도로 해야 합니다 — 이 버튼은 장부 표시만 바꿉니다.`)) return;
      setBusy(true);
      try { await markManySettled(pending.map((r) => r.id), true); await load(); }
      catch (e) { showAlert(e?.message || "지급 처리 실패"); }
      finally { setBusy(false); }
      return;
    }

    const seller = sellers[g.venueId];
    if (!seller?.sellerId) {
      return showAlert(`"${g.venueName}"이 아직 지급대행 셀러로 등록되지 않았습니다.\n상세 화면에서 먼저 셀러 등록을 해주세요.`);
    }
    if (!canPayout(seller.status)) {
      return showAlert(`지급할 수 없는 셀러 상태입니다: ${SELLER_STATUS_LABEL[seller.status] || seller.status}\n\n개인사업자는 등록 시 발송된 본인인증을 마쳐야 지급이 열립니다.`);
    }
    if (payoutInfo.available < amount) {
      return showAlert(`지급 잔액이 부족합니다.\n필요 ${won(amount)} / 가능 ${won(payoutInfo.available)}`);
    }
    if (!await showConfirm(
      `⚠️ 실제 이체가 실행됩니다.\n\n"${g.venueName}" ${pending.length}건 · ${won(amount)}을(를) 지급대행으로 보냅니다.\n지급한 정산금은 회수하기 어렵습니다. 계속할까요?`
    )) return;

    setBusy(true);
    try {
      const r = await requestPayout(g.venueId);
      await load();
      showAlert(`지급 요청 완료 — ${won(r.amount)} (${r.count}건)\n최종 결과는 지급 상태가 "지급 완료"로 바뀌면 확인됩니다.`);
      fetchBalance().then((b) => setPayoutInfo((p) => ({ ...p, available: b.available || 0 }))).catch(() => {});
    } catch (e) {
      showAlert(e?.message || "지급 요청 실패");
    } finally { setBusy(false); }
  };

  /** 셀러 등록 / 상태 새로고침 */
  const onRegisterSeller = async (g) => {
    if (!await showConfirm(`"${g.venueName}"을(를) 지급대행 셀러로 등록할까요?\n\n개인사업자는 등록된 연락처로 본인인증 문자가 발송되고, 인증을 마쳐야 지급이 가능합니다.`)) return;
    setBusy(true);
    try {
      const r = await registerSeller(g.venueId);
      const fresh = await getSellerStatus(g.venueId);
      setSellers((m) => ({ ...m, [g.venueId]: fresh }));
      showAlert(`셀러 등록 완료 — 상태: ${SELLER_STATUS_LABEL[r.status] || r.status}`);
    } catch (e) {
      const d = e?.detail;
      showAlert(d?.missing?.length ? `등록에 필요한 정보가 없습니다:\n· ${d.missing.join("\n· ")}` : (e?.message || "셀러 등록 실패"));
    } finally { setBusy(false); }
  };
  const onSyncSeller = async (g) => {
    setBusy(true);
    try {
      await syncSeller(g.venueId);
      const fresh = await getSellerStatus(g.venueId);
      setSellers((m) => ({ ...m, [g.venueId]: fresh }));
    } catch (e) { showAlert(e?.message || "상태 조회 실패"); }
    finally { setBusy(false); }
  };

  /* ── 수수료 세금계산서 ─────────────────────────────────────
     발행 대상은 원장에서 산출한다(netPlatformFee 합). 실제 전자세금계산서 전송은
     홈택스·대행사에서 이뤄지므로, 여기서는 대상을 확정하고 결과 번호를 받아 적는다. */
  const invoiceTargets = useMemo(() => buildInvoiceTargets(rows), [rows]);
  const invoiceById = useMemo(() => {
    const m = {};
    invoices.forEach((i) => { m[i.id] = i; });
    return m;
  }, [invoices]);

  const onBuildDrafts = async () => {
    if (!invoiceTargets.length) return showAlert("이 기간에 청구할 이용료가 없습니다.");
    if (!await showConfirm(`${invoiceTargets.length}개 구장의 ${invPeriod} 수수료 세금계산서를 발행 대기로 만들까요?\n\n이미 발행 완료된 건은 건드리지 않습니다.`)) return;
    setBusy(true);
    try {
      for (const t of invoiceTargets) {
        // 공급받는자 정보는 발행 시점 스냅샷이어야 한다 → 구장 문서를 그때 읽어 박아둔다.
        const v = await getDoc(doc(db, "venues", t.venueId)).then((d) => (d.exists() ? d.data() : {})).catch(() => ({}));
        await upsertDraft(t, v, invPeriod);
      }
      await loadInvoices();
      showAlert("발행 대기 목록을 만들었습니다.");
    } catch (e) { showAlert(e?.message || "생성 실패"); }
    finally { setBusy(false); }
  };

  const onIssued = async (inv) => {
    const chk = issuableCheck(inv);
    if (!chk.ok) return showAlert(`발행에 필요한 정보가 없습니다:\n· ${chk.missing.join("\n· ")}`);
    if (!await showConfirm(`"${inv.venueName}" ${inv.period} 계산서를 발행 완료로 표시할까요?\n공급가액 ${won(inv.supply)} · 세액 ${won(inv.vat)}\n\n실제 발행(홈택스·대행사)을 마친 뒤에 눌러주세요.`)) return;
    setBusy(true);
    try { await markIssued(inv.id); await loadInvoices(); }
    catch (e) { showAlert(e?.message || "처리 실패"); }
    finally { setBusy(false); }
  };

  const onInvoiceCsv = async () => {
    const list = invoices.length ? invoices : invoiceTargets.map((t) => ({ ...t, period: invPeriod }));
    if (!list.length) return showAlert("내보낼 계산서가 없습니다.");
    const r = await exportCsv(buildTaxInvoiceCsv(list, invPeriod), `수수료세금계산서_${invPeriod}.csv`);
    if (r === "clipboard") showAlert("다운로드가 막혀 클립보드에 복사했습니다.");
    else if (r === "failed") showAlert("내보내기에 실패했습니다.");
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
        {/* 회사 매출은 환불 반영 후 기준이고 부가세 포함가다. 부가세 신고·수수료 세금계산서는
            이 공급가액/부가세를 그대로 쓴다(구장 이용료의 부가세는 구장주 몫이라 여기 없다). */}
        <StatCard>
          <CardLabel>플랫폼 이용료(회사 몫)</CardLabel>
          <CardVal $muted>{won(summary.netFee)}</CardVal>
          <CardSub>공급가 {won(summary.netFeeSupply)} · 부가세 {won(summary.netFeeVat)}</CardSub>
        </StatCard>
        <StatCard><CardLabel>미지급액</CardLabel><CardVal $accent>{won(summary.pendingNet)}</CardVal></StatCard>
        <StatCard><CardLabel>지급 완료액</CardLabel><CardVal $done>{won(summary.settledNet)}</CardVal></StatCard>
      </Cards>

      {/* 지급대행 상태 — "아직 안 열림"과 "오류"를 구분해 보여준다.
          닫혀 있으면 지급처리 버튼은 예전처럼 장부 표시만 바꾸므로 그 사실을 명시한다. */}
      <Notice $on={payoutInfo.enabled}>
        {payoutInfo.enabled ? (
          <>
            <b>지급대행 연결됨</b> · 지급 가능 잔액 <b>{won(payoutInfo.available)}</b>
            <span> — 지급처리를 누르면 실제로 이체됩니다. 지급한 정산금은 회수하기 어렵습니다.</span>
          </>
        ) : payoutInfo.error ? (
          <><b>지급대행 연결 실패</b> · {payoutInfo.error}</>
        ) : (
          <>
            <b>지급대행 미연결</b> — PG 계약·지급대행 신청이 끝나면 열립니다.
            <span> 지금은 지급처리가 장부 표시만 바꾸고, 실제 이체는 따로 해야 합니다.</span>
          </>
        )}
      </Notice>

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
                {/* 카드 합계와 같은 기준(환불 반영 후)이어야 한다 — platformFee 는 환불 전 스냅샷이라 표만 커진다 */}
                <Hide style={{ color: "#9ca3af" }}>{won(g.netFee)}</Hide>
                <Strong>{won(g.net)}</Strong>
                <span>
                  {g.fullySettled
                    ? <Badge $done>지급완료</Badge>
                    : <Badge>대기 {g.pendingCount}</Badge>}
                </span>
                <Actions>
                  <SBtn onClick={() => setDetail(g)}>상세</SBtn>
                  {/* 지급대행이 열렸을 때만 셀러 상태가 의미를 갖는다 —
                      등록 전이면 지급 버튼 대신 등록 버튼을 내야 무엇을 해야 할지 보인다. */}
                  {payoutInfo.enabled && !sellers[g.venueId]?.sellerId && (
                    <SBtn onClick={() => onRegisterSeller(g)} disabled={busy}>셀러등록</SBtn>
                  )}
                  {payoutInfo.enabled && sellers[g.venueId]?.sellerId && !canPayout(sellers[g.venueId]?.status) && (
                    <SBtn onClick={() => onSyncSeller(g)} disabled={busy}
                      title={SELLER_STATUS_LABEL[sellers[g.venueId]?.status] || sellers[g.venueId]?.status}>
                      {SELLER_STATUS_LABEL[sellers[g.venueId]?.status] || "상태확인"}
                    </SBtn>
                  )}
                  {!g.fullySettled && (
                    <SBtn $primary onClick={() => settleVenue(g)} disabled={busy}>
                      {payoutInfo.enabled ? "지급실행" : "지급처리"}
                    </SBtn>
                  )}
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

      {/* ── 수수료 세금계산서 ──────────────────────────────────
          공급자 = 할래말래, 공급받는자 = 구장 사업자. 구장 이용료의 부가세는 구장주 몫이라
          여기 없고, 우리가 받는 중개 이용료에 대해서만 끊는다.
          실제 전자세금계산서 전송은 홈택스·발행 대행사에서 이뤄진다 — 이 화면은 "얼마를 누구에게"를
          원장에서 확정하고, 발행 결과를 되받아 적는 자리다. 없는 발행을 했다고 표시하지 않는다. */}
      <Card>
        <SecHead>
          <div>
            <SecTitle>수수료 세금계산서 · {invPeriod}</SecTitle>
            <Sub>
              대상 {invoiceTargets.length}곳 · 합계 {won(summary.netFee)}
              (공급가 {won(summary.netFeeSupply)} · 세액 {won(summary.netFeeVat)})
            </Sub>
          </div>
          <Actions>
            <SBtn onClick={onBuildDrafts} disabled={busy}>발행 대기 생성</SBtn>
            <SBtn onClick={onInvoiceCsv}>일괄발행 CSV</SBtn>
          </Actions>
        </SecHead>

        {invoiceTargets.length === 0 ? (
          <EmptyText>이 기간에 청구할 이용료가 없습니다.</EmptyText>
        ) : (
          <InvTable>
            <InvHead>
              <span>구장</span>
              <Hide>사업자번호</Hide>
              <span>공급가액</span>
              <span>세액</span>
              <span>합계</span>
              <span>상태</span>
              <span>관리</span>
            </InvHead>
            {invoiceTargets.map((t) => {
              const inv = invoiceById[invoiceId(t.venueId, invPeriod)];
              const chk = inv ? issuableCheck(inv) : { ok: true, missing: [] };
              return (
                <InvRow key={t.venueId}>
                  <Nm>{t.venueName}</Nm>
                  <Hide style={{ color: "#9ca3af" }}>{inv?.bizNo || "-"}</Hide>
                  <span>{won(t.supply)}</span>
                  <span>{won(t.vat)}</span>
                  <Strong>{won(t.total)}</Strong>
                  <span>
                    {!inv ? <Badge>미생성</Badge>
                      : inv.status === "issued" ? <Badge $done>발행 완료</Badge>
                      : !chk.ok ? <Badge $warn>정보 부족</Badge>
                      : <Badge>{TAX_INVOICE_STATUS_LABEL[inv.status]}</Badge>}
                  </span>
                  <Actions>
                    {inv && inv.status === "draft" && (
                      <SBtn $primary onClick={() => onIssued(inv)} disabled={busy}>발행 완료 표시</SBtn>
                    )}
                  </Actions>
                </InvRow>
              );
            })}
          </InvTable>
        )}
        <Sub style={{ marginTop: 10 }}>
          전자세금계산서는 국세청 전송으로 효력이 생깁니다. 위 CSV 를 홈택스(또는 발행 대행사)에
          올려 발행한 뒤 "발행 완료 표시"를 눌러주세요. 발행 대행사를 연동하면 이 단계가 자동화됩니다.
        </Sub>
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
              <SumItem><b style={{ color: "#9ca3af" }}>{won(detailGroup.netFee)}</b><span>이용료</span></SumItem>
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
/* 통계 카드 밑에 붙는 분해값 (공급가액·부가세 등) */
const CardSub = styled.div`
  margin-top: 4px; font-size: 11.5px;
  color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"};
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
  background: ${({ $done, $warn }) => ($done ? "#dcfce7" : $warn ? "#fee2e2" : "#fef3c7")};
  color: ${({ $done, $warn }) => ($done ? "#15803d" : $warn ? "#b91c1c" : "#a16207")};
`;

/* 지급대행 연결 상태 배너 — 열렸을 때는 "실제로 돈이 나간다"는 경고가 눈에 띄어야 한다 */
const Notice = styled.div`
  border-radius: 10px; padding: 11px 14px; font-size: 12.5px; line-height: 1.55;
  border: 1px solid ${({ $on }) => ($on ? "#a7f3d0" : "#e5e7eb")};
  background: ${({ $on }) => ($on ? "#ecfdf5" : "#f9fafb")};
  color: ${({ $on }) => ($on ? "#065f46" : "#4b5563")};
  b { font-weight: 800; }
`;

/* 세금계산서 표 — 정산 표와 열 구성이 달라 따로 둔다 */
const SecHead = styled.div`
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  flex-wrap: wrap; margin-bottom: 12px;
`;
const SecTitle = styled.div`font-size: 15px; font-weight: 800; color: ${({ theme }) => theme?.colors?.textStrong || "#111827"};`;
const InvTable = styled.div`width: 100%; display: flex; flex-direction: column;`;
const InvHead = styled.div`
  display: grid; grid-template-columns: 1fr 120px 110px 100px 110px 96px 130px; gap: 10px; align-items: center;
  padding: 0 8px 10px; border-bottom: 1px solid ${({ theme }) => theme?.colors?.border || "#e5e7eb"};
  font-size: 11.5px; font-weight: 700; color: ${({ theme }) => theme?.colors?.textWeak || "#9ca3af"};
  @media (max-width: 860px) { grid-template-columns: 1fr 100px 110px 96px 130px; }
`;
const InvRow = styled.div`
  display: grid; grid-template-columns: 1fr 120px 110px 100px 110px 96px 130px; gap: 10px; align-items: center;
  padding: 12px 8px; border-bottom: 1px solid ${({ theme }) => theme?.colors?.divider || "#f1f5f9"}; font-size: 13px;
  @media (max-width: 860px) { grid-template-columns: 1fr 100px 110px 96px 130px; }
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
