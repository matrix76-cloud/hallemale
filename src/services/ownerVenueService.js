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

import { db, ownerAuth } from "./firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { payFizz } from "./fizzService";
import { BOOKING_WINDOW_DAYS, isBookableDate } from "../constants/booking";

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

// 요일별 요금 구간(band) 정규화 — { mon:[{start,end,price}], ... }
function normalizeBands(b) {
  const out = {};
  for (const d of DAY_KEYS) {
    out[d] = arr(b?.[d])
      .map((x) => ({ start: safeStr(x.start), end: safeStr(x.end), price: toNum(x.price) ?? 0 }))
      .filter((x) => x.start && x.end);
  }
  return out;
}
// 특정 날짜 요금 오버라이드 — { "YYYY-MM-DD":[{start,end,price}] }
function normalizeOverrides(o) {
  const out = {};
  if (o && typeof o === "object") {
    for (const k of Object.keys(o)) {
      const bands = arr(o[k]).map((x) => ({ start: safeStr(x.start), end: safeStr(x.end), price: toNum(x.price) ?? 0 })).filter((x) => x.start && x.end);
      if (bands.length) out[k] = bands;
    }
  }
  return out;
}
function normalizeNotice(n) {
  const o = n || {};
  return {
    id: safeStr(o.id) || ("nt_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    title: safeStr(o.title),
    body: safeStr(o.body),
    pinned: o.pinned === true,
  };
}

/** 코트 1개 정규화 */
function normalizeCourt(c, idx = 0) {
  const o = c || {};
  return {
    id: safeStr(o.id) || makeCourtId(),
    name: safeStr(o.name) || `${idx + 1}코트`,
    type: o.type === "outdoor" ? "outdoor" : "indoor",
    surface: safeStr(o.surface), // 바닥재질 (마루/우레탄/인조잔디 등)
    pricePerHour: toNum(o.pricePerHour) ?? 0, // 기본요금(통일)
    slotMinutes: toNum(o.slotMinutes) || 60,
    hours: normalizeHours(o.hours, o.openTime, o.closeTime),
    // 요금 3단계: 기본(pricePerHour) > 요일별(priceBands) > 특정날짜(priceOverrides)
    priceBands: normalizeBands(o.priceBands),
    priceOverrides: normalizeOverrides(o.priceOverrides),
    // 코트별 공지/주의
    notices: arr(o.notices).map(normalizeNotice),
    cautions: arr(o.cautions).map((x) => safeStr(x)).filter(Boolean),
  };
}

/**
 * 요금 우선순위 해석: 특정날짜 > 요일별 구간 > 기본요금. (시간당 요금 반환)
 * 사용자앱 예약가/구장주 슬롯표시 공용.
 */
export function resolveSlotPrice(court, date, startTime) {
  if (!court) return 0;
  const m = hhmmToMin(startTime);
  const inBand = (bands) => {
    if (!Array.isArray(bands)) return null;
    for (const b of bands) {
      if (m >= hhmmToMin(b.start) && m < hhmmToMin(b.end)) return toNum(b.price) ?? null;
    }
    return null;
  };
  let p = inBand(court.priceOverrides?.[date]);
  if (p != null) return p;
  let dk = "mon";
  try { dk = dowToKey(new Date(date).getDay()); } catch {}
  p = inBand(court.priceBands?.[dk]);
  if (p != null) return p;
  return toNum(court.pricePerHour) ?? 0;
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
    // 네이버 플레이스식 상세정보
    sportTypes: arr(data.sportTypes).map((s) => safeStr(s)).filter(Boolean), // 종목(농구/풋살 등)
    parking: {
      available: data.parking?.available === true,
      fee: ["free", "paid"].includes(data.parking?.fee) ? data.parking.fee : "free",
      info: safeStr(data.parking?.info),
    },
    directions: safeStr(data.directions), // 찾아오는 길(대중교통·입구 안내)
    keywords: arr(data.keywords).map((k) => safeStr(k)).filter(Boolean), // 대표키워드(검색)
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

    // 사용자 노출 방식 (멀티코트 묶기 vs 독립)
    displayMode: data.displayMode === "separate" ? "separate" : "grouped",
    displayName: safeStr(data.displayName) || safeStr(data.name),

    // 사업자 인증 (어드민 수동 승인)
    business: {
      bizNo: safeStr(data.business?.bizNo) || safeStr(data.bizNo),
      bizName: safeStr(data.business?.bizName) || safeStr(data.bizName),
      ownerName: safeStr(data.business?.ownerName) || safeStr(data.ownerName),
      openDate: safeStr(data.business?.openDate),
      taxType: data.business?.taxType === "general" ? "general" : "simple", // 간이|일반
      licenseUrl: safeStr(data.business?.licenseUrl),
      status: ["pending", "verified", "rejected"].includes(data.business?.status) ? data.business.status : "none",
      rejectReason: safeStr(data.business?.rejectReason),
    },
    // 통신판매업 신고 (일반과세 필수 / 간이 면제)
    salesReport: {
      number: safeStr(data.salesReport?.number),
      certUrl: safeStr(data.salesReport?.certUrl),
      exempt: data.salesReport?.exempt === true,
      status: ["submitted"].includes(data.salesReport?.status) ? "submitted" : "none",
    },
    // 정산 계좌
    settlement: {
      bank: safeStr(data.settlement?.bank),
      account: safeStr(data.settlement?.account),
      holder: safeStr(data.settlement?.holder),
      verified: data.settlement?.verified === true,
    },

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
  sportTypes = [],
  parking,
  directions,
  keywords = [],
  description,
  rules,
  refundPolicy,
  bizName,
  bizNo,
  ownerName,
  contactPhone,
  courts = [],
  displayMode,
  displayName,
}) {
  if (!safeStr(ownerUid)) throw new Error("로그인이 필요합니다.");
  if (!safeStr(name)) throw new Error("구장명을 입력해주세요.");
  if (!safeStr(address)) throw new Error("주소를 입력해주세요.");

  // 구장주당 1구장 제한: 워크스페이스가 단일 구장(가장 최근 것) 기준이라, 2번째 구장은
  // 관리·정산·예약 화면에 안 보여 데드엔드가 된다 → 등록 자체를 차단(전환 UI 도입 전까지).
  const existingVenues = await listMyVenues(ownerUid);
  if (existingVenues.length > 0) {
    throw new Error("이미 등록한 구장이 있어요. 현재는 구장주당 1개 구장만 운영할 수 있어요.");
  }

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
    sportTypes: arr(sportTypes).map((s) => safeStr(s)).filter(Boolean),
    parking: {
      available: parking?.available === true,
      fee: ["free", "paid"].includes(parking?.fee) ? parking.fee : "free",
      info: safeStr(parking?.info),
    },
    directions: safeStr(directions),
    keywords: arr(keywords).map((k) => safeStr(k)).filter(Boolean),
    description: safeStr(description),
    rules: safeStr(rules),
    refundPolicy: safeStr(refundPolicy),

    bizName: safeStr(bizName),
    bizNo: safeStr(bizNo),
    ownerName: safeStr(ownerName),
    contactPhone: safeStr(contactPhone),

    courts: cleanCourts,

    // 사용자 노출 방식 (멀티코트 묶기 vs 독립)
    displayMode: displayMode === "separate" ? "separate" : "grouped",
    displayName: safeStr(displayName) || safeStr(name),

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
  if (patch.sportTypes !== undefined)
    update.sportTypes = arr(patch.sportTypes).map((s) => safeStr(s)).filter(Boolean);
  if (patch.parking !== undefined)
    update.parking = {
      available: patch.parking?.available === true,
      fee: ["free", "paid"].includes(patch.parking?.fee) ? patch.parking.fee : "free",
      info: safeStr(patch.parking?.info),
    };
  if (patch.directions !== undefined) update.directions = safeStr(patch.directions);
  if (patch.keywords !== undefined)
    update.keywords = arr(patch.keywords).map((k) => safeStr(k)).filter(Boolean);
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
  if (patch.displayMode !== undefined) update.displayMode = patch.displayMode === "separate" ? "separate" : "grouped";
  if (patch.displayName !== undefined) update.displayName = safeStr(patch.displayName);

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
 * 사업자 인증 / 통신판매업 / 정산 계좌
 * ========================================================== */

/**
 * 사업자등록번호 진위(체크섬) 검증 — 국세청 검증 알고리즘.
 * 형식이 유효하지 않은 가짜·오타 번호를 제출 전에 걸러낸다.
 * (실제 사업 존재 여부는 국세청 진위확인 API로 별도 확인)
 */
export function isValidBizNo(v) {
  const d = String(v || "").replace(/[^0-9]/g, "");
  if (d.length !== 10) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i], 10) * w[i];
  sum += Math.floor((parseInt(d[8], 10) * 5) / 10);
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(d[9], 10);
}

