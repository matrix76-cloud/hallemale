/* eslint-disable */
// src/pages/venue/PaymentPage.jsx
// 구장 예약 결제 — 토스 결제위젯.
//   매칭 제휴구장이면 "우리 팀 몫"만 결제한다(분담결제). 금액은 서버가 예약 문서에서 계산하므로
//   이 화면은 서버가 내려준 금액을 보여주기만 한다.
// 결제 성공 → 토스가 successUrl(/pay/success)로 리다이렉트 → 거기서 승인(confirm).
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { hasMock, mockData } from "../../dev/mockBus";
import { createOrder, renderWidget, IS_TEST_PAYMENT } from "../../services/tossPayments";
import {
  CANCEL_POLICY_TIERS, CANCEL_POLICY_NOTE,
  formatStartAt, cancelStageIndex, refundAmount,
} from "../../constants/cancelPolicy";
import Spinner from "../../components/common/Spinner";
import { FiMapPin, FiCalendar, FiUsers, FiClock, FiUser, FiPhone, FiHash, FiCreditCard, FiInfo, FiFileText } from "react-icons/fi";

const won = (v) => `${Number(v || 0).toLocaleString()}원`;
const toMin = (hhmm) => {
  const [h, m] = String(hhmm || "0:0").split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
};
/** 이용 시간 — "2시간" · "1시간 30분" */
function durationText(start, end) {
  const mins = Math.max(0, toMin(end) - toMin(start));
  if (!mins) return "";
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h ? `${h}시간` : ""}${h && m ? " " : ""}${m ? `${m}분` : ""}`;
}
/**
 * 결제 금액이 어떻게 나온 값인지 한 줄로 — "40,000원 × 2시간" · "6,000원 × 2시간 × 4명".
 * 계산이 실제 결제액과 안 맞으면(옛 예약 문서엔 unitPrice 가 없다) 아무것도 돌려주지 않는다.
 * 틀린 내역을 보여주느니 총액만 보여주는 게 낫다.
 */
function priceBreakdown(resv) {
  const unit = Number(resv?.unitPrice) || 0;
  const total = Number(resv?.price) || 0;
  const mins = Math.max(0, toMin(resv?.endTime) - toMin(resv?.startTime));
  if (!unit || !mins || !total) return null;
  const perPerson = resv?.priceMode === "perPerson";
  const heads = perPerson ? Math.max(1, Number(resv?.headcount) || 1) : 1;
  if (Math.round((unit * mins * heads) / 60) !== total) return null;
  const hours = mins / 60;
  const hourLabel = Number.isInteger(hours) ? `${hours}시간` : `${(mins / 60).toFixed(1)}시간`;
  return {
    label: perPerson ? "1인 요금" : "코트 요금",
    detail: `${won(unit)} × ${hourLabel}${perPerson ? ` × ${heads}명` : ""}`,
    total,
  };
}

export default function PaymentPage() {
  const { reservationId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [order, setOrder] = useState(null);
  const [resv, setResv] = useState(null);
  const [paying, setPaying] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const widgetsRef = useRef(null);

  // 1) 예약 조회 + 서버 주문 생성. 여기서 loading 이 풀려야 위젯 컨테이너가 화면에 붙는다.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (hasMock("venueReservationDocs")) {
          const raw = mockData("venueReservationDocs")[reservationId];
          if (!raw) throw new Error("예약을 찾을 수 없어요.");
          if (!alive) return;
          setResv({ id: reservationId, ...raw });
        } else {
          const snap = await getDoc(doc(db, "venueReservations", reservationId));
          if (!snap.exists()) throw new Error("예약을 찾을 수 없어요.");
          if (!alive) return;
          setResv({ id: snap.id, ...snap.data() });
        }

        // 서버가 금액을 확정한다(위조 방지). 결제 자격이 없으면 여기서 막힌다.
        const o = await createOrder(reservationId);
        if (!alive) return;
        setOrder(o);
      } catch (e) {
        if (alive) setErr(e?.message || "결제를 준비하지 못했어요.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reservationId]);

  // 2) 위젯은 컨테이너(#toss-payment-method)가 DOM 에 붙은 뒤에 그린다.
  //    주문 생성에 이어 같은 effect 에서 그리면 그 시점엔 loading 이 아직 true 라
  //    컨테이너가 렌더되기 전이고, 위젯이 selector 를 못 찾아 항상 실패한다.
  useEffect(() => {
    if (loading || err || !order) return;
    let alive = true;
    (async () => {
      try {
        const w = await renderWidget({
          selector: "#toss-payment-method",
          agreementSelector: "#toss-agreement",
          amount: order.amount,
        });
        if (!alive) return;
        widgetsRef.current = w;
        setWidgetReady(true);
      } catch (e) {
        if (alive) setErr(e?.message || "결제 수단을 불러오지 못했어요.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [loading, err, order]);

  const onPay = async () => {
    if (!widgetsRef.current || !order) return;
    setPaying(true);
    try {
      await widgetsRef.current.requestPayment({
        orderId: order.orderId,
        orderName: order.orderName,
        successUrl: `${window.location.origin}/pay/success`,
        failUrl: `${window.location.origin}/pay/fail`,
      });
    } catch (e) {
      // 사용자가 결제창을 닫은 경우도 여기로 온다 → 조용히 복귀
      setPaying(false);
      if (e?.code && e.code !== "USER_CANCEL") setErr(e?.message || "결제에 실패했어요.");
    }
  };

  // 🧪 테스트 결제일 때만 뜨는 건너뛰기 — 결제창만 생략하고 결과 화면부터는 실결제와 같은 경로를 탄다.
  //    (서버가 토스 승인만 건너뛰고 예약 확정·원장 기록은 그대로 하므로 그 다음 흐름까지 확인된다)
  const onSkip = () => {
    if (!order) return;
    navigate(`/pay/success?testSkip=1&orderId=${encodeURIComponent(order.orderId)}&amount=${order.amount}`);
  };

  const isSplit = order?.side === "A" || order?.side === "B";
  const teamName = order?.side === "A" ? resv?.teamAName : resv?.teamBName;

  const bd = priceBreakdown(resv);
  const startLabel = formatStartAt(resv?.date, resv?.startTime); // "8월 2일 (일) 19:00"
  const duration = durationText(resv?.startTime, resv?.endTime);
  // 취소 규정은 "이용 2일 전까지" 같은 상대 표현이라, 지금 취소하면 얼마가 돌아오는지가 안 읽힌다.
  // 이 예약이 지금 어느 단계인지 짚고 환불 예정액을 금액으로 적는다.
  const stage = resv?.date ? cancelStageIndex(resv.date, resv.startTime) : 0;
  const refundNow = refundAmount(order?.amount, resv?.date, resv?.startTime);

  return (
    <Wrap>
      {loading && (
        <Center>
          <Spinner />
        </Center>
      )}

      {!loading && err && (
        <ErrBox>
          <p>{err}</p>
          <GhostBtn onClick={() => navigate(-1)}>돌아가기</GhostBtn>
        </ErrBox>
      )}

      {!loading && !err && (
        <>
          {IS_TEST_PAYMENT && <TestBadge>테스트 결제 — 실제로 돈이 빠지지 않아요</TestBadge>}

          {/* 어디까지 왔는지 — 결제 화면만 놓고 보면 "이걸 누르면 끝인지"가 안 보인다. */}
          <Steps>
            <Step $done>예약 확인</Step>
            <StepBar $done />
            <Step $on>결제</Step>
            <StepBar />
            <Step>예약 확정</Step>
          </Steps>

          <Card>
            <CardHead>
              <Title>예약 정보</Title>
              {resv?.reservationCode ? (
                <Code><FiHash size={12} />{resv.reservationCode}</Code>
              ) : null}
            </CardHead>
            <VenueLine>
              {resv?.venueName}
              {resv?.courtName ? <em> · {resv.courtName}</em> : null}
            </VenueLine>
            <Row>
              <FiCalendar />
              <span>{startLabel || `${resv?.date} ${resv?.startTime}`}~{resv?.endTime}</span>
            </Row>
            {duration ? (
              <Row><FiClock /><span>이용 시간 {duration}</span></Row>
            ) : null}
            {resv?.priceMode === "perPerson" && Number(resv?.headcount) > 0 ? (
              <Row><FiUsers /><span>이용 인원 {resv.headcount}명</span></Row>
            ) : null}
            {isSplit && (
              <Row>
                <FiUsers />
                <span>{resv?.teamAName || "우리 팀"} vs {resv?.teamBName || "상대 팀"}</span>
              </Row>
            )}
            <Row>
              <FiUser />
              <span>
                {resv?.userName || "예약자"}
                {resv?.teamName ? ` · ${resv.teamName}` : ""}
              </span>
            </Row>
            {resv?.venuePhone ? (
              <Row><FiPhone /><span>구장 {resv.venuePhone}</span></Row>
            ) : null}
            {resv?.userNote ? (
              <NoteBox><b>요청사항</b>{resv.userNote}</NoteBox>
            ) : null}
          </Card>

          <Card>
            <Title>결제 금액</Title>
            {/* 총액만 덩그러니 두면 "왜 이 금액인지"를 확인할 방법이 없다.
                예약 시 저장해 둔 단가로 계산 근거를 한 줄 편다. */}
            {bd ? (
              <SplitRow>
                <span>{bd.label}<em> {bd.detail}</em></span>
                <span>{won(bd.total)}</span>
              </SplitRow>
            ) : (
              <SplitRow>
                <span>구장 이용료</span>
                <span>{won(isSplit ? resv?.splitTotal : order?.amount)}</span>
              </SplitRow>
            )}
            {isSplit && (
              <>
                {/* 위 내역 줄이 이미 총액을 보여줬으면 같은 금액을 두 번 쓰지 않는다 */}
                {bd ? null : (
                  <SplitRow>
                    <span>구장 총 이용료</span>
                    <span>{won(resv?.splitTotal)}</span>
                  </SplitRow>
                )}
                <SplitNote>양 팀이 절반씩 나눠 결제해요. 상대 팀 몫은 상대 팀장이 결제합니다.</SplitNote>
                <Divider />
                <SplitRow>
                  <span>{teamName ? `${teamName} 몫` : "우리 팀 몫"}</span>
                  <span>{won(order?.amount)}</span>
                </SplitRow>
              </>
            )}
            {/* 총액 표시 모델 — 구장 등록가가 곧 결제액이라 사용자에게 더 붙는 항목이 없다.
                플랫폼 이용료는 구장 정산에서 떼므로 소비자 화면에 항목으로 노출하지 않는다
                (노출하면 사용자가 추가로 내는 돈으로 오인된다). */}
            <SplitRow>
              <span>수수료</span>
              <span>0원</span>
            </SplitRow>
            <Divider />
            <PayRow>
              <span>최종 결제 금액</span>
              <strong>{won(order?.amount)}</strong>
            </PayRow>
            <SplitNote>표시된 금액이 곧 결제 금액이에요. 예약 후 붙는 추가 수수료는 없어요.</SplitNote>
          </Card>

          {/* 토스 위젯도 다른 항목과 같은 카드 안에 둔다 — 밖에 맨몸으로 두면
              결제 수단만 페이지에서 떨어져 나온 것처럼 보인다. */}
          <Card>
            <Title><FiCreditCard size={15} /> 결제 수단</Title>
            <Widget id="toss-payment-method" />
            <Widget id="toss-agreement" />
            {!widgetReady && <WidgetHint>결제 수단을 불러오는 중이에요…</WidgetHint>}
          </Card>

          {/* 환불정책은 결제 화면에 반드시 노출한다(토스페이먼츠 심사 요건). */}
          <Card>
            <Title><FiFileText size={15} /> 취소·환불 규정</Title>
            {resv?.date ? (
              <NowBox $tone={CANCEL_POLICY_TIERS[stage]?.tone}>
                지금 취소하면 <b>{CANCEL_POLICY_TIERS[stage]?.what}</b>
                {refundNow > 0 ? <> — 환불 예정 <b>{won(refundNow)}</b></> : null}
              </NowBox>
            ) : null}
            <PolicyTable>
              {CANCEL_POLICY_TIERS.map((t, i) => (
                <PolicyRow key={t.when} $on={resv?.date ? i === stage : false} $tone={t.tone}>
                  <span>{t.when}</span>
                  <b>{t.what}</b>
                </PolicyRow>
              ))}
            </PolicyTable>
            <SplitNote>{CANCEL_POLICY_NOTE}</SplitNote>
          </Card>

          <Card>
            <Title><FiInfo size={15} /> 결제 전 확인해 주세요</Title>
            <Bullets>
              <li>결제가 끝나면 예약이 확정되고, 예약 내역은 마이페이지 &gt; 내 구장 예약에서 볼 수 있어요.</li>
              <li>취소는 이용 시작 전까지 앱에서 할 수 있고, 위 규정에 따라 환불돼요.</li>
              <li>현장 이용 관련 문의는 구장{resv?.venuePhone ? `(${resv.venuePhone})` : ""}으로, 결제·환불 문의는 1:1 문의로 남겨주세요.</li>
            </Bullets>
          </Card>

          <PayBar>
            <BarTop>
              <BarLabel>최종 결제 금액</BarLabel>
              <BarPrice>{won(order?.amount)}</BarPrice>
            </BarTop>
            {/* 위젯이 준비되기 전에 누르면 requestPayment 가 조용히 무시된다 → 준비될 때까지 잠근다 */}
            <PayBtn onClick={onPay} disabled={paying || !widgetReady}>
              {paying
                ? "결제창을 여는 중…"
                : widgetReady
                ? `${won(order?.amount)} 결제하기`
                : "결제 수단을 불러오는 중…"}
            </PayBtn>
            {/* 결제창을 안 거치므로 위젯 준비와 무관하게 누를 수 있다 */}
            {IS_TEST_PAYMENT && (
              <SkipBtn onClick={onSkip} disabled={paying}>
                결제 건너뛰기 (테스트)
              </SkipBtn>
            )}
          </PayBar>
        </>
      )}
    </Wrap>
  );
}

// 하단 고정 결제바 높이만큼 비워둔다. 테스트 건너뛰기 버튼이 붙으면 그만큼 더 필요하다.
const Wrap = styled.div`display: flex; flex-direction: column; gap: 14px; padding-bottom: calc(${IS_TEST_PAYMENT ? 176 : 128}px + env(safe-area-inset-bottom));`;
const Center = styled.div`min-height: 50vh; display: flex; align-items: center; justify-content: center;`;
const Card = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 14px;
  padding: 16px;
  display: flex; flex-direction: column; gap: 10px;
`;
const Title = styled.div`
  display: flex; align-items: center; gap: 6px;
  font-size: 16px; font-weight: 800;
  svg { flex: none; color: ${({ theme }) => theme.colors.primary}; }
`;
const CardHead = styled.div`display: flex; align-items: center; justify-content: space-between; gap: 10px;`;
/* 예약번호 — 문의할 때 부를 번호라 눈에 띄되 제목을 이기면 안 된다 */
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
/* 예약 시 구장에 남긴 요청사항 — 결제 직전에 한 번 더 확인시킨다 */
const NoteBox = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: 10px; padding: 10px 12px;
  font-size: 12.5px; line-height: 1.55; white-space: pre-wrap;
  color: ${({ theme }) => theme.colors.textNormal};
  b { display: block; margin-bottom: 2px; font-size: 11.5px; color: ${({ theme }) => theme.colors.textWeak}; }
