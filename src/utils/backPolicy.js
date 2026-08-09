/* eslint-disable */
// src/utils/backPolicy.js
// 안드로이드 하드웨어 뒤로가기의 목적지를 한 곳에서만 정한다.
//
// 왜 필요했나 — "되는 화면과 안 되는 화면"이 갈렸던 이유:
//  1) 폴백이 항상 사용자앱 /home 이라, 구장주/어드민 화면에서 뒤로가기를 누르면
//     사용자앱 홈 → 인증 게이트 → 로그인으로 튕기거나 아무 일도 안 일어났다.
//  2) 각 영역의 진입점(/home, /owner/home, 어드민 대시보드)에서는 히스토리에 뒤로 갈
//     항목이 없어 navigate(-1)이 무동작이었다.
//
// 정책: 어떤 화면이든 뒤로가기는 반드시 셋 중 하나로 귀결된다(무반응 없음).
//  - "exit" : 앱 종료 확인 모달  (그 영역의 진입점 = 더 뒤로 갈 곳이 없는 화면)
//  - "home" : 그 영역의 홈으로   (홈이 아닌 하단 탭)
//  - "back" : 히스토리 뒤로, 앱 내부 백스택이 없으면 그 영역의 폴백 경로로
import { ADMIN_BASE } from "../config/adminPath";

const ADMIN = String(ADMIN_BASE || "/admin").toLowerCase();

/** 비교용 정규화: 소문자 + 끝 슬래시 제거("/"는 유지) */
export function normalizePath(pathname) {
  const p = String(pathname || "/").toLowerCase();
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}

/** 경로가 속한 앱 영역 */
export function getScope(pathname) {
  const p = normalizePath(pathname);
  if (p === "/owner" || p.startsWith("/owner/")) return "owner";
  if (p === ADMIN || p.startsWith(`${ADMIN}/`)) return "admin";
  return "user";
}

/** 영역별 홈(= 하단 탭에서 뒤로가기 했을 때 도착지) */
export const SCOPE_HOME = {
  user: "/home",
  owner: "/owner/home",
  admin: `${ADMIN_BASE}/dashboard`,
};

// 더 뒤로 갈 곳이 없는 진입점 → 앱 종료 확인
const ROOTS = {
  user: ["/", "/welcome", "/home"],
  owner: ["/owner", "/owner/home"],
  admin: [ADMIN, `${ADMIN}/dashboard`],
};

// 홈이 아닌 하단 탭 → 홈으로 (안드로이드 표준 동작)
const TABS = {
  user: ["/matchingmanage", "/records", "/community", "/my"],
  owner: ["/owner/sales", "/owner/settlement", "/owner/venue", "/owner/my"],
  admin: [],
};

// 백스택이 비었을 때의 도착지를 영역 홈이 아닌 곳으로 바꿔야 하는 예외.
// (로그인 화면에서 홈으로 보내면 인증 게이트가 다시 로그인으로 돌려보내 무한 루프처럼 보인다)
const FALLBACK_OVERRIDE = {
  "/login": "/welcome",
  "/oauth/kakao": "/welcome",
  "/owner/login": "/welcome",
  "/owner/signup": "/owner/login",
  "/owner/terms": "/owner/login",
  "/owner/privacy": "/owner/login",
  [`${ADMIN}/login`]: "/welcome",
};

/**
 * 해당 경로에서 하드웨어 뒤로가기를 눌렀을 때 무엇을 할지.
 * @param {string} pathname
 * @returns {{ scope: string, action: "exit"|"home"|"back", home: string, fallback: string }}
 */
export function resolveBackAction(pathname) {
  const p = normalizePath(pathname);
  const scope = getScope(p);
  const home = SCOPE_HOME[scope];
  const fallback = FALLBACK_OVERRIDE[p] || home;

  if (ROOTS[scope].includes(p)) return { scope, action: "exit", home, fallback };
  if (TABS[scope].includes(p)) return { scope, action: "home", home, fallback };
  return { scope, action: "back", home, fallback };
}

/** RN 에 보낼 NAV_STATE 의 isRoot (종료 확인 모달이 떠야 하는 화면인지) */
export function isRootPath(pathname) {
  return resolveBackAction(pathname).action === "exit";
}
