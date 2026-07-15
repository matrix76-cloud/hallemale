/* eslint-disable */
// src/utils/referral.js
// 리퍼럴 귀속 — 초대 링크(?ref=<uid>)로 들어온 신규 유저를 초대자에게 귀속.
// 진입 시 ref를 캡처(localStorage)해두고, 신규 가입 완료 시점에 유저 문서에 저장한다.

const KEY = "hm.referrer";

/** 앱 진입 시 URL의 ?ref 를 캡처해 저장(첫 유입 우선 — 이미 있으면 덮어쓰지 않음). index.js에서 렌더 전에 호출. */
export function captureReferrerFromUrl() {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    const v = String(ref || "").trim();
    if (v && !window.localStorage.getItem(KEY)) {
      window.localStorage.setItem(KEY, v);
    }
  } catch {}
}

export function getStoredReferrer() {
  try { return window.localStorage.getItem(KEY) || ""; } catch { return ""; }
}

export function clearStoredReferrer() {
  try { window.localStorage.removeItem(KEY); } catch {}
}
