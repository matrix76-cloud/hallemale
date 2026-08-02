// 예약번호 백필 (2026-08-02)
//   예약번호(HM-YYMMDD-XXXX)는 사용자앱 예약·매칭 제휴예약에서만 발급하고 있었다.
//   구장주 수동/정기대관 예약(createOwnerReservation)에는 없어서, 그 건들은 유저·구장주·어드민이
//   공유할 조회 키가 없다(어드민 예약 현황에 "미발급"으로 뜬다).
//   생성 경로는 코드로 고쳤고(ownerVenueService.createOwnerReservation), 이 스크립트는 기존 데이터용이다.
//
// 사용:
//   node scripts/backfill-reservation-codes.mjs                            # 미리보기(쓰기 없음)
//   ADMIN_ID=... ADMIN_PW=... node scripts/backfill-reservation-codes.mjs --apply
//
// 읽기는 공개지만 venueReservations 수정은 구장주·예약자·어드민만 가능하다(firestore.rules).
// 전 구장을 한 번에 손대므로 어드민 커스텀 토큰으로 로그인한다.
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { getAuth, signInWithCustomToken } from "firebase/auth";

const APPLY = process.argv.includes("--apply");

const cfg = {
  apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
  authDomain: "halle-bf789.firebaseapp.com",
  projectId: "halle-bf789",
  storageBucket: "halle-bf789.firebasestorage.app",
  messagingSenderId: "939913723928",
  appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
};
const app = initializeApp(cfg);
const db = getFirestore(app);

const ADMIN_LOGIN_URL =
  "https://asia-northeast3-halle-bf789.cloudfunctions.net/adminLogin";

async function signInAsAdmin() {
  const id = process.env.ADMIN_ID;
  const password = process.env.ADMIN_PW;
  if (!id || !password) {
    console.error(
      "\n✖ 관리자 인증 정보가 없습니다.\n" +
        "  사용: ADMIN_ID=<아이디> ADMIN_PW=<비밀번호> node scripts/backfill-reservation-codes.mjs --apply"
    );
    process.exit(1);
  }
  const res = await fetch(ADMIN_LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.token) {
    console.error(`\n✖ 관리자 로그인 실패: ${data?.error || res.status}`);
    process.exit(1);
  }
  await signInWithCustomToken(getAuth(app), data.token);
  console.log(`관리자 로그인 성공: ${data.name || id}\n`);
}

const s = (v) => String(v ?? "").trim();

// ownerVenueService.genReservationCode 와 같은 규칙
function genCode(date) {
  const ymd = s(date).replace(/-/g, "").slice(2); // YYMMDD
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HM-${ymd || "000000"}-${rand}`;
}

async function main() {
  const snap = await getDocs(collection(db, "venueReservations"));

  // 이미 쓰인 번호 — 백필이 기존 번호와 겹치면 조회 키가 깨진다
  const used = new Set();
  const targets = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    const code = s(data.reservationCode);
    if (code) { used.add(code); return; }
    targets.push({
      id: d.id,
      date: s(data.date),
      venueName: s(data.venueName),
      source: s(data.source) || (s(data.userId) ? "app" : "owner"),
      status: s(data.status),
    });
  });

  console.log(`예약 ${snap.size}건 · 번호 있음 ${used.size}건 · 미발급 ${targets.length}건`);
  if (!targets.length) { console.log("백필할 예약이 없습니다."); return; }

  const plans = targets.map((t) => {
    let code = genCode(t.date);
    while (used.has(code)) code = genCode(t.date);
    used.add(code);
    return { ...t, code };
  });

  for (const p of plans) {
    console.log(`  ${p.code}  ${p.date || "(날짜없음)"}  ${p.source}/${p.status}  ${p.venueName || p.id}`);
  }

  if (!APPLY) {
    console.log(`\n미리보기입니다. 반영하려면: ADMIN_ID=... ADMIN_PW=... node scripts/backfill-reservation-codes.mjs --apply`);
    return;
  }

  await signInAsAdmin();

  let ok = 0;
  for (const p of plans) {
    try {
      await updateDoc(doc(db, "venueReservations", p.id), { reservationCode: p.code });
      ok++;
    } catch (e) {
      console.error(`  ✗ ${p.id}: ${e?.message || e}`);
    }
  }
  console.log(`\n반영 완료: ${ok}/${plans.length}건`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