`;
const Row = styled.div`
  display: flex; align-items: center; gap: 8px;
  font-size: 13.5px; color: ${({ theme }) => theme.colors.textWeak};
  svg { flex: none; }
`;
const SplitRow = styled.div`
  display: flex; justify-content: space-between; gap: 10px;
  font-size: 13.5px; color: ${({ theme }) => theme.colors.textWeak};
  em { font-style: normal; font-size: 12px; opacity: 0.85; }
`;

/* 결제 단계 — 예약 확인 · 결제 · 예약 확정 */
const Steps = styled.div`display: flex; align-items: center; gap: 6px; padding: 0 2px;`;
const Step = styled.div`
  font-size: 12px; font-weight: ${({ $on }) => ($on ? 800 : 600)};
  color: ${({ $on, $done, theme }) => ($on ? theme.colors.primary : $done ? theme.colors.textNormal : theme.colors.textWeak)};
`;
const StepBar = styled.div`
  flex: 1; height: 2px; border-radius: 2px;
  background: ${({ $done, theme }) => ($done ? theme.colors.primary : theme.colors.border)};
`;

/* 토스 위젯이 붙는 자리 — 위젯이 자기 여백을 갖고 있어 카드 안에서 위아래로 뜬다 */
const Widget = styled.div`margin: 0 -8px;`;
const WidgetHint = styled.div`font-size: 12.5px; color: ${({ theme }) => theme.colors.textWeak};`;

/* 지금 취소하면 어떻게 되는지 — 규정표보다 이게 먼저 읽혀야 한다 */
const TONES = { ok: "#16a34a", warn: "#b45309", danger: "#dc2626" };
const NowBox = styled.div`
  border-radius: 10px; padding: 11px 12px;
  background: ${({ theme }) => theme.colors.surface};
  font-size: 12.5px; line-height: 1.55;
  color: ${({ theme }) => theme.colors.textNormal};
  b { font-weight: 800; color: ${({ $tone }) => TONES[$tone] || TONES.warn}; }
