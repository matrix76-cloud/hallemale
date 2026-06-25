// 구장 관리자 데모 시드 — 승인된 구장 1개 + 코트 2개 + 예약/블록 몇 건
// getMyVenue(ownerUid) 가 찾을 수 있도록 ownerUid = 로그인 UID 로 저장.
//
// 사용:
//   node scripts/seed-owner-venue.mjs                       → email 기본값(kkan2222@gmail.com)로 UID 조회 후 시드
//   node scripts/seed-owner-venue.mjs --email=foo@bar.com   → 다른 이메일로
//   node scripts/seed-owner-venue.mjs --uid=ABC123          → UID 직접 지정
//   node scripts/seed-owner-venue.mjs --pending             → 승인 대신 '심사중' 상태로
//   node scripts/seed-owner-venue.mjs --clean               → 시드 구장/예약/블록 삭제
//
// 재실행 안전: 고정 docId(seed_owner_venue_demo) 사용 → overwrite.

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
  authDomain: "halle-bf789.firebaseapp.com",
  projectId: "halle-bf789",
  storageBucket: "halle-bf789.firebasestorage.app",
  messagingSenderId: "939913723928",
  appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const args = process.argv.slice(2);
const getArg = (k, d = "") => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split("=").slice(1).join("=") : d;
};
const EMAIL = getArg("email", "kkan2222@gmail.com");
const UID_ARG = getArg("uid", "");
const PENDING = args.includes("--pending");
const CLEAN = args.includes("--clean");

const VENUE_ID = "seed_owner_venue_demo";
const COURT_A = "court_a";
const COURT_B = "court_b";

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

async function resolveUid() {
  if (UID_ARG) return UID_ARG;
  // users 컬렉션에서 email 로 조회
  const snap = await getDocs(query(collection(db, "users"), where("email", "==", EMAIL)));
  if (!snap.empty) return snap.docs[0].id;
  return "";
}

async function clean(uid) {
  await deleteDoc(doc(db, "venues", VENUE_ID)).catch(() => {});
  for (const c of ["venueReservations", "venueBlocks"]) {
    const snap = await getDocs(query(collection(db, c), where("venueId", "==", VENUE_ID)));
    for (const d of snap.docs) await deleteDoc(d.ref).catch(() => {});
  }
  console.log("🧹 시드 데이터 삭제 완료");
}

async function main() {
  const uid = await resolveUid();
  if (!uid) {
    console.error(
      `❌ UID를 찾지 못했어요. (email=${EMAIL})\n` +
      `   → 먼저 /owner/login 으로 한 번 로그인하거나, --uid=직접UID 로 실행해줘.`
    );
    process.exit(1);
  }
  console.log(`👤 ownerUid = ${uid}`);

  if (CLEAN) {
    await clean(uid);
    process.exit(0);
  }

  const weekday = { open: "09:00", close: "22:00", closed: false };
  const weekend = { open: "09:00", close: "21:00", closed: false };
  const hoursWeekdayLong = {
    mon: { ...weekday }, tue: { ...weekday }, wed: { ...weekday }, thu: { ...weekday }, fri: { ...weekday },
    sat: { ...weekend }, sun: { ...weekend },
  };
  const hoursWithSunClosed = {
    ...hoursWeekdayLong,
    sun: { open: "10:00", close: "18:00", closed: true }, // 일요일 휴무 데모
  };

  const courts = [
    { id: COURT_A, name: "A코트", type: "indoor", pricePerHour: 40000, slotMinutes: 60, hours: hoursWeekdayLong },
    { id: COURT_B, name: "B코트", type: "indoor", pricePerHour: 35000, slotMinutes: 60, hours: hoursWithSunClosed },
  ];

  const venue = {
    ownerUid: uid,
    status: PENDING ? "pending" : "approved",
    rejectReason: "",
    name: "용산 더베이스 농구장 (데모)",
    address: "서울 용산구 한강대로23길 55",
    addressDetail: "지하 2층",
    region: "서울 용산구",
    lat: 37.5298,
    lng: 126.9648,
    phone: "02-1234-5678",
    photos: ["https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1080&q=80"],
    imageUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1080&q=80",
    storagePaths: [],
    facilities: ["주차장", "샤워실", "화장실", "탈의실", "농구공 대여", "냉난방"],
    description: "실내 우레탄 코트 2면. 야간 조명 완비. 주차 20대 가능.",
    rules: "실내화 필수 · 음식물 반입 금지 · 시작 10분 전 입장",
    refundPolicy: "• 이용 7일 전: 100% 환불\n• 이용 3일 전: 50% 환불\n• 당일: 환불 불가",
    bizName: "더베이스스포츠",
    bizNo: "123-45-67890",
    ownerName: "이행렬",
    contactPhone: "010-1234-5678",
    courts,
    active: !PENDING,
    cost: "paid",
    type: "indoor",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "venues", VENUE_ID), venue);
  console.log(`🏟️  구장 저장: ${VENUE_ID} (status=${venue.status})`);

  // 예약/블록은 승인 상태일 때만 의미 있음
  if (!PENDING) {
    const today = ymd(new Date());
    const tomorrow = ymd(new Date(Date.now() + 86400000));

    const reservations = [
      { id: "seed_resv_1", courtId: COURT_A, date: today, startTime: "19:00", endTime: "20:00", userName: "김민수", teamName: "리바운드5", phone: "010-2222-3333", price: 40000, status: "requested" },
      { id: "seed_resv_2", courtId: COURT_A, date: today, startTime: "20:00", endTime: "21:00", userName: "박지훈", teamName: "청춘사자", phone: "010-4444-5555", price: 40000, status: "confirmed" },
      { id: "seed_resv_3", courtId: COURT_B, date: today, startTime: "18:00", endTime: "19:00", userName: "이서연", teamName: "날쎈초급", phone: "010-6666-7777", price: 35000, status: "requested" },
      { id: "seed_resv_4", courtId: COURT_A, date: tomorrow, startTime: "10:00", endTime: "11:00", userName: "최강", teamName: "블랙비어", phone: "010-8888-9999", price: 40000, status: "confirmed" },
    ];
    for (const r of reservations) {
      await setDoc(doc(db, "venueReservations", r.id), {
        venueId: VENUE_ID,
        ownerUid: uid,
        ...r,
        userId: "seed_user",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    console.log(`📅 예약 ${reservations.length}건 저장 (오늘=${today})`);

    // 블록(점심시간 막기) 예시
    await setDoc(doc(db, "venueBlocks", "seed_block_1"), {
      venueId: VENUE_ID,
      courtId: COURT_A,
      date: today,
      startTime: "12:00",
      endTime: "13:00",
      createdAt: serverTimestamp(),
    });
    console.log(`⛔ 블록 1건 저장 (오늘 12:00~13:00 A코트)`);
  }

  console.log("\n✅ 시드 완료! /owner 로 들어가서 확인해줘.");
  console.log(PENDING ? "   → '심사중' 화면이 보일 거야." : "   → 바로 예약관리 탭이 보일 거야.");
  process.exit(0);
}

main().catch((e) => {
  console.error("시드 실패:", e);
  process.exit(1);
});
