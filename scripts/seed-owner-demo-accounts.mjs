// 구장주 데모 계정 시드 — 운영 주체별(개인·사업자 4 / 학교 8 / 기관 4) 계정 + 구장 등록 + 승인
//
// 앱 화면과 같은 경로를 그대로 밟는다:
//   OwnerSignupPage(SMS 인증 → 이메일 가입) → OwnerTypeGate(운영 주체)
//   → OwnerAgreementGate(필수 동의) → OwnerOnboardingPage(구장 등록)
//   → 구장정보 인증/정산(사업자·통신판매업·정산계좌) → 승인
//
// 사용:
//   node scripts/seed-owner-demo-accounts.mjs            → 생성(+승인)
//   node scripts/seed-owner-demo-accounts.mjs --pending  → 승인 없이 심사중까지만
//   node scripts/seed-owner-demo-accounts.mjs --clean    → 데모 구장 비활성화(계정은 남음)
//
// ⚠️ 프로덕션 Firebase(halle-bf789)에 실제로 쓴다. 구장명은 전부 [데모] 접두어.

import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { writeFileSync } from "fs";

const firebaseConfig = {
  apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
  authDomain: "halle-bf789.firebaseapp.com",
  projectId: "halle-bf789",
  storageBucket: "halle-bf789.firebasestorage.app",
  messagingSenderId: "939913723928",
  appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
};

const CF_BASE = "https://asia-northeast3-halle-bf789.cloudfunctions.net";

const args = process.argv.slice(2);
const PENDING_ONLY = args.includes("--pending");
const CLEAN = args.includes("--clean");
// --limit=N : 앞에서 N개만 (첫 시도 검증용)
const LIMIT = Number((args.find((a) => a.startsWith("--limit=")) || "").split("=")[1]) || 0;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const PASSWORD = "HalleDemo2026!";
// functions/otp/phoneOtp.js TEST_PHONE_RANGE — Solapi 발송 없이 응답으로 코드가 내려온다.
const TEST_PHONES = ["01099991000", "01099991001", "01099991002", "01099991003", "01099991004", "01099991005"];

const PHOTOS = [
  "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1080&q=80",
  "https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=1080&q=80",
  "https://images.unsplash.com/photo-1518063319789-7217e6706b04?w=1080&q=80",
];

