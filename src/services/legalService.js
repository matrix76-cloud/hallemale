/* eslint-disable */
// src/services/legalService.js
// 약관/정책 (개인정보 처리지침 / 이용약관 / 운영정책 / 구장 관리자 이용약관) 관리
// Firestore 컬렉션: legal_documents (문서 ID: 'privacy' | 'terms' | 'operation' | 'owner_terms')

import { db } from "./firebase";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const VALID_TYPES = new Set(["privacy", "terms", "operation", "owner_terms"]);

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
 * 약관/정책 문서 조회
 * @param {'privacy'|'terms'} type
 */
export async function getLegalDoc(type) {
  const t = safeStr(type);
  if (!VALID_TYPES.has(t)) throw new Error("legal type이 잘못되었습니다.");

  const ref = doc(db, "legal_documents", t);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data() || {};
  return {
    type: t,
    title: safeStr(data.title),
    content: typeof data.content === "string" ? data.content : "",
    updatedAt: toDate(data.updatedAt),
    updatedBy: safeStr(data.updatedBy),
  };
}

/**
 * 약관/정책 문서 저장 (관리자)
 */
export async function saveLegalDoc({ type, title, content, byAdmin = "admin" } = {}) {
  const t = safeStr(type);
  if (!VALID_TYPES.has(t)) throw new Error("legal type이 잘못되었습니다.");

  const ref = doc(db, "legal_documents", t);
  await setDoc(
    ref,
    {
      type: t,
      title: safeStr(title),
      content: typeof content === "string" ? content : "",
      updatedAt: serverTimestamp(),
      updatedBy: safeStr(byAdmin) || "admin",
    },
    { merge: true }
  );
  return { type: t };
}
