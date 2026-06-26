/* eslint-disable */
// src/pages/matching/MatchPayPage.jsx
// 제휴구장 분할결제 화면 — 상대팀 수락 후 진입. 양 팀 각자 절반 결제 → 둘 다 결제 시 확정.
// 결제 전에 나가면 매칭은 그대로 조율중/제안 상태 유지 (예약 안 생김).
// ※ PG(카카오페이/네이버페이/토스페이/카드) 연동 가정 — 결제수단 선택 UI 포함.
import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../hooks/useAuth";
import { useClub } from "../../hooks/useClub";
import { useUI } from "../../hooks/useUI";
import { payPartnerShare, getMatchReservationStatus, expireMatchReservationIfNeeded, getVenue } from "../../services/ownerVenueService";
import { sendPaymentReminder, subscribeMatchRoom } from "../../services/matchRoomService";
import { requestTossPayment } from "../../services/tossPay";
import Spinner from "../../components/common/Spinner";
import { FiMapPin, FiClock, FiBell } from "react-icons/fi";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
function fmtWhen(pb) {
  if (!pb) return "";
  const d = pb.date ? new Date(`${pb.date}T00:00:00`) : null;
  const dateLabel = d ? `${d.getMonth() + 1}.${d.getDate()} (${WD[d.getDay()]})` : (pb.date || "");
  const time = [pb.startTime, pb.endTime].filter(Boolean).join("~");
  return [dateLabel, time].filter(Boolean).join(" ");
}

const TOSS_PENDING_KEY = "halle.toss.pending";

