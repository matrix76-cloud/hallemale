/* eslint-disable */
// src/services/postReportService.js
// 사용자가 게시글을 신고하는 기능 + 관리자가 처리하는 기능
// Firestore 컬렉션: community_reports

import { db } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
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

// 게시글 신고 등록 (사용자 측)
export async function createPostReport({
  postId,
  postTitle,
  postAuthorUid,
  postAuthorNickname,
  reporterUid,
  reporterNickname,
  reason,
}) {
  const pid = safeStr(postId);
  const ru = safeStr(reporterUid);
  const r = safeStr(reason);

  if (!pid) throw new Error("게시글 정보가 비어있습니다.");
  if (!ru) throw new Error("로그인이 필요합니다.");
  if (!r) throw new Error("신고 사유를 입력해주세요.");

  if (postAuthorUid && safeStr(postAuthorUid) === ru) {
    throw new Error("본인 게시글은 신고할 수 없습니다.");
  }

  const ref = await addDoc(collection(db, "community_reports"), {
    postId: pid,
    postTitle: safeStr(postTitle),
    postAuthorUid: safeStr(postAuthorUid),
    postAuthorNickname: safeStr(postAuthorNickname),
    reporterUid: ru,
    reporterNickname: safeStr(reporterNickname),
    reason: r,
    status: "pending", // pending | resolved | rejected
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

// 관리자 - 신고 목록 조회
export async function listPostReports({ statusFilter = "all" } = {}) {
  let q;
  if (statusFilter === "all") {
    q = query(collection(db, "community_reports"));
  } else {
    q = query(
      collection(db, "community_reports"),
      where("status", "==", String(statusFilter))
    );
  }
  const snap = await getDocs(q);

  const rows = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    rows.push({
      id: d.id,
      postId: safeStr(data.postId),
      postTitle: safeStr(data.postTitle),
      postAuthorUid: safeStr(data.postAuthorUid),
      postAuthorNickname: safeStr(data.postAuthorNickname),
      reporterUid: safeStr(data.reporterUid),
      reporterNickname: safeStr(data.reporterNickname),
      reason: safeStr(data.reason),
      status: safeStr(data.status) || "pending",
      createdAt: toDate(data.createdAt),
      resolvedAt: toDate(data.resolvedAt),
      resolvedBy: safeStr(data.resolvedBy),
    });
  });

  // pending 우선, 그 다음 createdAt 최신순
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

// 관리자 - 신고 처리 상태 변경
export async function updatePostReportStatus({ reportId, status, byAdmin }) {
  const id = safeStr(reportId);
  const s = safeStr(status);
  if (!id) throw new Error("reportId가 비어있습니다.");
  if (s !== "resolved" && s !== "rejected" && s !== "pending") {
    throw new Error("status가 잘못되었습니다.");
  }

  const ref = doc(db, "community_reports", id);
  await updateDoc(ref, {
    status: s,
    resolvedAt: s === "pending" ? null : serverTimestamp(),
    resolvedBy: s === "pending" ? "" : safeStr(byAdmin) || "admin",
  });
  return { id, status: s };
}

// 동일 게시글에 대한 신고 건수
export async function countReportsByPost(postId) {
  const pid = safeStr(postId);
  if (!pid) return 0;
  const q = query(
    collection(db, "community_reports"),
    where("postId", "==", pid)
  );
  const snap = await getDocs(q);
  return snap.size;
}
