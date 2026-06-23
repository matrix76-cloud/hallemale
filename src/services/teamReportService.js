/* eslint-disable */
// src/services/teamReportService.js
// 사용자가 팀을 신고 + 관리자가 처리
// Firestore 컬렉션: team_reports

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

export async function createTeamReport({
  clubId,
  clubName,
  reporterUid,
  reporterNickname,
  reason,
}) {
  const cid = safeStr(clubId);
  const ru = safeStr(reporterUid);
  const r = safeStr(reason);

  if (!cid) throw new Error("팀 정보가 비어있습니다.");
  if (!ru) throw new Error("로그인이 필요합니다.");
  if (!r) throw new Error("신고 사유를 입력해주세요.");

  const ref = await addDoc(collection(db, "team_reports"), {
    clubId: cid,
    clubName: safeStr(clubName),
    reporterUid: ru,
    reporterNickname: safeStr(reporterNickname),
    reason: r,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

// ✅ 내가 신고한 팀 목록 (내정보 > 내가 신고한 내역)
export async function listMyTeamReports(reporterUid) {
  const ru = safeStr(reporterUid);
  if (!ru) return [];
  const q = query(collection(db, "team_reports"), where("reporterUid", "==", ru));
  const snap = await getDocs(q);
  const rows = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    rows.push({
      id: d.id,
      type: "team",
      targetId: safeStr(data.clubId),
      targetName: safeStr(data.clubName),
      reason: safeStr(data.reason),
      status: safeStr(data.status) || "pending",
      createdAt: toDate(data.createdAt),
    });
  });
  rows.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  return rows;
}

export async function listTeamReports({ statusFilter = "all" } = {}) {
  let q;
  if (statusFilter === "all") {
    q = query(collection(db, "team_reports"));
  } else {
    q = query(collection(db, "team_reports"), where("status", "==", String(statusFilter)));
  }
  const snap = await getDocs(q);

  const rows = [];
  snap.forEach((d) => {
    const data = d.data() || {};
    rows.push({
      id: d.id,
      clubId: safeStr(data.clubId),
      clubName: safeStr(data.clubName),
      reporterUid: safeStr(data.reporterUid),
      reporterNickname: safeStr(data.reporterNickname),
      reason: safeStr(data.reason),
      status: safeStr(data.status) || "pending",
      createdAt: toDate(data.createdAt),
      resolvedAt: toDate(data.resolvedAt),
      resolvedBy: safeStr(data.resolvedBy),
    });
  });

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

export async function updateTeamReportStatus({ reportId, status, byAdmin }) {
  const id = safeStr(reportId);
  const s = safeStr(status);
  if (!id) throw new Error("reportId가 비어있습니다.");
  if (s !== "resolved" && s !== "rejected" && s !== "pending") {
    throw new Error("status가 잘못되었습니다.");
  }

  const ref = doc(db, "team_reports", id);
  await updateDoc(ref, {
    status: s,
    resolvedAt: s === "pending" ? null : serverTimestamp(),
    resolvedBy: s === "pending" ? "" : safeStr(byAdmin) || "admin",
  });
  return { id, status: s };
}
