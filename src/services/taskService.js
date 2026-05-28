/* eslint-disable */
// src/services/taskService.js
// ✅ tasks 적재 서비스 (페이지에서 DB 직접 접근 금지)
// - 팀명/로고 변경 시: tasks에 "team_snapshot_refresh" 적재
// - 서버(Functions/Cloud Run)가 스케줄로 tasks를 처리하며 파생 스냅샷 갱신

import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

function safeStr(v) {
  return String(v ?? "").trim();
}

function safeObj(v) {
  return v && typeof v === "object" ? v : {};
}

/**
 * ✅ 팀 스냅샷 갱신 Task 적재
 * @param {string} clubId
 * @param {object} patch  - { name?, logoUrl?, logoPath? }
 * @param {string} reason
 */
export async function enqueueTeamSnapshotRefreshTask({ clubId, patch, reason }) {
  const id = safeStr(clubId);
  if (!id) throw new Error("enqueueTeamSnapshotRefreshTask: clubId is required");

  const p = safeObj(patch);
  const r = safeStr(reason);

  const col = collection(db, "tasks");

  const payload = {
    kind: "team_snapshot_refresh",
    status: "queued", // queued | processing | done | failed
    clubId: id,
    patch: p,
    reason: r,
    attempts: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(col, payload);
  return { taskId: ref.id };
}