/** 사업자등록번호 자동 하이픈 포맷 (000-00-00000) */
export function formatBizNo(v) {
  const d = String(v || "").replace(/[^0-9]/g, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** 구장주: 사업자 인증 제출 → status=pending (어드민 승인 대기) */
export async function submitBusinessVerification(id, { bizNo, bizName, ownerName, openDate, taxType, licenseUrl } = {}) {
  const vid = safeStr(id);
  if (!vid) throw new Error("id가 비어있습니다.");
  if (!safeStr(bizNo)) throw new Error("사업자등록번호를 입력해주세요.");
  if (!isValidBizNo(bizNo)) throw new Error("올바른 사업자등록번호가 아니에요. 다시 확인해주세요.");
  if (!safeStr(bizName)) throw new Error("상호를 입력해주세요.");
  if (!safeStr(ownerName)) throw new Error("대표자명을 입력해주세요.");
  if (!safeStr(openDate)) throw new Error("개업일자를 입력해주세요.");
  await updateDoc(doc(db, "venues", vid), {
    business: {
      bizNo: safeStr(bizNo), bizName: safeStr(bizName), ownerName: safeStr(ownerName),
      openDate: safeStr(openDate), taxType: taxType === "general" ? "general" : "simple",
      licenseUrl: safeStr(licenseUrl), status: "pending", rejectReason: "",
    },
    updatedAt: serverTimestamp(),
  });
}

// 국세청 진위확인 Cloud Function 엔드포인트
const VERIFY_BUSINESS_URL = "https://asia-northeast3-halle-bf789.cloudfunctions.net/verifyBusiness";

/**
 * 국세청 진위확인 요청. 성공 시 서버가 venues 문서의 business.status를 직접 갱신한다.
 * 반환:
 *   { configured:false }              → 서비스키 미설정/함수 미배포 → 수동 승인 폴백
 *   { configured:true, valid:true }   → 진위확인 완료(자동 인증)
 *   { configured:true, valid:false, reason } → 불일치(자동 반려)
 */
export async function verifyBusinessOnline({ venueId, bizNo, ownerName, openDate, bizName } = {}) {
  try {
    // 구장주 인증 토큰 첨부 (함수가 소유자 검증) — 없으면 서버가 401
    const headers = { "Content-Type": "application/json" };
    try {
      const token = await ownerAuth.currentUser?.getIdToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (e) {}
    const res = await fetch(VERIFY_BUSINESS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ venueId, bizNo, ownerName, openDate, bizName }),
    });
    if (!res.ok) return { configured: true, valid: false, reason: "진위확인 요청에 실패했어요." };
    return await res.json();
  } catch (e) {
    // 함수 미배포/네트워크 오류 → 자동확인 스킵(수동 승인 폴백)
    return { configured: false, error: e?.message || "network" };
  }
}

/** 구장주: 통신판매업 신고 정보 저장 (일반과세 필수 / 간이 면제) */
export async function saveSalesReport(id, { number, certUrl, exempt } = {}) {
  const vid = safeStr(id);
  if (!vid) throw new Error("id가 비어있습니다.");
  await updateDoc(doc(db, "venues", vid), {
    salesReport: {
      number: safeStr(number), certUrl: safeStr(certUrl), exempt: exempt === true,
      status: exempt ? "none" : (safeStr(number) ? "submitted" : "none"),
    },
    updatedAt: serverTimestamp(),
  });
}

