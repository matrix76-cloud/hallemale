// legal_documents(Firestore) ← src/data/legalDefaults.js 동기화.
//
// 법령 문서 4종 + 구장주 약관은 화면이 Firestore 문서를 "우선" 렌더하고 없을 때만
// LEGAL_DEFAULTS 로 폴백한다(TermsPage.jsx 등). 그래서 코드만 고치면 라이브에 안 뜬다.
//
// scripts/seed-legal-docs.mjs 와 같은 일을 하지만 인증 경로가 다르다.
//   - seed-legal-docs.mjs : adminLogin 커스텀 토큰 (ADMIN_ID/ADMIN_PW 필요)
//   - 이 스크립트        : firebase CLI 로그인 자격 → Firestore REST (프로젝트 소유자 권한)
// 관리자 계정 없이 돌려야 할 때 쓴다. owner_terms 도 함께 본다(seed 쪽 TYPES 에는 빠져 있음).
//
// 사용: node scripts/sync-legal-docs.mjs          → 차이만 출력 (dry-run)
//       node scripts/sync-legal-docs.mjs --apply  → 실제 덮어쓰기

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";

const APPLY = process.argv.includes("--apply");
const PROJECT = "halle-bf789";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const TYPES = ["terms", "privacy", "operation", "refund", "owner_terms"];

const { LEGAL_DEFAULTS } = await import(
  pathToFileURL(join(process.cwd(), "src", "data", "legalDefaults.js")).href
);

async function accessToken() {
  const cfg = JSON.parse(
    readFileSync(join(homedir(), ".config", "configstore", "firebase-tools.json"), "utf8"),
  );
  const refresh = cfg?.tokens?.refresh_token;
  if (!refresh) throw new Error("firebase CLI 로그인이 필요합니다: firebase login");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
      client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`토큰 교환 실패: ${JSON.stringify(json)}`);
  return json.access_token;
}

const token = await accessToken();
const auth = { authorization: `Bearer ${token}` };

console.log(APPLY ? "=== APPLY: 실제 덮어쓰기 ===\n" : "=== DRY-RUN: 차이만 출력 (적용은 --apply) ===\n");

let changed = 0;
for (const type of TYPES) {
  const local = LEGAL_DEFAULTS[type];
  if (!local?.content) {
    console.log(`${type}: 코드에 기본 본문이 없어 건너뜀`);
    continue;
  }
  const res = await fetch(`${BASE}/legal_documents/${type}`, { headers: auth });
  const cur = await res.json();
  const remote = cur?.fields?.content?.stringValue || "";
  if (remote.trim() === local.content.trim()) {
    console.log(`${type}: 일치 (${remote.length}자) — 건너뜀`);
    continue;
  }
  changed += 1;
  console.log(
    `${type}: ★불일치 — 원격 ${remote.length}자 → 코드 ${local.content.length}자` +
      (remote ? ` (원격 최종수정 ${cur.updateTime?.slice(0, 10)})` : " (원격 문서 없음)"),
  );
  if (!APPLY) continue;

  // updatedAt = 화면의 "최근 업데이트" 표시용. title/content 만 덮어쓴다.
  const body = {
    fields: {
      title: { stringValue: local.title || type },
      content: { stringValue: local.content },
      updatedAt: { timestampValue: new Date().toISOString() },
    },
  };
  const w = await fetch(
    `${BASE}/legal_documents/${type}?` +
      ["title", "content", "updatedAt"].map((f) => `updateMask.fieldPaths=${f}`).join("&"),
    { method: "PATCH", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(body) },
  );
  const wj = await w.json();
  if (wj.error) throw new Error(`${type} 쓰기 실패: ${wj.error.message}`);
  console.log(`   ✅ 반영 완료`);
}

console.log(
  changed === 0
    ? "\n전부 일치 — 할 일 없음."
    : APPLY
      ? `\n${changed}건 반영 완료.`
      : `\n${changed}건 반영 필요. --apply 로 실행하세요.`,
);
