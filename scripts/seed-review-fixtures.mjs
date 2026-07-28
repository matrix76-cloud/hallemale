// 리뷰 도구(/review) 상세화면 픽스처 시드.
// 데모 계정에 데이터가 없어 빈 화면으로만 뜨던 상세 3종을 실제 문서로 채운다.
//   · 결제        → venueReservations/review_demo_reservation   (/pay/{id})
//   · 팀 초대 상세 → clubs/{DEMO_CLUB}/invites/review_demo_invite
//   · 가입 신청 상세 → clubs/{DEMO_CLUB}/joinRequests/review_demo_joinreq
//
// 실서비스 영향 최소화:
//   · 예약은 데모 구장(seed_owner_venue_demo · 용산 더베이스 농구장)에만 만든다 — 실제 제휴구장 아님.
//   · 초대/가입신청은 데모 계정이 클럽장인 팀청춘 안에서만 만든다 — 다른 사용자에게 안 보인다.
//   · 문서 ID 고정 → 재실행해도 덮어쓰기만(중복 생성 없음).
//
// 예약 날짜는 오늘+3일로 잡는다(Firestore 규칙의 예약 가능 창구 안). 시간이 지나 과거가 되면
// 다시 실행해 날짜만 갱신하면 된다.
//
// 사용 (데모 계정 비밀번호는 환경변수로 넘긴다):
//   DEMO_PW=... node scripts/seed-review-fixtures.mjs           → 계획만 (dry-run)
//   DEMO_PW=... node scripts/seed-review-fixtures.mjs --apply    → 실제 생성/갱신
//   DEMO_PW=... node scripts/seed-review-fixtures.mjs --clean    → 픽스처 3종 삭제

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
  authDomain: "halle-bf789.firebaseapp.com",
  projectId: "halle-bf789",
  storageBucket: "halle-bf789.firebasestorage.app",
  messagingSenderId: "939913723928",
  appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
};

// 데모 계정 (src/dev/reviewDemo.js · scripts/seed-review-demo.mjs 와 동일해야 함)
const DEMO_EMAIL = "review-demo@hallamalle.com";
const DEMO_PW = process.env.DEMO_PW;
if (!DEMO_PW) {
  console.error("DEMO_PW 환경변수가 필요합니다. 예) DEMO_PW=... node scripts/seed-review-fixtures.mjs");
  process.exit(1);
}
const DEMO_CLUB = "3fvB0Uolgp5dzziy3gLL"; // 팀청춘 (데모가 클럽장)

// 데모 구장 (scripts/seed-owner-venue.mjs 가 만든 승인 구장)
const DEMO_VENUE = "seed_owner_venue_demo";

// 리뷰 데이터(src/dev/reviewData.js)가 참조하는 고정 문서 ID
const RESERVATION_ID = "review_demo_reservation";
const INVITE_ID = "review_demo_invite";
const JOINREQ_ID = "review_demo_joinreq";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const CLEAN = args.includes("--clean");

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const plusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const cred = await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PW);
const uid = cred.user.uid;
console.log(`데모 계정 로그인 · uid=${uid}`);

if (CLEAN) {
  for (const ref of [
    doc(db, "venueReservations", RESERVATION_ID),
    doc(db, "clubs", DEMO_CLUB, "invites", INVITE_ID),
    doc(db, "clubs", DEMO_CLUB, "joinRequests", JOINREQ_ID),
  ]) {
    console.log("삭제:", ref.path);
    if (APPLY) await deleteDoc(ref);
  }
  console.log(APPLY ? "완료" : "(dry-run — --apply 를 함께 주면 실제로 지웁니다)");
  process.exit(0);
}

// 데모 프로필 스냅샷 (초대/가입신청 카드에 표시됨)
const meSnap = await getDoc(doc(db, "users", uid));
const me = meSnap.exists() ? meSnap.data() : {};
const snapshot = {
  uid,
  nickname: String(me.nickname || me.name || "리뷰데모"),
  avatarUrl: String(me.avatarUrl || me.photoURL || ""),
  region: String(me.region || me.activityRegion || ""),
};

// 데모 구장 정보 (결제 화면이 구장명·코트명·금액을 이 예약 문서에서 읽는다)
const venueSnap = await getDoc(doc(db, "venues", DEMO_VENUE));
if (!venueSnap.exists()) {
  console.error(`데모 구장(${DEMO_VENUE})이 없습니다. 먼저 node scripts/seed-owner-venue.mjs --apply 를 실행하세요.`);
  process.exit(1);
}
const venue = venueSnap.data() || {};
const court = (venue.courts || [])[0] || { id: "court_a", name: "A코트", price: 40000 };

const jobs = [
  {
    ref: doc(db, "venueReservations", RESERVATION_ID),
    // source 를 "match" 로 두지 않아야 단독예약(SINGLE)으로 잡혀 price 전액이 결제 금액이 된다.
    // status 는 종료상태(cancelled/rejected/noshow/done)가 아니어야 주문 생성이 통과한다.
    data: {
      venueId: DEMO_VENUE,
      venueName: String(venue.name || "데모 구장"),
      courtId: String(court.id || "court_a"),
      courtName: String(court.name || "A코트"),
      ownerUid: String(venue.ownerUid || ""),
      date: plusDays(3),
      startTime: "20:00",
      endTime: "22:00",
      userId: uid,
      userName: snapshot.nickname,
      teamName: "팀청춘",
      phone: "010-0000-0000",
      price: Number(court.price ?? court.pricePerHour ?? 40000),
      status: "requested",
      paid: false,
      memo: "[리뷰 도구 픽스처] 결제 화면 확인용",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  },
  {
    ref: doc(db, "clubs", DEMO_CLUB, "invites", INVITE_ID),
    data: {
      clubId: DEMO_CLUB,
      fromUid: uid,
      toUid: uid,
      message: "[리뷰 도구 픽스처] 초대 상세 화면 확인용입니다.",
      status: "pending",
      toSnapshot: snapshot,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  },
  {
    ref: doc(db, "clubs", DEMO_CLUB, "joinRequests", JOINREQ_ID),
    data: {
      clubId: DEMO_CLUB,
      playerUid: uid,
      status: "pending",
      message: "[리뷰 도구 픽스처] 가입 신청 상세 화면 확인용입니다.",
      playerSnapshot: snapshot,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  },
];

for (const j of jobs) {
  console.log("쓰기:", j.ref.path);
  console.log("  ", JSON.stringify({ ...j.data, createdAt: "<serverTimestamp>", updatedAt: "<serverTimestamp>" }));
  if (APPLY) await setDoc(j.ref, j.data, { merge: true });
}

console.log(APPLY ? "완료 — /review 에서 결제·초대 상세·가입신청 상세가 실화면으로 뜹니다." : "(dry-run — --apply 를 주면 실제로 씁니다)");
process.exit(0);
