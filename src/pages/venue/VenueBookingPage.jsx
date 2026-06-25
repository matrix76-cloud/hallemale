/* eslint-disable */
// src/pages/venue/VenueBookingPage.jsx
// 구장 예약 — 코트/날짜/빈 슬롯 선택 → 피지(가짜) 결제 → 예약 확정 + 구장주 푸시
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { proposeMatchSchedule } from "../../services/matchRoomService";
import {
  getVenue,
  listReservations,
  listBlocks,
  bookVenue,
  calcSlotPrice,
  dowToKey,
} from "../../services/ownerVenueService";
import { getFizzBalance, chargeFizz } from "../../services/fizzService";
import Spinner from "../../components/common/Spinner";
import VenueMiniMap from "../../components/matchRoom/VenueMiniMap";
import { FiMapPin, FiGrid, FiCalendar, FiClock, FiInfo, FiFileText, FiCreditCard, FiCheckCircle } from "react-icons/fi";
import { FacilityIcon } from "./facilityIcons";

/* ---------- time helpers ---------- */
function toMin(hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}
function toHHMM(min) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
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
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export default function VenueBookingPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const matchId = params.get("match") || ""; // 매칭룸에서 들어온 경우
  const { firebaseUser, userDoc } = useAuth();
  const uid = firebaseUser?.uid || "";

  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [courtId, setCourtId] = useState("");
  const [date, setDate] = useState("");
  const [reservations, setReservations] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [balance, setBalance] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  const dates = useMemo(() => {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(base + i * 86400000);
      return { date: ymd(d), day: d.getDate(), wd: WEEK[d.getDay()], dow: d.getDay() };
    });
  }, []);

  const nowMin = useMemo(() => {
    const n = new Date();
    return { today: ymd(n), min: n.getHours() * 60 + n.getMinutes() };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getVenue(id).then((v) => {
      if (cancelled) return;
      setVenue(v);
      setCourtId(v?.courts?.[0]?.id || "");
      setDate(dates[0]?.date || "");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [id]);

  const court = venue?.courts?.find((c) => c.id === courtId) || venue?.courts?.[0] || null;
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
    } catch (e) {
      console.warn("[VenueBooking] loadSlots failed", e);
    } finally { setSlotsLoading(false); }
  };

  useEffect(() => { setSelected(null); loadSlots(); /* eslint-disable-next-line */ }, [venue?.id, courtId, date]);

  const slotState = (slot) => {
    if (reservations.some((r) => ["requested", "confirmed"].includes(r.status) && overlap(slot.start, slot.end, r.startTime, r.endTime))) return "reserved";
    if (blocks.some((b) => overlap(slot.start, slot.end, b.startTime, b.endTime))) return "blocked";
    if (date === nowMin.today && toMin(slot.start) <= nowMin.min) return "past";
    return "open";
  };

  const price = selected && court ? calcSlotPrice(court, selected.start, selected.end) : 0;
  const need = Math.max(0, price - balance);

  const handleCharge = async (amount) => {
    if (!uid) return;
    try {
      const next = await chargeFizz(uid, amount);
      setBalance(next);
    } catch (e) { window.alert(e?.message || "충전 실패"); }
  };

  const handlePay = async () => {
    if (!uid) return window.alert("로그인이 필요해요.");
    if (!selected || !court) return;
    if (balance < price) return window.alert("피지 잔액이 부족해요. 충전해주세요.");
    setPaying(true);
    try {
      await bookVenue({
        venue, court, date,
        startTime: selected.start, endTime: selected.end,
        user: {
          uid,
          userName: userDoc?.nickname || "",
          teamName: userDoc?.activeTeamName || userDoc?.teamName || "",
          phone: userDoc?.phoneE164 || userDoc?.phone || "",
        },
      });
      // 매칭룸에서 들어온 경우: 예약한 구장·시간을 매칭 구장·일정 제안으로 등록
      if (matchId) {
        const clubId = userDoc?.activeTeamId || userDoc?.clubId || "";
        const hasLatLng = venue.lat != null && venue.lng != null;
        if (clubId && hasLatLng) {
          try {
            await proposeMatchSchedule({
              matchRequestId: matchId,
              scheduledAtISO: `${date}T${selected.start}:00`,
              fieldAddress: `${venue.name}${venue.address ? ` (${venue.address})` : ""}`,
              fieldLatLng: { lat: venue.lat, lng: venue.lng },
              durationMin: toMin(selected.end) - toMin(selected.start),
              proposedByClubId: clubId,
            });
          } catch (e) {
            console.warn("[VenueBooking] proposeMatchSchedule failed", e?.message || e);
          }
        }
        setPayOpen(false);
        window.alert("예약 완료! 이 구장·시간이 매칭 일정으로 제안됐어요. 상대팀이 확인합니다.");
        navigate(`/match-roomdetail/${matchId}/venue`, { replace: true });
        return;
      }

      setPayOpen(false);
      setSelected(null);
      await loadSlots();
      window.alert("예약이 확정됐어요! 구장 관리자에게 알림이 전송됐어요.");
    } catch (e) {
      if (e?.code === "slot_taken") { await loadSlots(); }
      window.alert(e?.message || "예약에 실패했어요.");
    } finally { setPaying(false); }
  };

  if (loading) return <Center><Spinner size="lg" /></Center>;
  if (!venue) return <Center>구장 정보를 찾을 수 없어요.</Center>;

  const photos = (venue.photos?.length ? venue.photos : venue.imageUrl ? [venue.imageUrl] : []).filter(Boolean);
  const hasLatLng = venue.lat != null && venue.lng != null;

  return (
    <Wrap>
      {photos.length > 0 && (
        <Gallery>
          {photos.map((u, i) => <GImg key={i} src={u} alt={`구장 사진 ${i + 1}`} />)}
        </Gallery>
      )}

      <Head>
        <VName>{venue.name}</VName>
        <VAddr>{venue.address} {venue.addressDetail}</VAddr>
      </Head>

      {hasLatLng && (
        <Section>
          <SecTitle><FiMapPin size={17} />위치</SecTitle>
          <VenueMiniMap latLng={{ lat: venue.lat, lng: venue.lng }} height={170} />
          <VAddr><FiMapPin size={13} style={{ verticalAlign: -2 }} /> {venue.address} {venue.addressDetail}</VAddr>
        </Section>
      )}

      {venue.facilities?.length > 0 && (
        <Section>
          <SecTitle><FiCheckCircle size={17} />편의시설</SecTitle>
          <FacWrap>{venue.facilities.map((f) => <Fac key={f}><FacilityIcon name={f} size={15} /> {f}</Fac>)}</FacWrap>
        </Section>
      )}

      <Section>
        <SecTitle><FiGrid size={17} />코트 선택</SecTitle>
        <Chips>
          {venue.courts.map((c) => (
            <Chip key={c.id} $on={c.id === court?.id} onClick={() => setCourtId(c.id)}>
              {c.name}
              <small>{(Number(c.pricePerHour) || 0).toLocaleString()}원/시간</small>
            </Chip>
          ))}
        </Chips>
      </Section>

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
        {isClosed ? (
          <Empty>이 요일은 휴무예요.</Empty>
        ) : slots.length === 0 ? (
          <Empty>운영 시간이 없어요.</Empty>
        ) : (
          <SlotGrid>
            {slots.map((s, i) => {
              const st = slotState(s);
              const on = selected && selected.start === s.start;
              return (
                <Slot key={i} $st={st} $on={on} disabled={st !== "open"} onClick={() => st === "open" && setSelected(s)}>
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

      {venue.description && (
        <Section>
          <SecTitle><FiInfo size={17} />구장 소개</SecTitle>
          <InfoPre>{venue.description}</InfoPre>
        </Section>
      )}
      {venue.rules && (
        <Section>
          <SecTitle><FiFileText size={17} />이용 규칙</SecTitle>
          <InfoPre>{venue.rules}</InfoPre>
        </Section>
      )}
      {venue.refundPolicy && (
        <Section>
          <SecTitle><FiCreditCard size={17} />환불 정책</SecTitle>
          <InfoPre>{venue.refundPolicy}</InfoPre>
        </Section>
      )}

      <div style={{ height: 90 }} />

      {selected && (
        <BottomBar>
          <div>
            <BbDate>{date} {selected.start}~{selected.end}</BbDate>
            <BbPrice>{price.toLocaleString()}원</BbPrice>
          </div>
          <BookBtn onClick={() => setPayOpen(true)}>예약하기</BookBtn>
        </BottomBar>
      )}

      {payOpen && selected && (
        <Sheet onClick={(e) => { if (e.target === e.currentTarget) setPayOpen(false); }}>
          <SheetCard onClick={(e) => e.stopPropagation()}>
            <SheetTitle>결제</SheetTitle>
            <PayRow><span>{venue.name} · {court.name}</span></PayRow>
            <PayRow><span>{date} {selected.start}~{selected.end}</span></PayRow>
            <Divider />
            <PayRow $big><span>결제 금액</span><b>{price.toLocaleString()} 피지</b></PayRow>
            <PayRow><span>보유 피지</span><b style={{ color: balance >= price ? "inherit" : "#dc2626" }}>{balance.toLocaleString()} 피지</b></PayRow>

            {need > 0 && (
              <ChargeBox>
                <small>피지가 {need.toLocaleString()} 부족해요. 충전(가짜)해주세요.</small>
                <ChargeBtns>
                  <Cb onClick={() => handleCharge(10000)}>+1만</Cb>
                  <Cb onClick={() => handleCharge(50000)}>+5만</Cb>
                  <Cb onClick={() => handleCharge(need)}>필요한 만큼 (+{need.toLocaleString()})</Cb>
                </ChargeBtns>
              </ChargeBox>
            )}

            <PayBtn disabled={paying || balance < price} onClick={handlePay}>
              {paying ? "결제 중…" : `${price.toLocaleString()} 피지 결제하고 예약`}
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
const Cover = styled.img`width: 100%; height: 180px; object-fit: cover; border-radius: 14px;`;
const Gallery = styled.div`
  display: flex; gap: 8px; overflow-x: auto; -webkit-overflow-scrolling: touch;
  scroll-snap-type: x mandatory;
  scrollbar-width: none; -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
`;
const GImg = styled.img`
  width: 100%; max-width: 100%; flex: 0 0 100%; scroll-snap-align: center;
  aspect-ratio: 3 / 2; object-fit: cover; object-position: center;
  border-radius: 14px; display: block;
`;
const FacWrap = styled.div`display: flex; flex-wrap: wrap; gap: 8px;`;
const Fac = styled.span`
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 13px; border-radius: 999px; font-size: 13px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textNormal};
  & > svg { color: ${({ theme }) => theme.colors.primary}; }
`;
const InfoPre = styled.div`
  font-size: 13.5px; line-height: 1.65; white-space: pre-wrap;
  color: ${({ theme }) => theme.colors.textNormal};
`;
const Head = styled.div`display: flex; flex-direction: column; gap: 4px;`;
const VName = styled.div`font-size: 19px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};`;
const VAddr = styled.div`font-size: 13px; color: ${({ theme }) => theme.colors.textWeak};`;
const Section = styled.div`display: flex; flex-direction: column; gap: 13px;`;
const SecTitle = styled.div`
  font-size: 16px; font-weight: 800; letter-spacing: -0.01em;
  color: ${({ theme }) => theme.colors.textStrong};
  display: flex; align-items: center; gap: 7px;
  & > svg { color: ${({ theme }) => theme.colors.primary}; flex-shrink: 0; }
`;
const Chips = styled.div`
  display: flex; gap: 8px; overflow-x: auto;
  scrollbar-width: none; -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
`;
const Chip = styled.button`
  flex: 0 0 auto; padding: 9px 14px; border-radius: 12px; cursor: pointer;
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.card)};
  color: ${({ $on, theme }) => ($on ? "#fff" : theme.colors.textNormal)};
  font-size: 13.5px; font-weight: 700;
  & small { font-size: 11px; font-weight: 600; opacity: 0.85; }
`;
const DateStrip = styled.div`
  display: flex; gap: 8px; overflow-x: auto;
  scrollbar-width: none; -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
`;
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
  transition: transform 0.1s, border-color 0.12s;
  border: 1px solid ${({ $on, $st, theme }) =>
    $on ? theme.colors.primary : $st === "open" ? theme.colors.border : "transparent"};
  background: ${({ $on, $st, theme }) =>
    $on ? theme.colors.primary : $st === "open" ? theme.colors.card : theme.colors.surface};
  color: ${({ $on, $st, theme }) =>
    $on ? "#fff" : $st === "open" ? theme.colors.textStrong : theme.colors.textWeak};
  opacity: ${({ $st }) => ($st === "open" ? 1 : 0.65)};
  &:active { transform: ${({ $st }) => ($st === "open" ? "translateY(1px)" : "none")}; }
  & b {
    font-size: 14px; font-weight: 700;
    text-decoration: ${({ $st }) => ($st === "open" ? "none" : "line-through")};
    text-decoration-thickness: 1px;
  }
  & span { font-size: 11.5px; font-weight: 700; }
  & .price { color: ${({ $on, theme }) => ($on ? "#fff" : theme.colors.primary)}; }
`;
const Empty = styled.div`text-align: center; font-size: 13px; color: ${({ theme }) => theme.colors.textWeak}; padding: 24px 0;`;
const Legend = styled.div`
  display: flex; gap: 14px; font-size: 11.5px; color: ${({ theme }) => theme.colors.textWeak};
  & span { display: inline-flex; align-items: center; }
  & span::before {
    content: ""; width: 11px; height: 11px; border-radius: 3px; margin-right: 5px;
    border: 1px solid ${({ theme }) => theme.colors.border};
  }
  & .open::before { background: ${({ theme }) => theme.colors.card}; }
  & .reserved::before, & .blocked::before { background: ${({ theme }) => theme.colors.surface}; }
`;

const BottomBar = styled.div`
  position: fixed; left: 50%; transform: translateX(-50%); bottom: 0;
  width: 100%; max-width: ${({ theme }) => theme.layout.maxWidth}px;
  background: ${({ theme }) => theme.colors.card};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  display: flex; align-items: center; justify-content: space-between; gap: 12px; z-index: 60;
`;
const BbDate = styled.div`font-size: 12.5px; color: ${({ theme }) => theme.colors.textWeak};`;
const BbPrice = styled.div`font-size: 17px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong};`;
const BookBtn = styled.button`
  height: 48px; padding: 0 26px; border-radius: 12px; border: none; cursor: pointer;
  background: ${({ theme }) => theme.colors.primary}; color: #fff; font-size: 15px; font-weight: 700;
  &:active { transform: translateY(1px); }
`;

const Sheet = styled.div`position: fixed; inset: 0; background: rgba(15,23,42,0.45); display: flex; align-items: flex-end; justify-content: center; z-index: 950;`;
const SheetCard = styled.div`
  width: 100%; max-width: ${({ theme }) => theme.layout.maxWidth}px;
  background: ${({ theme }) => theme.colors.card};
  border-radius: 18px 18px 0 0; padding: 20px 18px calc(20px + env(safe-area-inset-bottom));
  display: flex; flex-direction: column; gap: 10px;
`;
const SheetTitle = styled.div`font-size: 17px; font-weight: 800; color: ${({ theme }) => theme.colors.textStrong}; margin-bottom: 4px;`;
const PayRow = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  font-size: ${({ $big }) => ($big ? "15px" : "13.5px")};
  color: ${({ theme }) => theme.colors.textNormal};
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
