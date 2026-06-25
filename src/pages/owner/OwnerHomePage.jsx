/* eslint-disable */
// src/pages/owner/OwnerHomePage.jsx
// 예약 관리 — 코트 선택 + 날짜 선택 → 시간 슬롯 그리드 + 예약 승인/거절 + 슬롯 막기
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useOwner } from "../../context/OwnerContext";
import {
  listReservations,
  listBlocks,
  addBlock,
  removeBlock,
  setReservationStatus,
  dowToKey,
} from "../../services/ownerVenueService";
import { Page, Card, SectionTitle, SectionDesc, Badge, GhostBtn } from "./components/ownerUi";
import OwnerSpinner from "./components/OwnerSpinner";
import VenueGateNotice from "./components/VenueGateNotice";

/* ---------- 시간/날짜 헬퍼 ---------- */
function toMin(hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}
function toHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function buildSlots(court, dayKey) {
  if (!court) return [];
  const h = court.hours && court.hours[dayKey];
  if (!h || h.closed) return [];
  const start = toMin(h.open);
  const end = toMin(h.close);
  const step = court.slotMinutes || 60;
  const out = [];
  for (let t = start; t + step <= end; t += step) {
    out.push({ start: toHHMM(t), end: toHHMM(t + step) });
  }
  return out;
}
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
function buildDates(baseMs, n = 14) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(baseMs + i * 86400000);
    out.push({ date: ymd(d), day: d.getDate(), wd: WEEK[d.getDay()], dow: d.getDay() });
  }
  return out;
}
function overlap(aStart, aEnd, bStart, bEnd) {
  return toMin(aStart) < toMin(bEnd) && toMin(aEnd) > toMin(bStart);
}

/* ---------- styles ---------- */
const CourtTabs = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
`;
const CourtTab = styled.button`
  flex: 0 0 auto;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.card)};
  color: ${({ $on, theme }) => ($on ? "#fff" : theme.colors.textNormal)};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
`;
const DateStrip = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
`;
const DateCell = styled.button`
  flex: 0 0 auto;
  width: 52px;
  height: 60px;
  border-radius: 12px;
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
  background: ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.card)};
  color: ${({ $on, $dow, theme }) =>
    $on ? "#fff" : $dow === 0 ? "#ef4444" : $dow === 6 ? "#2563eb" : theme.colors.textNormal};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  font-weight: 600;
  & small { font-size: 11px; opacity: 0.85; }
  & b { font-size: 16px; }
`;
const SlotGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
`;
const Slot = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: ${({ $kind }) => ($kind === "reserved" ? "default" : "pointer")};
  border: 1px solid
    ${({ $kind, theme }) =>
      $kind === "reserved" ? "#bfdbfe" : $kind === "blocked" ? "#fecaca" : theme.colors.border};
  background: ${({ $kind, theme }) =>
    $kind === "reserved" ? "#eff6ff" : $kind === "blocked" ? "#fef2f2" : theme.colors.card};
  & .t { font-size: 13.5px; font-weight: 700; color: ${({ theme }) => theme.colors.textStrong}; }
  & .s { font-size: 11.5px; font-weight: 600; }
  & .reserved { color: #2563eb; }
  & .blocked { color: #dc2626; }
  & .open { color: ${({ theme }) => theme.colors.textWeak}; }
`;
const ResvCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;
const ResvTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;
const ResvName = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textStrong};
`;
const ResvMeta = styled.div`
  font-size: 12.5px;
  color: ${({ theme }) => theme.colors.textWeak};
  line-height: 1.5;
`;
const Actions = styled.div`display: flex; gap: 8px;`;
const SmallBtn = styled.button`
  flex: 1;
  height: 40px;
  border-radius: 9px;
  border: 1px solid ${({ $danger, theme }) => ($danger ? "#fecaca" : theme.colors.border)};
  background: ${({ $primary, $danger, theme }) =>
    $primary ? theme.colors.primary : $danger ? "#fef2f2" : theme.colors.card};
  color: ${({ $primary, $danger, theme }) =>
    $primary ? "#fff" : $danger ? "#dc2626" : theme.colors.textNormal};
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  &:active { transform: translateY(1px); }
`;
const Empty = styled.div`
  text-align: center;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
  padding: 18px 0;
