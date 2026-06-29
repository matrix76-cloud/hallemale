// 약관/개인정보처리방침 본문을 Firestore legal_documents/{privacy,terms} 에 반영한다.
// in-app(마이페이지) 화면은 legal_documents 문서를 우선 렌더하므로, 새 본문을 보이게 하려면
// 이 문서를 LEGAL_DEFAULTS 최신 내용으로 덮어써야 한다. (없으면 앱이 LEGAL_DEFAULTS 폴백)
//
// 사용: node scripts/seed-legal-docs.mjs          → 현재 DB 상태와 변경 계획만 출력 (dry-run)
//       node scripts/seed-legal-docs.mjs --apply  → 실제 덮어쓰기

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { LEGAL_DEFAULTS } from "../src/data/legalDefaults.js";

const firebaseConfig = {
  apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
  authDomain: "halle-bf789.firebaseapp.com",
  projectId: "halle-bf789",
  storageBucket: "halle-bf789.firebasestorage.app",
  messagingSenderId: "939913723928",
  appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
};

const APPLY = process.argv.includes("--apply");

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TYPES = ["privacy", "terms", "operation"];

async function run() {
  console.log(APPLY ? "=== APPLY 모드: 실제 덮어쓰기 ===" : "=== DRY-RUN: 계획만 출력 (적용하려면 --apply) ===");

  for (const type of TYPES) {
    const def = LEGAL_DEFAULTS[type];
    const ref = doc(db, "legal_documents", type);
    const snap = await getDoc(ref);
    const cur = snap.exists() ? snap.data() : null;
    const curLen = cur && typeof cur.content === "string" ? cur.content.length : 0;
    const nextLen = def.content.length;

    console.log(
      `\n[${type}] DB ${snap.exists() ? "존재" : "없음"} (현재 ${curLen}자) → 신규 ${nextLen}자` +
        (cur?.updatedAt ? ` / 마지막수정 ${cur.updatedBy || "-"}` : "")
    );

    if (!APPLY) continue;

    await setDoc(
      ref,
      {
        type,
        title: def.title,
        content: def.content,
        updatedAt: serverTimestamp(),
        updatedBy: "seed-script",
      },
      { merge: true }
    );
    console.log(`   ✔ ${type} 저장 완료`);
  }

  console.log("\n완료.");
  process.exit(0);
}

run().catch((e) => {
  console.error("ERR", e?.message || e);
  process.exit(1);
});
