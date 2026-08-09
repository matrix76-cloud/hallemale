/* eslint-disable */
// src/pages/owner/OwnerSettlementPage.jsx
// 정산 명세 — 언제 얼마를 받는지, 그 금액이 어떻게 나온 건지.
//
// 집계는 결제 원장(payments) 기준이다. 예약 문서의 price 로 집계하면 환불·부분취소가
// 반영되지 않아 장부가 어긋난다(ownerSettlementService 주석 참고).
//
// 원장 항등식: 결제 총액 − 플랫폼 이용료 = 정산 기준액, − 환불 = 정산액.
// 예전엔 "떼고 남은 금액만" 보여줬는데, 사업자는 왜 30,000이 28,500이 됐는지 건별로
// 확인할 수 있어야 세금계산서·부가세 신고를 할 수 있다. 그래서 차감 과정을 전부 편다.
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import {
  LuChevronLeft, LuChevronRight, LuLandmark, LuDownload,
  LuReceipt, LuCalendarClock, LuHistory, LuFileText,
} from "react-icons/lu";
import { useOwner } from "../../context/OwnerContext";
import {
  listOwnerPayments, summarize, filterPeriod, periodLabel, shiftPeriod,
  todayKst, vatMode, splitVat, groupPayouts, buildSettlementCsv, exportCsv,
} from "../../services/ownerSettlementService";
import { useUIActions } from "../../hooks/useUI";
import { resolveOwnerType } from "../../constants/ownerType";
import { Page, Card, ScreenTitle, SecTitle, Caption, PrimaryBtn, GhostBtn, StatBadge, Chip, C } from "./components/od";
import VenueGateNotice from "./components/VenueGateNotice";
import OwnerSpinner from "./components/OwnerSpinner";
import { SETTLEMENT_CYCLE_LABEL, nextPayoutDate } from "../../constants/payments";

const won = (v) => `${Number(v || 0).toLocaleString()}원`;

const dDay = (from, to) => {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "";
  const days = Math.round((b - a) / 86400000);
  if (days <= 0) return "오늘";
  if (days === 1) return "내일";
  return `${days}일 후`;
};

const mdLabel = (ymd) => {
  const [, m, d] = String(ymd || "").split("-");
  return m && d ? `${Number(m)}월 ${Number(d)}일` : "-";
};

/* ── 다음 지급 예정 (화면에서 가장 먼저 읽혀야 하는 숫자) ── */
const PayoutHead = styled.section`
  background: ${C.violet600};
  border-radius: 16px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #fff;
`;
const PayoutTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12.5px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.88);
  & > span { display: inline-flex; align-items: center; gap: 5px; }
`;
const PayoutAmt = styled.div`
  font-size: 30px;
  font-weight: 900;
  letter-spacing: -0.6px;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
`;
const PayoutSub = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.5;
`;

/* ── 단계별 금액 3칸 ── */
const Steps = styled.div`display:grid;grid-template-columns:repeat(3,1fr);gap:8px;`;
const Step = styled.div`
  border: 1px solid ${C.slate200};
  background: #fff;
  border-radius: 12px;
  padding: 12px 8px;
  text-align: center;
`;
const StepL = styled.div`font-size:11.5px;color:${C.slate500};`;
const StepV = styled.div`
  margin-top: 5px;
  font-size: 15px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: ${({ $on }) => ($on ? C.violet600 : C.slate800)};
`;

/* ── 기간 선택 ── */
const PeriodTabs = styled.div`display:flex;gap:6px;`;
const PeriodNav = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  background: #fff; border: 1px solid ${C.slate200}; border-radius: 14px; padding: 8px 6px;
`;
const NavBtn = styled.button`border:none;background:transparent;color:${C.slate500};cursor:pointer;display:flex;padding:6px;&:disabled{opacity:.3;cursor:not-allowed;}`;
const NavLabel = styled.div`font-size:15px;font-weight:800;color:${C.slate800};`;

/* ── 명세 원장 ── */
const Ledger = styled.div`display:flex;flex-direction:column;gap:9px;`;
const LRow = styled.div`
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  font-size: 13.5px;
  color: ${({ $strong }) => ($strong ? C.slate800 : C.slate500)};
  font-weight: ${({ $strong }) => ($strong ? 700 : 400)};
  & > b {
    font-variant-numeric: tabular-nums;
    font-weight: ${({ $strong }) => ($strong ? 800 : 600)};
    color: ${({ $minus, $strong }) => ($minus ? C.red500 : $strong ? C.slate800 : C.slate800)};
  }
