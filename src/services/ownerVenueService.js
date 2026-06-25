/* eslint-disable */
// src/services/ownerVenueService.js
// 구장 관리자(구장주) 전용 서비스
// - 구장 등록(심사 신청) / 내 구장 조회 / 구장·코트 수정
// - 예약 조회·승인·거절 / 시간 슬롯 막기(블록)
// - 어드민 승인·반려
//
// Firestore 컬렉션:
//   venues             구장(장소, 심사 단위)  ← 기존 컬렉션 확장(ownerUid, status, courts[] 등)
//   venueReservations  예약(코트별·날짜별)
//   venueBlocks        구장주가 막아둔 시간(코트별·날짜별)
//
// 인덱스 최소화 원칙: 단일 where + 클라이언트 메모리 필터/정렬.
// 이미지 업로드는 venuesService.uploadVenueImage 재사용.

import { db } from "./firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { payFizz } from "./fizzService";

function hhmmToMin(v) {
  const [h, m] = String(v || "0:0").split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return hhmmToMin(aStart) < hhmmToMin(bEnd) && hhmmToMin(aEnd) > hhmmToMin(bStart);
}

function safeStr(v) {
  return String(v ?? "").trim();
}
function toNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toDate(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function arr(v) {
  return Array.isArray(v) ? v : [];
}

// 간단한 코트 id 생성 (Date/Math.random 사용 안전 — 클라이언트 런타임)
function makeCourtId() {
  return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// 요일 키/라벨 (월~일)
export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABELS = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };

// JS getDay()(0=일~6=토) → 요일 키
export function dowToKey(dow) {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][dow] || "mon";
}

/** 요일별 운영시간 기본값 (주중 09~22 / 주말 09~21) */
export function defaultCourtHours() {
  const weekday = { open: "09:00", close: "22:00", closed: false };
  const weekend = { open: "09:00", close: "21:00", closed: false };
  return {
    mon: { ...weekday }, tue: { ...weekday }, wed: { ...weekday },
    thu: { ...weekday }, fri: { ...weekday },
    sat: { ...weekend }, sun: { ...weekend },
  };
}

/** hours 정규화 — 레거시(openTime/closeTime 단일) 호환 */
function normalizeHours(h, fbOpen, fbClose) {
  const fo = safeStr(fbOpen) || "09:00";
  const fc = safeStr(fbClose) || "22:00";
  const out = {};
  for (const d of DAY_KEYS) {
    const v = (h && h[d]) || {};
    out[d] = {
      closed: !!v.closed,
      open: safeStr(v.open) || fo,
      close: safeStr(v.close) || fc,
    };
  }
  return out;
}

/** 코트 1개 정규화 */
function normalizeCourt(c, idx = 0) {
  const o = c || {};
  return {
    id: safeStr(o.id) || makeCourtId(),
    name: safeStr(o.name) || `${idx + 1}코트`,
    type: o.type === "outdoor" ? "outdoor" : "indoor",
    pricePerHour: toNum(o.pricePerHour) ?? 0,
    slotMinutes: toNum(o.slotMinutes) || 60,
    // 요일별 운영시간 (레거시 openTime/closeTime 있으면 그 값으로 전 요일 채움)
    hours: normalizeHours(o.hours, o.openTime, o.closeTime),
  };
}

