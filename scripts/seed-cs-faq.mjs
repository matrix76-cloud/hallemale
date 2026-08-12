// CS 답변 원본(FAQ)을 Firestore csFaq/{id} 에 반영한다.
// 앱 FAQ 화면과 카카오톡 챗봇 스킬 서버가 모두 csFaq 를 읽으므로, 이 컬렉션이 단일 출처다.
// (비어 있으면 앱은 csFaqDefaults.js 로 폴백하지만, 챗봇은 폴백이 없어 아무 답도 못 한다)
//
// 사용: node scripts/seed-cs-faq.mjs          → 현재 DB 상태와 변경 계획만 출력 (dry-run)
//       ADMIN_ID=... ADMIN_PW=... node scripts/seed-cs-faq.mjs --apply
//
// ⚠️ 이미 DB 에 있는 문서는 기본적으로 건드리지 않는다(어드민이 고친 문구를 덮지 않기 위함).
//    기본값으로 되돌리려면 --overwrite 를 함께 준다.

import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { CS_FAQ_DEFAULTS } from "../src/data/csFaqDefaults.js";

const firebaseConfig = {
  apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
  authDomain: "halle-bf789.firebaseapp.com",
  projectId: "halle-bf789",
  storageBucket: "halle-bf789.firebasestorage.app",
  messagingSenderId: "939913723928",
  appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
};

const APPLY = process.argv.includes("--apply");
const OVERWRITE = process.argv.includes("--overwrite");

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// csFaq 쓰기는 보안규칙상 관리자(request.auth.token.admin)만 가능하다.
const ADMIN_LOGIN_URL =
  "https://asia-northeast3-halle-bf789.cloudfunctions.net/adminLogin";

async function signInAsAdmin() {
  const id = process.env.ADMIN_ID;
  const password = process.env.ADMIN_PW;
  if (!id || !password) {
    console.error(
      "\n✖ 관리자 인증 정보가 없습니다.\n" +
        "  csFaq 쓰기는 관리자 권한이 필요합니다.\n" +
        "  사용: ADMIN_ID=<아이디> ADMIN_PW=<비밀번호> node scripts/seed-cs-faq.mjs --apply"
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
  console.log(`관리자 로그인 성공: ${data.name || id} (${data.role || "admin"})\n`);
}

async function run() {
  console.log(
    APPLY
      ? `=== APPLY 모드${OVERWRITE ? " (기존 문서도 덮어씀)" : " (기존 문서는 유지)"} ===`
      : "=== DRY-RUN: 계획만 출력 (적용하려면 --apply) ==="
  );

  if (APPLY) await signInAsAdmin();

  const snap = await getDocs(collection(db, "csFaq"));
  const existing = new Set();
  snap.forEach((d) => existing.add(d.id));
  console.log(`현재 csFaq 문서 ${existing.size}개\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of CS_FAQ_DEFAULTS) {
    const has = existing.has(item.id);

    if (has && !OVERWRITE) {
      skipped++;
      continue;
    }

    console.log(
      `[${item.id}] ${has ? "덮어쓰기" : "신규"} / ${item.audience} / ${
        item.active ? "노출" : "비노출(초안)"
      } — ${item.q}`
    );

    if (!APPLY) {
      has ? updated++ : created++;
      continue;
    }

    await setDoc(
      doc(db, "csFaq", item.id),
      {
        audience: item.audience,
        q: item.q,
        a: item.a,
        keywords: item.keywords || [],
        order: item.order || 0,
        active: item.active !== false,
        updatedAt: serverTimestamp(),
        updatedBy: "seed-script",
      },
      { merge: true }
    );
    has ? updated++ : created++;
  }

  console.log(
    `\n신규 ${created} / 덮어쓰기 ${updated} / 건너뜀 ${skipped}` +
      (skipped ? "  (건너뛴 문서를 기본값으로 되돌리려면 --overwrite)" : "")
  );
  const drafts = CS_FAQ_DEFAULTS.filter((f) => f.active === false).length;
  if (drafts) {
    console.log(
      `\n⚠️ 비노출(초안) ${drafts}건 — 어드민 > CS 답변 관리에서 문구 검수 후 켜야 노출됩니다.`
    );
  }
  console.log("\n완료.");
  process.exit(0);
}

run().catch((e) => {
  console.error("ERR", e?.message || e);
  process.exit(1);
});
