/* eslint-disable */
// src/pages/venue/CourtBookingPage.jsx
// 코트 상세 — 날짜·시간(빈 슬롯) 선택 → 결제/예약 또는 매칭룸 구장·일정 제안
// 진입: /venue-book/:id/court/:courtId  (구장 상세 → 코트 카드 클릭)
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useUI } from "../../hooks/useUI";
import { proposeMatchSchedule } from "../../services/matchRoomService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import {
  getVenue, listReservations, listBlocks, bookVenue, writePartnerBooking,
  calcSlotPrice, dowToKey,
} from "../../services/ownerVenueService";
import { getFizzBalance, chargeFizz } from "../../services/fizzService";
import Spinner from "../../components/common/Spinner";
import { FiCalendar, FiClock, FiMapPin } from "react-icons/fi";

function toMin(hhmm) { const [h, m] = String(hhmm || "0:0").split(":").map((x) => parseInt(x, 10) || 0); return h * 60 + m; }
function toHHMM(min) { return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`; }
function overlap(aS, aE, bS, bE) { return toMin(aS) < toMin(bE) && toMin(aE) > toMin(bS); }
function buildSlots(court, dayKey) {
  if (!court) return [];
  const h = court.hours?.[dayKey];
  if (!h || h.closed) return [];
  const step = court.slotMinutes || 60;
  const out = [];
  for (let t = toMin(h.open); t + step <= toMin(h.close); t += step) out.push({ start: toHHMM(t), end: toHHMM(t + step) });
  return out;
}
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export default function CourtBookingPage() {
  const { id, courtId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const matchId = params.get("match") || "";
  const viewOnly = params.get("view") === "1"; // 매칭 카드에서 들어온 읽기 전용(예약 불가)
  const { firebaseUser, userDoc } = useAuth();
  const { showToast } = useUI() || {};
  const toast = (m) => { if (showToast) showToast({ message: m }); };
  const uid = firebaseUser?.uid || "";

  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [reservations, setReservations] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [balance, setBalance] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [matchInfo, setMatchInfo] = useState(null);

  const dates = useMemo(() => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(base + i * 86400000);
      return { date: ymd(d), day: d.getDate(), wd: WEEK[d.getDay()], dow: d.getDay() };
    });
  }, []);
  const nowMin = useMemo(() => { const n = new Date(); return { today: ymd(n), min: n.getHours() * 60 + n.getMinutes() }; }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getVenue(id).then((v) => {
      if (cancelled) return;
      setVenue(v);
      setDate(dates[0]?.date || "");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [id]);

  useEffect(() => {
    if (!matchId) { setMatchInfo(null); return; }
    let cancelled = false;
    getDoc(doc(db, "match_requests", matchId)).then((s) => {
      if (cancelled || !s.exists()) return;
      const d = s.data() || {};
      setMatchInfo({
        actorClubId: String(d.actorClubId || ""), targetClubId: String(d.targetClubId || ""),
        fromName: String(d.fromTeamSnapshot?.name || ""), toName: String(d.toTeamSnapshot?.name || ""),
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [matchId]);

  const court = venue?.courts?.find((c) => c.id === courtId) || null;
  const dayKey = useMemo(() => {
    const info = dates.find((d) => d.date === date);
    return info ? dowToKey(info.dow) : "mon";
  }, [dates, date]);
  const dayHours = court?.hours?.[dayKey];
  const isClosed = !dayHours || dayHours.closed;
  const slots = useMemo(() => buildSlots(court, dayKey), [court, dayKey]);

  const loadSlots = async () => {
    if (!venue?.id || !court?.id) return;
    setSlotsLoading(true);
    try {
      const [rs, bs, bal] = await Promise.all([
        listReservations({ venueId: venue.id, date, courtId: court.id }),
        listBlocks({ venueId: venue.id, date, courtId: court.id }),
        uid ? getFizzBalance(uid) : Promise.resolve(0),
      ]);
      setReservations(rs); setBlocks(bs); setBalance(bal);
    } catch (e) { console.warn("[CourtBooking] loadSlots failed", e); }
    finally { setSlotsLoading(false); }
  };
  useEffect(() => { setSelected(null); loadSlots(); /* eslint-disable-next-line */ }, [venue?.id, courtId, date]);

  const slotState = (slot) => {
    if (reservations.some((r) => ["requested", "pending", "confirmed"].includes(r.status) && overlap(slot.start, slot.end, r.startTime, r.endTime))) return "reserved";
    if (blocks.some((b) => overlap(slot.start, slot.end, b.startTime, b.endTime))) return "blocked";
    if (date === nowMin.today && toMin(slot.start) <= nowMin.min) return "past";
    return "open";
  };

  // 연속된 빈 슬롯을 눌러 범위 선택 (시간 제한 없음 — 하루 종일 예약 가능)
  const onSlotClick = (s) => {
    if (viewOnly) return; // 읽기 전용: 슬롯 선택 비활성
    if (slotState(s) !== "open") return;
    const sS = toMin(s.start), sE = toMin(s.end);
    if (!selected) { setSelected({ start: s.start, end: s.end }); return; }
    const selS = toMin(selected.start), selE = toMin(selected.end);
    // 범위 바로 뒤에 인접 → 뒤로 확장
    if (sS === selE) {
      return setSelected({ start: selected.start, end: s.end });
    }
    // 범위 바로 앞에 인접 → 앞으로 확장
    if (sE === selS) {
      return setSelected({ start: s.start, end: selected.end });
    }
    // 이미 선택된 범위 안의 슬롯
    if (sS >= selS && sE <= selE) {
      if (selE - selS <= sE - sS) return setSelected(null);                          // 단일 슬롯 → 선택 해제
      if (sE === selE) return setSelected({ start: selected.start, end: s.start });  // 마지막 슬롯 → 뒤에서 한 칸 축소
      if (sS === selS) return setSelected({ start: s.end, end: selected.end });      // 첫 슬롯 → 앞에서 한 칸 축소
      return setSelected({ start: s.start, end: s.end });                            // 가운데 → 그 슬롯만 선택
    }
    // 떨어진 슬롯 → 새 범위 시작
    setSelected({ start: s.start, end: s.end });
  };

  const price = selected && court ? calcSlotPrice(court, selected.start, selected.end) : 0;
  const need = Math.max(0, price - balance);
  const handleCharge = async (amount) => {
    if (!uid) return;
    try { setBalance(await chargeFizz(uid, amount)); } catch (e) { toast(e?.message || "충전 실패"); }
  };

  const handlePay = async () => {
    if (!uid) return toast("로그인이 필요해요.");
    if (!selected || !court) return;
    if (balance < price) return toast("잔액이 부족해요. 충전해주세요.");
    setPaying(true);
    try {
      await bookVenue({
        venue, court, date, startTime: selected.start, endTime: selected.end,
        user: { uid, userName: userDoc?.nickname || "", teamName: userDoc?.activeTeamName || userDoc?.teamName || "", phone: userDoc?.phoneE164 || userDoc?.phone || "" },
      });
      setPayOpen(false); setSelected(null); await loadSlots();
      toast("예약이 확정됐어요! 구장 관리자에게 알림이 전송됐어요.");
    } catch (e) {
      if (e?.code === "slot_taken") { await loadSlots(); }
      toast(e?.message || "예약에 실패했어요.");
    } finally { setPaying(false); }
  };

  const myClubId = userDoc?.activeTeamId || userDoc?.clubId || "";
  const handlePropose = async () => {
    if (!selected || !court) return;
    if (!matchInfo) return toast("매칭 정보를 불러오는 중이에요. 잠시 후 다시 시도해주세요.");
    if (!myClubId) return toast("팀 정보를 확인할 수 없어요.");
    if (venue.lat == null || venue.lng == null) return toast("이 구장은 좌표 정보가 없어 제안할 수 없어요.");
    const isActor = myClubId === matchInfo.actorClubId;
    const opponentClubId = isActor ? matchInfo.targetClubId : matchInfo.actorClubId;
    const myTeamName = isActor ? matchInfo.fromName : matchInfo.toName;
    const oppTeamName = isActor ? matchInfo.toName : matchInfo.fromName;
    const ok = window.confirm(`${venue.name}\n${date} ${selected.start}~${selected.end}\n\n이 구장·일정으로 ${oppTeamName || "상대팀"}에게 제안할까요?`);
    if (!ok) return;
    setPaying(true);
    try {
      await proposeMatchSchedule({
        matchRequestId: matchId,
        scheduledAtISO: new Date(`${date}T${selected.start}:00`).toISOString(),
        fieldAddress: `${venue.name}${venue.address ? ` (${venue.address})` : ""}`,
        fieldLatLng: { lat: venue.lat, lng: venue.lng },
        durationMin: toMin(selected.end) - toMin(selected.start),
        proposedByClubId: myClubId,
      });
      await writePartnerBooking({
        matchId, venue, court, date, startTime: selected.start, endTime: selected.end,
        proposerUid: uid, proposerClubId: myClubId, proposerTeamName: myTeamName,
        opponentClubId, opponentTeamName: oppTeamName,
      });
      toast("상대팀에 구장·일정을 제안했어요!");
      navigate(`/match-roomdetail/${matchId}`, { replace: true });
    } catch (e) { toast(e?.message || "제안에 실패했어요."); }
    finally { setPaying(false); }
  };

  if (loading) return <Center><Spinner size="lg" /></Center>;
  if (!venue) return <Center>구장 정보를 찾을 수 없어요.</Center>;
  if (!court) return <Center>코트 정보를 찾을 수 없어요.</Center>;

  return (
    <Wrap>
      <Head>
        <CourtName>{court.name}</CourtName>
        <CourtMeta>{court.type === "outdoor" ? "실외" : "실내"} · {(Number(court.pricePerHour) || 0).toLocaleString()}원/시간</CourtMeta>
        <VenueRow><FiMapPin size={13} /> {venue.name} · {venue.address}</VenueRow>
      </Head>

      <Section>
        <SecTitle><FiCalendar size={17} />날짜 선택</SecTitle>
        <DateStrip>
          {dates.map((d) => (
            <DateCell key={d.date} $on={d.date === date} $dow={d.dow} onClick={() => setDate(d.date)}>
              <small>{d.wd}</small><b>{d.day}</b>
            </DateCell>
          ))}
        </DateStrip>
      </Section>

      <Section>
        <SecTitle><FiClock size={17} />시간 선택</SecTitle>
        <Legend>
          <span className="open">예약 가능</span>
          <span className="reserved">예약완료</span>
          <span className="blocked">사용 불가</span>
        </Legend>
        <SlotHint>{viewOnly ? "예약 현황만 볼 수 있어요. 예약은 매칭룸에서 진행돼요." : "연속된 시간대를 눌러 원하는 만큼 선택할 수 있어요."}</SlotHint>
        {isClosed ? (
          <Empty>이 요일은 휴무예요.</Empty>
        ) : slots.length === 0 ? (
          <Empty>운영 시간이 없어요.</Empty>
        ) : (
          <SlotGrid>
            {slots.map((s, i) => {
              const st = slotState(s);
              const on = selected && toMin(s.start) >= toMin(selected.start) && toMin(s.end) <= toMin(selected.end);
              return (
                <Slot key={i} $st={st} $on={on} disabled={st !== "open"} onClick={() => onSlotClick(s)}>
                  <b>{s.start}~{s.end}</b>
                  <span className={st === "open" ? "price" : ""}>
                    {st === "reserved" ? "예약완료" : st === "blocked" ? "사용 불가" : st === "past" ? "마감" : `${calcSlotPrice(court, s.start, s.end).toLocaleString()}원`}
                  </span>
                </Slot>
              );
            })}
          </SlotGrid>
        )}
      </Section>

      <div style={{ height: 90 }} />

      {!viewOnly && selected && (
        <BottomBar>
          <div>
            <BbDate>{date} {selected.start}~{selected.end}</BbDate>
            <BbPrice>{price.toLocaleString()}원{matchId ? <span> · 두 팀 반반</span> : null}</BbPrice>
          </div>
          {matchId ? (
            <BookBtn onClick={handlePropose} disabled={paying}>구장·일정 제안하기</BookBtn>
          ) : (
            <BookBtn onClick={() => setPayOpen(true)}>예약하기</BookBtn>
          )}
        </BottomBar>
      )}

      {payOpen && selected && (
        <Sheet onClick={(e) => { if (e.target === e.currentTarget) setPayOpen(false); }}>
          <SheetCard onClick={(e) => e.stopPropagation()}>
            <SheetTitle>결제</SheetTitle>
            <PayRow><span>{venue.name} · {court.name}</span></PayRow>
            <PayRow><span>{date} {selected.start}~{selected.end}</span></PayRow>
            <Divider />
            <PayRow $big><span>결제 금액</span><b>{price.toLocaleString()} 원</b></PayRow>
            <PayRow><span>보유 금액</span><b style={{ color: balance >= price ? "inherit" : "#dc2626" }}>{balance.toLocaleString()} 원</b></PayRow>
            {need > 0 && (
              <ChargeBox>
                <small>금액이 {need.toLocaleString()}원 부족해요. 충전해주세요.</small>
                <ChargeBtns>
                  <Cb onClick={() => handleCharge(10000)}>+1만</Cb>
                  <Cb onClick={() => handleCharge(50000)}>+5만</Cb>
                  <Cb onClick={() => handleCharge(need)}>필요한 만큼 (+{need.toLocaleString()})</Cb>
                </ChargeBtns>
              </ChargeBox>
            )}
            <PayBtn disabled={paying || balance < price} onClick={handlePay}>
              {paying ? "결제 중…" : `${price.toLocaleString()} 원 결제하고 예약`}
            </PayBtn>
            <CancelBtn onClick={() => setPayOpen(false)} disabled={paying}>취소</CancelBtn>
          </SheetCard>
        </Sheet>
      )}
    </Wrap>
  );
}

/* ---------- styles ---------- */
const Wrap = styled.div`display: flex; flex-direction: column; gap: 22px; padding-bottom: 8px;`;
const Center = styled.div`min-height: 40vh; display: flex; align-items: center; justify-content: center; color: ${({ theme }) => theme.colors.textWeak}; font-size: 14px;`;
const Head = styled.div`display: flex; flex-direction: column; gap: 6px;`;
const CourtName = styled.div`font-size: 20px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};`;
const CourtMeta = styled.div`font-size: 13.5px; font-weight: 700; color: ${({ theme }) => theme.colors.primary};`;
const VenueRow = styled.div`font-size: 13px; color: ${({ theme }) => theme.colors.textWeak}; display: flex; align-items: center; gap: 4px;`;
const Section = styled.div`display: flex; flex-direction: column; gap: 13px;`;
const SecTitle = styled.div`
  font-size: 16px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};
  display: flex; align-items: center; gap: 7px;
  & > svg { color: ${({ theme }) => theme.colors.primary}; flex-shrink: 0; }