/* ── 유틸 ───────────────────────────────────────────── */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 국세청 체크섬을 만족하는 사업자등록번호 (앞 9자리 → 검증숫자 계산) */
function bizNoFrom(base9) {
  const d = String(base9).replace(/\D/g, "").padStart(9, "0").slice(0, 9);
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i], 10) * w[i];
  sum += Math.floor((parseInt(d[8], 10) * 5) / 10);
  const check = (10 - (sum % 10)) % 10;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}${check}`;
}

function toE164Kr(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("0") ? `+82${d.slice(1)}` : `+82${d}`;
}

const weekday = { open: "09:00", close: "22:00", closed: false };
const weekend = { open: "09:00", close: "21:00", closed: false };
function hours(over = {}) {
  return {
    mon: { ...weekday }, tue: { ...weekday }, wed: { ...weekday },
    thu: { ...weekday }, fri: { ...weekday },
    sat: { ...weekend }, sun: { ...weekend },
    ...over,
  };
}
function court(id, name, type, surface, price, over = {}) {
  return {
    id, name, type, surface,
    pricePerHour: price, slotMinutes: 60,
    hours: hours(over.hours || {}),
    priceBands: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
    priceOverrides: {},
    notices: [], cautions: [],
  };
}

/* ── 계정 정의 (16개) ───────────────────────────────── */

const DEFAULT_REFUND =
  "• 당일 취소·노쇼는 삼가주세요. 반복 시 예약이 제한될 수 있어요.\n• 우천/천재지변 시 협의 후 일정 변경 가능";

const ACCOUNTS = [
  /* ── 개인 · 사업자 4 ───────────────────────────── */
  {
    email: "demo-biz1@hallemale-demo.com", ownerType: "business",
    manager: { name: "김대표", phone: TEST_PHONES[0] },
    venue: {
      name: "[데모] 할래말래 테스트구장 1호", address: "서울 용산구 데모로 1", addressDetail: "지하 2층",
      region: "서울 용산구", lat: 37.5298, lng: 126.9648, phone: "02-0000-0001",
      directions: "6호선 이태원역 3번 출구 도보 5분, 건물 뒤편 입구",
      description: "실내 우레탄 코트 2면. 야간 조명 완비. 주차 20대 가능.",
      rules: "실내화 필수 · 음식물 반입 금지 · 시작 10분 전 입장",
      facilities: ["주차장", "샤워실", "화장실", "탈의실", "농구공 대여", "냉난방"],
      parking: { available: true, fee: "free", info: "건물 내 20대, 이용 시간 무료" },
      keywords: ["용산 농구장", "이태원 농구", "실내코트"],
      courts: [court("c_biz1_a", "A코트", "indoor", "우레탄", 40000), court("c_biz1_b", "B코트", "indoor", "마루", 35000)],
      photos: [PHOTOS[0], PHOTOS[1]],
    },
    biz: { bizName: "할래말래데모스포츠1", ownerName: "김대표", bizNo: bizNoFrom("120815001"), openDate: "20190312", taxType: "general" },
    sales: { number: "2019-서울용산-01234", exempt: false },
    settle: { bank: "국민", account: "12345601234567", holder: "김대표" },
  },
  {
    email: "demo-biz2@hallemale-demo.com", ownerType: "business",
    manager: { name: "박사장", phone: TEST_PHONES[1] },
    venue: {
      name: "[데모] 할래말래 테스트구장 2호", address: "서울 강남구 데모로 2", addressDetail: "3층",
      region: "서울 강남구", lat: 37.5045, lng: 127.0248, phone: "02-0000-0002",
      directions: "2호선 역삼역 7번 출구 도보 3분",
      description: "3면 분할 가능한 대형 실내 코트. 관중석 60석.",
      rules: "실내화 필수 · 음주 후 입장 불가",
      facilities: ["주차장", "샤워실", "화장실", "탈의실", "매점", "냉난방", "관중석"],
      parking: { available: true, fee: "paid", info: "2시간 무료, 이후 시간당 2,000원" },
      keywords: ["강남 농구장", "역삼 농구", "대관"],
      courts: [court("c_biz2_a", "메인코트", "indoor", "마루", 60000), court("c_biz2_b", "서브코트", "indoor", "마루", 45000)],
      photos: [PHOTOS[1], PHOTOS[2]],
    },
    biz: { bizName: "할래말래데모스포츠2", ownerName: "박사장", bizNo: bizNoFrom("211881002"), openDate: "20210701", taxType: "general" },
    sales: { number: "2021-서울강남-05678", exempt: false },
    settle: { bank: "신한", account: "11022233344455", holder: "박사장" },
  },
  {
    email: "demo-biz3@hallemale-demo.com", ownerType: "business",
    manager: { name: "이점장", phone: TEST_PHONES[2] },
    venue: {
      name: "[데모] 할래말래 테스트구장 3호", address: "경기 수원시 팔달구 데모로 3", addressDetail: "",
      region: "경기 수원시", lat: 37.2636, lng: 127.0286, phone: "031-0000-0003",
      directions: "수원시청역 5번 출구 도보 8분",
      description: "우레탄 코트 1면. 소규모 팀 대관에 적합.",
      rules: "쓰레기 되가져가기 · 시설물 파손 시 배상",
      facilities: ["주차장", "화장실", "정수기", "냉난방"],
      parking: { available: true, fee: "free", info: "부설주차장 15대" },
      keywords: ["수원 농구장", "팔달구 체육관"],
      courts: [court("c_biz3_a", "1코트", "indoor", "우레탄", 30000)],
      photos: [PHOTOS[2]],
    },
    biz: { bizName: "할래말래데모스포츠3", ownerName: "이점장", bizNo: bizNoFrom("135220003"), openDate: "20220215", taxType: "simple" },
    sales: { number: "", exempt: true },
    settle: { bank: "농협", account: "3020123456789", holder: "이점장" },
  },
  {
    email: "demo-biz4@hallemale-demo.com", ownerType: "business",
    manager: { name: "최실장", phone: TEST_PHONES[3] },
    venue: {
      name: "[데모] 할래말래 테스트야외코트", address: "부산 해운대구 데모로 4", addressDetail: "",
      region: "부산 해운대구", lat: 35.1587, lng: 129.1604, phone: "051-0000-0004",
      directions: "2호선 해운대역 3번 출구 도보 10분",
      description: "야외 하드코트 2면. 야간 조명 22시까지.",
      rules: "우천 시 이용 불가 · 소음 자제(22시 이후)",
      facilities: ["화장실", "정수기", "샤워실"],
      parking: { available: false, fee: "free", info: "" },
      keywords: ["해운대 농구장", "부산 야외코트"],
      courts: [
        court("c_biz4_a", "A코트", "outdoor", "아스팔트", 20000),
        court("c_biz4_b", "B코트", "outdoor", "아스팔트", 20000, { hours: { sun: { open: "10:00", close: "18:00", closed: true } } }),
      ],
      photos: [PHOTOS[0]],
    },
    biz: { bizName: "할래말래데모스포츠4", ownerName: "최실장", bizNo: bizNoFrom("605330004"), openDate: "20200601", taxType: "simple" },
    sales: { number: "", exempt: true },
    settle: { bank: "부산", account: "1012345678901", holder: "최실장" },
  },

  /* ── 학교 8 (초 2 · 중 2 · 고 2 · 대 2) ─────────── */
  {
    email: "demo-school1@hallemale-demo.com", ownerType: "school",
    manager: { name: "정선생", phone: TEST_PHONES[4] },
    venue: {
      name: "[데모] 할래말래테스트초등학교 체육관", address: "서울 성동구 데모로 11", addressDetail: "본관 3층",
      region: "서울 성동구", lat: 37.5610, lng: 127.0370, phone: "02-0000-0011",
      directions: "2호선 한양대역 2번 출구 도보 7분, 정문 옆 체육관 입구",
      description: "초등 규격 코트 1면. 주말·방과 후 개방.",
      rules: "실내화 필수 · 음식물 반입 금지 · 학교 시설물 훼손 금지",
      facilities: ["주차장", "화장실", "정수기", "냉난방"],
      parking: { available: true, fee: "free", info: "운동장 주차 10대" },
      keywords: ["성동구 체육관", "학교 대관"],
      courts: [court("c_sch1_a", "체육관", "indoor", "마루", 20000, { hours: { mon: { open: "18:00", close: "21:00", closed: false }, tue: { open: "18:00", close: "21:00", closed: false }, wed: { open: "18:00", close: "21:00", closed: false }, thu: { open: "18:00", close: "21:00", closed: false }, fri: { open: "18:00", close: "21:00", closed: false } } })],
      photos: [PHOTOS[1]],
    },
    biz: { bizName: "할래말래테스트초등학교", ownerName: "정선생", deptName: "체육부", licenseUrl: PHOTOS[0], school: { code: "D000000001", officeCode: "B10", name: "할래말래테스트초등학교", kind: "초등학교", address: "서울 성동구 데모로 11", tel: "02-0000-0011", foundKind: "공립" } },
    settle: { bank: "우리", account: "1002345678901", holder: "할래말래테스트초등학교" },
  },
  {
    email: "demo-school2@hallemale-demo.com", ownerType: "school",
    manager: { name: "오선생", phone: TEST_PHONES[5] },
    venue: {
      name: "[데모] 할래말래데모초등학교 강당", address: "경기 고양시 일산동구 데모로 12", addressDetail: "강당",
      region: "경기 고양시", lat: 37.6584, lng: 126.7770, phone: "031-0000-0012",
      directions: "3호선 마두역 1번 출구 도보 12분",
      description: "다목적 강당. 농구 1면 규격.",
      rules: "실내화 필수 · 21시 이후 이용 불가",
      facilities: ["화장실", "정수기", "냉난방"],
      parking: { available: true, fee: "free", info: "정문 옆 8대" },
      keywords: ["일산 체육관", "학교 강당"],
      courts: [court("c_sch2_a", "강당", "indoor", "마루", 18000)],
      photos: [PHOTOS[2]],
    },
    biz: { bizName: "할래말래데모초등학교", ownerName: "오선생", deptName: "체육부", licenseUrl: PHOTOS[0], school: { code: "D000000002", officeCode: "J10", name: "할래말래데모초등학교", kind: "초등학교", address: "경기 고양시 일산동구 데모로 12", tel: "031-0000-0012", foundKind: "공립" } },
    settle: { bank: "농협", account: "3011234567890", holder: "할래말래데모초등학교" },
  },
  {
    email: "demo-school3@hallemale-demo.com", ownerType: "school",
    manager: { name: "강선생", phone: TEST_PHONES[0] },
    venue: {
      name: "[데모] 할래말래테스트중학교 체육관", address: "서울 노원구 데모로 13", addressDetail: "체육관동",
      region: "서울 노원구", lat: 37.6545, lng: 127.0568, phone: "02-0000-0013",
      directions: "7호선 중계역 2번 출구 도보 6분",
      description: "중등 규격 실내코트. 평일 야간·주말 개방.",
      rules: "실내화 필수 · 학교 규정 준수",
      facilities: ["주차장", "화장실", "탈의실", "냉난방"],
      parking: { available: true, fee: "free", info: "교내 12대" },
      keywords: ["노원 농구장", "중계동 체육관"],
      courts: [court("c_sch3_a", "체육관", "indoor", "우레탄", 25000)],
      photos: [PHOTOS[0]],
    },
    biz: { bizName: "할래말래테스트중학교", ownerName: "강선생", deptName: "체육부", licenseUrl: PHOTOS[0], school: { code: "D000000003", officeCode: "B10", name: "할래말래테스트중학교", kind: "중학교", address: "서울 노원구 데모로 13", tel: "02-0000-0013", foundKind: "공립" } },
    settle: { bank: "국민", account: "60012345678901", holder: "할래말래테스트중학교" },
  },
  {
    email: "demo-school4@hallemale-demo.com", ownerType: "school",
    manager: { name: "윤선생", phone: TEST_PHONES[1] },
    venue: {
      name: "[데모] 할래말래데모중학교 실내코트", address: "인천 연수구 데모로 14", addressDetail: "",
      region: "인천 연수구", lat: 37.3890, lng: 126.6450, phone: "032-0000-0014",
      directions: "인천1호선 센트럴파크역 4번 출구 도보 9분",
      description: "실내 1면 + 야외 1면. 주말 종일 개방.",
      rules: "실내화 필수 · 쓰레기 되가져가기",
      facilities: ["주차장", "화장실", "정수기"],
      parking: { available: true, fee: "free", info: "운동장 주차" },
      keywords: ["송도 농구장", "연수구 체육관"],
      courts: [
        court("c_sch4_a", "실내코트", "indoor", "마루", 22000),
        court("c_sch4_b", "야외코트", "outdoor", "우레탄", 12000),
      ],
      photos: [PHOTOS[1]],
    },
    biz: { bizName: "할래말래데모중학교", ownerName: "윤선생", deptName: "체육부", licenseUrl: PHOTOS[0], school: { code: "D000000004", officeCode: "E10", name: "할래말래데모중학교", kind: "중학교", address: "인천 연수구 데모로 14", tel: "032-0000-0014", foundKind: "공립" } },
    settle: { bank: "기업", account: "01012345678901", holder: "할래말래데모중학교" },
  },
  {
    email: "demo-school5@hallemale-demo.com", ownerType: "school",
    manager: { name: "임선생", phone: TEST_PHONES[2] },
    venue: {
      name: "[데모] 할래말래테스트고등학교 체육관", address: "서울 관악구 데모로 15", addressDetail: "체육관 2층",
      region: "서울 관악구", lat: 37.4784, lng: 126.9516, phone: "02-0000-0015",
      directions: "2호선 서울대입구역 3번 출구 도보 10분",
      description: "고등 규격 실내코트 1면. 관중석 200석.",
      rules: "실내화 필수 · 시설 파손 시 배상 · 흡연 금지",
      facilities: ["주차장", "샤워실", "화장실", "탈의실", "관중석", "냉난방"],
      parking: { available: true, fee: "free", info: "교내 30대" },
      keywords: ["관악 농구장", "고등학교 대관"],
      courts: [court("c_sch5_a", "체육관", "indoor", "마루", 30000)],
      photos: [PHOTOS[2]],
    },
    biz: { bizName: "할래말래테스트고등학교", ownerName: "임선생", deptName: "체육부", licenseUrl: PHOTOS[0], school: { code: "D000000005", officeCode: "B10", name: "할래말래테스트고등학교", kind: "고등학교", address: "서울 관악구 데모로 15", tel: "02-0000-0015", foundKind: "사립" } },
    settle: { bank: "하나", account: "12345678901234", holder: "할래말래테스트고등학교" },
  },
  {
    email: "demo-school6@hallemale-demo.com", ownerType: "school",
    manager: { name: "서선생", phone: TEST_PHONES[3] },
    venue: {
      name: "[데모] 할래말래데모고등학교 다목적관", address: "대전 유성구 데모로 16", addressDetail: "",
      region: "대전 유성구", lat: 36.3620, lng: 127.3560, phone: "042-0000-0016",
      directions: "유성온천역 6번 출구 버스 10분",
      description: "다목적 실내관. 농구·배구 겸용.",
      rules: "실내화 필수 · 사전 승인된 인원만 입장",
      facilities: ["주차장", "화장실", "정수기", "냉난방"],
      parking: { available: true, fee: "free", info: "교내 20대" },
      keywords: ["대전 농구장", "유성 체육관"],
      courts: [court("c_sch6_a", "다목적관", "indoor", "우레탄", 24000)],
      photos: [PHOTOS[0]],
    },
    biz: { bizName: "할래말래데모고등학교", ownerName: "서선생", deptName: "체육부", licenseUrl: PHOTOS[0], school: { code: "D000000006", officeCode: "G10", name: "할래말래데모고등학교", kind: "고등학교", address: "대전 유성구 데모로 16", tel: "042-0000-0016", foundKind: "공립" } },
    settle: { bank: "우체국", account: "01234567890123", holder: "할래말래데모고등학교" },
  },
  {
    email: "demo-school7@hallemale-demo.com", ownerType: "school",
    manager: { name: "한조교", phone: TEST_PHONES[4] },
    venue: {
      name: "[데모] 할래말래테스트대학교 체육관", address: "서울 서대문구 데모로 17", addressDetail: "학생회관 지하 1층",
      region: "서울 서대문구", lat: 37.5665, lng: 126.9388, phone: "02-0000-0017",
      directions: "2호선 신촌역 3번 출구 도보 12분",
      description: "대학 체육관 2면. 야간 대관 가능.",
      rules: "실내화 필수 · 교내 금연 · 22시 이후 소음 자제",
      facilities: ["주차장", "샤워실", "화장실", "탈의실", "매점", "냉난방"],
      parking: { available: true, fee: "paid", info: "교내 주차 시간당 1,000원" },
      keywords: ["신촌 농구장", "대학 체육관"],
      courts: [
        court("c_sch7_a", "제1체육관", "indoor", "마루", 45000),
        court("c_sch7_b", "제2체육관", "indoor", "우레탄", 35000),
      ],
      photos: [PHOTOS[1], PHOTOS[2]],
    },
    biz: { bizName: "할래말래테스트대학교", ownerName: "한조교", deptName: "학생지원처 시설팀", licenseUrl: PHOTOS[0], school: { code: "D000000007", officeCode: "B10", name: "할래말래테스트대학교", kind: "대학교", address: "서울 서대문구 데모로 17", tel: "02-0000-0017", foundKind: "사립" } },
    settle: { bank: "신한", account: "11055566677788", holder: "할래말래테스트대학교" },
  },
  {
    email: "demo-school8@hallemale-demo.com", ownerType: "school",
    manager: { name: "노주임", phone: TEST_PHONES[5] },
    venue: {
      name: "[데모] 할래말래데모대학교 실내체육관", address: "강원 강릉시 데모로 18", addressDetail: "",
      region: "강원 강릉시", lat: 37.7700, lng: 128.8760, phone: "033-0000-0018",
      directions: "강릉역에서 버스 15분",
      description: "실내 1면 + 야외 2면. 방학 중 종일 개방.",
      rules: "실내화 필수 · 단체 이용 시 사전 협의",
      facilities: ["주차장", "샤워실", "화장실", "정수기"],
      parking: { available: true, fee: "free", info: "교내 무료" },
      keywords: ["강릉 농구장", "대학 대관"],
      courts: [
        court("c_sch8_a", "실내체육관", "indoor", "마루", 28000),
        court("c_sch8_b", "야외 A코트", "outdoor", "우레탄", 10000),
      ],
      photos: [PHOTOS[0]],
    },
    biz: { bizName: "할래말래데모대학교", ownerName: "노주임", deptName: "시설관리팀", licenseUrl: PHOTOS[0], school: { code: "D000000008", officeCode: "K10", name: "할래말래데모대학교", kind: "대학교", address: "강원 강릉시 데모로 18", tel: "033-0000-0018", foundKind: "사립" } },
    settle: { bank: "농협", account: "3512345678901", holder: "할래말래데모대학교" },
  },

  /* ── 기관 · 단체 4 ─────────────────────────────── */
  {
    email: "demo-org1@hallemale-demo.com", ownerType: "org",
    manager: { name: "조주임", phone: TEST_PHONES[0] },
    venue: {
      name: "[데모] 할래말래데모공단 체육관", address: "서울 성동구 데모로 21", addressDetail: "지하 1층",
      region: "서울 성동구", lat: 37.5635, lng: 127.0369, phone: "02-0000-0021",
      directions: "2호선 왕십리역 8번 출구 도보 5분",
      description: "공공 실내체육관 2면. 주민 우선 배정.",
      rules: "실내화 필수 · 공단 이용수칙 준수",
      facilities: ["주차장", "샤워실", "화장실", "탈의실", "냉난방", "관중석"],
      parking: { available: true, fee: "paid", info: "30분 무료, 이후 30분당 500원" },
      keywords: ["성동 공공체육관", "왕십리 농구장"],
      courts: [
        court("c_org1_a", "주경기장", "indoor", "마루", 35000),
        court("c_org1_b", "보조경기장", "indoor", "우레탄", 25000),
      ],
      photos: [PHOTOS[1], PHOTOS[0]],
    },
    biz: { bizName: "할래말래데모시설공단", ownerName: "조주임", deptName: "체육시설운영팀", licenseUrl: PHOTOS[0] },
    settle: { bank: "우리", account: "1005123456789", holder: "할래말래데모시설공단" },
  },
  {
    email: "demo-org2@hallemale-demo.com", ownerType: "org",
    manager: { name: "배팀장", phone: TEST_PHONES[1] },
    venue: {
      name: "[데모] 할래말래데모문화체육센터", address: "서울 광진구 데모로 22", addressDetail: "2층",
      region: "서울 광진구", lat: 37.5450, lng: 127.0940, phone: "02-0000-0022",
      directions: "5호선 광나루역 2번 출구 도보 8분",
      description: "생활체육 전용 코트 1면. 강습 없는 시간대 대관.",
      rules: "실내화 필수 · 음식물 반입 금지",
      facilities: ["주차장", "화장실", "탈의실", "정수기", "냉난방"],
      parking: { available: true, fee: "free", info: "센터 주차장 40대" },
      keywords: ["광진 농구장", "생활체육관"],
      courts: [court("c_org2_a", "체육관", "indoor", "우레탄", 28000)],
      photos: [PHOTOS[2]],
    },
    biz: { bizName: "할래말래데모문화체육센터", ownerName: "배팀장", deptName: "시설운영팀", licenseUrl: PHOTOS[0] },
    settle: { bank: "국민", account: "81012345678901", holder: "할래말래데모문화체육센터" },
  },
  {
    email: "demo-org3@hallemale-demo.com", ownerType: "org",
    manager: { name: "신간사", phone: TEST_PHONES[2] },
    venue: {
      name: "[데모] 할래말래데모단체 체육관", address: "경기 성남시 분당구 데모로 23", addressDetail: "교육관 지하",
      region: "경기 성남시", lat: 37.3950, lng: 127.1110, phone: "031-0000-0023",
      directions: "신분당선 판교역 1번 출구 도보 15분",
      description: "교회 부속 실내체육관. 주일 오전 제외 상시 대관.",
      rules: "실내화 필수 · 주일 오전 이용 불가 · 음주/흡연 금지",
      facilities: ["주차장", "화장실", "정수기", "냉난방"],
      parking: { available: true, fee: "free", info: "지하주차장 50대" },
      keywords: ["판교 농구장", "교회 체육관"],
      courts: [court("c_org3_a", "체육관", "indoor", "마루", 20000, { hours: { sun: { open: "13:00", close: "20:00", closed: false } } })],
      photos: [PHOTOS[0]],
    },
    biz: { bizName: "할래말래데모단체", ownerName: "신간사", deptName: "시설관리부", licenseUrl: PHOTOS[0] },
    settle: { bank: "카카오뱅크", account: "333012345678", holder: "할래말래데모단체" },
  },
  {
    email: "demo-org4@hallemale-demo.com", ownerType: "org",
    manager: { name: "허복지사", phone: TEST_PHONES[3] },
    venue: {
      name: "[데모] 할래말래데모복지관 다목적홀", address: "대구 수성구 데모로 24", addressDetail: "4층",
      region: "대구 수성구", lat: 35.8570, lng: 128.6300, phone: "053-0000-0024",
      directions: "2호선 범어역 4번 출구 도보 6분",
      description: "복지관 다목적홀. 농구 1면 규격, 저렴한 대관료.",
      rules: "실내화 필수 · 복지관 이용수칙 준수",
      facilities: ["주차장", "화장실", "정수기", "냉난방", "엘리베이터"],
      parking: { available: true, fee: "free", info: "복지관 주차장 25대" },
      keywords: ["대구 농구장", "수성구 체육관"],
      courts: [court("c_org4_a", "다목적홀", "indoor", "우레탄", 15000)],
      photos: [PHOTOS[1]],
    },
    biz: { bizName: "할래말래데모복지관", ownerName: "허복지사", deptName: "생활체육팀", licenseUrl: PHOTOS[0] },
    settle: { bank: "대구", account: "50812345678901", holder: "할래말래데모복지관" },
  },
];

/* ── 앱과 동일한 단계 ───────────────────────────────── */

const issues = [];
function note(step, msg) {
  issues.push({ step, msg });
  console.log(`   ⚠️  [${step}] ${msg}`);
}

/** OwnerSignupPage: 인증번호 발송 → 확인 (테스트 번호는 응답에 코드가 실려온다) */
async function passPhoneOtp(phone) {
  const r1 = await fetch(`${CF_BASE}/requestPhoneOtp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, purpose: "signup" }),
  });
  const d1 = await r1.json();
  if (!d1?.ok) throw new Error(`requestPhoneOtp 실패: ${d1?.error}`);
  if (!d1.testCode) throw new Error("테스트 번호가 아니라 실제 SMS로 발송됨 — 중단");

  const r2 = await fetch(`${CF_BASE}/verifyPhoneOtp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code: d1.testCode }),
  });
  const d2 = await r2.json();
  if (!d2?.ok || d2.verified !== true) throw new Error(`verifyPhoneOtp 실패: ${d2?.error}`);
  return { code: d1.testCode, proof: d2.proof === true };
}

/** ownerAuthService.ownerSignUpEmail — 가입(이미 있으면 로그인) */
async function signUpOrIn(email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return { uid: cred.user.uid, created: true };
  } catch (e) {
    if (e?.code === "auth/email-already-in-use") {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return { uid: cred.user.uid, created: false };
    }
    throw e;
  }
}

/** userService.ensureUserDoc + saveOwnerManagerInfo + saveOwnerType + saveOwnerConsents */
async function writeUserDoc(uid, acc) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid, email: acc.email, nickname: "", avatarUrl: null,
      onboardingDone: false,
      regionSido: null, regionGu: null, region: null,
      clubId: null, activeTeamId: "",
      mainPosition: null, skillLevel: null, heightCm: null, weightKg: null,
      birthYear: null, intro: "", careers: [],
      phoneE164: toE164Kr(acc.manager.phone), phoneVerified: true, provider: "password",
      marketingConsent: null, termsConsent: null, privacyConsent: null,
      roleInTeam: null, isTeamCaptain: null,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }, { merge: true });
  }
  // 담당자 정보 (가입 폼)
  await setDoc(ref, {
    ownerManagerName: acc.manager.name,
    ownerManagerPhone: acc.manager.phone,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  // 운영 주체 게이트
  await setDoc(ref, {
    ownerType: acc.ownerType, ownerTypeAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }, { merge: true });
  // 동의 게이트
  await setDoc(ref, {
    ownerTermsConsent: true, ownerPrivacyConsent: true, ownerAdultConsent: true,
    ownerMarketingConsent: true, ownerConsentAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }, { merge: true });
}

/** ownerVenueService.registerVenue */
async function registerVenue(uid, acc) {
  const v = acc.venue;
  const needsBizNo = acc.ownerType === "business";
  const payload = {
    ownerUid: uid,
    status: "pending", rejectReason: "",
    name: v.name, address: v.address, addressDetail: v.addressDetail || "",
    region: v.region, lat: v.lat, lng: v.lng, phone: v.phone,
    photos: v.photos, imageUrl: v.photos[0] || "", storagePaths: [],
    facilities: v.facilities, sportTypes: ["농구"],
    parking: v.parking,
    directions: v.directions || "",
    keywords: v.keywords || [],
    description: v.description || "", rules: v.rules || "",
    refundPolicy: DEFAULT_REFUND,
    defaultOwnerNote: "예약 시간 10분 전까지 입장해 주세요. 입구는 정문 우측입니다.",
    ownerType: acc.ownerType,
    bizName: acc.biz.bizName,
    bizNo: needsBizNo ? acc.biz.bizNo : "",
    deptName: needsBizNo ? "" : (acc.biz.deptName || ""),
    ownerName: acc.biz.ownerName,
    contactPhone: acc.manager.phone,
    courts: v.courts,
    displayMode: v.courts.length > 1 ? "grouped" : "grouped",
    displayName: v.name,
    active: false, cost: "paid", type: v.courts[0]?.type || "indoor",
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, "venues"), payload);
  return ref.id;
}

/** 구장정보 > 인증/정산 탭: submitBusinessVerification + saveSalesReport + saveSettlementAccount */
async function submitVerification(venueId, acc) {
  const needsBizNo = acc.ownerType === "business";
  const business = {
    ownerType: acc.ownerType,
    bizNo: needsBizNo ? acc.biz.bizNo : "",
    bizName: acc.biz.bizName,
    ownerName: acc.biz.ownerName,
    openDate: acc.biz.openDate || "",
    taxType: needsBizNo && acc.biz.taxType === "general" ? "general" : "simple",
    licenseUrl: acc.biz.licenseUrl || PHOTOS[0],
    status: "pending", rejectReason: "",
    ...(acc.biz.school ? { school: acc.biz.school } : {}),
  };
  await updateDoc(doc(db, "venues", venueId), { business, updatedAt: serverTimestamp() });

  if (acc.sales) {
    await updateDoc(doc(db, "venues", venueId), {
      salesReport: {
        number: acc.sales.number || "",
        certUrl: "",
        exempt: acc.sales.exempt === true,
        status: acc.sales.exempt ? "none" : (acc.sales.number ? "submitted" : "none"),
      },
      updatedAt: serverTimestamp(),
    });
  }
  await updateDoc(doc(db, "venues", venueId), {
    settlement: { ...acc.settle, account: acc.settle.account.replace(/\D/g, ""), verified: false },
    updatedAt: serverTimestamp(),
  });
}

/**
 * 어드민 승인 — approveVenue / setBusinessStatus 와 동일한 쓰기.
 * ⚠️ 이걸 구장주 본인 세션으로 성공시킬 수 있다는 것 자체가 규칙 구멍이다(리포트에 기록).
 */
async function approveAsAdmin(venueId) {
  await updateDoc(doc(db, "venues", venueId), {
    status: "approved", rejectReason: "", active: true,
    "business.status": "verified", "business.rejectReason": "",
    updatedAt: serverTimestamp(),
  });
}

/* ── 실행 ───────────────────────────────────────────── */

async function cleanAll() {
  // 데모 구장 비노출 처리 (계정·문서는 남긴다)
  const snap = await getDocs(query(collection(db, "venues"), where("ownerType", "in", ["business", "school", "org"])));
  let n = 0;
  for (const d of snap.docs) {
    if (String(d.data()?.name || "").startsWith("[데모]")) {
      await updateDoc(d.ref, { active: false, status: "rejected", rejectReason: "데모 정리", updatedAt: serverTimestamp() });
      n++;
    }
  }
  console.log(`🧹 데모 구장 ${n}건 비활성화`);
}

async function main() {
  if (CLEAN) {
    // clean 은 로그인 필요 (venues write: signedIn)
    await signInWithEmailAndPassword(auth, ACCOUNTS[0].email, PASSWORD);
    await cleanAll();
    process.exit(0);
  }

  const results = [];
  const targets = LIMIT ? ACCOUNTS.slice(0, LIMIT) : ACCOUNTS;
  for (const acc of targets) {
    console.log(`\n▶ ${acc.email} (${acc.ownerType})`);
    const row = { ...acc, password: PASSWORD, ok: false };
    try {
      const otp = await passPhoneOtp(acc.manager.phone);
      console.log(`   · SMS 인증 통과 (code=${otp.code}, proof=${otp.proof})`);
      if (!otp.proof) note("otp", `${acc.email}: 인증 증빙(phone_proofs) 없이 통과 — 구장주 가입은 phones 연결·증빙이 남지 않음`);

      const { uid, created } = await signUpOrIn(acc.email, PASSWORD);
      row.uid = uid;
      console.log(`   · 계정 ${created ? "생성" : "기존 로그인"} uid=${uid}`);

      await writeUserDoc(uid, acc);
      console.log("   · users 문서 + 주체 + 동의 저장");

      // 이미 등록된 데모 구장이 있으면 재사용
      const mine = await getDocs(query(collection(db, "venues"), where("ownerUid", "==", uid)));
      let venueId = mine.docs.find((d) => String(d.data()?.name || "").startsWith("[데모]"))?.id;
      if (!venueId) {
        venueId = await registerVenue(uid, acc);
        console.log(`   · 구장 등록 신청 venueId=${venueId}`);
      } else {
        console.log(`   · 기존 데모 구장 재사용 venueId=${venueId}`);
      }
      row.venueId = venueId;

      await submitVerification(venueId, acc);
      console.log("   · 주체 인증 + 통신판매업 + 정산계좌 제출");

      if (!PENDING_ONLY) {
        await approveAsAdmin(venueId);
        console.log("   · 승인 완료 (status=approved, active=true)");
        row.status = "approved";
      } else {
        row.status = "pending";
      }
      row.ok = true;
    } catch (e) {
      console.log(`   ❌ 실패: ${e?.code || ""} ${e?.message}`);
      row.error = `${e?.code || ""} ${e?.message}`;
      note("flow", `${acc.email}: ${e?.message}`);
    } finally {
      try { await signOut(auth); } catch {}
      await sleep(300);
    }
    results.push(row);
  }

  const out = results.map((r) => ({
    email: r.email, password: PASSWORD, ownerType: r.ownerType,
    manager: r.manager, uid: r.uid || "", venue: r.venue.name,
    venueId: r.venueId || "", status: r.status || "", ok: r.ok, error: r.error || "",
    bizName: r.biz.bizName, bizNo: r.biz.bizNo || "", deptName: r.biz.deptName || "",
    settle: r.settle,
  }));
  writeFileSync("scripts/.demo-owner-accounts.json", JSON.stringify(out, null, 2), "utf8");

  console.log("\n════════ 결과 ════════");
  console.log(`성공 ${out.filter((r) => r.ok).length} / ${out.length}`);
  for (const r of out) console.log(`${r.ok ? "✅" : "❌"} ${r.email}  ${r.ownerType}  ${r.venue}  ${r.status}${r.error ? "  " + r.error : ""}`);
  if (issues.length) {
    console.log("\n════════ 관찰된 문제 ════════");
    for (const i of issues) console.log(`· [${i.step}] ${i.msg}`);
  }
  console.log("\n계정 목록 저장: scripts/.demo-owner-accounts.json");
  process.exit(0);
}

main().catch((e) => { console.error("시드 실패:", e); process.exit(1); });