/** venues 문서 → 화면용 row */
export function venueRow(d) {
  const data = d.data() || {};
  const photos = arr(data.photos).map((p) => safeStr(p)).filter(Boolean);
  return {
    id: d.id,
    ownerUid: safeStr(data.ownerUid),
    // 심사: status 없으면(레거시/어드민 등록) approved 취급
    status: ["pending", "approved", "rejected"].includes(data.status)
      ? data.status
      : "approved",
    rejectReason: safeStr(data.rejectReason),

    name: safeStr(data.name),
    address: safeStr(data.address),
    addressDetail: safeStr(data.addressDetail),
    region: safeStr(data.region),
    lat: toNum(data.lat),
    lng: toNum(data.lng),
    phone: safeStr(data.phone),

    photos,
    imageUrl: safeStr(data.imageUrl) || photos[0] || "",
    storagePath: safeStr(data.storagePath),
    storagePaths: arr(data.storagePaths).map((p) => safeStr(p)).filter(Boolean),

    facilities: arr(data.facilities).map((f) => safeStr(f)).filter(Boolean),
    description: safeStr(data.description) || safeStr(data.memo),
    rules: safeStr(data.rules),
    refundPolicy: safeStr(data.refundPolicy),

    bizName: safeStr(data.bizName),
    bizNo: safeStr(data.bizNo),
    ownerName: safeStr(data.ownerName),
    contactPhone: safeStr(data.contactPhone),

    courts: arr(data.courts).map((c, i) => normalizeCourt(c, i)),

    type: data.type === "outdoor" ? "outdoor" : "indoor",
    cost: data.cost === "free" ? "free" : "paid",
    active: data.active !== false,

    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

/* ============================================================
 * 구장 등록 / 조회 / 수정 (구장주)
 * ========================================================== */

/**
 * 구장 등록(심사 신청) — status=pending, active=false 로 저장
 */
export async function registerVenue({
  ownerUid,
  name,
  address,
  addressDetail,
  region,
  lat,
  lng,
  phone,
  photos = [],
  storagePaths = [],
  facilities = [],
  description,
  rules,
  refundPolicy,
  bizName,
  bizNo,
  ownerName,
  contactPhone,
  courts = [],
}) {
  if (!safeStr(ownerUid)) throw new Error("로그인이 필요합니다.");
  if (!safeStr(name)) throw new Error("구장명을 입력해주세요.");
  if (!safeStr(address)) throw new Error("주소를 입력해주세요.");

  const cleanPhotos = arr(photos).map((p) => safeStr(p)).filter(Boolean);
  const cleanCourts = arr(courts).map((c, i) => normalizeCourt(c, i));
  if (cleanCourts.length === 0) {
    // 최소 1개 코트는 있어야 예약 단위가 생김
    cleanCourts.push(normalizeCourt({ name: "1코트" }, 0));
  }

  const payload = {
    ownerUid: safeStr(ownerUid),
    status: "pending",
    rejectReason: "",

    name: safeStr(name),
    address: safeStr(address),
    addressDetail: safeStr(addressDetail),
    region: safeStr(region),
    lat: toNum(lat),
    lng: toNum(lng),
    phone: safeStr(phone),

    photos: cleanPhotos,
    imageUrl: cleanPhotos[0] || "",
    storagePaths: arr(storagePaths).map((p) => safeStr(p)).filter(Boolean),

    facilities: arr(facilities).map((f) => safeStr(f)).filter(Boolean),
    description: safeStr(description),
    rules: safeStr(rules),
    refundPolicy: safeStr(refundPolicy),

    bizName: safeStr(bizName),
    bizNo: safeStr(bizNo),
    ownerName: safeStr(ownerName),
    contactPhone: safeStr(contactPhone),

    courts: cleanCourts,

    // 승인 전까지 사용자에게 노출 안 함
    active: false,
    cost: "paid",
    type: cleanCourts[0]?.type || "indoor",

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "venues"), payload);
  return { id: ref.id };
}

/** 내 구장 목록 (ownerUid 기준, 보통 1개) */
export async function listMyVenues(ownerUid) {
  const uid = safeStr(ownerUid);
  if (!uid) return [];
  const snap = await getDocs(
    query(collection(db, "venues"), where("ownerUid", "==", uid))
  );
  const rows = [];
  snap.forEach((d) => rows.push(venueRow(d)));
  rows.sort((a, b) => {
    const ta = a.createdAt ? a.createdAt.getTime() : 0;
    const tb = b.createdAt ? b.createdAt.getTime() : 0;
    return tb - ta;
  });
  return rows;
}

/** 내 대표 구장 1개 (가장 최근) */
export async function getMyVenue(ownerUid) {
  const rows = await listMyVenues(ownerUid);
  return rows[0] || null;
}

/** 단건 조회 */
export async function getVenue(id) {
  const vid = safeStr(id);
  if (!vid) return null;
  const snap = await getDoc(doc(db, "venues", vid));
  if (!snap.exists()) return null;
  return venueRow(snap);
}

/** 구장 정보 수정 (구장주) — 핵심 정보 변경 시 재심사로 되돌릴지는 호출부에서 결정 */
export async function updateMyVenue(id, patch = {}) {
  const vid = safeStr(id);
  if (!vid) throw new Error("id가 비어있습니다.");

  const update = { updatedAt: serverTimestamp() };
  if (patch.name !== undefined) update.name = safeStr(patch.name);
  if (patch.address !== undefined) update.address = safeStr(patch.address);
  if (patch.addressDetail !== undefined) update.addressDetail = safeStr(patch.addressDetail);
  if (patch.region !== undefined) update.region = safeStr(patch.region);
  if (patch.lat !== undefined) update.lat = toNum(patch.lat);
  if (patch.lng !== undefined) update.lng = toNum(patch.lng);
  if (patch.phone !== undefined) update.phone = safeStr(patch.phone);
  if (patch.photos !== undefined) {
    const cleanPhotos = arr(patch.photos).map((p) => safeStr(p)).filter(Boolean);
    update.photos = cleanPhotos;
    update.imageUrl = cleanPhotos[0] || "";
  }
  if (patch.storagePaths !== undefined)
    update.storagePaths = arr(patch.storagePaths).map((p) => safeStr(p)).filter(Boolean);
  if (patch.facilities !== undefined)
    update.facilities = arr(patch.facilities).map((f) => safeStr(f)).filter(Boolean);
  if (patch.description !== undefined) update.description = safeStr(patch.description);
  if (patch.rules !== undefined) update.rules = safeStr(patch.rules);
  if (patch.refundPolicy !== undefined) update.refundPolicy = safeStr(patch.refundPolicy);
  if (patch.bizName !== undefined) update.bizName = safeStr(patch.bizName);
  if (patch.bizNo !== undefined) update.bizNo = safeStr(patch.bizNo);
  if (patch.ownerName !== undefined) update.ownerName = safeStr(patch.ownerName);
  if (patch.contactPhone !== undefined) update.contactPhone = safeStr(patch.contactPhone);
  if (patch.courts !== undefined) {
    const cleanCourts = arr(patch.courts).map((c, i) => normalizeCourt(c, i));
    update.courts = cleanCourts;
    update.type = cleanCourts[0]?.type || "indoor";
  }

  await updateDoc(doc(db, "venues", vid), update);
}

/** 반려된 구장을 수정 후 재신청 — status를 다시 pending으로 */
export async function resubmitVenue(id) {
  const vid = safeStr(id);
  if (!vid) throw new Error("id가 비어있습니다.");
  await updateDoc(doc(db, "venues", vid), {
    status: "pending",
    rejectReason: "",
    active: false,
    updatedAt: serverTimestamp(),
  });
}

/* ============================================================
 * 어드민 승인 / 반려
 * ========================================================== */

export async function approveVenue(id) {
  const vid = safeStr(id);
  if (!vid) throw new Error("id가 비어있습니다.");
  await updateDoc(doc(db, "venues", vid), {
    status: "approved",
    rejectReason: "",
    active: true, // 승인 시 사용자 노출 ON
    updatedAt: serverTimestamp(),
  });
}

export async function rejectVenue(id, reason = "") {
  const vid = safeStr(id);
  if (!vid) throw new Error("id가 비어있습니다.");
  await updateDoc(doc(db, "venues", vid), {
    status: "rejected",
    rejectReason: safeStr(reason),
    active: false,
    updatedAt: serverTimestamp(),
  });
}

/** 어드민: 전체 구장 목록 (status 포함) */
export async function listAllVenuesAdmin() {
  const snap = await getDocs(query(collection(db, "venues")));
  const rows = [];
  snap.forEach((d) => rows.push(venueRow(d)));
  rows.sort((a, b) => {
    const ta = a.createdAt ? a.createdAt.getTime() : 0;
    const tb = b.createdAt ? b.createdAt.getTime() : 0;
    return tb - ta;
  });
  return rows;
}

/** 어드민: 임의 상태로 변경 (신청대기/승인/반려) */
export async function setVenueStatus(id, status, reason = "") {
  const vid = safeStr(id);
  if (!vid) throw new Error("id가 비어있습니다.");
  const next = ["pending", "approved", "rejected"].includes(status) ? status : "pending";
  await updateDoc(doc(db, "venues", vid), {
    status: next,
    rejectReason: next === "rejected" ? safeStr(reason) : "",
    active: next === "approved", // 승인일 때만 사용자 노출
    updatedAt: serverTimestamp(),
  });
}

/** 어드민: 심사 대기 구장 목록 */
export async function listPendingVenues() {
  const snap = await getDocs(
    query(collection(db, "venues"), where("status", "==", "pending"))
  );
  const rows = [];
  snap.forEach((d) => rows.push(venueRow(d)));
  rows.sort((a, b) => {
    const ta = a.createdAt ? a.createdAt.getTime() : 0;
    const tb = b.createdAt ? b.createdAt.getTime() : 0;
    return ta - tb; // 먼저 신청한 순
  });
  return rows;
}

/* ============================================================
 * 예약 (venueReservations)
 * ========================================================== */

function reservationRow(d) {
  const data = d.data() || {};
  return {
    id: d.id,
    venueId: safeStr(data.venueId),
    courtId: safeStr(data.courtId),
    ownerUid: safeStr(data.ownerUid),
    courtName: safeStr(data.courtName),
    venueName: safeStr(data.venueName),
    date: safeStr(data.date), // YYYY-MM-DD
    startTime: safeStr(data.startTime), // HH:mm
    endTime: safeStr(data.endTime),
    userId: safeStr(data.userId),
    userName: safeStr(data.userName),
    teamName: safeStr(data.teamName),
    phone: safeStr(data.phone),
    price: toNum(data.price) ?? 0,
    status: ["requested", "pending", "confirmed", "rejected", "cancelled", "done"].includes(data.status)
      ? data.status
      : "requested",
    // 두 팀 분할 결제
    matchId: safeStr(data.matchId),
    splitTotal: toNum(data.splitTotal) ?? (toNum(data.price) ?? 0),
    shareA: toNum(data.shareA) ?? 0,
    shareB: toNum(data.shareB) ?? 0,
    teamAClubId: safeStr(data.teamAClubId),
    teamBClubId: safeStr(data.teamBClubId),
    teamAName: safeStr(data.teamAName),
    teamBName: safeStr(data.teamBName),
    paidByA: data.paidByA === true,
    paidByB: data.paidByB === true,
    teamAPayerUid: safeStr(data.teamAPayerUid),
    teamBPayerUid: safeStr(data.teamBPayerUid),
    paymentDeadline: safeStr(data.paymentDeadline),
    createdAt: toDate(data.createdAt),
  };
}

/** 구장의 예약 목록 (venueId 단일 where → 클라 필터로 date/court) */
export async function listReservations({ venueId, date = "", courtId = "" } = {}) {
  const vid = safeStr(venueId);
  if (!vid) return [];
  const snap = await getDocs(
    query(collection(db, "venueReservations"), where("venueId", "==", vid))
  );
  let rows = [];
  snap.forEach((d) => rows.push(reservationRow(d)));
  if (safeStr(date)) rows = rows.filter((r) => r.date === safeStr(date));
  if (safeStr(courtId)) rows = rows.filter((r) => r.courtId === safeStr(courtId));
  rows.sort((a, b) => (a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0));
  return rows;
}

/** 예약 상태 변경 (승인/거절/완료) */
export async function setReservationStatus(reservationId, status) {
  const rid = safeStr(reservationId);
  if (!rid) throw new Error("reservationId가 비어있습니다.");
  const next = ["requested", "confirmed", "rejected", "cancelled", "done"].includes(status)
    ? status
    : "requested";
  await updateDoc(doc(db, "venueReservations", rid), {
    status: next,
    updatedAt: serverTimestamp(),
  });
}

/**
 * (테스트/유저앱용) 예약 생성 — 유저가 예약하면 호출.
 * 지금은 시드/테스트로도 사용.
 */
export async function createReservation({
  venueId,
  courtId,
  ownerUid,
  date,
  startTime,
  endTime,
  userId,
  userName,
  teamName,
  phone,
  price,
  status = "requested",
}) {
  if (!safeStr(venueId)) throw new Error("venueId가 필요합니다.");
  if (!safeStr(date)) throw new Error("date가 필요합니다.");
  const ref = await addDoc(collection(db, "venueReservations"), {
    venueId: safeStr(venueId),
    courtId: safeStr(courtId),
    ownerUid: safeStr(ownerUid),
    date: safeStr(date),
    startTime: safeStr(startTime),
    endTime: safeStr(endTime),
    userId: safeStr(userId),
    userName: safeStr(userName),
    teamName: safeStr(teamName),
    phone: safeStr(phone),
    price: toNum(price) ?? 0,
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id };
}

/* ============================================================
 * 사용자 예약 (목록 / 예약+결제+푸시)
 * ========================================================== */

/** 예약 가능한 구장 목록 — 승인 + 활성 + 코트 보유 */
export async function listBookableVenues() {
  const snap = await getDocs(
    query(collection(db, "venues"), where("status", "==", "approved"))
  );
  const rows = [];
  snap.forEach((d) => rows.push(venueRow(d)));
  const out = rows.filter((v) => v.active && (v.courts?.length || 0) > 0);
  out.sort((a, b) => {
    const ta = a.createdAt ? a.createdAt.getTime() : 0;
    const tb = b.createdAt ? b.createdAt.getTime() : 0;
    return tb - ta;
  });
  return out;
}

/** 슬롯 가격 계산 (시간당 가격 × 슬롯시간 비율) */
export function calcSlotPrice(court, startTime, endTime) {
  const per = toNum(court?.pricePerHour) ?? 0;
  const mins = Math.max(0, hhmmToMin(endTime) - hhmmToMin(startTime));
  return Math.round((per * mins) / 60);
}

/**
 * 구장 예약 + 피지 결제 + 구장주 푸시 알림.
 * 1) 해당 슬롯이 비었는지 재검증(다른 예약/블록 겹침 확인)
 * 2) 피지 차감(payFizz)
 * 3) venueReservations 생성 (status=confirmed, paid=true)
 * 4) 구장주에게 notifications 문서 생성(push queued → sendPushTick 발송)
 */
export async function bookVenue({ venue, court, date, startTime, endTime, user }) {
  const venueId = safeStr(venue?.id);
  const courtId = safeStr(court?.id);
  const uid = safeStr(user?.uid);
  if (!venueId || !courtId) throw new Error("구장/코트 정보가 올바르지 않습니다.");
  if (!safeStr(date) || !safeStr(startTime) || !safeStr(endTime)) throw new Error("예약 시간이 올바르지 않습니다.");
  if (!uid) throw new Error("로그인이 필요합니다.");

  // 1) 슬롯 비었는지 재검증
  const [reservations, blocks] = await Promise.all([
    listReservations({ venueId, date, courtId }),
    listBlocks({ venueId, date, courtId }),
  ]);
  const taken = reservations.some(
    (r) => ["requested", "confirmed"].includes(r.status) && rangesOverlap(startTime, endTime, r.startTime, r.endTime)
  );
  if (taken) {
    const err = new Error("이미 예약된 시간이에요. 다른 시간을 선택해주세요.");
    err.code = "slot_taken";
    throw err;
  }
  const blocked = blocks.some((b) => rangesOverlap(startTime, endTime, b.startTime, b.endTime));
  if (blocked) {
    const err = new Error("예약할 수 없는 시간이에요.");
    err.code = "slot_blocked";
    throw err;
  }

  const price = calcSlotPrice(court, startTime, endTime);

  // 2) 피지 결제 (잔액 부족 시 에러 전파)
  await payFizz(uid, price);

  // 3) 예약 생성 (결제 완료 → 확정)
  const ownerUid = safeStr(venue?.ownerUid);
  let reservationId = "";
  try {
    const ref = await addDoc(collection(db, "venueReservations"), {
      venueId,
      courtId,
      ownerUid,
      courtName: safeStr(court?.name),
      venueName: safeStr(venue?.name),
      date: safeStr(date),
      startTime: safeStr(startTime),
      endTime: safeStr(endTime),
      userId: uid,
      userName: safeStr(user?.userName),
      teamName: safeStr(user?.teamName),
      phone: safeStr(user?.phone),
      price,
      paid: true,
      paidFizz: price,
      paymentMethod: "fizz",
      status: "confirmed",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    reservationId = ref.id;
  } catch (e) {
    // 예약 저장 실패 시 결제 롤백(환불)
    try { await payFizz(uid, -price); } catch {}
    throw e;
  }

  // 4) 구장주 푸시 알림 (실패해도 예약은 유지)
  if (ownerUid) {
    try {
      await addDoc(collection(db, "notifications"), {
        kind: "venue",
        subType: "venueReservationCreated",
        type: "venue_reservation",
        title: "새 구장 예약이 들어왔어요",
        body: `${date} ${startTime}~${endTime} · ${safeStr(court?.name)} (${safeStr(user?.userName) || "예약자"})`,
        targetType: "USER",
        targetIds: [ownerUid],
        linkType: "venue",
        linkTargetId: venueId,
        meta: { venueId, reservationId, deepLink: "/owner/home" },
        push: { enabled: true, status: "queued", sentAt: null, failReason: null },
        prefsCategory: "match",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn("[bookVenue] owner notify failed:", e?.message || e);
    }
  }

  return { reservationId, price };
}

/* ============================================================
 * 두 팀 분할 결제 (매칭룸 제휴구장 예약)
 *  - 제안: 결제 없이 구장·시간·금액을 매칭에 기록(partnerBooking) + status=proposed
 *  - 확정: 두 팀이 각자 절반 결제 → 실제 venueReservation 생성 + 구장주 알림
 * ========================================================== */

/** 슬롯이 비었는지 확인 (예약/블록 겹침) */
async function assertSlotFree({ venueId, courtId, date, startTime, endTime }) {
  const [rs, bs] = await Promise.all([
    listReservations({ venueId, date, courtId }),
    listBlocks({ venueId, date, courtId }),
  ]);
  const taken = rs.some(
    (r) => ["requested", "pending", "confirmed"].includes(r.status) && rangesOverlap(startTime, endTime, r.startTime, r.endTime)
  );
  if (taken) { const e = new Error("이미 예약된 시간이에요."); e.code = "slot_taken"; throw e; }
  const blocked = bs.some((b) => rangesOverlap(startTime, endTime, b.startTime, b.endTime));
  if (blocked) { const e = new Error("예약할 수 없는 시간이에요."); e.code = "slot_blocked"; throw e; }
}

/** 절반씩 분할 */
export function splitPrice(total) {
  const t = toNum(total) ?? 0;
  const a = Math.round(t / 2);
  return { total: t, shareA: a, shareB: t - a };
}

/**
 * 제안: 매칭에 제휴구장 예약 의향 기록 (결제 X).
 * match_requests/{matchId}.partnerBooking 에 저장.
 */
export async function writePartnerBooking({ matchId, venue, court, date, startTime, endTime, proposerUid, proposerClubId, proposerTeamName, opponentClubId, opponentTeamName }) {
  const id = safeStr(matchId);
  if (!id) throw new Error("matchId가 필요합니다.");
  await assertSlotFree({ venueId: venue.id, courtId: court.id, date, startTime, endTime });
  const total = calcSlotPrice(court, startTime, endTime);
  const { shareA, shareB } = splitPrice(total);

  await updateDoc(doc(db, "match_requests", id), {
    partnerBooking: {
      venueId: safeStr(venue.id),
      venueName: safeStr(venue.name),
      ownerUid: safeStr(venue.ownerUid),
      courtId: safeStr(court.id),
      courtName: safeStr(court.name),
      date: safeStr(date),
      startTime: safeStr(startTime),
      endTime: safeStr(endTime),
      totalPrice: total,
      shareA, shareB,
      proposerUid: safeStr(proposerUid),
      proposerClubId: safeStr(proposerClubId),
      proposerTeamName: safeStr(proposerTeamName),
      opponentClubId: safeStr(opponentClubId),
      opponentTeamName: safeStr(opponentTeamName),
      finalized: false,
      reservationId: "",
    },
    updatedAt: serverTimestamp(),
  });
  return { total, shareA, shareB };
}

// 분할결제 마감 시간 (한 팀 결제 후 2시간)
export const PARTNER_PAY_WINDOW_MS = 2 * 60 * 60 * 1000;

/** 매칭의 분할예약 1건 조회 (pending/confirmed) */
async function findMatchReservation(matchId) {
  const snap = await getDocs(
    query(collection(db, "venueReservations"), where("matchId", "==", safeStr(matchId)))
  );
  let row = null;
  snap.forEach((d) => {
    const r = reservationRow(d);
    if (["pending", "confirmed"].includes(r.status)) row = { ...r, _deadline: d.data()?.paymentDeadline || "" };
  });
  return row;
}

/** 만료(2시간 초과) pending 예약이면 환불+취소 처리. 처리했으면 true */
export async function expireMatchReservationIfNeeded(matchId) {
  const r = await findMatchReservation(matchId);
  if (!r || r.status !== "pending") return false;
  const dl = r._deadline ? new Date(r._deadline).getTime() : 0;
  if (!dl || Date.now() <= dl) return false;

  // 먼저 낸 팀 환불
  const refundUid = r.paidByA ? r.teamAPayerUid : r.teamBPayerUid;
  // reservationRow에 payerUid가 없으므로 원문서에서 읽음
  const dref = doc(db, "venueReservations", r.id);
  const fresh = await getDoc(dref);
  const data = fresh.data() || {};
  const paidUid = data.paidByA ? safeStr(data.teamAPayerUid) : safeStr(data.teamBPayerUid);
  const paidAmt = data.paidByA ? (toNum(data.shareA) ?? 0) : (toNum(data.shareB) ?? 0);
  if (paidUid && paidAmt) { try { await payFizz(paidUid, -paidAmt); } catch {} }

  await updateDoc(dref, { status: "cancelled", cancelReason: "payment_timeout", updatedAt: serverTimestamp() });
  // 매칭의 partnerBooking 결제상태 초기화 (재결제 가능하게)
  try {
    await updateDoc(doc(db, "match_requests", safeStr(matchId)), {
      "partnerBooking.payState": "expired",
      updatedAt: serverTimestamp(),
    });
  } catch {}
  return true;
}

/**
 * 한 팀이 자기 몫 결제.
 *  - 첫 결제: 예약 생성(status=pending) + 슬롯 잠금 + 2시간 마감.
 *  - 둘째 결제: status=confirmed + 구장주 알림.
 * side = "A"(제안팀) | "B"(상대팀)
 */
export async function payPartnerShare({ matchId, side, payerUid, payerTeamName }) {
  const id = safeStr(matchId);
  const sd = side === "A" ? "A" : "B";
  const uid = safeStr(payerUid);
  if (!id || !uid) throw new Error("결제 정보가 올바르지 않습니다.");

  // 만료 먼저 정리
  await expireMatchReservationIfNeeded(id);

  const msnap = await getDoc(doc(db, "match_requests", id));
  const pb = msnap.exists() ? msnap.data()?.partnerBooking : null;
  if (!pb) throw new Error("제안된 구장 정보가 없습니다.");

  const shareA = toNum(pb.shareA) ?? 0;
  const shareB = toNum(pb.shareB) ?? 0;
  const myShare = sd === "A" ? shareA : shareB;

  const existing = await findMatchReservation(id);

  // 첫 결제 → 예약 생성 (pending)
  if (!existing) {
    await assertSlotFree({ venueId: pb.venueId, courtId: pb.courtId, date: pb.date, startTime: pb.startTime, endTime: pb.endTime });
    await payFizz(uid, myShare);
    const deadlineISO = new Date(Date.now() + PARTNER_PAY_WINDOW_MS).toISOString();
    let reservationId = "";
    try {
      const ref = await addDoc(collection(db, "venueReservations"), {
        venueId: safeStr(pb.venueId), venueName: safeStr(pb.venueName), ownerUid: safeStr(pb.ownerUid),
        courtId: safeStr(pb.courtId), courtName: safeStr(pb.courtName),
        date: safeStr(pb.date), startTime: safeStr(pb.startTime), endTime: safeStr(pb.endTime),
        userId: uid, userName: safeStr(payerTeamName), teamName: safeStr(payerTeamName),
        price: toNum(pb.totalPrice) ?? 0, paymentMethod: "fizz", status: "pending",
        matchId: id, splitTotal: toNum(pb.totalPrice) ?? 0, shareA, shareB,
        teamAClubId: safeStr(pb.proposerClubId), teamBClubId: safeStr(pb.opponentClubId),
        teamAName: safeStr(pb.proposerTeamName), teamBName: safeStr(pb.opponentTeamName),
        paidByA: sd === "A", paidByB: sd === "B",
        teamAPayerUid: sd === "A" ? uid : "", teamBPayerUid: sd === "B" ? uid : "",
        paymentDeadline: deadlineISO,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      reservationId = ref.id;
    } catch (e) {
      try { await payFizz(uid, -myShare); } catch {}
      throw e;
    }
    await updateDoc(doc(db, "match_requests", id), {
      "partnerBooking.payState": "half", "partnerBooking.reservationId": reservationId,
      "partnerBooking.paymentDeadline": deadlineISO, updatedAt: serverTimestamp(),
    });
    return { state: "pending", reservationId, deadline: deadlineISO, share: myShare };
  }

  // 이미 이 팀이 냈으면
  if ((sd === "A" && existing.paidByA) || (sd === "B" && existing.paidByB)) {
    return { state: existing.status, already: true };
  }

  // 둘째 결제 → 확정
  await payFizz(uid, myShare);
  const patch = sd === "A"
    ? { paidByA: true, teamAPayerUid: uid }
    : { paidByB: true, teamBPayerUid: uid };
  await updateDoc(doc(db, "venueReservations", existing.id), {
    ...patch, status: "confirmed", paid: true, updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "match_requests", id), {
    "partnerBooking.payState": "paid", "partnerBooking.finalized": true, updatedAt: serverTimestamp(),
  });

  // 구장주 알림 (양 팀 결제 완료 = 예약 확정)
  if (pb.ownerUid) {
    try {
      await addDoc(collection(db, "notifications"), {
        kind: "venue", subType: "venueReservationCreated", type: "venue_reservation",
        title: "새 구장 예약이 확정됐어요",
        body: `${pb.date} ${pb.startTime}~${pb.endTime} · ${safeStr(pb.courtName)} (${safeStr(pb.proposerTeamName)} vs ${safeStr(pb.opponentTeamName)})`,
        targetType: "USER", targetIds: [safeStr(pb.ownerUid)],
        linkType: "venue", linkTargetId: safeStr(pb.venueId),
        meta: { venueId: pb.venueId, reservationId: existing.id, deepLink: "/owner/home" },
        push: { enabled: true, status: "queued", sentAt: null, failReason: null },
        prefsCategory: "match", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    } catch (e) { console.warn("[payPartnerShare] notify failed", e?.message || e); }
  }
  return { state: "confirmed", reservationId: existing.id, share: myShare };
}

/** 매칭의 분할예약 결제현황 (구장앱/매칭룸 표시용) */
export async function getMatchReservationStatus(matchId) {
  await expireMatchReservationIfNeeded(matchId);
  const r = await findMatchReservation(matchId);
  if (!r) return null;
  return {
    id: r.id, status: r.status,
    paidByA: r.paidByA, paidByB: r.paidByB,
    teamAName: r.teamAName, teamBName: r.teamBName,
    shareA: r.shareA, shareB: r.shareB, total: r.splitTotal,
    deadline: r._deadline || "",
  };
}

/* ============================================================
 * 슬롯 막기 (venueBlocks) — 구장주가 특정 시간 예약 불가 처리
 * ========================================================== */

function blockRow(d) {
  const data = d.data() || {};
  return {
    id: d.id,
    venueId: safeStr(data.venueId),
    courtId: safeStr(data.courtId),
    date: safeStr(data.date),
    startTime: safeStr(data.startTime),
    endTime: safeStr(data.endTime),
    createdAt: toDate(data.createdAt),
  };
}

export async function listBlocks({ venueId, date = "", courtId = "" } = {}) {
  const vid = safeStr(venueId);
  if (!vid) return [];
  const snap = await getDocs(
    query(collection(db, "venueBlocks"), where("venueId", "==", vid))
  );
  let rows = [];
  snap.forEach((d) => rows.push(blockRow(d)));
  if (safeStr(date)) rows = rows.filter((r) => r.date === safeStr(date));
  if (safeStr(courtId)) rows = rows.filter((r) => r.courtId === safeStr(courtId));
  return rows;
}

export async function addBlock({ venueId, courtId, date, startTime, endTime }) {
  if (!safeStr(venueId)) throw new Error("venueId가 필요합니다.");
  const ref = await addDoc(collection(db, "venueBlocks"), {
    venueId: safeStr(venueId),
    courtId: safeStr(courtId),
    date: safeStr(date),
    startTime: safeStr(startTime),
    endTime: safeStr(endTime),
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

export async function removeBlock(blockId) {
  const bid = safeStr(blockId);
  if (!bid) throw new Error("blockId가 비어있습니다.");
  await deleteDoc(doc(db, "venueBlocks", bid));
}

/* ============================================================
 * 시설물(편의시설) 선택지 — 등록 폼/표시 공용
 * ========================================================== */

export const FACILITY_OPTIONS = [
  "주차장",
  "샤워실",
  "화장실",
  "탈의실",
  "음료판매",
  "농구공 대여",
  "조끼 대여",
  "냉난방",
  "관람석",
  "와이파이",
];

/* ============================================================
 * 구장주 role 마킹 — users/{uid}.role = "owner"
 * (소셜 로그인 인프라 공유, 계정 구분만 role로)
 * ========================================================== */
export async function markUserAsOwner(uid) {
  const u = safeStr(uid);
  if (!u) return;
  try {
    await updateDoc(doc(db, "users", u), {
      role: "owner",
      isVenueOwner: true,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn("[ownerVenueService] markUserAsOwner failed:", e?.message || e);
  }
}
