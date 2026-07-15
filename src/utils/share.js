/* eslint-disable */
// src/utils/share.js
// 바이럴 루프 — 친구/팀 초대 공유. 네이티브 SHARE 브리지가 없어 웹 표준으로 처리:
//   navigator.share(웹 공유 시트) → 없으면 클립보드 복사 폴백. 절대 throw 하지 않는다.
// 리퍼럴 귀속(?ref=uid)은 링크에 심어두되, 실제 귀속 처리는 랜딩/가입에서 ref를 읽어야 완성된다(후속).

import { track } from "./analytics";

// 공유/설치 랜딩 도메인 — 랜딩이 쓰는 브랜드 도메인. 실제 배포 URL이 다르면 이 상수만 교체.
export const APP_SHARE_URL = "https://hallaemallae.com";

/** 초대 링크 생성 (?ref=<uid> + utm) */
export function buildInviteUrl(refUid) {
  const ref = String(refUid || "").trim();
  const params = new URLSearchParams({ utm_source: "invite" });
  if (ref) params.set("ref", ref);
  return `${APP_SHARE_URL}?${params.toString()}`;
}

/**
 * 앱 초대 공유.
 * @param {{ refUid?: string, context?: string, text?: string }} opts
 *   - refUid: 초대한 사람 uid(리퍼럴 귀속용)
 *   - context: 계측용 위치 태그(예: "my", "opponent_none", "team_manage")
 *   - text: 커스텀 메시지(없으면 기본 문구)
 * @returns {Promise<{ method: string, url: string }>} method: shared|copied|cancelled|unsupported|error
 */
export async function shareApp({ refUid = "", context = "unknown", text } = {}) {
  const url = buildInviteUrl(refUid);
  const message =
    text || "같이 농구 한판 어때? 할래말래에서 팀 만들고 매칭·구장 예약까지 한 번에! 🏀";
  let method = "none";
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title: "할래말래", text: message, url });
      method = "shared";
    } else if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${message}\n${url}`);
      method = "copied";
    } else {
      method = "unsupported";
    }
  } catch (e) {
    // 사용자가 공유 시트를 닫으면 AbortError → 취소(정상)로 취급
    method = e?.name === "AbortError" ? "cancelled" : "error";
  }
  try { track("invite_shared", { context, method }); } catch {}
  return { method, url };
}
