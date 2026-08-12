// scripts/capture-mockups.mjs
// 랜딩페이지에 쓰는 앱 화면 목업을 실제 앱에서 다시 찍는다.
//
// 왜 있나: 랜딩의 폰 목업이 손으로 캡처한 파일이라, 앱 디자인이 바뀌어도 그대로 남았다.
// 리뷰 보드가 쓰는 목업 주입(?mock=<시나리오>&freeze=1)을 그대로 재사용하면
// 로그인 없이·항상 같은 데이터로 화면을 띄울 수 있다 → 언제 다시 돌려도 같은 그림이 나온다.
//
// 쓰는 법:
//   1) 개발 서버를 띄운다 (목업 주입은 development 에서만 켜진다)
//        npx react-scripts start        # http://localhost:3000
//   2) node scripts/capture-mockups.mjs [--port 3000] [--only app-ranking,app-venues]
//   → web/assets/shots/*.png 로 저장된다.
//
// 크롬 --screenshot 옵션을 쓰지 않고 CDP(원격 디버깅)로 찍는다:
// 새 헤드리스는 --window-size 를 레이아웃 뷰포트에 반영하지 않아(800px 로 그린 뒤 잘라냄)
// 폰 화면이 오른쪽이 잘린 채로 저장된다. Emulation.setDeviceMetricsOverride 로 지정해야
// 실제 폰 폭으로 그려진다. (puppeteer 등 추가 의존성 없이 내장 WebSocket 만 쓴다)

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "web/assets/shots");

// 폰 목업 프레임 안에 들어갈 크기. 2배로 찍어 레티나에서도 또렷하게.
const VIEW_W = 390;
const VIEW_H = 844;
const SCALE = 2;
const SETTLE_MS = 2600; // load 이후 데이터·이미지가 자리잡을 때까지
const DEBUG_PORT = 9333;

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

