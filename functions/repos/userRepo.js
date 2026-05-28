/* eslint-disable */
// functions/repos/userRepo.js
const { getDb, getAdmin } = require("../firebaseAdmin");

function usersCol() {
  return getDb().collection("users");
}

function normalizeTokens(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const t of raw) {
    if (!t) continue;
    if (typeof t === "string") {
      if (t.trim()) out.push(t.trim());
    } else if (typeof t === "object" && typeof t.token === "string" && t.token.trim()) {
      out.push(t.token.trim());
    }
  }
  return out;
}

function buildUserInfo(snap) {
  const data = snap.data() || {};
  const fcmTokens = normalizeTokens(data.fcmTokens);
  const prefs = data.notificationPrefs || { enabled: true, categories: {} };
  return { fcmTokens, prefs };
}

/**
 * 유저 FCM 토큰 + 알림 설정 일괄 조회
 * - 반환: Map<uid, { fcmTokens: string[], prefs: object }>
 * - fcmTokens는 string[] 또는 [{token, platform}] 둘 다 string[]로 정규화
 */
async function getUsersFcmInfoBatch(uids = []) {
  const result = new Map();
  if (!Array.isArray(uids) || uids.length === 0) return result;

  const unique = [...new Set(uids)];
  const CHUNK = 100;

  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const refs = slice.map((uid) => usersCol().doc(uid));
    const docs = await getDb().getAll(...refs);

    for (const snap of docs) {
      if (!snap.exists) continue;
      result.set(snap.id, buildUserInfo(snap));
    }
  }

  return result;
}

/**
 * 전체 사용자의 FCM 토큰/설정 조회 (브로드캐스트용)
 * - 토큰이 1개 이상인 사용자만 포함
 */
async function getAllUsersFcmInfo() {
  const result = new Map();
  const snap = await usersCol().get();
  for (const doc of snap.docs) {
    const info = buildUserInfo(doc);
    if (info.fcmTokens.length === 0) continue;
    result.set(doc.id, info);
  }
  return result;
}

/**
 * 만료된 FCM 토큰 제거
 * - string/object 두 형태 모두 안전 제거 (read-modify-write)
 */
async function removeStaleToken(uid, token) {
  if (!uid || !token) return;
  const ref = usersCol().doc(uid);
  await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data() || {};
    const arr = Array.isArray(data.fcmTokens) ? data.fcmTokens : [];
    const next = arr.filter((t) => {
      if (!t) return false;
      if (typeof t === "string") return t !== token;
      if (typeof t === "object") return t.token !== token;
      return true;
    });
    if (next.length !== arr.length) {
      tx.update(ref, { fcmTokens: next });
    }
  });
}

module.exports = { getUsersFcmInfoBatch, getAllUsersFcmInfo, removeStaleToken };