`;
const LRule = styled.div`height:1px;background:${C.slate200};margin:2px 0;`;
const LTotal = styled.div`
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  border-top: 2px solid ${C.slate800};
  padding-top: 12px; margin-top: 3px;
  & > span { font-size: 14px; font-weight: 800; color: ${C.slate800}; }
  & > b { font-size: 19px; font-weight: 900; letter-spacing: -0.4px; font-variant-numeric: tabular-nums; color: ${C.violet600}; }
`;
const VatBox = styled.div`
  margin-top: 12px;
  border: 1px solid ${C.slate200};
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

/* ── 건별 내역 ── */
const Item = styled.button`
  width: 100%; box-sizing: border-box; text-align: left; cursor: pointer;
  border: none; background: transparent;
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 11px 0; border-bottom: 1px solid ${C.slate200};
  &:last-of-type { border-bottom: none; }
  &:active { background: #fafafa; }
`;
const ItemL = styled.div`display:flex;flex-direction:column;gap:3px;min-width:0;`;
const ItemT = styled.div`font-size:13.5px;font-weight:700;color:${C.slate800};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
const ItemS = styled.div`font-size:11.5px;color:${C.slate500};`;
const ItemR = styled.div`display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;`;
const Amt = styled.div`
  font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums;
  color: ${({ $off }) => ($off ? C.slate400 : C.slate800)};
  text-decoration: ${({ $off }) => ($off ? "line-through" : "none")};
`;
const Breakdown = styled.div`
  padding: 2px 0 12px;
  display: flex; flex-direction: column; gap: 7px;
  border-bottom: 1px solid ${C.slate200};
`;
const BRow = styled.div`
  display: flex; justify-content: space-between; gap: 10px;
  font-size: 12.5px; color: ${C.slate500};
  & > b { font-variant-numeric: tabular-nums; font-weight: 700; color: ${({ $minus }) => ($minus ? C.red500 : C.slate800)}; }
`;
const HeadRow = styled.div`display:flex;align-items:center;justify-content:space-between;gap:8px;`;
const CsvBtn = styled.button`
  flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px;
  border: 1px solid ${C.slate200}; background: #fff; color: ${C.slate500};
  border-radius: 9px; padding: 6px 10px; font-size: 12px; font-weight: 700; cursor: pointer;
  &:active { transform: translateY(1px); }
  &:disabled { opacity: .45; cursor: not-allowed; }
`;

/* ── 계좌 상태 ── */
const AcctRow = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  font-size: 13px; color: ${C.slate500};
  & > b { color: ${C.slate800}; font-weight: 700; }
`;

const PERIOD_TABS = [
  { type: "month", label: "월" },
  { type: "quarter", label: "분기" },
  { type: "half", label: "반기" },
  { type: "year", label: "연" },
];