/** 구장주: 정산 계좌 저장 (1원 인증은 데모로 즉시 verified) */
export async function saveSettlementAccount(id, { bank, account, holder } = {}) {
  const vid = safeStr(id);
  if (!vid) throw new Error("id가 비어있습니다.");
  if (!safeStr(bank) || !safeStr(account)) throw new Error("은행/계좌번호를 입력해주세요.");
  await updateDoc(doc(db, "venues", vid), {
    settlement: { bank: safeStr(bank), account: safeStr(account), holder: safeStr(holder), verified: true },
    updatedAt: serverTimestamp(),
  });
}

/** 어드민: 사업자 인증 승인/반려 */
export async function setBusinessStatus(id, status, reason = "") {
  const vid = safeStr(id);
  if (!vid) throw new Error("id가 비어있습니다.");
  const next = ["pending", "verified", "rejected"].includes(status) ? status : "pending";

  let ownerUid = "";
  try {
    const vs = await getDoc(doc(db, "venues", vid));
    ownerUid = safeStr(vs.exists() ? vs.data()?.ownerUid : "");
  } catch (e) {}

  await updateDoc(doc(db, "venues", vid), {
    "business.status": next,
    "business.rejectReason": next === "rejected" ? safeStr(reason) : "",
    updatedAt: serverTimestamp(),
  });

  // 사업자 인증 결과 알림 — 인증/반려돼도 몰라서 "심사중"에 방치되던 것 방지 (setVenueStatus 동일 패턴)
  if (ownerUid && (next === "verified" || next === "rejected")) {
    try {
      const ok = next === "verified";
      await addDoc(collection(db, "notifications"), {
        kind: "venue",
        subType: ok ? "business_verified" : "business_rejected",
        type: ok ? "business_verified" : "business_rejected",
        title: ok ? "사업자 인증 완료 ✅" : "사업자 인증 반려",
        body: ok
          ? "사업자 정보 인증이 완료됐어요."
          : `사업자 정보 인증이 반려됐어요.${reason ? ` 사유: ${safeStr(reason)}` : " 정보를 확인해 다시 제출해 주세요."}`,
        targetType: "USER", targetIds: [ownerUid],
        linkType: "venue", linkTargetId: vid,
        meta: { venueId: vid, deepLink: "/owner/home" },
        push: { enabled: true, status: "queued", sentAt: null, failReason: null },
        prefsCategory: "owner", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), readBy: {},
      });
    } catch (e) {
      console.warn("[setBusinessStatus] notify failed:", e?.message || e);
    }
  }
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

  // 알림 발송용 구장주 정보(uid·구장명) 확보
  let ownerUid = "", venueName = "";
  try {
    const vs = await getDoc(doc(db, "venues", vid));
    if (vs.exists()) {
      ownerUid = safeStr(vs.data()?.ownerUid);
      venueName = safeStr(vs.data()?.name);
    }
  } catch (e) {
    console.warn("[setVenueStatus] read venue failed:", e?.message || e);
  }

  await updateDoc(doc(db, "venues", vid), {
    status: next,
    rejectReason: next === "rejected" ? safeStr(reason) : "",
    active: next === "approved", // 승인일 때만 사용자 노출
    updatedAt: serverTimestamp(),
  });

  // 구장주에게 승인/반려 결과 알림 — 승인돼도 몰라서 안 돌아오던 공급 이탈 방지
  if (ownerUid && (next === "approved" || next === "rejected")) {
    try {
      const approved = next === "approved";
      await addDoc(collection(db, "notifications"), {
        kind: "venue",
        subType: approved ? "venue_approved" : "venue_rejected",
        type: approved ? "venue_approved" : "venue_rejected",
        title: approved ? "구장 승인 완료 🎉" : "구장 등록 반려",
        body: approved
          ? `'${venueName || "구장"}'이 승인되었어요. 이제 예약을 받을 수 있어요.`
          : `'${venueName || "구장"}' 등록이 반려되었어요.${reason ? ` 사유: ${safeStr(reason)}` : " 정보를 수정해 다시 신청해 주세요."}`,
        targetType: "USER", targetIds: [ownerUid],
        linkType: "venue", linkTargetId: vid,
        meta: { venueId: vid, deepLink: approved ? "/owner/home" : "/owner/onboarding" },
        push: { enabled: true, status: "queued", sentAt: null, failReason: null },
        prefsCategory: "owner", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), readBy: {},
      });
    } catch (e) {
      console.warn("[setVenueStatus] owner notify failed:", e?.message || e);
    }
  }
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
    venuePhone: safeStr(data.venuePhone),
    reservationCode: safeStr(data.reservationCode),
    ownerNote: safeStr(data.ownerNote), // 구장주가 승인 시 예약자에게 남긴 안내글
    date: safeStr(data.date), // YYYY-MM-DD
    startTime: safeStr(data.startTime), // HH:mm
    endTime: safeStr(data.endTime),
    userId: safeStr(data.userId),
    userName: safeStr(data.userName),
    teamName: safeStr(data.teamName),
    phone: safeStr(data.phone),
    price: toNum(data.price) ?? 0,
    status: ["requested", "pending", "confirmed", "rejected", "cancelled", "done", "noshow"].includes(data.status)
      ? data.status
      : "requested",
    // 예약 출처(app=사용자앱 / owner=구장주 수동·전화) + 결제수단 + 메모 + 정기대관 묶음
    paymentMethod: safeStr(data.paymentMethod),
    source: safeStr(data.source) || (safeStr(data.userId) ? "app" : "owner"),
    memo: safeStr(data.memo),
    recurringId: safeStr(data.recurringId),
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
    teamAPayerName: safeStr(data.teamAPayerName),
    teamAPayerPhone: safeStr(data.teamAPayerPhone),
    teamBPayerName: safeStr(data.teamBPayerName),
    teamBPayerPhone: safeStr(data.teamBPayerPhone),
    // 예약 요청 시점의 각 팀 팀장 연락처 스냅샷 (구장주 승인 시 확인용)
    teamALeaderUid: safeStr(data.teamALeaderUid),
    teamALeaderName: safeStr(data.teamALeaderName),
    teamALeaderPhone: safeStr(data.teamALeaderPhone),
    teamBLeaderUid: safeStr(data.teamBLeaderUid),
    teamBLeaderName: safeStr(data.teamBLeaderName),
    teamBLeaderPhone: safeStr(data.teamBLeaderPhone),
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

