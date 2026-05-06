/* eslint-disable */
// src/services/adminAccountService.js
// 어드민(운영자) 계정 관리
// Firestore 컬렉션: admin_accounts (문서 ID = 로그인 아이디)
// - role: "super" (삭제 불가) | "admin" (삭제 가능)
// - 비밀번호는 SHA-256 해시로 저장

import { db } from "./firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const SUPER_ADMIN_ID = "admin";

function safeStr(v) {
  return String(v || "").trim();
}

function toDate(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * SHA-256 해시 (Web Crypto API)
 */
async function sha256(text) {
  const buf = new TextEncoder().encode(String(text || ""));
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 'admin' 계정이 없으면 자동 생성 (id=admin, pw=admin, role=super)
 */
export async function ensureSuperAdmin() {
  const ref = doc(db, "admin_accounts", SUPER_ADMIN_ID);
  const snap = await getDoc(ref);
  if (snap.exists()) return false;

  const passwordHash = await sha256("admin");
  await setDoc(ref, {
    id: SUPER_ADMIN_ID,
    name: "최고 관리자",
    role: "super",
    passwordHash,
    createdAt: serverTimestamp(),
    createdBy: "system",
  });
  return true;
}

/**
 * 운영자 목록
 */
export async function listAdminAccounts() {
  await ensureSuperAdmin();
  const snap = await getDocs(collection(db, "admin_accounts"));
  const rows = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    rows.push({
      id: d.id,
      name: safeStr(data.name) || d.id,
      role: safeStr(data.role) || "admin",
      createdAt: toDate(data.createdAt),
      createdBy: safeStr(data.createdBy),
    });
  });

  // super 우선, 그 다음 createdAt 오래된 순
  rows.sort((a, b) => {
    if (a.role !== b.role) {
      if (a.role === "super") return -1;
      if (b.role === "super") return 1;
    }
    const ta = a.createdAt ? a.createdAt.getTime() : 0;
    const tb = b.createdAt ? b.createdAt.getTime() : 0;
    return ta - tb;
  });

  return rows;
}

/**
 * 운영자 추가
 */
export async function createAdminAccount({ id, password, name, byAdmin = "admin" } = {}) {
  const cleanId = safeStr(id);
  const cleanPw = safeStr(password);
  const cleanName = safeStr(name) || cleanId;

  if (!cleanId) throw new Error("아이디를 입력해주세요.");
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(cleanId)) {
    throw new Error("아이디는 영문/숫자/_/- 3~20자만 가능합니다.");
  }
  if (!cleanPw) throw new Error("비밀번호를 입력해주세요.");
  if (cleanPw.length < 4) throw new Error("비밀번호는 최소 4자 이상이어야 합니다.");

  const ref = doc(db, "admin_accounts", cleanId);
  const exist = await getDoc(ref);
  if (exist.exists()) throw new Error("이미 사용중인 아이디입니다.");

  const passwordHash = await sha256(cleanPw);
  await setDoc(ref, {
    id: cleanId,
    name: cleanName,
    role: "admin",
    passwordHash,
    createdAt: serverTimestamp(),
    createdBy: safeStr(byAdmin) || "admin",
  });
  return { id: cleanId };
}

/**
 * 운영자 삭제 (super는 삭제 불가)
 */
export async function deleteAdminAccount({ id } = {}) {
  const cleanId = safeStr(id);
  if (!cleanId) throw new Error("id가 비어있습니다.");
  if (cleanId === SUPER_ADMIN_ID) {
    throw new Error("최고 관리자는 삭제할 수 없습니다.");
  }

  const ref = doc(db, "admin_accounts", cleanId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("존재하지 않는 운영자입니다.");

  const data = snap.data() || {};
  if (safeStr(data.role) === "super") {
    throw new Error("최고 관리자는 삭제할 수 없습니다.");
  }

  await deleteDoc(ref);
  return { id: cleanId };
}

/**
 * 운영자 비밀번호 변경
 */
export async function changeAdminPassword({ id, newPassword } = {}) {
  const cleanId = safeStr(id);
  const cleanPw = safeStr(newPassword);
  if (!cleanId) throw new Error("id가 비어있습니다.");
  if (!cleanPw || cleanPw.length < 4) {
    throw new Error("비밀번호는 최소 4자 이상이어야 합니다.");
  }

  const ref = doc(db, "admin_accounts", cleanId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("존재하지 않는 운영자입니다.");

  const passwordHash = await sha256(cleanPw);
  await setDoc(ref, { passwordHash, updatedAt: serverTimestamp() }, { merge: true });
  return { id: cleanId };
}

/**
 * 로그인 검증
 * - 'admin' 계정이 없는 첫 사용 시점에는 자동 시드 후 검증
 */
export async function verifyAdminLogin({ id, password } = {}) {
  const cleanId = safeStr(id);
  const cleanPw = safeStr(password);
  if (!cleanId || !cleanPw) return { ok: false, reason: "empty" };

  await ensureSuperAdmin();

  const ref = doc(db, "admin_accounts", cleanId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: false, reason: "not_found" };

  const data = snap.data() || {};
  const inputHash = await sha256(cleanPw);
  if (safeStr(data.passwordHash) !== inputHash) {
    return { ok: false, reason: "wrong_password" };
  }

  return {
    ok: true,
    id: cleanId,
    name: safeStr(data.name) || cleanId,
    role: safeStr(data.role) || "admin",
  };
}

export const SUPER_ADMIN = SUPER_ADMIN_ID;
