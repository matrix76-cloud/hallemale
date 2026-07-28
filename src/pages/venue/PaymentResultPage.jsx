/* eslint-disable */
// src/pages/venue/PaymentResultPage.jsx
// 토스 결제창 복귀 지점. /pay/success · /pay/fail 둘 다 이 화면이 받는다.
//   성공 리다이렉트는 "결제 완료"가 아니라 "승인해도 좋다"는 신호다 → 여기서 서버 승인(confirm)을
//   호출해야 실제로 결제가 확정된다. 승인 실패 시 돈은 빠지지 않는다.
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { confirmPayment } from "../../services/tossPayments";
import Spinner from "../../components/common/Spinner";
import { FiCheckCircle, FiXCircle } from "react-icons/fi";

const won = (v) => `${Number(v || 0).toLocaleString()}원`;

export default function PaymentResultPage() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isFail = pathname.endsWith("/fail");

  const [state, setState] = useState(isFail ? "failed" : "confirming");
  const [message, setMessage] = useState(sp.get("message") || "");
  const [result, setResult] = useState(null);
  // StrictMode 이중 실행으로 승인이 두 번 나가지 않게 막는다.
  const ranRef = useRef(false);

  useEffect(() => {
    if (isFail || ranRef.current) return;
    ranRef.current = true;

    const paymentKey = sp.get("paymentKey");
    const orderId = sp.get("orderId");
    const amount = Number(sp.get("amount"));
    if (!paymentKey || !orderId || !amount) {
      setState("failed");
      setMessage("결제 정보가 올바르지 않아요.");
      return;
    }

    (async () => {
      try {
        const r = await confirmPayment({ paymentKey, orderId, amount });
        setResult(r);
        setState("done");
      } catch (e) {
        setMessage(e?.message || "결제 승인에 실패했어요.");
        setState("failed");
      }
    })();
  }, [isFail, sp]);

  const goBack = () => {
    const matchId = result?.matchId;
    navigate(matchId ? `/match-roomdetail/${matchId}` : "/venues", { replace: true });
  };

  if (state === "confirming") {
    return (
      <Center>
        <Spinner />
        <Note>결제를 확인하고 있어요…</Note>
      </Center>
    );
  }

  if (state === "failed") {
    return (
      <Center>
        <FiXCircle size={44} />
        <Head>결제가 완료되지 않았어요</Head>
        <Note>{message || "다시 시도해 주세요."}</Note>
        <Btn onClick={() => navigate(-1)}>돌아가기</Btn>
      </Center>
    );
  }

  // 분담결제에서 상대 팀이 아직 안 냈으면 그 사실을 알려줘야 흐름이 안 끊긴다.
  const waiting = result?.reservationStatus === "pending";

  return (
    <Center>
      <FiCheckCircle size={44} />
      <Head>결제가 완료됐어요</Head>
      <Amount>{won(result?.amount)}</Amount>
      <Note>
        {waiting
          ? "상대 팀이 남은 몫을 결제하면 예약이 확정돼요. 2시간 안에 결제되지 않으면 자동 취소되고 결제하신 금액은 환불됩니다."
          : "예약이 확정됐어요."}
      </Note>
      <Btn onClick={goBack}>확인</Btn>
    </Center>
  );
}

const Center = styled.div`
  min-height: 70vh;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 24px 16px calc(24px + env(safe-area-inset-bottom));
  text-align: center;
  svg { color: ${({ theme }) => theme.colors.textWeak}; }
`;
const Head = styled.div`font-size: 18px; font-weight: 800;`;
const Amount = styled.div`font-size: 24px; font-weight: 800;`;
const Note = styled.p`
  margin: 0; max-width: 320px;
  font-size: 13.5px; line-height: 1.6;
  color: ${({ theme }) => theme.colors.textWeak};
`;
const Btn = styled.button`
  margin-top: 8px; height: 48px; padding: 0 28px; border: none; border-radius: 12px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff; font-size: 15px; font-weight: 800; cursor: pointer;
`;
