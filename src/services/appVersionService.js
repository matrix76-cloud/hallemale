/* eslint-disable */
// src/services/appVersionService.js
// 앱 버전 체크 + 자동 새로고침 (jogunBiz 패턴)

import { db } from "./firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";

const STORAGE_KEY = "hallamaella.app.version";

export async function fetchLatestUpdate() {
  try {
    const col = collection(db, "app_updates");
    let snap;
    try {
      snap = await getDocs(query(col, orderBy("createdAt", "desc"), limit(1)));
    } catch (e) {
      snap = await getDocs(col);
    }
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!docs.length) return null;
    docs.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || +new Date(a.createdAt || 0);
      const tb = b.createdAt?.toMillis?.() || +new Date(b.createdAt || 0);
      return tb - ta;
    });
    return docs[0];
  } catch (e) {
    return null;
  }
}

export function isVersionNewer(server, local) {
  if (!server) return false;
  if (!local) return true;
  const a = String(server).split(".").map((n) => parseInt(n, 10) || 0);
  const b = String(local).split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] || 0;
    const bi = b[i] || 0;
    if (ai > bi) return true;
    if (ai < bi) return false;
  }
  return false;
}

// 캐시(Cache Storage)를 비우고 새로고침 — WebView가 오래된 화면을 다시 읽는 것 방지
async function hardReload() {
  try {
    if (typeof caches !== "undefined" && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) {}
  try {
    window.location.reload();
  } catch (e) {}
}

export async function checkAppUpdate({ onUpdate } = {}) {
  const latest = await fetchLatestUpdate();
  if (!latest?.version) return null;

  let local = null;
  try {
    local = localStorage.getItem(STORAGE_KEY);
  } catch (e) {}

  if (!local) {
    try {
      localStorage.setItem(STORAGE_KEY, latest.version);
    } catch (e) {}
    return null;
  }

  if (isVersionNewer(latest.version, local)) {
    try {
      localStorage.setItem(STORAGE_KEY, latest.version);
    } catch (e) {}
    if (typeof onUpdate === "function") {
      try { onUpdate(latest); } catch (e) {}
    }
    setTimeout(() => {
      hardReload();
    }, 1500);
    return latest;
  }

  return null;
}