`;
const DateStrip = styled.div`display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; &::-webkit-scrollbar { display: none; }`;
const DateCell = styled.button`
  flex: 0 0 auto; width: 52px; height: 60px; border-radius: 12px; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-weight: 700;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.card)};
  color: ${({ $on, $dow, theme }) => ($on ? "#fff" : $dow === 0 ? "#ef4444" : $dow === 6 ? "#2563eb" : theme.colors.textNormal)};
  & small { font-size: 11px; opacity: 0.85; }
  & b { font-size: 16px; }
`;
const SlotGrid = styled.div`display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;`;
const Slot = styled.button`
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 13px 4px; border-radius: 11px;
  cursor: ${({ $st }) => ($st === "open" ? "pointer" : "not-allowed")};
  border: 1px solid ${({ $on, $st, theme }) => ($on ? theme.colors.primary : $st === "open" ? theme.colors.border : "transparent")};
  background: ${({ $on, $st, theme }) => ($on ? theme.colors.primary : $st === "open" ? theme.colors.card : theme.colors.surface)};
  color: ${({ $on, $st, theme }) => ($on ? "#fff" : $st === "open" ? theme.colors.textStrong : theme.colors.textWeak)};
  opacity: ${({ $st }) => ($st === "open" ? 1 : 0.65)};
  & b { font-size: 14px; font-weight: 700; text-decoration: ${({ $st }) => ($st === "open" ? "none" : "line-through")}; }
  & span { font-size: 11.5px; font-weight: 700; }
  & .price { color: ${({ $on, theme }) => ($on ? "#fff" : theme.colors.primary)}; }