/* ── 매칭 예약(승인대기) 상태 변화를 매칭룸(match_requests) + 양 팀장 알림에 반영 (예약승인제) ── */

/**
 * 팀장(clubs.ownerUid)의 이름·전화번호 스냅샷.
 * 구장주가 예약을 승인할 때 각 팀 팀장에게 연락할 수 있도록 예약 문서에 비정규화 저장한다.
 * (구장주가 users 문서를 직접 읽지 않아도 되게 하려는 목적)
 */
async function loadClubLeaderContact(clubId) {
  const cid = safeStr(clubId);
  if (!cid) return { uid: "", name: "", phone: "" };
  try {
    const clubSnap = await getDoc(doc(db, "clubs", cid));
    const uid = safeStr(clubSnap.exists() ? clubSnap.data()?.ownerUid : "");
    if (!uid) return { uid: "", name: "", phone: "" };
    const userSnap = await getDoc(doc(db, "users", uid));
    const u = userSnap.exists() ? userSnap.data() || {} : {};
    return {
      uid,
      name: safeStr(u.nickname || u.displayName),
      phone: safeStr(u.phoneE164),
    };
  } catch (e) {
    console.warn("[loadClubLeaderContact] failed:", e?.message || e);
    return { uid: "", name: "", phone: "" };
  }
}

// 양 팀 팀장(clubs.ownerUid)에게 매칭 알림 발송
async function notifyMatchTeamLeaders(matchId, clubIds, { subType, type, title, body }) {
  const mid = safeStr(matchId);
  const ids = Array.from(new Set((clubIds || []).map(safeStr).filter(Boolean)));
  for (const cid of ids) {
    try {
      const clubSnap = await getDoc(doc(db, "clubs", cid));
      const ownerUid = safeStr(clubSnap.exists() ? clubSnap.data()?.ownerUid : "");
      if (!ownerUid) continue;
      await addDoc(collection(db, "notifications"), {
        kind: "match", subType, type, title, body,
        targetType: "USER", targetIds: [ownerUid],
        linkType: "match", linkTargetId: mid,
        meta: { matchId: mid, deepLink: `/match-roomdetail/${mid}` },
        push: { enabled: true, status: "queued", sentAt: null, failReason: null },
        prefsCategory: "match", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), readBy: {},
      });
    } catch (e) {
      console.warn("[notifyMatchTeamLeaders] failed:", e?.message || e);
    }
  }
}

