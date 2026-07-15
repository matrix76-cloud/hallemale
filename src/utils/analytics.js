/* eslint-disable */
// src/utils/analytics.js
// 얇은 이벤트 트래킹 래퍼.
// - Firebase Analytics(GA4)로 전송하고, RN 웹뷰면 네이티브로도 미러링(앱이 자체 애널리틱스로 포워딩 가능).
// - 절대 throw 하지 않는다(계측이 앱 흐름을 깨면 안 된다).
// - analytics 준비 전 호출된 이벤트는 큐에 담았다가 준비되면 flush.
// - GA4 규칙: 이벤트/파라미터명은 snake_case, 이벤트명 40자 이하 권장.

import { getAnalyticsIfAvailable } from "../services/firebase";

const isDev = process.env.NODE_ENV !== "production";

let _initStarted = false;
let _initDone = false;
let _analytics = null;
let _mod = null;
const _queue = [];
const _superProps = {}; // 모든 이벤트에 붙는 공통 속성(예: role, env)

// RN 웹뷰로도 이벤트 전달 — 네이티브 앱이 자체 애널리틱스/로그로 포워딩할 수 있게.
function toNative(name, params) {
  try {
    const rn = typeof window !== "undefined" && window.ReactNativeWebView;
    if (rn && typeof rn.postMessage === "function") {
      rn.postMessage(JSON.stringify({ type: "ANALYTICS", event: name, params }));
    }
  } catch {}
}

async function ensureInit() {
  if (_initStarted) return;
  _initStarted = true;
  try {
    _mod = await import("firebase/analytics");
    _analytics = await getAnalyticsIfAvailable();
  } catch {
    _analytics = null;
  }
  _initDone = true;
  const pending = _queue.splice(0);
  for (const [name, params] of pending) fire(name, params);
}

function fire(name, params) {
  const merged = { ..._superProps, ...(params || {}) };
  toNative(name, merged);
  if (isDev) {
    try { console.debug("[track]", name, merged); } catch {}
  }
  if (_analytics && _mod) {
    try { _mod.logEvent(_analytics, name, merged); } catch {}
  }
}

/** 이벤트 1건 기록. 예: track("match_request_sent", { region: "서울" }) */
export function track(name, params) {
  if (!name) return;
  if (!_initDone) {
    _queue.push([name, params]);
    ensureInit();
    return;
  }
  fire(name, params);
}

/** 로그인 사용자 식별 + 사용자 속성. uid는 GA userId로, props는 user_properties로 설정. */
export function identify(uid, props) {
  if (props) Object.assign(_superProps, props);
  (async () => {
    try {
      if (!_initStarted) await ensureInit();
      if (!_analytics || !_mod) return;
      if (uid) _mod.setUserId(_analytics, String(uid));
      if (props) _mod.setUserProperties(_analytics, props);
    } catch {}
  })();
}

/** 모든 이후 이벤트에 붙는 공통 속성 병합(예: setSuperProps({ role: "user" })). */
export function setSuperProps(props) {
  if (props) Object.assign(_superProps, props);
}
