// scripts/setup-toss-review.mjs
// 토스페이먼츠 심사 준비 1회성 작업.
//   1) 심사용 테스트 계정 생성 (동의·전화인증·웰컴 게이트를 모두 통과한 상태로)
//   2) 테스트 구장 정리 — 쓰레기 구장 삭제 + "(데모)" 표기 제거
//
// 삭제 전에 원본 문서를 콘솔에 그대로 출력한다(되돌릴 수 있게).
// 실행 (심사계정 비밀번호는 환경변수로 넘긴다):
//       REVIEW_PW=... node scripts/setup-toss-review.mjs          ← 미리보기(변경 없음)
//       REVIEW_PW=... node scripts/setup-toss-review.mjs --apply  ← 실제 반영
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const KEY_PATH = "C:/Users/hdl48/OneDrive/바탕 화면/ilsaeng/halle-bf789-firebase-adminsdk-fbsvc-54ff45a1b0.json";

if (!process.env.REVIEW_PW) {
  console.error("REVIEW_PW 환경변수가 필요합니다. 예) REVIEW_PW=... node scripts/setup-toss-review.mjs");
  process.exit(1);
}

const REVIEW = {
  email: "toss-review@hallaemallae.com",
  password: process.env.REVIEW_PW,
  nickname: "토스심사",
  // 실제로 쓰지 않는 번호. 전화 게이트 통과용 표기값이라 phones 인덱스는 만들지 않는다.
  phoneE164: "+821000000000",
};

const app = initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, "utf8"))) });
const auth = getAuth(app);
const db = getFirestore(app);

const log = (...a) => console.log(...a);

/* ── 1) 심사용 계정 ───────────────────────────────── */
async function setupReviewAccount() {
  let user = null;
  try {
    user = await auth.getUserByEmail(REVIEW.email);
    log(`[계정] 이미 존재 → 비밀번호만 재설정: ${REVIEW.email} (uid ${user.uid})`);
    if (APPLY) await auth.updateUser(user.uid, { password: REVIEW.password });
  } catch {
    log(`[계정] 신규 생성: ${REVIEW.email}`);
    if (APPLY) {
      user = await auth.createUser({
        email: REVIEW.email,
        password: REVIEW.password,
        displayName: REVIEW.nickname,
        emailVerified: true,
      });
    }
  }
  if (!APPLY || !user) return;

  // 게이트 통과 조건: 동의 3종 + phoneVerified + welcomeSeen
  await db.collection("users").doc(user.uid).set(
    {
      uid: user.uid,
      email: REVIEW.email,
      nickname: REVIEW.nickname,
      provider: "email",
      phoneE164: REVIEW.phoneE164,
      phoneVerified: true,
      termsConsent: true,
      privacyConsent: true,
      ageOver14Consent: true,
      marketingConsent: false,
      onboardingDone: true,
      welcomeSeen: true,
      isReviewAccount: true, // 나중에 정리할 때 식별용
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  log(`[계정] users/${user.uid} 설정 완료 (동의·전화인증·웰컴 통과)`);
}

/* ── 2) 구장 정리 ────────────────────────────────── */
async function cleanupVenues() {
  const snap = await db.collection("venues").get();
  for (const d of snap.docs) {
    const v = d.data() || {};
    const name = String(v.name || "").trim();

    // 이름이 자음/의미 없는 문자열인 테스트 구장 — 삭제
    if (name === "ㄷㄴㅊㅊㄷ") {
      log(`\n[구장] 삭제 대상: ${d.id} / ${name}`);
      log("  백업(원본):", JSON.stringify(v));
      if (APPLY) {
        await d.ref.delete();
        log("  → 삭제 완료");
      }
      continue;
    }

    // "(데모)" 표기 제거 — 심사관에게 데모로 보이지 않게
    if (name.includes("(데모)")) {
      const next = name.replace(/\s*\(데모\)\s*/g, " ").replace(/\s+/g, " ").trim();
      log(`\n[구장] 이름 변경: "${name}" → "${next}" (${d.id})`);
      if (APPLY) {
        await d.ref.update({ name: next, updatedAt: FieldValue.serverTimestamp() });
        log("  → 변경 완료");
      }
    }
  }
}

await setupReviewAccount();
await cleanupVenues();
log(`\n${APPLY ? "✅ 반영 완료" : "ℹ️ 미리보기였습니다. 실제 반영하려면 --apply 를 붙이세요."}`);
process.exit(0);
