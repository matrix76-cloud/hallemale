/* eslint-disable */
// src/pages/matching/MatchPayPage.jsx
// 제휴구장 분할결제 화면 — 상대팀 수락 후 진입. 양 팀 각자 절반 결제 → 둘 다 결제 시 확정.
// 결제 전에 나가면 매칭은 그대로 조율중/제안 상태 유지 (예약 안 생김).
import React, { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../hooks/useAuth";
import { useClub } from "../../hooks/useClub";
import { useUI } from "../../hooks/useUI";
import { payPartnerShare, getMatchReservationStatus, expireMatchReservationIfNeeded } from "../../services/ownerVenueService";
import Spinner from "../../components/common/Spinner";

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
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await expireMatchReservationIfNeeded(id).catch(() => {});
      const snap = await getDoc(doc(db, "match_requests", id));
      const data = snap.exists() ? snap.data() : null;
      setPb(data?.partnerBooking || null);
      setResv(await getMatchReservationStatus(id));
    } catch (e) {
      setPb(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

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
      const res = await payPartnerShare({
        matchId: id, side, payerUid: uid, payerTeamName: myTeam,
        payerName: userDoc?.nickname || "",
        payerPhone: userDoc?.phoneE164 || userDoc?.phone || "",
      });
      await load();
      if (res?.state === "confirmed") {
        toast("양 팀 결제 완료! 구장 예약이 확정됐어요.");
        navigate(`/match-roomdetail/${id}`, { replace: true });
      } else {
        toast("결제 완료! 상대팀 결제를 기다리는 중이에요.");
      }
    } catch (e) {
      toast(e?.message || "결제에 실패했어요.");
    } finally { setPaying(false); }
  };

  return (
    <Wrap>
      <Sub>{myTeam} 부담분</Sub>

      <Card>
        <CardTitle>대관료 정산</CardTitle>
        <Line><span>대관료 (양 팀 공동)</span><b>{total.toLocaleString()}원</b></Line>
        <Line><span>우리 팀 부담 (1/2)</span><b>{myShare.toLocaleString()}원</b></Line>
        <Divider />
        <Line $big><span>결제 금액</span><Strong>{myShare.toLocaleString()}원</Strong></Line>
      </Card>

      <Card>
        <CardTitle>양 팀 결제 현황</CardTitle>
        <TeamRow><span>{myTeam} (우리)</span><Stat $on={myPaid}>{myPaid ? "✓ 결제완료" : "미결제"}</Stat></TeamRow>
        <TeamRow><span>{oppTeam}</span><Stat $on={oppPaid}>{oppPaid ? "✓ 결제완료" : "미결제"}</Stat></TeamRow>
        {!confirmed && myPaid && (
          <Note>상대팀 결제를 기다리는 중이에요{rm != null ? ` · 남은 시간 ${rm}분` : ""}. (2시간 내 미결제 시 자동취소·환불)</Note>
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
        <PrimaryBtn type="button" onClick={handlePay} disabled={paying}>
          {paying ? "결제 중…" : `${myShare.toLocaleString()}원 결제하기`}
        </PrimaryBtn>
      )}
      <BtnNote>내 몫만 결제돼요. 양 팀 모두 결제하면 예약이 확정됩니다.</BtnNote>
    </Wrap>
  );
}

const VIO = "#7C3AED";
const Wrap = styled.div`display: flex; flex-direction: column; gap: 14px; padding-bottom: 20px;`;
const Center = styled.div`min-height: 50vh; display: flex; align-items: center; justify-content: center; color: ${({ theme }) => theme.colors.textWeak}; font-size: 14px;`;
const Sub = styled.div`font-size: 13px; color: ${({ theme }) => theme.colors.textWeak};`;
const Card = styled.section`background: ${({ theme }) => theme.colors.card}; border: 1px solid ${({ theme }) => theme.colors.border}; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px;`;
const CardTitle = styled.div`font-size: 13px; font-weight: 700; color: ${({ theme }) => theme.colors.textWeak};`;
const Line = styled.div`display: flex; align-items: center; justify-content: space-between; font-size: ${({ $big }) => ($big ? "15px" : "14px")}; color: ${({ theme }) => theme.colors.textNormal}; & b { font-weight: 700; color: ${({ theme }) => theme.colors.textStrong}; }`;
const Strong = styled.b`font-size: 20px; font-weight: 800; color: ${VIO} !important;`;
const Divider = styled.div`height: 1px; background: ${({ theme }) => theme.colors.border}; margin: 2px 0;`;
const TeamRow = styled.div`display: flex; align-items: center; justify-content: space-between; font-size: 14px; color: ${({ theme }) => theme.colors.textStrong}; font-weight: 600;`;
const Stat = styled.span`font-size: 13px; font-weight: 700; color: ${({ $on }) => ($on ? "#16A34A" : "#94A3B8")};`;
const Note = styled.div`font-size: 12px; color: ${({ theme }) => theme.colors.textWeak}; line-height: 1.5;`;
const NoteOk = styled.div`font-size: 13px; font-weight: 700; color: #16A34A;`;
const Spacer = styled.div`flex: 1; min-height: 8px;`;
const PrimaryBtn = styled.button`width: 100%; height: 52px; border: none; border-radius: 14px; background: ${VIO}; color: #fff; font-size: 16px; font-weight: 800; cursor: pointer; &:hover { filter: brightness(0.96); } &:active { transform: translateY(1px); } &:disabled { opacity: 0.5; }`;
const DoneBtn = styled(PrimaryBtn)`background: ${({ theme }) => theme.colors.surface}; color: ${({ theme }) => theme.colors.textWeak}; cursor: default;`;
const BtnNote = styled.div`text-align: center; font-size: 11.5px; color: ${({ theme }) => theme.colors.textWeak};`;
