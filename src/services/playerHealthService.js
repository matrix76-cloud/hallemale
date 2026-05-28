/* eslint-disable */
// src/services/playerHealthService.js
// 워치(Apple Watch / Galaxy Watch) 헬스 데이터 — RN 브릿지 + Firestore 저장
//
// 컬렉션: player_sessions/{sessionId}
//   - playerId, source, startedAt, endedAt
//   - avgHeartRate, maxHeartRate, minHeartRate, totalCalories
//   - heartRateSamples: [{value, timestamp}]
//   - createdAt

import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { postToApp, onceFromApp } from "../bridge/webviewBridge";

const COL = "player_sessions";

/* ── RN 브릿지 호출 ── */

export function checkHealthAvailable() {
  return new Promise((resolve) => {
    const unsub = onceFromApp("HEALTH_AVAILABLE_RESULT", (p) => {
      resolve(p || { available: false });
    });
    if (!postToApp("CHECK_HEALTH_AVAILABLE")) {
      unsub?.();
      resolve({ available: false, status: "not_in_webview" });
    }
    setTimeout(() => {
      unsub?.();
      resolve({ available: false, status: "timeout" });
    }, 6000);
  });
}

export function requestHealthPermission() {
  return new Promise((resolve) => {
    const unsub = onceFromApp("HEALTH_PERMISSION_RESULT", (p) => resolve(p || { success: false }));
    if (!postToApp("REQUEST_HEALTH_PERMISSION")) {
      unsub?.();
      resolve({ success: false, error: "not_in_webview" });
    }
    setTimeout(() => {
      unsub?.();
      resolve({ success: false, error: "timeout" });
    }, 30000);
  });
}

export function requestHealthData(period = {}) {
  return new Promise((resolve) => {
    const unsub = onceFromApp("HEALTH_DATA_RESULT", (p) => resolve(p || {}));
    if (!postToApp("REQUEST_HEALTH_DATA", period)) {
      unsub?.();
      resolve({ error: "not_in_webview" });
    }
    setTimeout(() => {
      unsub?.();
      resolve({ error: "timeout" });
    }, 10000);
  });
}

export function startHealthTracking() {
  return postToApp("START_HEALTH_TRACKING");
}

export function stopHealthTracking() {
  return new Promise((resolve) => {
    const unsub = onceFromApp("HEALTH_SESSION_SUMMARY", (p) => resolve(p || {}));
    if (!postToApp("STOP_HEALTH_TRACKING")) {
      unsub?.();
      resolve({ error: "not_in_webview" });
    }
    setTimeout(() => {
      unsub?.();
      resolve({ error: "timeout" });
    }, 8000);
  });
}

/* ── Firestore ── */

export async function savePlayerSession({ playerId, summary, matchId = null, note = "" }) {
  if (!playerId || !summary) throw new Error("playerId/summary required");
  const doc = {
    playerId: String(playerId),
    matchId: matchId ? String(matchId) : null,
    source: summary.source || "unknown",
    startedAt: summary.period?.startTime || null,
    endedAt: summary.period?.endTime || null,
    avgHeartRate: summary.avgHeartRate ?? null,
    maxHeartRate: summary.maxHeartRate ?? null,
    minHeartRate: summary.minHeartRate ?? null,
    totalCalories: summary.totalCalories ?? 0,
    heartRateSamples: Array.isArray(summary.heartRateSamples)
      ? summary.heartRateSamples.slice(-100)
      : [],
    note: note || "",
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, COL), doc);
  return ref.id;
}

export async function listPlayerSessions(playerId, max = 10) {
  if (!playerId) return [];
  try {
    const q = query(
      collection(db, COL),
      where("playerId", "==", String(playerId)),
      orderBy("createdAt", "desc"),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    // fallback without orderBy (인덱스 부재)
    const q2 = query(
      collection(db, COL),
      where("playerId", "==", String(playerId)),
      limit(max)
    );
    const snap = await getDocs(q2);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return list.sort((a, b) => {
      const ta = a.createdAt?.seconds || 0;
      const tb = b.createdAt?.seconds || 0;
      return tb - ta;
    });
  }
}

export function formatDuration(startISO, endISO) {
  if (!startISO || !endISO) return "";
  const s = new Date(startISO).getTime();
  const e = new Date(endISO).getTime();
  if (!s || !e || e <= s) return "";
  const min = Math.round((e - s) / 60000);
  if (min < 60) return `${min}분`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분`;
}