export default function OwnerSettlementPage() {
  const navigate = useNavigate();
  const { uid, venue, userDoc, loading: ownerLoading, refresh } = useOwner();
  const { showToast } = useUIActions() || {};
  const toast = (m) => { if (showToast) showToast({ message: m }); };

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState("");   // 펼친 건별 내역
  const [busyCsv, setBusyCsv] = useState(false);

  const now = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState({
    type: "month",
    y: now.getFullYear(),
    m: now.getMonth() + 1,
    q: Math.ceil((now.getMonth() + 1) / 3),
    h: now.getMonth() + 1 <= 6 ? 1 : 2,
  });

  useEffect(() => {
    if (!uid || !venue?.id) return;
    setLoading(true);
    listOwnerPayments(uid, { venueId: venue.id })
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [uid, venue?.id]);

  const today = todayKst();
  // 받을 돈은 기간과 무관하게 "아직 안 받은 전부" — 기간으로 쪼개면 실제 입금액과 안 맞는다.
  const all = useMemo(() => summarize(rows, today), [rows, today]);
  const periodRows = useMemo(() => filterPeriod(rows, period), [rows, period]);
  const sum = useMemo(() => summarize(periodRows, today), [periodRows, today]);
  const payouts = useMemo(() => groupPayouts(rows), [rows]);

  const payDate = nextPayoutDate(today);
  const payableCount = useMemo(
    () => rows.filter((r) => r.netVenueAmount > 0 && !r.settled && r.date && r.date < today).length,
    [rows, today]
  );

  // 실제 원장에서 뽑은 유효 요율 — 그랜드파더링(0%) 구장은 상수(5%)와 다르다.
  const effRate = sum.amount > 0 ? (sum.platformFee / sum.amount) * 100 : null;

  const ownerType = resolveOwnerType(userDoc, venue);
  const mode = vatMode({ ownerType, taxType: venue?.business?.taxType });
  const vat = splitVat(sum.net);

  const onCsv = async () => {
    if (!periodRows.length || busyCsv) return;
    setBusyCsv(true);
    try {
      const csv = buildSettlementCsv(periodRows, { venueName: venue?.name });
      const name = `정산명세_${(venue?.name || "구장").replace(/[\\/:*?"<>|]/g, "")}_${periodLabel(period).replace(/\s/g, "")}.csv`;
      const how = await exportCsv(csv, name);
      toast(
        how === "download" ? "정산 명세를 내려받았어요."
        : how === "clipboard" ? "내려받기가 막혀 있어 클립보드에 복사했어요."
        : "내보내기에 실패했어요."
      );
    } finally {
      setBusyCsv(false);
    }
  };

  if (ownerLoading) return <OwnerSpinner label="불러오는 중…" />;
  if (!venue || venue.status !== "approved")
    return <Page><VenueGateNotice venue={venue} refresh={refresh} /></Page>;

  const acct = venue.settlement || {};
  const hasAcct = !!(acct.bank && acct.account);
  const maskedAcct = hasAcct
    ? `${acct.bank} ${String(acct.account).slice(0, 3)}****${String(acct.account).slice(-3)}`
    : "";

  return (
    <Page>
      <ScreenTitle>정산</ScreenTitle>

      <PayoutHead>
        <PayoutTop>
          <span><LuCalendarClock size={14} /> 다음 지급 예정</span>
          <span>{mdLabel(payDate)} · {dDay(today, payDate)}</span>
        </PayoutTop>
        <PayoutAmt>{won(all.payable)}</PayoutAmt>
        <PayoutSub>
          이용이 끝난 예약 {payableCount}건 · {SETTLEMENT_CYCLE_LABEL} 지급
          {all.upcoming > 0 ? ` · 이용 예정 ${won(all.upcoming)}은 아직 대상이 아니에요` : ""}
        </PayoutSub>
      </PayoutHead>

      {/* 계좌 — 돈이 나가는 전제조건이라 정산 화면 안에서 상태를 바로 본다 */}
      <Card>
        <SecTitle><LuLandmark size={16} /> 정산 계좌</SecTitle>
        {!hasAcct ? (
          <>
            <Caption>계좌가 없으면 정산금을 보내드릴 수 없어요. 쌓인 정산금은 그대로 유지돼요.</Caption>
            <PrimaryBtn type="button" onClick={() => navigate("/owner/my")}>계좌 등록하기</PrimaryBtn>
          </>
        ) : (
          <>
            <AcctRow>
              <span>{maskedAcct}</span>
              <StatBadge $tone={acct.verified ? "done" : "pending"}>
                {acct.verified ? "예금주 확인 완료" : "예금주 확인 중"}
              </StatBadge>
            </AcctRow>
            <AcctRow><span>예금주</span><b>{acct.holder || "-"}</b></AcctRow>
            {acct.taxEmail ? <AcctRow><span>명세 수신</span><b>{acct.taxEmail}</b></AcctRow> : null}
            {!acct.verified && (
              <Caption>
                첫 지급 전에 등록하신 계좌의 예금주를 대조해요. 집계는 그대로 쌓이고,
                확인이 끝나면 지급 일정에 맞춰 나가요.
              </Caption>
            )}
            <GhostBtn type="button" onClick={() => navigate("/owner/my")}>계좌 변경</GhostBtn>
          </>
        )}
      </Card>

      <Steps>
        <Step>
          <StepL>이용 예정</StepL>
          <StepV>{won(all.upcoming)}</StepV>
        </Step>
        <Step>
          <StepL>정산 대기</StepL>
          <StepV $on>{won(all.payable)}</StepV>
        </Step>
        <Step>
          <StepL>지급 완료</StepL>
          <StepV>{won(all.paid)}</StepV>
        </Step>
      </Steps>

      <PeriodTabs>
        {PERIOD_TABS.map((t) => (
          <Chip
            key={t.type}
            $on={period.type === t.type}
            style={{ flex: 1 }}
            onClick={() => setPeriod((p) => ({ ...p, type: t.type }))}
          >
            {t.label}
          </Chip>
        ))}
      </PeriodTabs>

      <PeriodNav>
        <NavBtn onClick={() => setPeriod((p) => shiftPeriod(p, -1))}><LuChevronLeft size={20} /></NavBtn>
        <NavLabel>{periodLabel(period)}</NavLabel>
        <NavBtn onClick={() => setPeriod((p) => shiftPeriod(p, 1))}><LuChevronRight size={20} /></NavBtn>
      </PeriodNav>

      {/* 정산 명세 — 차감 과정을 전부 편다 */}
      <Card>
        <SecTitle><LuReceipt size={16} /> {periodLabel(period)} 정산 명세</SecTitle>

        {loading ? (
          <Caption>불러오는 중…</Caption>
        ) : sum.amount === 0 ? (
          <Caption>이 기간에는 앱으로 결제된 예약이 없어요.</Caption>
        ) : (
          <>
            <Ledger>
              <LRow>
                <span>결제 총액 <small>({periodRows.length}건)</small></span>
                <b>{won(sum.amount)}</b>
              </LRow>
              <LRow $minus>
                <span>플랫폼 이용료{effRate != null ? ` (${effRate.toFixed(effRate % 1 === 0 ? 0 : 1)}%)` : ""}</span>
                <b>− {won(sum.platformFee)}</b>
              </LRow>
              <LRule />
              <LRow $strong>
                <span>정산 기준액</span>
                <b>{won(sum.venueAmount)}</b>
              </LRow>
              {sum.refunded > 0 && (
                <LRow $minus>
                  <span>환불 차감 <small>({sum.refundCount}건)</small></span>
                  <b>− {won(sum.refunded)}</b>
                </LRow>
              )}
            </Ledger>

            <LTotal>
              <span>정산액</span>
              <b>{won(sum.net)}</b>
            </LTotal>

            {mode === "general" ? (
              <VatBox>
                <LRow><span>공급가액</span><b>{won(vat.supply)}</b></LRow>
                <LRow><span>부가세 (10%)</span><b>{won(vat.vat)}</b></LRow>
                <Caption>
                  일반과세자 기준으로 정산액을 부가세 포함가로 보고 나눈 참고값이에요.
                  실제 신고 금액은 세무 대리인과 확인해 주세요.
                </Caption>
              </VatBox>
            ) : (
              <Caption>
                {mode === "simple"
                  ? "간이과세자는 업종별 부가율에 따라 세액이 달라져 공급가액·부가세를 나눠 보여드리지 않아요. 위 정산액(총액)으로 신고해 주세요."
                  : "학교·기관은 과세 구조가 달라 공급가액·부가세를 나눠 보여드리지 않아요. 위 정산액(총액) 기준으로 확인해 주세요."}
              </Caption>
            )}
          </>
        )}
      </Card>

      {/* 세금계산서 — 플랫폼 이용료는 구장 입장에서 매입(비용)이라, 계산서를 받아야 매입세액 공제가 된다.
          발행 자체는 플랫폼이 하지만 "얼마인지"와 "어디로 발행되는지"는 구장주가 확인할 수 있어야 한다.
          학교·기관은 사업자등록번호가 없어 발행 대상이 아니므로 사업자에게만 보인다. */}
      {ownerType === "business" && (
        <Card>
          <SecTitle><LuFileText size={16} /> 세금계산서</SecTitle>
          <Ledger>
            <LRow $strong>
              <span>{periodLabel(period)} 플랫폼 이용료</span>
              <b>{won(sum.platformFee)}</b>
            </LRow>
          </Ledger>
          <Caption>
            구장이 부담한 플랫폼 이용료예요. 이 금액에 대한 세금계산서를 아래 정보로 발행해 드려요.
          </Caption>

          <AcctRow><span>상호</span><b>{venue?.business?.bizName || "-"}</b></AcctRow>
          <AcctRow><span>사업자등록번호</span><b>{venue?.business?.bizNo || "-"}</b></AcctRow>
          <AcctRow><span>대표자</span><b>{venue?.business?.ownerName || "-"}</b></AcctRow>
          <AcctRow>
            <span>과세유형</span>
            <b>{venue?.business?.taxType === "general" ? "일반과세자" : "간이과세자"}</b>
          </AcctRow>
          <AcctRow><span>수신 이메일</span><b>{acct.taxEmail || "미등록"}</b></AcctRow>

          {(!venue?.business?.bizNo || !acct.taxEmail) && (
            <>
              <Caption style={{ color: C.red500 }}>
                {!venue?.business?.bizNo && !acct.taxEmail
                  ? "사업자등록번호와 수신 이메일이 없어 세금계산서를 발행할 수 없어요."
                  : !venue?.business?.bizNo
                  ? "사업자등록번호가 없어 세금계산서를 발행할 수 없어요."
                  : "수신 이메일이 없어 세금계산서를 보낼 곳이 없어요."}
              </Caption>
              <PrimaryBtn type="button" onClick={() => navigate("/owner/my")}>내정보에서 등록하기</PrimaryBtn>
            </>
          )}
        </Card>
      )}

      {/* 건별 내역 — 탭하면 금액 구성이 펼쳐진다 */}
      <Card>
        <HeadRow>
          <SecTitle>건별 내역 {periodRows.length > 0 && `(${periodRows.length})`}</SecTitle>
          <CsvBtn type="button" onClick={onCsv} disabled={!periodRows.length || busyCsv}>
            <LuDownload size={13} /> {busyCsv ? "내보내는 중…" : "CSV"}
          </CsvBtn>
        </HeadRow>

        {loading ? (
          <Caption>불러오는 중…</Caption>
        ) : periodRows.length === 0 ? (
          <Caption>이 기간에는 앱으로 결제된 예약이 없어요.</Caption>
        ) : (
          periodRows.map((r) => {
            const dead = r.netVenueAmount <= 0;
            const open = openId === r.id;
            return (
              <React.Fragment key={r.id}>
                <Item type="button" onClick={() => setOpenId(open ? "" : r.id)}>
                  <ItemL>
                    <ItemT>
                      {r.date}
                      {r.matchId ? " · 매칭" : " · 단독"}
                      {r.side === "A" || r.side === "B" ? ` (${r.side}팀 몫)` : ""}
                    </ItemT>
                    <ItemS>결제 {won(r.amount)} · 이용료 {won(r.platformFee)}</ItemS>
                  </ItemL>
                  <ItemR>
                    <Amt $off={dead}>{won(dead ? r.venueAmount : r.netVenueAmount)}</Amt>
                    <StatBadge $tone={dead ? "refund" : r.settled ? "done" : r.date >= today ? "pending" : "confirmed"}>
                      {dead ? "환불" : r.settled ? "지급완료" : r.date >= today ? "이용예정" : "정산대기"}
                    </StatBadge>
                  </ItemR>
                </Item>

                {open && (
                  <Breakdown>
                    <BRow><span>결제액</span><b>{won(r.amount)}</b></BRow>
                    <BRow $minus><span>플랫폼 이용료</span><b>− {won(r.platformFee)}</b></BRow>
                    <BRow><span>정산 기준액</span><b>{won(r.venueAmount)}</b></BRow>
                    {r.refundedVenueAmount > 0 && (
                      <BRow $minus><span>환불 차감</span><b>− {won(r.refundedVenueAmount)}</b></BRow>
                    )}
                    <BRow><span>정산액</span><b>{won(r.netVenueAmount)}</b></BRow>
                    <BRow><span>결제번호</span><b style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 11.5 }}>{r.paymentKey}</b></BRow>
                    {r.settledAt ? <BRow><span>지급일</span><b>{r.settledAt}</b></BRow> : null}
                  </Breakdown>
                )}
              </React.Fragment>
            );
          })
        )}
      </Card>

      {/* 지급 이력 — 누적 총액만으로는 통장과 대사가 안 된다 */}
      <Card>
        <SecTitle><LuHistory size={16} /> 지급 이력</SecTitle>
        {loading ? (
          <Caption>불러오는 중…</Caption>
        ) : payouts.length === 0 ? (
          <Caption>아직 지급된 정산금이 없어요.</Caption>
        ) : (
          <>
            {payouts.map((p) => (
              <AcctRow key={p.date} style={{ padding: "9px 0", borderBottom: `1px solid ${C.slate200}` }}>
                <span>{p.date} · {p.count}건</span>
                <b>{won(p.amount)}</b>
              </AcctRow>
            ))}
            <LTotal>
              <span>지금까지 지급받은 정산금</span>
              <b>{won(all.paid)}</b>
            </LTotal>
          </>
        )}
      </Card>

      <Caption>
        정산금은 등록하신 계좌로 {SETTLEMENT_CYCLE_LABEL}에 지급해요. 이용이 끝난 예약만 정산 대상이며,
        이용 전 취소·환불된 건은 자동으로 빠져요. 금액은 실제 결제 원장 기준이라 예약 정가와 다를 수 있어요.
      </Caption>
    </Page>
  );
}
