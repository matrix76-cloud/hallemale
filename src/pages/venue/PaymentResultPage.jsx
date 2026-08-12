/* eslint-disable */
// src/pages/venue/PaymentResultPage.jsx
// 토스 결제창 복귀 지점. /pay/success · /pay/fail 둘 다 이 화면이 받는다.
//   성공 리다이렉트는 "결제 완료"가 아니라 "승인해도 좋다"는 신호다 → 여기서 서버 승인(confirm)을
//   호출해야 실제로 결제가 확정된다. 승인 실패 시 돈은 빠지지 않는다.
//
// 화면 구성: 결과 배지(애니메이션) → 금액 → 무슨 일이 벌어졌는지 → 예약·결제 내역 → 다음 행동.
//   결과 화면은 "됐다/안 됐다" 한 줄로 끝나면 안 된다. 사용자는 여기서 영수증을 확인하고,
//   안 됐으면 "돈이 빠졌는지"를 가장 먼저 알고 싶어 한다.
import React, { useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { hasMock, mockData } from "../../dev/mockBus";
import { confirmPayment } from "../../services/tossPayments";
import { formatStartAt } from "../../constants/cancelPolicy";
import { FiCalendar, FiUser, FiUsers, FiCreditCard, FiClock, FiHash, FiInfo, FiPhone } from "react-icons/fi";

const won = (v) => `${Number(v || 0).toLocaleString()}원`;
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

/** 승인 시각·결제 마감 표기 — "8월 12일 (수) 17:29" */
function formatMoment(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]}) ${hh}:${mm}`;
}

// failUrl 로 돌아올 때 붙는 code → 사용자가 이해할 수 있는 문구.
// 토스가 주는 message 는 개발자용 문장이라 그대로 보여주면 무슨 일인지 알기 어렵다.
const FAIL_TEXT = {
  PAY_PROCESS_CANCELED: "결제를 취소하셨어요.",
  PAY_PROCESS_ABORTED: "결제가 중간에 중단됐어요. 다시 시도해 주세요.",
  REJECT_CARD_COMPANY: "카드사에서 결제를 거절했어요. 다른 카드로 시도해 주세요.",
  INVALID_CARD_EXPIRATION: "카드 유효기간을 다시 확인해 주세요.",
  EXCEED_MAX_CARD_INSTALLMENT_PLAN: "선택한 할부 개월 수를 사용할 수 없는 카드예요.",
  NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT: "이 카드로는 할부를 쓸 수 없어요.",
  EXCEED_MAX_PAYMENT_AMOUNT: "결제 한도를 넘었어요. 다른 결제수단을 선택해 주세요.",
};

// 사유별 "그래서 뭘 하면 되나". 실패 문구만 있으면 사용자는 다음 행동을 스스로 찾아야 한다.
const FAIL_HINT = {
  PAY_PROCESS_CANCELED: ["예약은 그대로 남아 있어요. 예약 내역에서 다시 결제하면 이어서 진행돼요."],
  REJECT_CARD_COMPANY: ["다른 카드로 결제해 보세요.", "카드사 승인 문제라면 카드사에 문의가 필요해요."],
  INVALID_CARD_EXPIRATION: ["카드 유효기간을 확인하고 다시 시도해 주세요."],
  EXCEED_MAX_PAYMENT_AMOUNT: ["카드 한도를 확인하거나 다른 결제수단을 선택해 주세요."],
  EXCEED_MAX_CARD_INSTALLMENT_PLAN: ["할부 개월 수를 줄이거나 일시불로 결제해 주세요."],
  NOT_SUPPORTED_INSTALLMENT_PLAN_CARD_OR_MERCHANT: ["일시불로 결제해 주세요."],
  default: ["잠시 후 예약 내역에서 다시 결제해 주세요.", "계속 실패하면 1:1 문의로 알려주세요."],
};

/** 애니메이션을 끌지 여부 — 시스템 설정(모션 줄이기)을 따른다. */
function prefersReducedMotion() {
  try {
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** 결제 금액 카운트업. 모션 줄이기 설정이면 곧바로 최종값을 보여준다. */
function useCountUp(target, run) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const end = Number(target) || 0;
    if (!run || !end || prefersReducedMotion()) {
      setV(end);
      return;
    }
    let raf = 0;
    let startedAt = 0;
    const DURATION = 700;
    const tick = (t) => {
      if (!startedAt) startedAt = t;
      const p = Math.min(1, (t - startedAt) / DURATION);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(end * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return v;
}

export default function PaymentResultPage() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isFail = pathname.endsWith("/fail");

  const [state, setState] = useState(isFail ? "failed" : "confirming");
  const [message, setMessage] = useState(
    FAIL_TEXT[sp.get("code")] || sp.get("message") || ""
  );
  // 실패의 종류 — 결제창에서 실패("toss")인지, 승인 단계 실패("confirm")인지, 파라미터가 깨진 것("invalid")인지.
  // 셋 다 돈은 빠지지 않지만 사용자에게 할 말이 다르다.
  const [failKind, setFailKind] = useState(isFail ? "toss" : "");
  const [result, setResult] = useState(null);
  // 영수증에 쓸 예약 정보. 승인 응답에는 금액·상태만 있어 구장명·일시는 예약 문서에서 읽는다.
  const [resv, setResv] = useState(null);
  // StrictMode 이중 실행으로 승인이 두 번 나가지 않게 막는다.
  const ranRef = useRef(false);

  useEffect(() => {
    if (isFail || ranRef.current) return;
    ranRef.current = true;

    // 🧪 결제창을 건너뛴 테스트 승인 — paymentKey 는 서버가 만든다.
    //    결과 화면부터는 실결제와 완전히 같은 경로를 타야 흐름 확인이 의미가 있다.
    const testSkip = sp.get("testSkip") === "1";
    const paymentKey = sp.get("paymentKey");
    const orderId = sp.get("orderId");
    const amount = Number(sp.get("amount"));
    if ((!paymentKey && !testSkip) || !orderId || !amount) {
      setState("failed");
      setFailKind("invalid");
      setMessage("결제 정보가 올바르지 않아요.");
      return;
    }

    (async () => {
      try {
        const r = await confirmPayment({ paymentKey, orderId, amount, testSkip });
        setResult(r);
        setState("done");
      } catch (e) {
        setMessage(e?.message || "결제 승인에 실패했어요.");
        setFailKind("confirm");
        setState("failed");
      }
    })();
  }, [isFail, sp]);

  // 승인이 끝난 뒤 예약 문서를 읽어 영수증을 채운다.
  // 표시용이라 실패해도 결과 화면 자체는 그대로 둔다 — 여기서 에러를 띄우면
  // "결제는 됐는데 실패처럼 보이는" 최악의 화면이 된다.
  useEffect(() => {
    const rid = result?.reservationId;
    if (state !== "done" || !rid) return;
    let alive = true;
    (async () => {
      try {
        if (hasMock("venueReservationDocs")) {
          const raw = mockData("venueReservationDocs")[rid];
          if (raw && alive) setResv({ id: rid, ...raw });
          return;
        }
        const snap = await getDoc(doc(db, "venueReservations", rid));
        if (snap.exists() && alive) setResv({ id: snap.id, ...snap.data() });
      } catch {
        /* 영수증 보강 실패 — 금액·상태는 이미 화면에 있다 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [state, result?.reservationId]);

  const amount = Number(result?.amount) || 0;
  const shownAmount = useCountUp(amount, state === "done");

  if (state === "confirming") {
    return (
      <Wrap>
        <Hero>
          <Loader aria-hidden="true">
            <span />
            <span />
            <span />
          </Loader>
          <Headline>결제를 확인하고 있어요</Headline>
          <Sub>화면을 닫지 말고 잠시만 기다려 주세요.</Sub>
        </Hero>
      </Wrap>
    );
  }

  if (state === "failed") {
    const hints = FAIL_HINT[sp.get("code")] || FAIL_HINT.default;
    return (
      <Wrap>
        <Hero>
          <Badge $tone="danger" aria-hidden="true">
            <svg viewBox="0 0 80 80">
              <circle className="halo" cx="40" cy="40" r="36" />
              <circle className="disc" cx="40" cy="40" r="30" />
              <path className="mark" d="M31 31 L49 49" />
              <path className="mark mark2" d="M49 31 L31 49" />
            </svg>
          </Badge>
          <Headline>결제가 완료되지 않았어요</Headline>
          <Sub>{message || "다시 시도해 주세요."}</Sub>
        </Hero>

        {/* 실패 화면에서 사용자가 가장 먼저 확인하고 싶은 것은 "돈이 빠졌는지"다 */}
        <Assure $delay={0.05}>
          {failKind === "confirm"
            ? "결제가 승인되지 않아 금액은 청구되지 않아요. 결제 문자를 받으셨다면 자동으로 취소됩니다."
            : "결제가 진행되지 않아 청구된 금액이 없어요."}
        </Assure>

        <Card $delay={0.1}>
          <Title><FiInfo size={15} /> 이렇게 해보세요</Title>
          <Bullets>
            {hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </Bullets>
        </Card>

        <Actions $delay={0.15}>
          <PrimaryBtn onClick={() => navigate("/my/reservations")}>
            예약 내역에서 다시 결제하기
          </PrimaryBtn>
          <GhostBtn onClick={() => navigate("/home")}>홈으로</GhostBtn>
        </Actions>
      </Wrap>
    );
  }

  // 분담결제에서 상대 팀이 아직 안 냈으면 그 사실을 알려줘야 흐름이 안 끊긴다.
  const waiting = result?.reservationStatus === "pending";
  // 가상계좌: 계좌만 발급된 상태. 입금이 확인돼야 예약이 잡힌다.
  const awaitingDeposit = result?.awaitingDeposit === true;
  // 결제는 됐는데 예약 반영이 늦어지는 경우 — 서버가 웹훅으로 따라잡는다.
  // 여기서 "실패"라고 말하면 안 된다. 돈은 이미 빠졌다.
  const syncPending = result?.reservationSyncPending === true;

  const note = awaitingDeposit
    ? "발급된 계좌로 입금하시면 예약이 확정돼요. 입금 전에는 예약이 잡히지 않아요."
    : syncPending
      ? "결제는 정상 처리됐어요. 예약 확정 반영이 잠시 지연되고 있어요 — 조금 뒤 예약 내역에서 확인해 주세요."
      : waiting
        ? "상대 팀이 남은 몫을 결제하면 예약이 확정돼요. 2시간 안에 결제되지 않으면 자동 취소되고 결제하신 금액은 환불됩니다."
        : "";

  const startLabel = resv?.date ? formatStartAt(resv.date, resv.startTime) : "";
  const deadline = waiting ? formatMoment(resv?.paymentDeadline) : "";
  const approvedAt = formatMoment(result?.approvedAt);
  const isSplit = typeof result?.paidByA === "boolean" || typeof result?.paidByB === "boolean";

  return (
    <Wrap>
      <Hero>
        <Badge $tone={awaitingDeposit ? "warn" : "ok"} aria-hidden="true">
          <svg viewBox="0 0 80 80">
            <circle className="halo" cx="40" cy="40" r="36" />
            <circle className="disc" cx="40" cy="40" r="30" />
            {awaitingDeposit ? (
              <path className="mark" d="M40 23 V41 L52 48" />
            ) : (
              <path className="mark" d="M27 41 L36 50 L54 31" />
            )}
          </svg>
        </Badge>
        <Headline>{awaitingDeposit ? "입금을 기다리고 있어요" : "결제가 완료됐어요"}</Headline>
        <Amount>{won(shownAmount)}</Amount>
        {resv ? (
          <Sub>
            {resv.venueName}
            {resv.courtName ? ` · ${resv.courtName}` : ""}
            {startLabel ? ` · ${startLabel}` : ""}
          </Sub>
        ) : null}
        {waiting ? <Chip>상대 팀 결제 대기 중</Chip> : null}
        {!waiting && !awaitingDeposit && !syncPending ? <Chip $tone="ok">예약 확정</Chip> : null}
      </Hero>

      {note ? <Assure $tone="warn" $delay={0.08}>{note}</Assure> : null}

      {/* 분담결제 — 두 팀 중 누가 냈는지가 이 화면의 핵심 정보다 */}
      {isSplit && resv ? (
        <Card $delay={0.12}>
          <Title><FiUsers size={15} /> 팀별 결제 현황</Title>
          <TeamRow $done={result?.paidByA === true}>
            <span>{resv.teamAName || "우리 팀"}</span>
            <b>{result?.paidByA === true ? "결제 완료" : "결제 대기"}</b>
          </TeamRow>
          <TeamRow $done={result?.paidByB === true}>
            <span>{resv.teamBName || "상대 팀"}</span>
            <b>{result?.paidByB === true ? "결제 완료" : "결제 대기"}</b>
          </TeamRow>
          {deadline ? <SubNote>상대 팀 결제 마감 · {deadline}</SubNote> : null}
        </Card>
      ) : null}

      {resv ? (
        <Card $delay={0.16}>
          <CardHead>
            <Title>예약 정보</Title>
            {resv.reservationCode ? (
              <Code><FiHash size={12} />{resv.reservationCode}</Code>
            ) : null}
          </CardHead>
          <VenueLine>
            {resv.venueName}
            {resv.courtName ? <em> · {resv.courtName}</em> : null}
          </VenueLine>
          <Row>
            <FiCalendar />
            <span>{startLabel || `${resv.date} ${resv.startTime}`}~{resv.endTime}</span>
          </Row>
          {resv.priceMode === "perPerson" && Number(resv.headcount) > 0 ? (
            <Row><FiUsers /><span>이용 인원 {resv.headcount}명</span></Row>
          ) : null}
          <Row>
            <FiUser />
            <span>
              {resv.userName || "예약자"}
              {resv.teamName ? ` · ${resv.teamName}` : ""}
            </span>
          </Row>
          {resv.venuePhone ? (
            <Row><FiPhone /><span>구장 {resv.venuePhone}</span></Row>
          ) : null}
        </Card>
      ) : null}

      <Card $delay={0.2}>
        <Title><FiCreditCard size={15} /> 결제 정보</Title>
        <SplitRow>
          <span>{isSplit ? "결제 금액 (우리 팀 몫)" : "결제 금액"}</span>
          <b>{won(amount)}</b>
        </SplitRow>
        {/* 분담결제는 결제액과 대관료가 다르다 — 총액을 같이 두지 않으면
            "8만원짜리 구장인데 왜 4만원이 찍혔지"로 읽힌다. */}
        {isSplit && Number(resv?.splitTotal) > 0 ? (
          <SplitRow>
            <span>구장 총 이용료</span>
            <span>{won(resv.splitTotal)} · 양 팀이 절반씩</span>
          </SplitRow>
        ) : null}
        {result?.method ? (
          <SplitRow><span>결제 수단</span><span>{result.method}</span></SplitRow>
        ) : null}
        {approvedAt ? (
          <SplitRow><span>결제 일시</span><span>{approvedAt}</span></SplitRow>
        ) : null}
        {sp.get("orderId") ? (
          <SplitRow><span>주문번호</span><Mono>{sp.get("orderId")}</Mono></SplitRow>
        ) : null}
      </Card>

      <Card $delay={0.24}>
        <Title><FiClock size={15} /> 이용 전 확인해 주세요</Title>
        <Bullets>
          <li>예약 내역은 내 정보 &gt; 내 구장 예약에서 다시 볼 수 있어요.</li>
          <li>취소는 이용 시작 전까지 앱에서 할 수 있고, 취소·환불 규정에 따라 환불돼요.</li>
          <li>
            현장 이용 관련 문의는 구장
            {resv?.venuePhone ? `(${resv.venuePhone})` : ""}으로, 결제·환불 문의는 1:1 문의로 남겨주세요.
          </li>
        </Bullets>
      </Card>

      <Actions $delay={0.28}>
        {result?.matchId ? (
          <PrimaryBtn onClick={() => navigate(`/match-roomdetail/${result.matchId}`, { replace: true })}>
            매칭공간으로 가기
          </PrimaryBtn>
        ) : (
          <PrimaryBtn onClick={() => navigate("/my/reservations", { replace: true })}>
            예약 내역 보기
          </PrimaryBtn>
        )}
        <GhostBtn onClick={() => navigate("/home", { replace: true })}>홈으로</GhostBtn>
      </Actions>
    </Wrap>
  );
}

/* ── 애니메이션 ─────────────────────────────────────────────
   결과 화면은 "방금 무슨 일이 일어났는지"를 몸으로 알려주는 자리다.
   배지가 튀어 오르고 → 표시가 그려지고 → 아래 내용이 차례로 올라온다.
   모션 줄이기 설정에서는 전부 끈다(멀미·주의력 문제). */
const pop = keyframes`
  0%   { transform: scale(0.4); opacity: 0; }
  60%  { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
`;
const draw = keyframes`
  from { stroke-dashoffset: 60; }
  to   { stroke-dashoffset: 0; }
`;
const ripple = keyframes`
  0%   { transform: scale(0.85); opacity: 0.45; }
  100% { transform: scale(1.25); opacity: 0; }
`;
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: none; }
`;
const blink = keyframes`
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.35; }
  40%           { transform: scale(1); opacity: 1; }
`;

const TONES = { ok: "#0FA464", warn: "#b45309", danger: "#DC2626" };
const toneColor = ({ $tone, theme }) =>
  $tone === "ok" ? theme.colors.accent : TONES[$tone] || TONES.ok;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Hero = styled.div`
  display: flex; flex-direction: column; align-items: center;
  gap: 6px; padding: 28px 8px 18px;
  text-align: center;
`;

/* 결과 배지 — 원이 튀어 오르고 표시가 그려진다 */
const Badge = styled.div`
  width: 92px; height: 92px; margin-bottom: 6px;
  svg { width: 100%; height: 100%; overflow: visible; }
  .disc {
    fill: ${toneColor};
    transform-origin: 50% 50%;
    animation: ${pop} 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .halo {
    fill: none; stroke: ${toneColor}; stroke-width: 2;
    transform-origin: 50% 50%;
    animation: ${ripple} 0.9s ease-out 0.15s both;
  }
  .mark {
    fill: none; stroke: #fff; stroke-width: 6;
    stroke-linecap: round; stroke-linejoin: round;
    stroke-dasharray: 60;
    animation: ${draw} 0.4s ease-out 0.28s both;
  }
  .mark2 { animation-delay: 0.4s; }

  @media (prefers-reduced-motion: reduce) {
    .disc, .halo, .mark, .mark2 { animation: none; }
    .halo { opacity: 0; }
    .mark { stroke-dasharray: none; }
  }
`;

/* 승인 대기 로더 — 스피너 대신 점 세 개(결제 진행 중이라는 감각) */
const Loader = styled.div`
  display: flex; gap: 8px; margin-bottom: 14px;
  span {
    width: 10px; height: 10px; border-radius: 50%;
    background: ${({ theme }) => theme.colors.primary};
    animation: ${blink} 1.1s ease-in-out infinite;
  }
  span:nth-child(2) { animation-delay: 0.16s; }
  span:nth-child(3) { animation-delay: 0.32s; }
  @media (prefers-reduced-motion: reduce) {
    span { animation: none; opacity: 0.6; }
  }
`;

const Headline = styled.div`
  font-size: 20px; font-weight: 800; letter-spacing: -0.4px;
  color: ${({ theme }) => theme.colors.textStrong};
  animation: ${fadeUp} 0.4s ease 0.1s both;
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;
const Amount = styled.div`
  font-size: 30px; font-weight: 900; letter-spacing: -1px;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.textStrong};
  animation: ${fadeUp} 0.4s ease 0.16s both;
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;
const Sub = styled.p`
  margin: 2px 0 0; max-width: 320px;
  font-size: 13.5px; line-height: 1.6;
  color: ${({ theme }) => theme.colors.textWeak};
  animation: ${fadeUp} 0.4s ease 0.22s both;
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;
/* 지금 예약이 어떤 상태인지 한 단어로 */
const Chip = styled.div`
  margin-top: 8px; padding: 5px 12px; border-radius: 999px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 12px; font-weight: 700;
  color: ${({ $tone, theme }) => ($tone === "ok" ? theme.colors.accent : theme.colors.textNormal)};
  animation: ${fadeUp} 0.4s ease 0.28s both;
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