// 랜딩에서 쓰는 목업 — 파일명은 랜딩 HTML 의 <img src> 와 1:1 로 맞춘다.
// path/scenario 는 리뷰 보드(src/dev/reviewData.js · boardData.js)와 같은 값이다.
const SHOTS = [
  // 홈은 이벤트 팝업이 화면을 덮는다 — 목업에는 팝업 없는 홈이 필요하므로 미리 닫아둔다.
  { name: "app-home", path: "/home", scenario: "base-leader", dismissPopup: true },
  { name: "app-matching", path: "/matching", scenario: "base-leader" },
  { name: "app-matchroom", path: "/match-roomdetail/mock_room", scenario: "base-leader" },
  { name: "app-team", path: "/team/mock_club_me", scenario: "base-leader" },
  { name: "app-ranking", path: "/teamRanking", scenario: "base-leader" },
  { name: "app-venues", path: "/venues", scenario: "venue-flow" },
  { name: "app-venue-book", path: "/venue-book/mock_venue", scenario: "venue-flow" },
  { name: "app-roomvenue", path: "/match-roomdetail/mock_room/venue", scenario: "base-leader" },
  { name: "app-records", path: "/records", scenario: "base-leader" },
  { name: "app-matching-manage", path: "/matchingmanage", scenario: "base-leader" },

  // 구장주 랜딩(owner.html)용 — 공급측 화면
  // owner-verified 를 쓰는 이유: 기본 세션(base-owner)은 정산계좌 미등록이라
  // 화면 맨 위에 "정산 계좌를 등록해주세요" 경고 카드가 덮는다.
  { name: "owner-home", path: "/owner/home", scenario: "owner-verified" },
  { name: "owner-onboarding", path: "/owner/onboarding?step=intro", scenario: "owner-noven" },
  { name: "owner-settlement", path: "/owner/settlement", scenario: "owner-verified" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const hit = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!hit) throw new Error("크롬/엣지를 찾지 못했습니다. CHROME_CANDIDATES 에 경로를 추가하세요.");
  return hit;
}

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** CDP 소켓 한 개를 감싼 최소 클라이언트 — 명령 id 매칭과 이벤트 대기만 한다. */
function cdp(ws) {
  let id = 0;
  const waiting = new Map();
  const once = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiting.has(msg.id)) {
      const { resolve: res, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : res(msg.result);
    }
    if (msg.method && once.has(msg.method)) {
      once.get(msg.method)();
      once.delete(msg.method);
    }
  });
  return {
    send(method, params = {}, sessionId) {
      const mid = ++id;
      return new Promise((res, reject) => {
        waiting.set(mid, { resolve: res, reject });
        ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    waitFor(method, timeoutMs = 20000) {
      return new Promise((res) => {
        once.set(method, res);
        setTimeout(res, timeoutMs);
      });
    },
  };
}

async function main() {
  const chromePath = findChrome();
  const port = arg("--port", "3000");
  const only = arg("--only", "");
  const w = Number(arg("--w", VIEW_W));
  const h = Number(arg("--h", VIEW_H));
  const scale = Number(arg("--scale", SCALE));
  const wanted = only ? only.split(",").map((s) => s.trim()) : null;
  const list = wanted ? SHOTS.filter((s) => wanted.includes(s.name)) : SHOTS;

  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`브라우저: ${chromePath}`);
  console.log(`대상 ${list.length}장 · ${w}x${h}@${scale}x → ${OUT_DIR}\n`);

  const proc = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${resolve(tmpdir(), "hm-capture-profile")}`,
    "about:blank",
  ], { stdio: "ignore" });

  try {
    // 디버깅 포트가 열릴 때까지 대기
    let version = null;
    for (let i = 0; i < 40 && !version; i++) {
      try { version = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); }
      catch { await sleep(250); }
    }
    if (!version) throw new Error("크롬 디버깅 포트가 열리지 않았습니다.");

    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", rej, { once: true });
    });
    const c = cdp(ws);

    const { targetId } = await c.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await c.send("Target.attachToTarget", { targetId, flatten: true });

    await c.send("Page.enable", {}, sessionId);
    // 이게 핵심 — 실제 폰 폭으로 레이아웃시킨다.
    await c.send("Emulation.setDeviceMetricsOverride", {
      width: w, height: h, deviceScaleFactor: scale, mobile: true,
    }, sessionId);

    for (const shot of list) {
      const q = `mock=${shot.scenario}&freeze=1`;
      const url = `http://localhost:${port}${shot.path}${shot.path.includes("?") ? "&" : "?"}${q}`;
      const out = resolve(OUT_DIR, `${shot.name}.png`);
      try {
        const loaded = c.waitFor("Page.loadEventFired");
        await c.send("Page.navigate", { url }, sessionId);
        await loaded;
        await sleep(SETTLE_MS);
        // 개발 서버의 런타임 오류 오버레이(webpack-dev-server)가 화면을 덮으면 목업이 못 쓰게 된다.
        // 화면 자체는 그 아래에 정상적으로 그려져 있으므로 걷어내고 찍는다.
        await c.send("Runtime.evaluate", {
          expression: `document.querySelectorAll('iframe#webpack-dev-server-client-overlay').forEach(function(el){el.remove()});`,
        }, sessionId);
        if (shot.dismissPopup) {
          // 이벤트 팝업의 "오늘 그만보기"를 눌러 닫는다(EventPopupModal — localStorage 에 기록).
          await c.send("Runtime.evaluate", {
            expression: `Array.from(document.querySelectorAll('button')).filter(function(b){return /오늘 그만보기/.test(b.textContent||'')}).forEach(function(b){b.click()});`,
          }, sessionId);
          await sleep(700);
        }
        const { data } = await c.send("Page.captureScreenshot", { format: "png" }, sessionId);
        writeFileSync(out, Buffer.from(data, "base64"));
        const kb = Math.round(statSync(out).size / 1024);
        console.log(`  ✓ ${shot.name}.png  (${kb}KB)  ${shot.path}`);
      } catch (e) {
        console.log(`  ✗ ${shot.name}  — ${e?.message?.split("\n")[0]}`);
      }
    }

    ws.close();
  } finally {
    proc.kill();
  }
  console.log("\n끝. 이미지를 확인한 뒤 랜딩(web/index.html)에 반영하세요.");
}

main().catch((e) => { console.error(e); process.exit(1); });
