/* eslint-disable */
// src/services/userReportService.js
// 사용자가 다른 사용자를 신고하는 기능 + 관리자가 처리하는 기능
// Firestore 컬렉션: user_reports

import { db } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

function safeStr(v) {
  return String(v || "").trim();
}

function toDate(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// 사용자 신고 등록 (사용자 측)
export async function createUserReport({
  targetUid,
  targetNickname,
  reporterUid,
  reporterNickname,
  reason,
}) {
  const tu = safeStr(targetUid);
  const ru = safeStr(reporterUid);
  const r = safeStr(reason);

  if (!tu) throw new Error("신고 대상이 비어있습니다.");
  if (!ru) throw new Error("로그인이 필요합니다.");
  if (tu === ru) throw new Error("본인은 신고할 수 없습니다.");
  if (!r) throw new Error("신고 사유를 입력해주세요.");

  const ref = await addDoc(collection(db, "user_reports"), {
    targetUid: tu,
    targetNickname: safeStr(targetNickname),
    reporterUid: ru,
    reporterNickname: safeStr(reporterNickname),
    reason: r,
    status: "pending", // pending | resolved | rejected
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

// 관리자 - 신고 목록 조회
export async function listUserReports({ statusFilter = "all" } = {}) {
  let q;
  if (statusFilter === "all") {
    q = query(collection(db, "user_reports"));
  } else {
    q = query(
      collection(db, "user_reports"),
      where("status", "==", String(statusFilter))
    );
  }
  const snap = await getDocs(q);

  const rows = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    rows.push({
      id: d.id,
      targetUid: safeStr(data.targetUid),
      targetNickname: safeStr(data.targetNickname),
      reporterUid: safeStr(data.reporterUid),
      reporterNickname: safeStr(data.reporterNickname),
      reason: safeStr(data.reason),
      status: safeStr(data.status) || "pending",
      createdAt: toDate(data.createdAt),
      resolvedAt: toDate(data.resolvedAt),
      resolvedBy: safeStr(data.resolvedBy),
    });
  });

  // 최신 순 (pending 우선, 그 다음 createdAt 최신순)
  rows.sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === "pending") return -1;
      if (b.status === "pending") return 1;
    }
    const ta = a.createdAt ? a.createdAt.getTime() : 0;
    const tb = b.createdAt ? b.createdAt.getTime() : 0;
    return tb - ta;
  });

  return rows;
}

// 관리자 - 신고 처리 상태 변경 (resolved | rejected)
export async function updateReportStatus({ reportId, status, byAdmin }) {
  const id = safeStr(reportId);
  const s = safeStr(status);
  if (!id) throw new Error("reportId가 비어있습니다.");
  if (s !== "resolved" && s !== "rejected" && s !== "pending") {
    throw new Error("status가 잘못되었습니다.");
  }

  const ref = doc(db, "user_reports", id);
  await updateDoc(ref, {
    status: s,
    resolvedAt: s === "pending" ? null : serverTimestamp(),
    resolvedBy: s === "pending" ? "" : safeStr(byAdmin) || "admin",
  });
  return { id, status: s };
}

// 동일 대상에 대한 신고 건수 (어드민 카운트용)
export async function countReportsByTarget(targetUid) {
  const tu = safeStr(targetUid);
  if (!tu) return 0;
  const q = query(
    collection(db, "user_reports"),
    where("targetUid", "==", tu)
  );
  const snap = await getDocs(q);
  return snap.size;
}
