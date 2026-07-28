// /review 기록 스레드(Firestore reviewThreads) 를 터미널에서 읽고 답글을 단다.
// AI 에이전트가 "미답변 기록"을 감지 → 수정/답변 후 답글을 남기는 용도.
//
// 인증: firebase CLI 로그인 자격(~/.config/configstore/firebase-tools.json)의
//       refresh_token 을 access_token 으로 교환해 Firestore REST 호출.
//       (프로젝트 소유자 권한이라 보안규칙 signedIn() 을 통과할 필요 없음)
//
// 사용:
//   node scripts/review-cli.mjs inbox              → 미답변 기록만 (개발자 root 글 중 AI 답글 없는 것)
//   node scripts/review-cli.mjs inbox --all        → 전체 스레드
//   node scripts/review-cli.mjs inbox --screen=my-page
//   node scripts/review-cli.mjs show <pid>         → 한 글 + 그 답글 전문
//   node scripts/review-cli.mjs reply <pid> -      → stdin 으로 답글 본문 입력
//   node scripts/review-cli.mjs reply <pid> "본문"

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const PROJECT = "halle-bf789";
const COL = "reviewThreads";
const AI_AUTHOR = "AI"; // AuthReview.jsx 의 작성자 토글과 동일해야 답글로 인식된다
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

// ── 인증 ──────────────────────────────────────────────────────────────
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

// ── Firestore REST ────────────────────────────────────────────────────
const val = (v) => {
  if (v == null) return undefined;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(val);
  if (v.mapValue !== undefined) {
    const o = {};
    for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = val(x);
    return o;
  }
  return undefined;
};

async function fetchAll(token) {
  const out = [];
  let pageToken = "";
  do {
    const url = `${BASE}/${COL}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    for (const d of json.documents || []) {
      const f = d.fields || {};
      out.push({
        pid: d.name.split("/").pop(),
        screenId: val(f.screenId),
        by: val(f.by),
        at: val(f.at),
        text: val(f.text) || "",
        replyTo: val(f.replyTo),
        imgs: (val(f.imgs) || []).length,
        pins: val(f.pins) || [],
        ts: val(f.ts) || d.createTime,
      });
    }
    pageToken = json.nextPageToken || "";
  } while (pageToken);
  out.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  return out;
}

async function postReply(token, { screenId, replyTo, text }) {
  const body = {
    fields: {
      screenId: { stringValue: screenId },
      by: { stringValue: AI_AUTHOR },
      text: { stringValue: text },
      at: {
        stringValue: new Date()
          .toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })
          .slice(0, 16),
      },
      ts: { timestampValue: new Date().toISOString() },
      replyTo: { stringValue: replyTo },
    },
  };
  const res = await fetch(`${BASE}/${COL}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.name.split("/").pop();
}

// ── 출력 ──────────────────────────────────────────────────────────────
const pinLine = (pins) =>
  pins.length
    ? `    📍 핀 ${pins.length}: ${pins
        .map((p) => p.label || p.tag || p.text || "")
        .filter(Boolean)
        .join(", ")}`
    : "";

function render(e, indent = "") {
  const head = `${indent}[${e.pid}] ${e.by} · ${e.at} · ${e.screenId}`;
  const meta = e.imgs ? `${indent}    🖼 스샷 ${e.imgs}장` : "";
  const text = e.text
    .split("\n")
    .map((l) => `${indent}    ${l}`)
    .join("\n");
  return [head, text, meta, pinLine(e.pins) && indent + pinLine(e.pins).trim()]
    .filter(Boolean)
    .join("\n");
}

// ── main ──────────────────────────────────────────────────────────────
const [cmd, ...rest] = process.argv.slice(2);
const flag = (k) => rest.find((a) => a.startsWith(`--${k}`));
const flagVal = (k) => (flag(k) || "").split("=")[1] || "";

const token = await accessToken();
const all = await fetchAll(token);

if (cmd === "inbox" || !cmd) {
  const screen = flagVal("screen");
  // AuthReview.jsx:200-204 의 미답변 정의와 동일 — 개발자 root 글 중 답글 없는 것
  const answered = new Set(all.filter((e) => e.replyTo).map((e) => e.replyTo));
  let roots = all.filter((e) => !e.replyTo);
  if (screen) roots = roots.filter((e) => e.screenId === screen);
  if (!flag("all")) roots = roots.filter((e) => e.by === "개발자" && !answered.has(e.pid));

  if (!roots.length) {
    console.log("미답변 기록 없음.");
    process.exit(0);
  }
  console.log(`미답변 ${roots.length}건${screen ? ` (screen=${screen})` : ""}\n`);
  if (flag("brief")) {
    for (const r of roots) {
      const first = r.text.split("\n").find((l) => l.trim()) || "(본문 없음)";
      console.log(
        `[${r.pid}] ${r.screenId} · ${r.at}${r.imgs ? ` · 🖼${r.imgs}` : ""} — ${first.slice(0, 80)}`,
      );
    }
    process.exit(0);
  }
  for (const r of roots) {
    console.log(render(r));
    for (const c of all.filter((e) => e.replyTo === r.pid)) console.log(render(c, "  ↳"));
    console.log("");
  }
} else if (cmd === "show") {
  const pid = rest[0];
  const root = all.find((e) => e.pid === pid);
  if (!root) throw new Error(`기록 없음: ${pid}`);
  console.log(render(root));
  for (const c of all.filter((e) => e.replyTo === pid)) console.log(render(c, "  ↳"));
} else if (cmd === "reply") {
  const pid = rest[0];
  const root = all.find((e) => e.pid === pid);
  if (!root) throw new Error(`기록 없음: ${pid}`);
  let text = rest.slice(1).filter((a) => !a.startsWith("--")).join(" ");
  if (!text || text === "-") text = readFileSync(0, "utf8");
  text = text.trim();
  if (!text) throw new Error("본문이 비었습니다.");
  const newPid = await postReply(token, {
    screenId: root.screenId,
    replyTo: root.pid,
    text,
  });
  console.log(`✅ 답글 등록 (${newPid}) → ${root.screenId} / ${root.pid}`);
} else {
  console.log("사용: inbox [--all] [--screen=ID] | show <pid> | reply <pid> <본문|->");
}
