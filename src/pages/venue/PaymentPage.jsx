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
import { CANCEL_POLICY_TIERS, CANCEL_POLICY_NOTE } from "../../constants/cancelPolicy";
import Spinner from "../../components/common/Spinner";
import { FiMapPin, FiCalendar, FiUsers } from "react-icons/fi";

const won = (v) => `${Number(v || 0).toLocaleString()}원`;

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

          <Card>
            <Title>{resv?.venueName}</Title>
            <Row>
              <FiCalendar />
              <span>
                {resv?.date} {resv?.startTime}~{resv?.endTime}
              </span>
            </Row>
            <Row>
              <FiMapPin />
              <span>{resv?.courtName}</span>
            </Row>
            {isSplit && (
              <Row>
                <FiUsers />
                <span>
                  {resv?.teamAName} vs {resv?.teamBName}
                </span>
              </Row>
            )}
          </Card>

          <Card>
            {isSplit ? (
              <>
                <SplitRow>
                  <span>구장 총 이용료</span>
                  <span>{won(resv?.splitTotal)}</span>
                </SplitRow>
                <SplitNote>양 팀이 절반씩 나눠 결제해요. 상대 팀 몫은 상대 팀장이 결제합니다.</SplitNote>
                <Divider />
                <SplitRow>
                  <span>{teamName ? `${teamName} 몫` : "우리 팀 몫"}</span>
                  <span>{won(order?.amount)}</span>
                </SplitRow>
              </>
            ) : (
              <SplitRow>
                <span>구장 이용료</span>
                <span>{won(order?.amount)}</span>
              </SplitRow>
            )}
            {/* 총액 표시 모델 — 구장 등록가가 곧 결제액이라 사용자에게 더 붙는 항목이 없다.
                플랫폼 이용료는 구장 정산에서 떼므로 소비자 화면에 항목으로 노출하지 않는다
                (노출하면 사용자가 추가로 내는 돈으로 오인된다). */}
            <Divider />
            <PayRow>
              <span>결제 금액</span>
              <strong>{won(order?.amount)}</strong>
            </PayRow>
          </Card>

          <div id="toss-payment-method" />
          <div id="toss-agreement" />

          {/* 환불정책은 결제 화면에 반드시 노출한다(토스페이먼츠 심사 요건). */}
          <Card>
            <Title>취소·환불 규정</Title>
            {CANCEL_POLICY_TIERS.map((t) => (
              <SplitRow key={t.when}>
                <span>{t.when}</span>
                <span>{t.what}</span>
              </SplitRow>
            ))}
            <SplitNote>{CANCEL_POLICY_NOTE}</SplitNote>
          </Card>

          <PayBar>
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
const Wrap = styled.div`display: flex; flex-direction: column; gap: 14px; padding-bottom: calc(${IS_TEST_PAYMENT ? 144 : 96}px + env(safe-area-inset-bottom));`;
const Center = styled.div`min-height: 50vh; display: flex; align-items: center; justify-content: center;`;
const Card = styled.div`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 14px;
  padding: 16px;
  display: flex; flex-direction: column; gap: 10px;
`;
const Title = styled.div`font-size: 16px; font-weight: 800;`;
const Row = styled.div`
  display: flex; align-items: center; gap: 8px;
  font-size: 13.5px; color: ${({ theme }) => theme.colors.textWeak};
  svg { flex: none; }
`;
const SplitRow = styled.div`display: flex; justify-content: space-between; font-size: 13.5px; color: ${({ theme }) => theme.colors.textWeak};`;
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
