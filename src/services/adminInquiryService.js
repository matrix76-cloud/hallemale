/* eslint-disable */
// src/services/adminInquiryService.js
// ✅ 관리자 1:1 문의 관리
// - listInquiriesAdmin: 전체 문의 조회(인덱스 없이 클라 정렬)
// - answerInquiry: 답변 저장(status=answered) + 사용자에게 알림(notifications) 생성

import { db } from "./firebase";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

const toStr = (v) => String(v ?? "").trim();

function toDateSafe(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sortByCreatedAtDesc(list) {
  return [...(list || [])].sort((a, b) => {
    const ta = toDateSafe(a.createdAt)?.getTime() || 0;
    const tb = toDateSafe(b.createdAt)?.getTime() || 0;
    return tb - ta;
  });
}

/* ===== read (전체 문의) ===== */

export async function listInquiriesAdmin({ limitCount = 300 } = {}) {
  const snap = await getDocs(collection(db, "inquiries"));
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  return sortByCreatedAtDesc(list).slice(0, limitCount);
}

/* ===== 사용자 알림 생성 (답변 등록 시) ===== */

async function notifyInquiryAuthor({ inquiryId, uid, title, answer, adminUid }) {
  const targetUid = toStr(uid);
  if (!targetUid) return;

  try {
    await addDoc(collection(db, "notifications"), {
      kind: "inquiry",
      subType: "inquiry_answered",
      type: "inquiry_answered",
      title: "문의에 답변이 등록되었어요",
      body: toStr(title) || toStr(answer).slice(0, 80),
      targetType: "USER",
      targetIds: [targetUid],
      actorUid: toStr(adminUid),
      linkType: "inquiry",
      linkTargetId: inquiryId,
      meta: { inquiryId, deepLink: "/my/inquiry" },
      push: { enabled: true, status: "queued", sentAt: null, failReason: null },
      prefsCategory: "inquiry",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      readBy: {},
    });
  } catch (e) {
    console.warn("[adminInquiry] notify failed:", e?.message || e);
  }
}

/* ===== 답변 저장 ===== */

export async function answerInquiry({ inquiryId, uid, title, answer, adminUid } = {}) {
  const id = toStr(inquiryId);
  const ans = toStr(answer);
  if (!id) throw new Error("inquiryId가 필요합니다.");
  if (!ans) throw new Error("답변 내용을 입력해 주세요.");

  await updateDoc(doc(db, "inquiries", id), {
    answer: ans,
    answeredAt: serverTimestamp(),
    answeredBy: toStr(adminUid),
    status: "answered",
    updatedAt: serverTimestamp(),
  });

  await notifyInquiryAuthor({ inquiryId: id, uid, title, answer: ans, adminUid });

  return { ok: true };
}