`;
const Legend = styled.div`
  display: flex;
  gap: 14px;
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.textWeak};
  & span::before {
    content: "";
    display: inline-block;
    width: 10px; height: 10px; border-radius: 3px;
    margin-right: 4px; vertical-align: -1px;
  }
  & .open::before { background: ${({ theme }) => theme.colors.border}; }
  & .reserved::before { background: #93c5fd; }
  & .blocked::before { background: #fca5a5; }
`;

const STATUS_LABEL = {
  requested: "승인 대기",
  confirmed: "예약 확정",
  rejected: "거절됨",
  cancelled: "취소됨",
  done: "이용 완료",
};

export default function OwnerHomePage() {
  const { venue, loading: ownerLoading, refresh: ownerRefresh } = useOwner();
  const courts = venue?.courts || [];

  const dates = useMemo(() => {
    // Date.now() 사용 금지 컨텍스트 아님 — 일반 런타임. 오늘 0시 기준.
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return buildDates(base, 14);
  }, []);

  const [courtId, setCourtId] = useState(courts[0]?.id || "");
  const [date, setDate] = useState(dates[0]?.date || "");
  const [reservations, setReservations] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const court = courts.find((c) => c.id === courtId) || courts[0] || null;

  const load = async () => {
    if (!venue?.id) return;
    setLoading(true);
    try {
      const [rs, bs] = await Promise.all([
        listReservations({ venueId: venue.id, date, courtId: court?.id || "" }),
        listBlocks({ venueId: venue.id, date, courtId: court?.id || "" }),
      ]);
      setReservations(rs);
      setBlocks(bs);
    } catch (e) {
      console.warn("[OwnerHome] load failed", e?.message || e);
      setReservations([]);
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [venue?.id, courtId, date]);

  const dayKey = useMemo(() => {
    const info = dates.find((d) => d.date === date);
    return info ? dowToKey(info.dow) : "mon";
  }, [dates, date]);

  const dayHours = court?.hours?.[dayKey];
  const isClosedDay = !dayHours || dayHours.closed;

  const slots = useMemo(() => buildSlots(court, dayKey), [court, dayKey]);

  const slotKind = (slot) => {
    const r = reservations.find(
      (x) => ["requested", "confirmed"].includes(x.status) && overlap(slot.start, slot.end, x.startTime, x.endTime)
    );
    if (r) return { kind: "reserved", resv: r };
    const b = blocks.find((x) => overlap(slot.start, slot.end, x.startTime, x.endTime));
    if (b) return { kind: "blocked", block: b };
    return { kind: "open" };
  };

  const onSlotClick = async (slot, info) => {
    if (busy) return;
    if (info.kind === "reserved") return; // 예약된 슬롯은 토글 불가
    setBusy(true);
    try {
      if (info.kind === "blocked") {
        await removeBlock(info.block.id);
      } else {
        await addBlock({ venueId: venue.id, courtId: court.id, date, startTime: slot.start, endTime: slot.end });
      }
      await load();
    } catch (e) {
      window.alert(e?.message || "처리에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const changeResv = async (id, status) => {
    if (busy) return;
    setBusy(true);
    try {
      await setReservationStatus(id, status);
      await load();
    } catch (e) {
      window.alert(e?.message || "처리에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  // 소프트 게이트: 미등록/심사중/반려면 막지 않고 안내 카드만
  if (ownerLoading) {
    return <Page><OwnerSpinner label="불러오는 중…" /></Page>;
  }
  if (!venue || venue.status !== "approved") {
    return (
      <Page>
        <VenueGateNotice venue={venue} refresh={ownerRefresh} />
      </Page>
    );
  }
  if (!courts.length) {
    return (
      <Page>
        <Card>
          <Empty>등록된 코트가 없어요. '내 구장' 탭에서 코트를 추가해주세요.</Empty>
        </Card>
      </Page>
    );
  }

  const pending = reservations.filter((r) => r.status === "requested");
  const others = reservations.filter((r) => r.status !== "requested");

  return (
    <Page>
      <Card>
        <SectionTitle>코트 선택</SectionTitle>
        <CourtTabs>
          {courts.map((c) => (
            <CourtTab key={c.id} $on={c.id === court?.id} onClick={() => setCourtId(c.id)}>
              {c.name}
            </CourtTab>
          ))}
        </CourtTabs>
        <DateStrip>
          {dates.map((d) => (
            <DateCell key={d.date} $on={d.date === date} $dow={d.dow} onClick={() => setDate(d.date)}>
              <small>{d.wd}</small>
              <b>{d.day}</b>
            </DateCell>
          ))}
        </DateStrip>
      </Card>

      <Card>
        <SectionTitle>시간 슬롯</SectionTitle>
        <SectionDesc>빈 슬롯을 누르면 예약을 막을 수 있어요. 막힌 슬롯을 다시 누르면 해제됩니다.</SectionDesc>
        <Legend>
          <span className="open">예약 가능</span>
          <span className="reserved">예약됨</span>
          <span className="blocked">막힘</span>
        </Legend>
        {loading ? (
          <OwnerSpinner label="불러오는 중…" />
        ) : isClosedDay ? (
          <Empty>이 요일은 휴무예요. ('내 구장' 탭에서 운영시간을 바꿀 수 있어요)</Empty>
        ) : slots.length === 0 ? (
          <Empty>운영 시간이 설정되지 않았어요.</Empty>
        ) : (
          <SlotGrid>
            {slots.map((s, i) => {
              const info = slotKind(s);
              return (
                <Slot key={i} $kind={info.kind} onClick={() => onSlotClick(s, info)}>
                  <span className="t">{s.start} ~ {s.end}</span>
                  <span className={`s ${info.kind}`}>
                    {info.kind === "reserved"
                      ? `예약 · ${info.resv.teamName || info.resv.userName || "예약자"}`
                      : info.kind === "blocked"
                      ? "막힘 (탭하여 해제)"
                      : "예약 가능"}
                  </span>
                </Slot>
              );
            })}
          </SlotGrid>
        )}
      </Card>

      <Card>
        <SectionTitle>승인 대기 예약 {pending.length > 0 && `(${pending.length})`}</SectionTitle>
        {loading ? null : pending.length === 0 ? (
          <Empty>승인 대기 중인 예약이 없어요.</Empty>
        ) : (
          pending.map((r) => (
            <ResvCard key={r.id}>
              <ResvTop>
                <ResvName>{r.teamName || r.userName || "예약자"}</ResvName>
                <Badge $tone="pending">{STATUS_LABEL[r.status]}</Badge>
              </ResvTop>
              <ResvMeta>
                {r.startTime} ~ {r.endTime}
                {r.price ? ` · ${r.price.toLocaleString()}원` : ""}
                {r.phone ? ` · ${r.phone}` : ""}
              </ResvMeta>
              <Actions>
                <SmallBtn $primary onClick={() => changeResv(r.id, "confirmed")}>승인</SmallBtn>
                <SmallBtn $danger onClick={() => changeResv(r.id, "rejected")}>거절</SmallBtn>
              </Actions>
            </ResvCard>
          ))
        )}
      </Card>

      {others.length > 0 && (
        <Card>
          <SectionTitle>그 외 예약</SectionTitle>
          {others.map((r) => (
            <ResvCard key={r.id}>
              <ResvTop>
                <ResvName>{r.teamName || r.userName || "예약자"}</ResvName>
                <Badge $tone={r.status === "confirmed" ? "approved" : r.status === "rejected" || r.status === "cancelled" ? "rejected" : "default"}>
                  {STATUS_LABEL[r.status]}
                </Badge>
              </ResvTop>
              <ResvMeta>
                {r.startTime} ~ {r.endTime}
                {r.price ? ` · ${r.price.toLocaleString()}원` : ""}
              </ResvMeta>
              {r.status === "confirmed" && (
                <Actions>
                  <SmallBtn onClick={() => changeResv(r.id, "done")}>이용 완료 처리</SmallBtn>
                </Actions>
              )}
            </ResvCard>
          ))}
        </Card>
      )}
    </Page>
  );
}