export default function MatchPayPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { firebaseUser, userDoc } = useAuth();
  const { club } = useClub();
  const { showToast } = useUI() || {};
  const toast = (m) => showToast && showToast({ message: m });

  const uid = firebaseUser?.uid || "";
  const myClubId = String(club?.clubId || club?.id || userDoc?.activeTeamId || "");

  const [pb, setPb] = useState(null);
  const [resv, setResv] = useState(null);
  const [venueAddr, setVenueAddr] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const navedRef = useRef(false);
  const tossHandledRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await expireMatchReservationIfNeeded(id).catch(() => {});
      const snap = await getDoc(doc(db, "match_requests", id));
      const data = snap.exists() ? snap.data() : null;
      const booking = data?.partnerBooking || null;
      setPb(booking);
      setResv(await getMatchReservationStatus(id));
      if (booking?.venueId) {
        getVenue(booking.venueId)
          .then((v) => setVenueAddr([v?.address, v?.addressDetail].filter(Boolean).join(" ")))
          .catch(() => {});
      }
    } catch (e) {
      setPb(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // 실시간: 양 팀 결제로 매칭이 confirmed 되면 매칭룸으로 이동하며 최종 확정 축하 표시
  useEffect(() => {
    if (!id) return;
    let baseline = null;
    const unsub = subscribeMatchRoom(id, (sig) => {
      const st = sig?.status || "";
      if (baseline === null) { baseline = st; return; }
      if (st === "confirmed" && !navedRef.current) {
        navedRef.current = true;
        navigate(`/match-roomdetail/${id}`, { replace: true, state: { celebrateConfirmed: true } });
      }
    });
    return () => unsub && unsub();
  }, [id, navigate]);

  // 토스 결제창에서 돌아왔을 때 처리 (?toss=success | ?toss=fail)
  // ⚠️ 프론트 전용 테스트: 서버 승인 검증 없이 성공 redirect만으로 결제 처리.
  useEffect(() => {
    if (tossHandledRef.current) return;
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("toss");
    if (!t) return;
    const stripUrl = () => navigate(`/match-pay/${id}`, { replace: true });

    if (t === "fail") {
      tossHandledRef.current = true;
      try { sessionStorage.removeItem(TOSS_PENDING_KEY); } catch {}
      toast("결제가 취소되었어요.");
      stripUrl();
      return;
    }
    if (t === "success") {
      if (!uid) return; // 인증 복원 대기
      tossHandledRef.current = true;
      let pend = null;
      try { pend = JSON.parse(sessionStorage.getItem(TOSS_PENDING_KEY) || "null"); } catch {}
      try { sessionStorage.removeItem(TOSS_PENDING_KEY); } catch {}
      if (!pend || pend.matchId !== id) { stripUrl(); return; }
      (async () => {
        setPaying(true);
        try {
          const res = await payPartnerShare({
            matchId: id, side: pend.side, payerUid: uid, payerTeamName: pend.payerTeamName,
            payerName: pend.payerName, payerPhone: pend.payerPhone,
          });
          if (res?.state === "confirmed") {
            navedRef.current = true;
            navigate(`/match-roomdetail/${id}`, { replace: true, state: { celebrateConfirmed: true } });
            return;
          }
          await load();
          toast("결제 완료! 상대팀 결제를 기다리는 중이에요.");
        } catch (e) {
          toast(e?.message || "결제 처리에 실패했어요.");
        } finally {
          setPaying(false);
          stripUrl();
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, uid]);

  if (loading) return <Center><Spinner size="lg" /></Center>;
  if (!pb) return <Center>결제할 구장 정보가 없어요.</Center>;

  const side = myClubId === String(pb.proposerClubId) ? "A" : "B";
  const myTeam = side === "A" ? pb.proposerTeamName : pb.opponentTeamName;
  const oppTeam = side === "A" ? pb.opponentTeamName : pb.proposerTeamName;
  const myShare = side === "A" ? pb.shareA : pb.shareB;
  const total = pb.totalPrice || 0;
  const myPaid = resv ? (side === "A" ? resv.paidByA : resv.paidByB) : false;
  const oppPaid = resv ? (side === "A" ? resv.paidByB : resv.paidByA) : false;
  const confirmed = resv?.status === "confirmed";
  const rm = resv?.deadline ? Math.max(0, Math.round((new Date(resv.deadline).getTime() - Date.now()) / 60000)) : null;

  const handlePay = async () => {
    if (paying || myPaid) return;
    setPaying(true);
    try {
      // 결제 의도를 저장 → 토스 결제창 성공 redirect 복귀 시 사용
      const pending = {
        matchId: id, side, payerTeamName: myTeam,
        payerName: userDoc?.nickname || "",
        payerPhone: userDoc?.phoneE164 || userDoc?.phone || "",
      };
      try { sessionStorage.setItem(TOSS_PENDING_KEY, JSON.stringify(pending)); } catch {}

      const origin = window.location.origin;
      const orderId = `m${id}-${side}-${Date.now()}`;
      await requestTossPayment({
        method: "card",
        amount: myShare,
        orderId,
        orderName: `${pb.venueName || "구장"} 대관료 (${myTeam} 부담분)`,
        customerName: userDoc?.nickname || myTeam || "사용자",
        successUrl: `${origin}/match-pay/${id}?toss=success`,
        failUrl: `${origin}/match-pay/${id}?toss=fail`,
      });
      // 정상 호출 시 토스로 페이지가 리다이렉트되므로 이 아래는 실행되지 않음
    } catch (e) {
      try { sessionStorage.removeItem(TOSS_PENDING_KEY); } catch {}
      toast(e?.message || "결제창을 열지 못했어요.");
      setPaying(false);
    }
  };

  // 가상결제 (PC 테스트용) — 토스 결제창을 거치지 않고 바로 결제 처리
  const handleVirtualPay = async () => {
    if (paying || myPaid) return;
    setPaying(true);
    try {
      const res = await payPartnerShare({
        matchId: id, side, payerUid: uid, payerTeamName: myTeam,
        payerName: userDoc?.nickname || "",
        payerPhone: userDoc?.phoneE164 || userDoc?.phone || "",
      });
      if (res?.state === "confirmed") {
        navedRef.current = true;
        navigate(`/match-roomdetail/${id}`, { replace: true, state: { celebrateConfirmed: true } });
      } else {
        await load();
        toast("가상결제 완료! 상대팀 결제를 기다리는 중이에요.");
      }
    } catch (e) {
      toast(e?.message || "가상결제에 실패했어요.");
    } finally { setPaying(false); }
  };

  const handleRemind = async () => {
    if (reminderBusy || reminderSent) return;
    setReminderBusy(true);
    try {
      await sendPaymentReminder({ matchRequestId: id, fromClubId: myClubId });
      setReminderSent(true);
      toast("상대팀에 결제 요청 알림을 보냈어요.");
    } catch (e) {
      toast(e?.message || "알림 전송에 실패했어요.");
    } finally { setReminderBusy(false); }
  };

  return (
    <Wrap>
      {/* 구장 정보 */}
      <VenueCard>
        <VThumb>
          {pb.venueImageUrl ? <VThumbImg src={pb.venueImageUrl} alt={pb.venueName} /> : <FiMapPin size={22} />}
        </VThumb>
        <VInfo>
          <VName>{pb.venueName || "구장"}</VName>
          <VLine><FiClock size={12} /> {fmtWhen(pb)}{pb.courtName ? ` · ${pb.courtName}` : ""}</VLine>
          {venueAddr ? <VLine><FiMapPin size={12} /> {venueAddr}</VLine> : null}
        </VInfo>
      </VenueCard>

      {/* 부담분 */}
      <Card>
        <Sub>{myTeam} 부담분</Sub>
        <Line><span>대관료 (양 팀 공동)</span><b>{total.toLocaleString()}원</b></Line>
        <Line><span>우리 팀 부담 (1/2)</span><b>{myShare.toLocaleString()}원</b></Line>
        <Divider />
        <Line $big><span>결제 금액</span><Strong>{myShare.toLocaleString()}원</Strong></Line>
      </Card>

      {/* 양 팀 결제 현황 */}
      <Card>
        <CardTitle>양 팀 결제 현황</CardTitle>
        <TeamRow><span>{myTeam} (우리)</span><Stat $on={myPaid}>{myPaid ? "✓ 결제완료" : "미결제"}</Stat></TeamRow>
        <TeamRow><span>{oppTeam}</span><Stat $on={oppPaid}>{oppPaid ? "✓ 결제완료" : "미결제"}</Stat></TeamRow>
        {!confirmed && myPaid && (
          <Note>상대팀 결제를 기다리는 중이에요{rm != null ? ` · 남은 시간 ${rm}분` : ""}. (2시간 내 미결제 시 자동취소·환불)</Note>
        )}
        {!confirmed && myPaid && !oppPaid && (
          <RemindBtn type="button" onClick={handleRemind} disabled={reminderBusy || reminderSent}>
            <FiBell size={15} />
            {reminderSent ? "알림을 보냈어요" : reminderBusy ? "보내는 중…" : `${oppTeam}에게 결제 알림 보내기`}
          </RemindBtn>
        )}
        {confirmed && <NoteOk>✅ 양 팀 결제완료 · 예약이 확정됐어요!</NoteOk>}
        {!myPaid && <Note>결제하지 않고 나가면 예약은 만들어지지 않고 매칭은 조율중으로 유지돼요.</Note>}
      </Card>

      <Spacer />

      {confirmed ? (
        <PrimaryBtn type="button" onClick={() => navigate(`/match-roomdetail/${id}`, { replace: true })}>
          매칭룸으로
        </PrimaryBtn>
      ) : myPaid ? (
        <DoneBtn disabled>우리 팀 결제 완료 · 상대팀 대기</DoneBtn>
      ) : (
        <PayRow>
          <PrimaryBtn type="button" onClick={handlePay} disabled={paying}>
            {paying ? "결제 중…" : `${myShare.toLocaleString()}원 결제하기`}
          </PrimaryBtn>
          <VirtualBtn type="button" onClick={handleVirtualPay} disabled={paying}>
            가상결제
          </VirtualBtn>
        </PayRow>
      )}
      <BtnNote>내 몫만 결제돼요. 양 팀 모두 결제하면 예약이 확정됩니다.</BtnNote>
    </Wrap>
  );
}

const VIO = "#7C3AED";
const Wrap = styled.div`display: flex; flex-direction: column; gap: 14px; padding-bottom: 20px;`;
const Center = styled.div`min-height: 50vh; display: flex; align-items: center; justify-content: center; color: ${({ theme }) => theme.colors.textWeak}; font-size: 14px;`;
const Sub = styled.div`font-size: 13px; font-weight: 700; color: ${({ theme }) => theme.colors.textWeak};`;
const Card = styled.section`background: ${({ theme }) => theme.colors.card}; border: 1px solid ${({ theme }) => theme.colors.border}; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px;`;
const CardTitle = styled.div`font-size: 13px; font-weight: 700; color: ${({ theme }) => theme.colors.textWeak};`;

/* 구장 정보 카드 */
const VenueCard = styled.section`
  background: ${({ theme }) => theme.colors.card};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 16px; padding: 14px;
  display: flex; align-items: center; gap: 12px;
`;
const VThumb = styled.div`
  width: 60px; height: 60px; flex-shrink: 0; border-radius: 12px; overflow: hidden;
  background: ${({ theme }) => theme.colors.surface};
  display: flex; align-items: center; justify-content: center; color: ${({ theme }) => theme.colors.textWeak};
`;
const VThumbImg = styled.img`width: 100%; height: 100%; object-fit: cover;`;
const VInfo = styled.div`flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;`;
const VName = styled.div`font-size: 15px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};`;
const VLine = styled.div`
  font-size: 12.5px; color: ${({ theme }) => theme.colors.textNormal};
  display: flex; align-items: center; gap: 5px;
  & > svg { color: ${({ theme }) => theme.colors.textWeak}; flex-shrink: 0; }
`;

const Line = styled.div`display: flex; align-items: center; justify-content: space-between; font-size: ${({ $big }) => ($big ? "15px" : "14px")}; color: ${({ theme }) => theme.colors.textNormal}; & b { font-weight: 700; color: ${({ theme }) => theme.colors.textStrong}; }`;
const Strong = styled.b`font-size: 20px; font-weight: 800; color: ${VIO} !important;`;
const Divider = styled.div`height: 1px; background: ${({ theme }) => theme.colors.border}; margin: 2px 0;`;

const TeamRow = styled.div`display: flex; align-items: center; justify-content: space-between; font-size: 14px; color: ${({ theme }) => theme.colors.textStrong}; font-weight: 600;`;
const Stat = styled.span`font-size: 13px; font-weight: 700; color: ${({ $on }) => ($on ? "#16A34A" : "#94A3B8")};`;
const Note = styled.div`font-size: 12px; color: ${({ theme }) => theme.colors.textWeak}; line-height: 1.5;`;
const RemindBtn = styled.button`
  margin-top: 4px;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; height: 44px; border-radius: 11px; cursor: pointer;
  border: 1.5px solid ${VIO};
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(124,58,237,0.12)" : "#f5f3ff")};
  color: ${VIO}; font-size: 13.5px; font-weight: 800;
  &:disabled { opacity: 0.55; cursor: default; }
  &:active:not(:disabled) { transform: translateY(1px); }
`;
const NoteOk = styled.div`font-size: 13px; font-weight: 700; color: #16A34A;`;
const Spacer = styled.div`flex: 1; min-height: 8px;`;
const PrimaryBtn = styled.button`width: 100%; height: 52px; border: none; border-radius: 14px; background: ${VIO}; color: #fff; font-size: 16px; font-weight: 800; cursor: pointer; &:hover { filter: brightness(0.96); } &:active { transform: translateY(1px); } &:disabled { opacity: 0.5; }`;
const DoneBtn = styled(PrimaryBtn)`background: ${({ theme }) => theme.colors.surface}; color: ${({ theme }) => theme.colors.textWeak}; cursor: default;`;
/* 결제하기 + 가상결제 나란히 */
const PayRow = styled.div`display: flex; gap: 8px; & > button:first-child { flex: 1; }`;
/* 가상결제(테스트) 버튼 — 토스 안 거치고 바로 결제 처리 */
const VirtualBtn = styled.button`
  flex-shrink: 0; width: 96px; height: 52px; border-radius: 14px; cursor: pointer;
  border: 1.5px dashed ${VIO};
  background: ${({ theme }) => (theme.mode === "dark" ? "rgba(124,58,237,0.12)" : "#f5f3ff")};
  color: ${VIO}; font-size: 14px; font-weight: 800;
  &:active:not(:disabled) { transform: translateY(1px); }
  &:disabled { opacity: 0.5; cursor: default; }
`;
const BtnNote = styled.div`text-align: center; font-size: 11.5px; color: ${({ theme }) => theme.colors.textWeak};`;
