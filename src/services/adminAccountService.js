/* eslint-disable */
// src/services/adminAccountService.js
// 어드민(운영자) 계정 관리
// Firestore 컬렉션: admin_accounts (문서 ID = 로그인 아이디)
// - role: "super" (삭제 불가) | "admin" (삭제 가능)
// - 비밀번호는 솔트 있는 PBKDF2-SHA256 으로 저장한다.
//
// ⚠️ 이 화면에서 만든 해시를 서버(functions/auth/adminLogin.js)가 검증한다.
//    PBKDF2 파라미터가 어긋나면 로그인이 통째로 막히므로 양쪽을 같이 고칠 것.
//
// 예전에는 무솔트 SHA-256 1회였다. admin_accounts 를 읽을 수 있는 사람(=다른 운영자)이
// 남의 해시를 가져가면 레인보우 테이블로 바로 복원되는 값이라 교체했다.
// 구버전 해시로 저장된 계정은 서버가 로그인 성공 시점에 PBKDF2 로 올려준다.

import { db } from "./firebase";
import { hasMock, mockData, mockQuerySnap } from "../dev/mockBus";
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

// 서버(functions/auth/adminLogin.js)와 반드시 같은 값
const PBKDF2_ALGO = "pbkdf2-sha256";
const PBKDF2_ITERATIONS = 210000;
const PBKDF2_KEYLEN = 32;

// 4자리 비밀번호는 온라인 대입으로 뚫린다. 관리자 콘솔 전체가 걸린 계정이라 길이를 올렸다.
const MIN_PASSWORD_LENGTH = 10;

function safeStr(v) {
  return String(v || "").trim();
}

function toDate(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  const s = String(hex || "");
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(s.substr(i * 2, 2), 16);
  return out;
}

async function pbkdf2Hex(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password || "")),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(saltHex), iterations, hash: "SHA-256" },
    key,
    PBKDF2_KEYLEN * 8,
  );
  return toHex(new Uint8Array(bits));
}

/** 저장용 비밀번호 필드 묶음 (솔트는 매번 새로 뽑는다) */
async function newPasswordFields(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = toHex(salt);
  return {
    passwordAlgo: PBKDF2_ALGO,
    passwordSalt: saltHex,
    passwordIterations: PBKDF2_ITERATIONS,
    passwordHash: await pbkdf2Hex(password, saltHex, PBKDF2_ITERATIONS),
  };
}

function assertPassword(pw) {
  if (!pw) throw new Error("비밀번호를 입력해주세요.");
  if (pw.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
  }
}

/**
 * 운영자 목록
 * ※ 계정이 없을 때 자동 생성하지 않는다. 최초 1회 생성은 서버 부트스트랩
 *    (functions/.env 의 ADMIN_BOOTSTRAP_PASSWORD)만 할 수 있다.
 */
export async function listAdminAccounts() {
  if (hasMock("adminAccounts")) {
    const snap0 = mockQuerySnap(mockData("adminAccounts"));
    const rows0 = [];
    snap0.forEach((d) => {
      const data = d.data() || {};
      rows0.push({ id: d.id, name: safeStr(data.name) || d.id, role: safeStr(data.role) || "admin", createdAt: toDate(data.createdAt) });
    });
    return rows0;
  }
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
  assertPassword(cleanPw);

  const ref = doc(db, "admin_accounts", cleanId);
  const exist = await getDoc(ref);
  if (exist.exists()) throw new Error("이미 사용중인 아이디입니다.");

  await setDoc(ref, {
    id: cleanId,
    name: cleanName,
    role: "admin",
    ...(await newPasswordFields(cleanPw)),
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
  assertPassword(cleanPw);

  const ref = doc(db, "admin_accounts", cleanId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("존재하지 않는 운영자입니다.");

  await setDoc(
    ref,
    { ...(await newPasswordFields(cleanPw)), updatedAt: serverTimestamp() },
    { merge: true },
  );
  return { id: cleanId };
}

export const SUPER_ADMIN = SUPER_ADMIN_ID;
export const ADMIN_MIN_PASSWORD_LENGTH = MIN_PASSWORD_LENGTH;