`;
const Empty = styled.div`text-align: center; font-size: 13px; color: ${({ theme }) => theme.colors.textWeak}; padding: 24px 0;`;
const Legend = styled.div`
  display: flex; gap: 14px; font-size: 11.5px; color: ${({ theme }) => theme.colors.textWeak};
  & span { display: inline-flex; align-items: center; }
  & span::before { content: ""; width: 11px; height: 11px; border-radius: 3px; margin-right: 5px; border: 1px solid ${({ theme }) => theme.colors.border}; }
  & .open::before { background: ${({ theme }) => theme.colors.card}; }
  & .reserved::before, & .blocked::before { background: ${({ theme }) => theme.colors.surface}; }
`;
const SlotHint = styled.div`
  margin-top: 8px; font-size: 11.5px; color: ${({ theme }) => theme.colors.textWeak};
`;
const BottomBar = styled.div`
  position: fixed; left: 50%; transform: translateX(-50%); bottom: 0;
  width: 100%; max-width: ${({ theme }) => theme.layout.maxWidth}px;
  background: ${({ theme }) => theme.colors.card}; border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  display: flex; align-items: center; justify-content: space-between; gap: 12px; z-index: 60;
`;
const BbDate = styled.div`font-size: 12.5px; color: ${({ theme }) => theme.colors.textWeak};`;
const BbPrice = styled.div`font-size: 17px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong}; & span { font-size: 11px; font-weight: 600; color: ${({ theme }) => theme.colors.textWeak}; }`;
const BookBtn = styled.button`
  height: 48px; padding: 0 26px; border-radius: 12px; border: none; cursor: pointer;
  background: ${({ theme }) => theme.colors.primary}; color: #fff; font-size: 15px; font-weight: 700;
  &:active { transform: translateY(1px); }
