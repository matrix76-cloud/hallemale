/* eslint-disable */
// src/services/adminCsFaqService.js
// ✅ 관리자 CS 답변(FAQ) 관리 — csFaq/{id}
// - 여기서 고친 문구가 앱 FAQ 화면과 카카오톡 챗봇 응답에 동시에 반영된다.
// - 챗봇 스킬 서버는 응답 속도 때문에 5분 인메모리 캐시를 쓴다 → 저장 후 최대 5분 뒤에 반영된다.

import { db } from "./firebase";
import { hasMock, mockData, mockQuerySnap } from "../dev/mockBus";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

const toStr = (v) => String(v ?? "").trim();

/* ===== read (전체 — 비노출 항목 포함) ===== */

export async function listCsFaqAdmin() {
  const snap = hasMock("csFaq")
    ? mockQuerySnap(mockData("csFaq"))
    : await getDocs(collection(db, "csFaq"));

  const list = [];
  snap.forEach((d) => {
    const v = d.data() || {};
    list.push({
      id: d.id,
      audience: toStr(v.audience) || "user",
      q: toStr(v.q),
      a: toStr(v.a),
      keywords: Array.isArray(v.keywords) ? v.keywords : [],
      order: Number(v.order) || 0,
      active: v.active !== false,
      updatedAt: v.updatedAt || null,
      updatedBy: toStr(v.updatedBy),
    });
  });

  return list.sort((a, b) => {
    if (a.audience !== b.audience) return a.audience < b.audience ? -1 : 1;
    return a.order - b.order;
  });
}

/* ===== write ===== */

export async function saveCsFaq({ id, audience, q, a, keywords, order, active, adminUid } = {}) {
  const docId = toStr(id);
  const question = toStr(q);
  const answer = toStr(a);

  if (!docId) throw new Error("문서 ID가 필요합니다.");
  if (!question) throw new Error("질문을 입력해 주세요.");
  if (!answer) throw new Error("답변을 입력해 주세요.");

  await setDoc(
    doc(db, "csFaq", docId),
    {
      audience: audience === "owner" ? "owner" : "user",
      q: question,
      a: answer,
      keywords: (Array.isArray(keywords) ? keywords : [])
        .map(toStr)
        .filter(Boolean),
      order: Number(order) || 0,
      active: active !== false,
      updatedAt: serverTimestamp(),
      updatedBy: toStr(adminUid) || "admin",
    },
    { merge: true }
  );

  return { ok: true, id: docId };
}

export async function deleteCsFaq(id) {
  const docId = toStr(id);
  if (!docId) throw new Error("문서 ID가 필요합니다.");
  await deleteDoc(doc(db, "csFaq", docId));
  return { ok: true };
}
