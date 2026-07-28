// functions/scripts/fix-venue-refund-text.mjs
// 구장 문서의 자체 안내(venues.refundPolicy)에서 "환불 비율" 문장을 걷어낸다.
//
// 왜: 환불 기준은 플랫폼 공통(약관 「취소 및 환불 정책」 제5조 ①)인데, 일부 구장 문서에
//     구버전 비율(7일 전 100% 등)이 남아 있어 예약 화면에 서로 다른 두 표가 동시에 뜬다.
//     구장 고유 안내(우천·일정변경 등)만 남기고 비율 줄만 제거한다.
//
// 실행: node functions/scripts/fix-venue-refund-text.mjs          ← 미리보기
//       node functions/scripts/fix-venue-refund-text.mjs --apply  ← 반영
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const KEY_PATH = "C:/Users/hdl48/OneDrive/바탕 화면/ilsaeng/halle-bf789-firebase-adminsdk-fbsvc-54ff45a1b0.json";
const db = getFirestore(initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, "utf8"))) }));

// 환불 비율을 말하는 줄 (예: "• 이용 7일 전: 100% 환불", "당일: 환불 불가")
const REFUND_RATE_LINE = /(\d+\s*%\s*환불)|(환불\s*불가)|(전액\s*환불)/;

const snap = await db.collection("venues").get();
let changed = 0;

for (const d of snap.docs) {
  const v = d.data() || {};
  const before = String(v.refundPolicy || "");
  if (!before.trim()) continue;

  const kept = before
    .split("\n")
    .filter((line) => !REFUND_RATE_LINE.test(line))
    .join("\n")
    .trim();

  if (kept === before.trim()) continue;

  console.log(`\n■ ${v.name} (${d.id})`);
  console.log("  [기존]\n" + before.split("\n").map((l) => "    " + l).join("\n"));
  console.log("  [정리 후]\n" + (kept ? kept.split("\n").map((l) => "    " + l).join("\n") : "    (비움 — 구장 자체 안내 블록 미노출)"));

  changed++;
  if (APPLY) {
    await d.ref.update({ refundPolicy: kept, updatedAt: FieldValue.serverTimestamp() });
    console.log("  → 반영 완료");
  }
}

console.log(`\n대상 ${changed}건. ${APPLY ? "✅ 반영 완료" : "ℹ️ 미리보기였습니다. --apply 로 반영하세요."}`);
process.exit(0);
