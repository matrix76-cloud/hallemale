/* eslint-disable */
// src/services/adminAuthService.js
// 어드민 Firebase 인증 — 서버 CF(adminLogin)로 비번 검증 후 커스텀 토큰 → signInWithCustomToken.
// 기존 localStorage 플래그 방식(위조 가능)을 대체하는 진짜 인증.

import { auth } from "./firebase";
import { signInWithCustomToken, signOut } from "firebase/auth";

const ADMIN_LOGIN_URL =
  "https://asia-northeast3-halle-bf789.cloudfunctions.net/adminLogin";

const ADMIN_SESSION_USER_KEY = "HALLE_ADMIN_USER";

/**
 * 어드민 로그인: 서버 검증 → Firebase 세션 생성.
 * @returns {Promise<{id:string,name:string,role:string}>}
 * @throws Error (아이디/비번 오류 또는 서버 오류)
 */
export async function adminSignIn({ id, password } = {}) {
  const cleanId = String(id || "").trim();
  const cleanPw = String(password || "").trim();
  if (!cleanId || !cleanPw) throw new Error("아이디 또는 비밀번호를 입력해주세요.");

  let res;
  try {
    res = await fetch(ADMIN_LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cleanId, password: cleanPw }),
    });
  } catch (e) {
    throw new Error("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
  }

  if (!res.ok) {
    let reason = "";
    try {
      reason = (await res.json())?.error || "";
    } catch (e) {}
    if (reason === "wrong_password" || reason === "not_found" || reason === "empty") {
      throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
    throw new Error("로그인 처리 중 오류가 발생했습니다.");
  }

  const data = await res.json();
  await signInWithCustomToken(auth, data.token);

  const profile = { id: data.id, name: data.name, role: data.role };
  try {
    localStorage.setItem(ADMIN_SESSION_USER_KEY, JSON.stringify(profile));
  } catch (e) {}

  return profile;
}

/** 어드민 로그아웃: Firebase 세션 종료 + 로컬 표시정보 정리 */
export async function adminSignOut() {
  try {
    await signOut(auth);
  } catch (e) {}
  try {
    localStorage.removeItem("HALLE_ADMIN_AUTHED");
    localStorage.removeItem("HALLE_ADMIN_AUTHED_AUTO");
    localStorage.removeItem(ADMIN_SESSION_USER_KEY);
  } catch (e) {}
}