`;
const Sheet = styled.div`position: fixed; inset: 0; background: rgba(15,23,42,0.45); display: flex; align-items: flex-end; justify-content: center; z-index: 950;`;
const SheetCard = styled.div`
  width: 100%; max-width: ${({ theme }) => theme.layout.maxWidth}px;
  background: ${({ theme }) => theme.colors.card}; border-radius: 18px 18px 0 0;
  padding: 20px 18px calc(20px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 10px;
`;
const SheetTitle = styled.div`font-size: 17px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong}; margin-bottom: 4px;`;
const PayRow = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  font-size: ${({ $big }) => ($big ? "15px" : "13.5px")}; color: ${({ theme }) => theme.colors.textNormal};
  & b { font-weight: 800; color: ${({ theme }) => theme.colors.textStrong}; }
`;
const Divider = styled.div`height: 1px; background: ${({ theme }) => theme.colors.border}; margin: 4px 0;`;
const ChargeBox = styled.div`display: flex; flex-direction: column; gap: 8px; background: ${({ theme }) => theme.colors.surface}; border-radius: 12px; padding: 12px; & small { font-size: 12px; color: ${({ theme }) => theme.colors.textWeak}; }`;
const ChargeBtns = styled.div`display: flex; gap: 8px; flex-wrap: wrap;`;
const Cb = styled.button`flex: 1; min-width: 70px; height: 40px; border-radius: 9px; border: 1px solid ${({ theme }) => theme.colors.border}; background: ${({ theme }) => theme.colors.card}; color: ${({ theme }) => theme.colors.textNormal}; font-size: 12.5px; font-weight: 700; cursor: pointer;`;
const PayBtn = styled.button`
  height: 52px; border-radius: 12px; border: none; cursor: pointer; margin-top: 6px;
  background: ${({ theme }) => theme.colors.primary}; color: #fff; font-size: 15px; font-weight: 800;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;
const CancelBtn = styled.button`height: 44px; border-radius: 12px; border: none; background: transparent; color: ${({ theme }) => theme.colors.textWeak}; font-size: 14px; font-weight: 600; cursor: pointer;`;