`;
const PolicyTable = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px; overflow: hidden;
`;
const PolicyRow = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 10px 12px; font-size: 12.5px;
  background: ${({ $on, theme }) => ($on ? theme.colors.surface : "transparent")};
  & + & { border-top: 1px solid ${({ theme }) => theme.colors.border}; }
  & > span {
    color: ${({ theme }) => theme.colors.textNormal};
    font-weight: ${({ $on }) => ($on ? 800 : 600)};
  }
  & > b { font-weight: 700; color: ${({ $tone }) => TONES[$tone] || TONES.warn}; }
`;
const Bullets = styled.ul`
  margin: 0; padding-left: 16px;
  display: flex; flex-direction: column; gap: 6px;
  font-size: 12.5px; line-height: 1.55;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const SplitNote = styled.p`margin: 0; font-size: 12.5px; line-height: 1.5; color: ${({ theme }) => theme.colors.textWeak};`;
const Divider = styled.div`height: 1px; background: ${({ theme }) => theme.colors.border};`;
/* 최종 결제 금액 — 라벨은 평문, 숫자만 크고 진하게(금액이 먼저 읽혀야 한다) */
const PayRow = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textNormal};
  strong {
    font-size: 22px;
    font-weight: 900;
    letter-spacing: -0.5px;
    font-variant-numeric: tabular-nums;
    color: ${({ theme }) => theme.colors.primary};
  }