// 예약 문서(matchId 보유)의 상태 변화 → 매칭 확정/복귀 동기화
//  action: "approved"(구장주 승인 → 경기 확정) | "rejected"(반려 → 조율중 복귀)
async function syncMatchOnReservationChange(data, action) {
  const matchId = safeStr(data?.matchId);
  if (!matchId) return;
  const clubIds = [safeStr(data.teamAClubId), safeStr(data.teamBClubId)];

  if (action === "approved") {
    await updateDoc(doc(db, "match_requests", matchId), {
      status: "confirmed",
      "partnerBooking.approvalState": "approved",
      "partnerBooking.finalized": true,
      // 확정 카드가 partnerBooking에서 바로 읽도록 예약번호·구장주 안내글 미러링
      "partnerBooking.reservationCode": safeStr(data.reservationCode),
      "partnerBooking.ownerNote": safeStr(data.ownerNote),
      "partnerBooking.venuePhone": safeStr(data.venuePhone),
      confirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await notifyMatchTeamLeaders(matchId, clubIds, {
      subType: "venueReservationApproved", type: "venue_reservation_approved",
      title: "구장 예약 승인 🎉 경기 확정!",
      body: `${safeStr(data.date)} ${safeStr(data.startTime)}~${safeStr(data.endTime)} · ${safeStr(data.courtName)} 예약이 승인돼 경기가 확정됐어요!`,
    });
  } else if (action === "rejected") {
    // 조율중(accepted)으로 되돌리고 제안 정보 비움 → 다른 구장·시간 재제안 가능
    await updateDoc(doc(db, "match_requests", matchId), {
      status: "accepted",
      partnerBooking: null,
      scheduledAt: null,
      field: null,
      proposedByClubId: "",
      proposedAt: null,
      updatedAt: serverTimestamp(),
    });
    await notifyMatchTeamLeaders(matchId, clubIds, {
      subType: "venueReservationRejected", type: "venue_reservation_rejected",
      title: "구장 예약이 반려됐어요",
      body: `${safeStr(data.courtName)} 예약이 구장 사정으로 반려됐어요. 다른 구장·시간을 다시 제안해 주세요.`,
    });
  } else if (action === "cancelled" || action === "noshow") {
    // 확정된 매칭 예약이 취소/노쇼로 종료 → 매칭룸을 조율중(accepted)으로 되돌리고 양 팀장에게 통보.
    // (안 그러면 예약은 종료됐는데 경기는 confirmed로 남아 두 팀이 계속 확정으로 오인)
    await updateDoc(doc(db, "match_requests", matchId), {
      status: "accepted",
      partnerBooking: null,
      scheduledAt: null,
      field: null,
      proposedByClubId: "",
      proposedAt: null,
      updatedAt: serverTimestamp(),
    });
    const noshow = action === "noshow";
    await notifyMatchTeamLeaders(matchId, clubIds, {
      subType: noshow ? "venueReservationNoshow" : "venueReservationCancelled",
      type: noshow ? "venue_reservation_noshow" : "venue_reservation_cancelled",
      title: noshow ? "구장 예약이 노쇼 처리됐어요" : "구장 예약이 취소됐어요",
      body: `${safeStr(data.courtName)} 예약이 ${noshow ? "노쇼로 처리" : "구장 사정으로 취소"}됐어요. 필요하면 다른 구장·시간을 다시 제안해 주세요.`,
    });
  }
}

// 일반 사용자앱 예약(source=app, userId 보유, matchId 없음)의 상태 변화를 예약자 본인에게 통보.
// 매칭 예약은 syncMatchOnReservationChange 가 양 팀장에게 별도 통보하므로 여기서 제외한다.
//  action: "confirmed" | "rejected" | "cancelled" | "noshow"
async function notifyBookingUserOnStatusChange(data, action) {
  const userId = safeStr(data?.userId);
  if (!userId) return;                 // 예약자 uid 없으면(구장주 수동예약 등) 통보 대상 아님
  if (safeStr(data?.matchId)) return;   // 매칭 예약은 팀장 통보로 대체
  const when = `${safeStr(data.date)} ${safeStr(data.startTime)}~${safeStr(data.endTime)}`;
  const where = `${safeStr(data.venueName)}${safeStr(data.courtName) ? ` · ${safeStr(data.courtName)}` : ""}`;
  const note = safeStr(data.ownerNote);
  const M = {
    confirmed: { subType: "venueReservationConfirmed", title: "예약이 확정됐어요 🎉", body: `${when} · ${where} 예약이 확정됐어요. 이용료는 현장에서 정산해요.${note ? `\n구장 안내: ${note}` : ""}` },
    rejected:  { subType: "venueReservationRejected",  title: "예약이 반려됐어요",     body: `${when} · ${where} 예약 요청이 구장 사정으로 반려됐어요. 다른 시간을 선택해 주세요.` },
    cancelled: { subType: "venueReservationCancelled", title: "예약이 취소됐어요",     body: `${when} · ${where} 예약이 취소됐어요.` },
    noshow:    { subType: "venueReservationNoshow",    title: "노쇼로 처리됐어요",       body: `${when} · ${where} 예약이 노쇼로 처리됐어요.` },
  };
  const m = M[action];
  if (!m) return;
  try {
    await addDoc(collection(db, "notifications"), {
      kind: "venue",
      subType: m.subType,
      type: "venue_reservation",
      title: m.title,
      body: m.body,
      targetType: "USER",
      targetIds: [userId],
      linkType: "venue",
      linkTargetId: safeStr(data.venueId),
      meta: { venueId: safeStr(data.venueId), reservationId: safeStr(data.id), deepLink: "/my/reservations" },
      push: { enabled: true, status: "queued", sentAt: null, failReason: null },
      prefsCategory: "venue",
      readBy: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn("[notifyBookingUserOnStatusChange] failed:", e?.message || e);
  }
}

/** 예약 상태 변경 (승인/거절/완료/노쇼). opts.ownerNote: 승인 시 예약자에게 남길 안내글 */
export async function setReservationStatus(reservationId, status, opts = {}) {
  const rid = safeStr(reservationId);
  if (!rid) throw new Error("reservationId가 비어있습니다.");
  const next = ["requested", "confirmed", "rejected", "cancelled", "done", "noshow"].includes(status)
    ? status
    : "requested";
  const ownerNote = safeStr(opts?.ownerNote);
  const dref = doc(db, "venueReservations", rid);

  // 현재 상태 조회 (상태머신 가드 + 승인 시 슬롯 재검증 + 매칭 동기화용)
  const preSnap = await getDoc(dref);
  if (!preSnap.exists()) throw new Error("예약을 찾을 수 없습니다.");
  const cur = preSnap.data() || {};
  const curStatus = safeStr(cur.status);

  // ③ 상태머신 가드: 역행/중복 전이 차단 (done→confirmed 되돌림, 재승인 중복푸시 등)
  if (next === "confirmed" && !["requested", "pending"].includes(curStatus))
    throw new Error("승인 대기 상태의 예약만 승인할 수 있어요.");
  if ((next === "done" || next === "noshow") && curStatus !== "confirmed")
    throw new Error("확정된 예약만 이용완료·노쇼 처리할 수 있어요.");

  // ① 승인 시 슬롯 재검증: 같은 코트·날짜에 이미 확정된 겹침 예약이 있으면 이중예약 차단
  if (next === "confirmed") {
    const others = await listReservations({ venueId: safeStr(cur.venueId), date: safeStr(cur.date), courtId: safeStr(cur.courtId) });
    const clash = others.some(
      (r) => r.id !== rid && r.status === "confirmed" && rangesOverlap(cur.startTime, cur.endTime, r.startTime, r.endTime)
    );
    if (clash) throw new Error("이미 확정된 예약이 있는 시간대예요. 이 요청은 반려해 주세요.");
  }

  await updateDoc(dref, {
    status: next,
    ...(next === "confirmed" ? { ownerNote } : {}),
    updatedAt: serverTimestamp(),
  });

  // 승인(confirmed)/노쇼(noshow) 시 후속 통보
  if (next === "confirmed" || next === "noshow") {
    try {
      const data = { ...cur, id: rid, status: next };
      // 매칭 예약: 승인→경기 확정 동기화 / 노쇼→매칭룸 조율중 복귀 + 양 팀장 알림
      if (safeStr(data.matchId)) {
        await syncMatchOnReservationChange(data, next === "confirmed" ? "approved" : "noshow");
      }
      // 일반 사용자앱 예약 → 예약자 본인 통보 (matchId면 내부에서 skip)
      await notifyBookingUserOnStatusChange(data, next);
    } catch (e) {
      console.warn("[setReservationStatus] post-status notify failed:", e?.message || e);
    }
  }
}

/**
 * 예약을 종료 상태로 변경 (구장주 반려/취소 공용).
 * - 예약 전용(현장 정산) 전환: 앱 결제/환불 없음 → 상태만 변경.
 * - 멱등: 이미 종료(rejected/cancelled/noshow)됐으면 재처리하지 않음.
 */
async function setReservationEndStatus(reservationId, nextStatus) {
  const rid = safeStr(reservationId);
  if (!rid) throw new Error("reservationId가 비어있습니다.");
  const dref = doc(db, "venueReservations", rid);
  const snap = await getDoc(dref);
  if (!snap.exists()) throw new Error("예약을 찾을 수 없습니다.");
  const data = snap.data() || {};

  // 이미 종료 처리된 예약이면 재처리 안 함
  if (["rejected", "cancelled", "noshow"].includes(safeStr(data.status))) {
    return { alreadyDone: true };
  }

  await updateDoc(dref, {
    status: nextStatus,
    updatedAt: serverTimestamp(),
  });
  // 매칭 예약 반려/취소 → 매칭룸 조율중(accepted) 복귀 + 재제안 유도 알림
  if (safeStr(data.matchId) && (nextStatus === "rejected" || nextStatus === "cancelled")) {
    try {
      await syncMatchOnReservationChange(data, nextStatus);
    } catch (e) {
      console.warn("[setReservationEndStatus] match sync failed:", e?.message || e);
    }
  }
  // 일반 사용자앱 예약 반려/취소 → 예약자 본인 통보
  if (nextStatus === "rejected" || nextStatus === "cancelled") {
    await notifyBookingUserOnStatusChange({ ...data, id: rid }, nextStatus);
  }
  return { ok: true };
}

/** 예약 반려 (승인대기 예약 거절) — status=rejected */
export async function rejectReservation(reservationId) {
  return setReservationEndStatus(reservationId, "rejected");
}

/** 확정 예약 취소 (구장주 사정·우천 등) — status=cancelled */
export async function cancelReservation(reservationId) {
  return setReservationEndStatus(reservationId, "cancelled");
}

/* ============================================================
 * 사용자앱 "내 예약" — 조회 + 본인 취소
 * ========================================================== */

/** 내가 예약한 목록 (userId == uid). 최신순(예약일·시작시각 내림차순). */
export async function listMyReservations(uid) {
  const u = safeStr(uid);
  if (!u) return [];
  const snap = await getDocs(
    query(collection(db, "venueReservations"), where("userId", "==", u))
  );
  let rows = [];
  snap.forEach((d) => rows.push(reservationRow(d)));
  // 매칭 분할예약(matchId 보유)은 매칭룸에서 관리하므로 개인 예약 목록에서 제외
  rows = rows.filter((r) => !r.matchId);
  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.startTime < b.startTime ? 1 : a.startTime > b.startTime ? -1 : 0;
  });
  return rows;
}

/**
 * 예약자 본인 취소 — status=cancelled.
 * - 요청(requested)·확정(confirmed) 상태만 취소 가능. 이미 종료/이용완료면 불가.
 * - 지난 예약(과거 날짜·시각)은 취소 불가.
 * - 취소 시 구장주에게 알림.
 */
export async function cancelMyReservation(reservationId, uid) {
  const rid = safeStr(reservationId);
  const u = safeStr(uid);
  if (!rid) throw new Error("reservationId가 비어있습니다.");
  if (!u) throw new Error("로그인이 필요합니다.");
  const dref = doc(db, "venueReservations", rid);
  const snap = await getDoc(dref);
  if (!snap.exists()) throw new Error("예약을 찾을 수 없습니다.");
  const data = snap.data() || {};
  if (safeStr(data.userId) !== u) throw new Error("본인 예약만 취소할 수 있어요.");
  if (!["requested", "confirmed"].includes(safeStr(data.status))) {
    throw new Error("이미 처리된 예약이라 취소할 수 없어요.");
  }
  // 지난 예약 취소 방지 (시작 시각이 이미 지났으면 불가)
  const startISO = `${safeStr(data.date)}T${safeStr(data.startTime) || "00:00"}:00`;
  if (new Date(startISO).getTime() < Date.now()) {
    throw new Error("이미 시작된 예약은 취소할 수 없어요.");
  }

  await updateDoc(dref, { status: "cancelled", canceledBy: "user", updatedAt: serverTimestamp() });

  // 구장주 알림 (실패해도 취소는 유지)
  const ownerUid = safeStr(data.ownerUid);
  if (ownerUid) {
    try {
      await addDoc(collection(db, "notifications"), {
        kind: "venue",
        subType: "venueReservationCanceledByUser",
        type: "venue_reservation",
        title: "예약이 취소됐어요",
        body: `${safeStr(data.date)} ${safeStr(data.startTime)}~${safeStr(data.endTime)} · ${safeStr(data.courtName)} 예약을 예약자가 취소했어요.`,
        targetType: "USER",
        targetIds: [ownerUid],
        linkType: "venue",
        linkTargetId: safeStr(data.venueId),
        meta: { venueId: safeStr(data.venueId), reservationId: rid, deepLink: "/owner/home" },
        push: { enabled: true, status: "queued", sentAt: null, failReason: null },
        prefsCategory: "venue",
        readBy: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn("[cancelMyReservation] owner notify failed:", e?.message || e);
    }
  }
  return { ok: true };
}

/** 노쇼 처리 — 환불 없이 status=noshow (예약금 몰수) */
export async function markReservationNoshow(reservationId) {
  return setReservationStatus(reservationId, "noshow");
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
 * 구장주 수동 예약 (전화/현장) — 단건 또는 매주 정기대관
 * ========================================================== */

// 결제수단 라벨 (수동예약 폼/표시 공용)
export const PAYMENT_METHODS = ["onsite_card", "cash", "transfer", "free"];
export const PAYMENT_METHOD_LABELS = {
  onsite_card: "현장카드",
  cash: "현금",
  transfer: "계좌이체",
  free: "무료·기타",
  fizz: "앱결제",
};

// "YYYY-MM-DD" + n일
function addDaysStr(dateStr, days) {
  const d = new Date(`${safeStr(dateStr)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return safeStr(dateStr);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 구장주가 직접 넣는 예약(전화·현장). status=confirmed·paid로 바로 확정.
 * repeatWeeks>1 이면 매주 같은 시간으로 정기대관 생성(같은 recurringId로 묶음).
 * 이미 찬 주차는 건너뛰고 skipped로 반환.
 */
export async function createOwnerReservation({
  venue, court, date, startTime, endTime,
  customerName, phone, memo = "", price, paymentMethod = "onsite_card",
  repeatWeeks = 1,
}) {
  const venueId = safeStr(venue?.id);
  const courtId = safeStr(court?.id);
  if (!venueId || !courtId) throw new Error("구장/코트 정보가 올바르지 않습니다.");
  if (!safeStr(date) || !safeStr(startTime) || !safeStr(endTime)) throw new Error("예약 시간이 올바르지 않습니다.");

  const weeks = Math.max(1, Math.min(52, toNum(repeatWeeks) || 1));
  const ownerUid = safeStr(venue?.ownerUid);
  const method = PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : "onsite_card";
  const priceOverride = toNum(price);
  const recurringId = weeks > 1
    ? "rec_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    : "";

  const created = [];
  const skipped = [];

  for (let k = 0; k < weeks; k++) {
    const d = addDaysStr(date, k * 7);
    try {
      await assertSlotFree({ venueId, courtId, date: d, startTime, endTime });
    } catch (e) {
      skipped.push(d);
      continue;
    }
    const per = priceOverride != null ? priceOverride : calcSlotPrice(court, startTime, endTime, d);
    const ref = await addDoc(collection(db, "venueReservations"), {
      venueId, courtId, ownerUid,
      courtName: safeStr(court?.name), venueName: safeStr(venue?.name),
      date: d, startTime: safeStr(startTime), endTime: safeStr(endTime),
      userId: "", userName: safeStr(customerName), teamName: safeStr(customerName),
      phone: safeStr(phone), memo: safeStr(memo),
      price: per, paid: true, paidFizz: 0, paymentMethod: method,
      source: "owner", status: "confirmed",
      recurringId,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    created.push({ id: ref.id, date: d });
  }

  return { created, skipped, recurringId };
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

/**
 * 예약 가능 기간(오늘 포함 BOOKING_WINDOW_DAYS일) 밖이면 차단.
 * 사용자 예약 경로 전용 — 구장주 수동·정기대관(createOwnerReservation)은 대상이 아니다.
 * firestore.rules 의 venueReservations 규칙에도 같은 창구가 걸려 있어 UI를 우회해도 막힌다.
 */
function assertBookableDate(date) {
  if (isBookableDate(date)) return;
  const e = new Error(`예약은 오늘부터 ${BOOKING_WINDOW_DAYS}일(3주) 이내 날짜만 가능해요.`);
  e.code = "date_out_of_window";
  throw e;
}

/** 슬롯 가격 계산 — date 주면 3단계 요금(특정날짜>요일별>기본) 반영, 없으면 기본요금 */
export function calcSlotPrice(court, startTime, endTime, date) {
  const per = date ? resolveSlotPrice(court, date, startTime) : (toNum(court?.pricePerHour) ?? 0);
  const mins = Math.max(0, hhmmToMin(endTime) - hhmmToMin(startTime));
  return Math.round((per * mins) / 60);
}

/**
 * 구장 예약 요청 + 구장주 푸시 알림 (예약 전용·현장 정산 · 결제 없음).
 * 1) 해당 슬롯이 비었는지 재검증(다른 예약/블록 겹침 확인)
 * 2) venueReservations 생성 (status=requested · 승인대기, paid=false)
 * 3) 구장주에게 notifications 문서 생성(push queued → sendPushTick 발송)
 */
/**
 * 사람이 읽을 예약번호 발급 — "HM-YYMMDD-XXXX" (예약일 + 4자리 코드).
 * 표시·문의 식별용이라 전역 유일성까지는 필요 없다(문서 id가 실 키).
 */
export function genReservationCode(date) {
  const ymd = safeStr(date).replace(/-/g, "").slice(2); // YYMMDD
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HM-${ymd || "000000"}-${rand}`;
}

export async function bookVenue({ venue, court, date, startTime, endTime, user }) {
  const venueId = safeStr(venue?.id);
  const courtId = safeStr(court?.id);
  const uid = safeStr(user?.uid);
  if (!venueId || !courtId) throw new Error("구장/코트 정보가 올바르지 않습니다.");
  if (!safeStr(date) || !safeStr(startTime) || !safeStr(endTime)) throw new Error("예약 시간이 올바르지 않습니다.");
  if (!uid) throw new Error("로그인이 필요합니다.");
  assertBookableDate(date);

  // 1) 슬롯 비었는지 재검증
  const [reservations, blocks] = await Promise.all([
    listReservations({ venueId, date, courtId }),
    listBlocks({ venueId, date, courtId }),
  ]);
  const taken = reservations.some(
    (r) => ["requested", "pending", "confirmed"].includes(r.status) && rangesOverlap(startTime, endTime, r.startTime, r.endTime)
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

  const price = calcSlotPrice(court, startTime, endTime, date);

  // 2) 예약 요청 생성 (결제 없음 → 구장주 승인 대기)
  const ownerUid = safeStr(venue?.ownerUid);
  const ref = await addDoc(collection(db, "venueReservations"), {
    venueId,
    courtId,
    ownerUid,
    courtName: safeStr(court?.name),
    venueName: safeStr(venue?.name),
    venuePhone: safeStr(venue?.phone || venue?.contactPhone),
    reservationCode: genReservationCode(date),
    date: safeStr(date),
    startTime: safeStr(startTime),
    endTime: safeStr(endTime),
    userId: uid,
    userName: safeStr(user?.userName),
    teamName: safeStr(user?.teamName),
    phone: safeStr(user?.phone),
    price,
    paid: false,
    paymentMethod: "onsite",
    status: "requested",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const reservationId = ref.id;

  // 3) 구장주 푸시 알림 (실패해도 예약 요청은 유지)
  if (ownerUid) {
    try {
      await addDoc(collection(db, "notifications"), {
        kind: "venue",
        subType: "venueReservationCreated",
        type: "venue_reservation",
        title: "새 예약 요청이 들어왔어요",
        body: `${date} ${startTime}~${endTime} · ${safeStr(court?.name)} (${safeStr(user?.userName) || "예약자"}) · 승인 대기`,
        targetType: "USER",
        targetIds: [ownerUid],
        linkType: "venue",
        linkTargetId: venueId,
        meta: { venueId, reservationId, deepLink: "/owner/home" },
        push: { enabled: true, status: "queued", sentAt: null, failReason: null },
        // 구장주 예약 알림 — "match" 토글과 분리(별도 카테고리라 매칭 알림 꺼도 안 꺼짐)
        prefsCategory: "venue",
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
  assertBookableDate(date);
  await assertSlotFree({ venueId: venue.id, courtId: court.id, date, startTime, endTime });
  const total = calcSlotPrice(court, startTime, endTime, date);
  const { shareA, shareB } = splitPrice(total);

  await updateDoc(doc(db, "match_requests", id), {
    partnerBooking: {
      venueId: safeStr(venue.id),
      venueName: safeStr(venue.name),
      venueImageUrl: safeStr(venue.imageUrl) || safeStr(arr(venue.photos)[0]) || "",
      venuePhone: safeStr(venue.phone || venue.contactPhone),
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

/**
 * (예약승인제) 상대팀이 제휴구장 제안을 수락 → 구장주 승인 대기 예약 생성.
 *  - 결제 없음(현장 정산). venueReservations/m_{matchId} 를 status="requested"(승인대기)로 생성.
 *  - match_requests.status="awaiting_venue_approval", partnerBooking.approvalState="requested".
 *  - 구장주에게 예약요청 알림 → OwnerHomePage 승인 대기 큐에 노출됨.
 *  - 멱등: 이미 requested/pending/confirmed 예약이 있으면 재생성하지 않음.
 */
export async function requestVenueReservationForMatch({ matchId, requestedByClubId } = {}) {
  const id = safeStr(matchId);
  if (!id) throw new Error("matchId가 필요합니다.");

  const msnap = await getDoc(doc(db, "match_requests", id));
  const pb = msnap.exists() ? msnap.data()?.partnerBooking : null;
  if (!pb) throw new Error("제안된 구장 정보가 없습니다.");

  const resRef = doc(db, "venueReservations", `m_${id}`);
  const pre = await getDoc(resRef);
  const preActive = pre.exists() && ["requested", "pending", "confirmed"].includes(safeStr(pre.data()?.status));

  if (!preActive) {
    assertBookableDate(pb.date);
    await assertSlotFree({ venueId: pb.venueId, courtId: pb.courtId, date: pb.date, startTime: pb.startTime, endTime: pb.endTime });
    const [leaderA, leaderB] = await Promise.all([
      loadClubLeaderContact(pb.proposerClubId),
      loadClubLeaderContact(pb.opponentClubId),
    ]);
    await setDoc(resRef, {
      venueId: safeStr(pb.venueId), venueName: safeStr(pb.venueName), ownerUid: safeStr(pb.ownerUid),
      venuePhone: safeStr(pb.venuePhone),
      reservationCode: genReservationCode(pb.date),
      courtId: safeStr(pb.courtId), courtName: safeStr(pb.courtName),
      date: safeStr(pb.date), startTime: safeStr(pb.startTime), endTime: safeStr(pb.endTime),
      userId: safeStr(pb.proposerUid), userName: safeStr(pb.proposerTeamName), teamName: safeStr(pb.proposerTeamName),
      price: toNum(pb.totalPrice) ?? 0, paid: false, paymentMethod: "onsite", source: "match",
      status: "requested",
      matchId: id, splitTotal: toNum(pb.totalPrice) ?? 0,
      shareA: toNum(pb.shareA) ?? 0, shareB: toNum(pb.shareB) ?? 0,
      teamAClubId: safeStr(pb.proposerClubId), teamBClubId: safeStr(pb.opponentClubId),
      teamAName: safeStr(pb.proposerTeamName), teamBName: safeStr(pb.opponentTeamName),
      // 구장주가 승인 시 각 팀 팀장에게 연락할 수 있도록 예약 시점 연락처를 저장
      teamALeaderUid: leaderA.uid, teamALeaderName: leaderA.name, teamALeaderPhone: leaderA.phone,
      teamBLeaderUid: leaderB.uid, teamBLeaderName: leaderB.name, teamBLeaderPhone: leaderB.phone,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  }

  await updateDoc(doc(db, "match_requests", id), {
    status: "awaiting_venue_approval",
    "partnerBooking.accepted": true,
    "partnerBooking.acceptedByClubId": safeStr(requestedByClubId),
    "partnerBooking.acceptedAt": serverTimestamp(),
    "partnerBooking.approvalState": "requested",
    "partnerBooking.reservationId": resRef.id,
    updatedAt: serverTimestamp(),
  });

  if (pb.ownerUid) {
    try {
      await addDoc(collection(db, "notifications"), {
        kind: "venue", subType: "venueReservationRequested", type: "venue_reservation",
        title: "새 구장 예약 요청이 들어왔어요",
        body: `${safeStr(pb.date)} ${safeStr(pb.startTime)}~${safeStr(pb.endTime)} · ${safeStr(pb.courtName)} (${safeStr(pb.proposerTeamName)} vs ${safeStr(pb.opponentTeamName)}) — 승인해 주세요`,
        targetType: "USER", targetIds: [safeStr(pb.ownerUid)],
        linkType: "venue", linkTargetId: safeStr(pb.venueId),
        meta: { venueId: safeStr(pb.venueId), reservationId: resRef.id, matchId: id, deepLink: "/owner/home" },
        push: { enabled: true, status: "queued", sentAt: null, failReason: null },
        prefsCategory: "venue", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn("[requestVenueReservationForMatch] notify failed:", e?.message || e);
    }
  }

  return { reservationId: resRef.id, status: "requested" };
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
  // 이미 활성 예약이 있는 시간은 막지 못하게 한다. (안 그러면 예약 우선 렌더로 블록이 화면에서 안 보이다가,
  //  예약이 취소되면 유령 블록이 남아 이후 예약을 계속 차단함)
  const dayRes = await listReservations({ venueId, date, courtId });
  const clash = dayRes.some(
    (r) => ["requested", "pending", "confirmed"].includes(r.status) && rangesOverlap(startTime, endTime, r.startTime, r.endTime)
  );
  if (clash) throw new Error("이미 예약이 있는 시간은 막을 수 없어요. 예약을 먼저 처리해 주세요.");
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

// 종목 (네이버 플레이스 업종/스포츠 카테고리 참고 — 검색·필터용)
export const SPORT_OPTIONS = [
  "농구",
  "풋살",
  "배드민턴",
  "테니스",
  "족구",
  "배구",
  "탁구",
  "다목적",
];

// 코트 바닥재질 (스포츠 구장 핵심 정보)
export const SURFACE_OPTIONS = [
  "마루",
  "우레탄",
  "인조잔디",
  "타폴린",
  "고무바닥",
  "기타",
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
