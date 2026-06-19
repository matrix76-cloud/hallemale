/* eslint-disable */
// src/services/inquiryService.js
// ✅ 1:1 문의(inquiries) 서비스
// - SSOT: inquiries/{inquiryId}
// - 인덱스 최소화 원칙: where(uid)만 사용, 정렬은 클라이언트 메모리에서 처리
// - 관리자 답변: { answer, answeredAt, status: "answered" } 필드 읽기 지원

import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

/* ===== util ===== */

const toStr = (v) => String(v ?? "").trim();

function toDateSafe(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function sortByCreatedAtDesc(list) {
  return [...(list || [])].sort((a, b) => {
    const ta = toDateSafe(a.createdAt)?.getTime() || 0;
    const tb = toDateSafe(b.createdAt)?.getTime() || 0;
    return tb - ta;
  });
}

/* ===== create ===== */

export async function createInquiry({ uid, title, content, category, nickname } = {}) {
  const u = toStr(uid);
  const t = toStr(title);
  const c = toStr(content);

  if (!u) throw new Error("로그인이 필요합니다.");
  if (!t) throw new Error("제목을 입력해 주세요.");
  if (!c) throw new Error("문의 내용을 입력해 주세요.");

  const payload = {
    uid: u,
    title: t,
    content: c,
    category: toStr(category) || "etc",
    nickname: toStr(nickname),
    status: "open", // open | answered | closed
    answer: "",
    answeredAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "inquiries"), payload);
  return { id: ref.id, ...payload };
}

/* ===== read (내 문의 내역) ===== */

export async function getMyInquiries(uid, { limitCount = 200 } = {}) {
  const u = toStr(uid);
  if (!u) return [];

  const col = collection(db, "inquiries");
  const q = query(col, where("uid", "==", u));

  const snap = await getDocs(q);

  const list = [];
  snap.forEach((d) => {
    list.push({ id: d.id, ...d.data() });
  });

  // 인덱스 없이 클라이언트 메모리 정렬
  return sortByCreatedAtDesc(list).slice(0, limitCount);
}
