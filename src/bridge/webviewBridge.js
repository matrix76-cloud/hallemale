// src/bridge/webviewBridge.js
// RN WebView ↔ Web 브릿지 유틸리티 (React 의존 없음)

/**
 * 현재 환경이 RN WebView 안인지 감지
 */
export function isInWebView() {
  try {
    return typeof window !== "undefined" && !!window.ReactNativeWebView;
  } catch {
    return false;
  }
}

/**
 * Web → RN 타입 기반 메시지 발송
 * @param {string} type - 메시지 타입 (e.g. "WEB_READY", "NAV_STATE")
 * @param {object} payload
 * @returns {boolean} 발송 성공 여부
 */
export function postToApp(type, payload = {}) {
  if (!isInWebView()) return false;
  try {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type, payload })
    );
    return true;
  } catch (e) {
    console.warn("[Bridge] postToApp error:", e);
    return false;
  }
}

/**
 * RN → Web 수신 메시지 파싱
 * @param {*} eventData - window message event.data
 * @returns {{ type: string, payload: object } | null}
 */
export function parseAppMessage(eventData) {
  try {
    const data =
      typeof eventData === "string" ? JSON.parse(eventData) : eventData;
    if (!data?.type) return null;
    return { type: data.type, payload: data.payload || {} };
  } catch {
    return null;
  }
}

/**
 * 글로벌 1회성 메시지 대기 (React 의존 없음)
 * WebviewBridgeContext와 같은 window message 이벤트를 공유
 */
const _oneTimeListeners = {};

export function onceFromApp(type, callback) {
  if (!_oneTimeListeners[type]) {
    _oneTimeListeners[type] = new Set();
  }
  _oneTimeListeners[type].add(callback);
  return () => _oneTimeListeners[type]?.delete(callback);
}

// 글로벌 메시지 핸들러 (1회 등록)
// RN WebView: iOS는 window에, Android는 document에 message가 dispatch됨
if (typeof window !== "undefined") {
  const _globalHandler = (event) => {
    const msg = parseAppMessage(event.data);
    if (!msg) return;
    const cbs = _oneTimeListeners[msg.type];
    if (cbs?.size) {
      const arr = [...cbs];
      cbs.clear();
      arr.forEach((cb) => {
        try { cb(msg.payload); } catch (e) { console.warn("[Bridge] once error:", e); }
      });
    }
  };
  window.addEventListener("message", _globalHandler);
  if (typeof document !== "undefined") {
    document.addEventListener("message", _globalHandler);
  }
}
