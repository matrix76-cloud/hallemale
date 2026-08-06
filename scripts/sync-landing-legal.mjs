// web/*.html(랜딩 정적 정책 문서) ← src/data/legalDefaults.js 동기화.
//
// 정책 문서가 세 곳에 있다:
//   1) src/data/legalDefaults.js   — 단일 출처(코드)
//   2) Firestore legal_documents   — 앱 화면이 읽는 곳   → scripts/sync-legal-docs.mjs
//   3) web/*.html                  — 랜딩(정적 페이지)   → 이 스크립트
// 2번만 맞추고 3번을 빼먹어서 랜딩이 두 번의 개정만큼 낡아 있었다(환불정책 7/25·8/2 미반영).
// 약관을 고치면 두 스크립트를 같이 돌릴 것.
//
// 사용: node scripts/sync-landing-legal.mjs          → 차이만 출력 (dry-run)
//       node scripts/sync-landing-legal.mjs --apply  → web/*.html 갱신
//       (그 뒤 npm run copy-landing 으로 public/landing 에 복사해야 화면에 반영된다)

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const APPLY = process.argv.includes("--apply");
const ROOT = process.cwd();
const { LEGAL_DEFAULTS, LEGAL_EFFECTIVE } = await import(
  pathToFileURL(join(ROOT, "src", "data", "legalDefaults.js")).href
);

// type → 랜딩 파일. owner_terms 는 앱 전용(구장주)이라 랜딩에 페이지가 없다.
const FILES = {
  terms: "terms.html",
  privacy: "privacy.html",
  refund: "refund.html",
  operation: "operation.html",
};

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const CIRCLED = /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]/;
const ARTICLE = /^제\d+조\s*\(/;
const BRACKET = /^\[.+\]$/;
const SUBITEM = /^\s+\d+\.\s/;
const DASHITEM = /^-\s/;

/** 약관 평문 → 랜딩 페이지 본문 HTML. 조문=h2, 항=ul>li, 그 외=p */
function toHtml(content) {
  const lines = String(content).split("\n");
  const out = [];
  let list = null; // 열려 있는 <ul> 버퍼

  const closeList = () => {
    if (list && list.length) out.push("    <ul>\n" + list.join("\n") + "\n    </ul>");
    list = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) continue;

    if (ARTICLE.test(line.trim()) || BRACKET.test(line.trim())) {
      closeList();
      out.push(`    <h2>${esc(line.trim())}</h2>`);
      continue;
    }
    if (CIRCLED.test(line.trim()) || DASHITEM.test(line.trim())) {
      list = list || [];
      list.push(`      <li>${esc(line.trim().replace(DASHITEM, ""))}</li>`);
      continue;
    }
    if (SUBITEM.test(raw)) {
      // 항 아래 세부 항목(1. 2. 3.) — 직전 li 에 이어 붙인다
      list = list || [];
      if (list.length) {
        list[list.length - 1] = list[list.length - 1].replace(
          /<\/li>$/,
          `<br><span class="sub">${esc(line.trim())}</span></li>`,
        );
      } else {
        list.push(`      <li>${esc(line.trim())}</li>`);
      }
      continue;
    }
    closeList();
    out.push(`    <p>${esc(line.trim())}</p>`);
  }
  closeList();
  return out.join("\n");
}

let changed = 0;
for (const [type, file] of Object.entries(FILES)) {
  const doc = LEGAL_DEFAULTS[type];
  if (!doc?.content) { console.log(`${type}: 코드에 본문이 없어 건너뜀`); continue; }

  const path = join(ROOT, "web", file);
  const html = readFileSync(path, "utf8");
  const s = html.indexOf("<main>");
  const e = html.indexOf("</main>");
  if (s < 0 || e < 0) { console.log(`${file}: <main> 을 찾지 못해 건너뜀`); continue; }

  const eff = LEGAL_EFFECTIVE?.[type] || "";
  const effKr = eff ? eff.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, d) => `${y}년 ${+m}월 ${+d}일`) : "";
  const body = [
    "<main>",
    '  <div class="wrap">',
    `    <h1>${esc(doc.title)}</h1>`,
    effKr ? `    <p class="updated">시행일자: ${effKr}</p>` : "",
    "",
    toHtml(doc.content),
    "  </div>",
    "",
  ].filter((x) => x !== "").join("\n");

  const next = html.slice(0, s) + body + html.slice(e);
  if (next === html) { console.log(`${type} → ${file}: 일치 — 건너뜀`); continue; }

  changed += 1;
  const oldLen = html.slice(s, e).length;
  console.log(`${type} → ${file}: ★불일치 (본문 ${oldLen}자 → ${body.length}자)`);
  if (APPLY) {
    writeFileSync(path, next, "utf8");
    console.log("   ✅ 반영 완료");
  }
}

console.log(
  changed === 0
    ? "\n전부 일치 — 할 일 없음."
    : APPLY
      ? `\n${changed}건 반영 완료. 이어서 'npm run copy-landing' 을 돌려 public/landing 에 반영하세요.`
      : `\n${changed}건 반영 필요. --apply 로 실행하세요.`,
);