const rise = ({ $delay = 0 }) => `${$delay}s`;

/* 실패 화면의 "돈은 안 빠졌어요" / 성공 화면의 상태 안내 */
const Assure = styled.div`
  border-radius: 12px; padding: 12px 14px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  font-size: 12.5px; line-height: 1.6;
  color: ${({ theme }) => theme.colors.textNormal};
  border-left: 3px solid ${({ $tone, theme }) => ($tone === "warn" ? TONES.warn : theme.colors.border)};
  animation: ${fadeUp} 0.4s ease ${rise} both;
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;

const Card = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 14px;
  padding: 16px;
  display: flex; flex-direction: column; gap: 10px;
  animation: ${fadeUp} 0.4s ease ${rise} both;
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;
const CardHead = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 10px;`;
const Title = styled.div`
  display: flex; align-items: center; gap: 6px;
  font-size: 16px; font-weight: 800;
  svg { flex: none; color: ${({ theme }) => theme.colors.primary}; }
`;
const Code = styled.div`
  display: inline-flex; align-items: center; gap: 3px;
  padding: 3px 8px; border-radius: 7px;
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 11.5px; font-weight: 700; font-variant-numeric: tabular-nums;
`;
const VenueLine = styled.div`
  font-size: 15px; font-weight: 800; line-height: 1.35;
  color: ${({ theme }) => theme.colors.textStrong};
  em { font-style: normal; font-weight: 700; color: ${({ theme }) => theme.colors.textWeak}; }
`;
const Row = styled.div`
  display: flex; align-items: center; gap: 8px;
  font-size: 13.5px; color: ${({ theme }) => theme.colors.textWeak};
  svg { flex: none; }
`;
const SplitRow = styled.div`
  display: flex; justify-content: space-between; align-items: baseline; gap: 10px;
  font-size: 13.5px; color: ${({ theme }) => theme.colors.textWeak};
  b {
    font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums;
    color: ${({ theme }) => theme.colors.textStrong};
  }
`;
const Mono = styled.span`
  font-variant-numeric: tabular-nums; font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textNormal};
`;
/* 분담결제 — 팀별 결제 여부 */
const TeamRow = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 10px 12px; border-radius: 10px;
  background: ${({ theme }) => theme.colors.surface};
  font-size: 13px; color: ${({ theme }) => theme.colors.textNormal};
  b {
    font-size: 12.5px; font-weight: 800;
    color: ${({ $done, theme }) => ($done ? theme.colors.accent : theme.colors.textWeak)};
  }
`;
const SubNote = styled.p`
  margin: 0; font-size: 12.5px; line-height: 1.5;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const Bullets = styled.ul`
  margin: 0; padding-left: 16px;
  display: flex; flex-direction: column; gap: 6px;
  font-size: 12.5px; line-height: 1.55;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Actions = styled.div`
  display: flex; flex-direction: column; gap: 8px;
  margin-top: 4px;
  animation: ${fadeUp} 0.4s ease ${rise} both;
  @media (prefers-reduced-motion: reduce) { animation: none; }
`;
const PrimaryBtn = styled.button`
  width: 100%; height: 52px; border: none; border-radius: 12px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff; font-size: 15px; font-weight: 800; cursor: pointer;
`;
const GhostBtn = styled.button`
  width: 100%; height: 48px; border-radius: 12px; cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: transparent;
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 14px; font-weight: 700;
`;