`;
const TestBadge = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const PayBar = styled.div`
  position: fixed; left: 0; right: 0; bottom: 0;
  margin: 0 auto; width: 100%; max-width: ${({ theme }) => theme.layout.maxWidth}px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: ${({ theme }) => theme.colors.bg};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  display: flex; flex-direction: column; gap: 8px;
`;
/* 하단 바에도 금액을 둔다 — 버튼만 있으면 스크롤을 올려야 얼마인지 확인된다 */
const BarTop = styled.div`display: flex; align-items: baseline; justify-content: space-between; gap: 10px;`;
const BarLabel = styled.div`font-size: 12.5px; font-weight: 600; color: ${({ theme }) => theme.colors.textWeak};`;
const BarPrice = styled.div`
  font-size: 18px; font-weight: 900; letter-spacing: -0.4px;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.textStrong};
`;
const PayBtn = styled.button`
  width: 100%; height: 52px; border: none; border-radius: 12px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff; font-size: 15px; font-weight: 800; cursor: pointer;
  &:disabled { opacity: 0.6; cursor: default; }
`;
const SkipBtn = styled.button`
  width: 100%; height: 40px; border-radius: 10px; cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: transparent;
  color: ${({ theme }) => theme.colors.textWeak};
  font-size: 13px; font-weight: 700;
  &:disabled { opacity: 0.6; cursor: default; }
`;
const ErrBox = styled.div`
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  padding: 48px 16px;
  p { margin: 0; font-size: 14px; color: ${({ theme }) => theme.colors.textWeak}; text-align: center; }
`;
const GhostBtn = styled.button`
  height: 44px; padding: 0 20px; border-radius: 10px; cursor: pointer;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: transparent; color: inherit; font-size: 14px; font-weight: 700;
`;
