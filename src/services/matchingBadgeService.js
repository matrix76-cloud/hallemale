/* eslint-disable */
// src/services/matchingBadgeService.js
// ✅ 매칭 탭 배지 카운트(팀단위 match_requests) — 실시간 구독 지원
// SSOT:
// - match_requests.status === "pending"
// - actorClubId==clubId OR targetClubId==clubId
// - notifications/readBy 안 봄 (단순 pending 개수)

import { db } from "./firebase";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

const toStr = (v) => String(v || "").trim();

function uniqCountById(list) {
  const map = {};
  for (const x of list || []) {
    const id = toStr(x?.id);
    if (!id) continue;
    map[id] = true;
  }
  return Object.keys(map).length;
}

export async function getMatchUnreadCountForTeam({ clubId, limitCount = 400 } = {}) {
  const myClubId = toStr(clubId);
  if (!myClubId) return 0;

  const col = collection(db, "match_requests");

  const q1 = query(
    col,
    where("status", "==", "pending"),
    where("actorClubId", "==", myClubId),
    limit(limitCount)
  );

  const q2 = query(
    col,
    where("status", "==", "pending"),
    where("targetClubId", "==", myClubId),
    limit(limitCount)
  );

  const [snapA, snapB] = await Promise.all([getDocs(q1), getDocs(q2)]);

  const rowsA = (snapA?.docs || []).map((d) => ({ id: d.id }));
  const rowsB = (snapB?.docs || []).map((d) => ({ id: d.id }));

  return uniqCountById([...(rowsA || []), ...(rowsB || [])]);
}

/**
 * ✅ 실시간 구독: pending 매칭 개수
 * - onCount(count) 콜백으로 즉시 반영
 * - 반환값: unsubscribe()
 */
export function subscribeMatchPendingCountForTeam({
  clubId,
  limitCount = 400,
  onCount,
} = {}) {
  const myClubId = toStr(clubId);
  const cb = typeof onCount === "function" ? onCount : null;

  if (!myClubId) {
    cb && cb(0);
    return () => {};
  }

  const col = collection(db, "match_requests");

  const q1 = query(
    col,
    where("status", "==", "pending"),
    where("actorClubId", "==", myClubId),
    limit(limitCount)
  );

  const q2 = query(
    col,
    where("status", "==", "pending"),
    where("targetClubId", "==", myClubId),
    limit(limitCount)
  );

  let aIds = new Set();
  let bIds = new Set();
  let aReady = false;
  let bReady = false;

  const emit = () => {
    if (!cb) return;
    if (!aReady || !bReady) return;

    const merged = new Set();
    aIds.forEach((x) => merged.add(x));
    bIds.forEach((x) => merged.add(x));
    cb(merged.size);
  };

  const unsubA = onSnapshot(
    q1,
    (snap) => {
      aIds = new Set((snap?.docs || []).map((d) => d.id));
      aReady = true;
      emit();
    },
    () => {
      aIds = new Set();
      aReady = true;
      emit();
    }
  );

  const unsubB = onSnapshot(
    q2,
    (snap) => {
      bIds = new Set((snap?.docs || []).map((d) => d.id));
      bReady = true;
      emit();
    },
    () => {
      bIds = new Set();
      bReady = true;
      emit();
    }
  );

  return () => {
    try {
      unsubA && unsubA();
    } catch (e) {}
    try {
      unsubB && unsubB();
    } catch (e) {}
  };
}
