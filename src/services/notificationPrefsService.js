/* eslint-disable */
// src/services/notificationPrefsService.js
import { db } from "./firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

const DEFAULT_PREFS = {
  enabled: true,
  categories: {
    notice: true, // 공지사항
    chat: true, // 채팅
    teamInvite: true, // 팀 초대
    teamDecision: true, // 팀 수락/거절(참여요청 결과)
    match: true, // 매칭 알람
    player: true, // 선수등록
    team: true, // 팀등록
  },
};

function normalizePrefs(p) {
  const enabled =
    typeof p?.enabled === "boolean" ? p.enabled : DEFAULT_PREFS.enabled;

  const c = p?.categories && typeof p.categories === "object" ? p.categories : {};
  const categories = {
    notice: typeof c.notice === "boolean" ? c.notice : DEFAULT_PREFS.categories.notice,
    chat: typeof c.chat === "boolean" ? c.chat : DEFAULT_PREFS.categories.chat,
    teamInvite: typeof c.teamInvite === "boolean" ? c.teamInvite : DEFAULT_PREFS.categories.teamInvite,
    teamDecision: typeof c.teamDecision === "boolean" ? c.teamDecision : DEFAULT_PREFS.categories.teamDecision,
    match: typeof c.match === "boolean" ? c.match : DEFAULT_PREFS.categories.match,
    player: typeof c.player === "boolean" ? c.player : DEFAULT_PREFS.categories.player,
    team: typeof c.team === "boolean" ? c.team : DEFAULT_PREFS.categories.team,
  };

  return { enabled, categories };
}

export async function getMyNotificationPrefs(uid) {
  const _uid = String(uid || "").trim();
  if (!_uid) return normalizePrefs(null);

  const ref = doc(db, "users", _uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return normalizePrefs(null);

  const data = snap.data() || {};
  return normalizePrefs(data.notificationPrefs || null);
}

export async function saveMyNotificationPrefs(uid, prefs) {
  const _uid = String(uid || "").trim();
  if (!_uid) throw new Error("saveMyNotificationPrefs: uid is required");

  const normalized = normalizePrefs(prefs);

  const ref = doc(db, "users", _uid);
  await updateDoc(ref, {
    notificationPrefs: {
      ...normalized,
      updatedAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  });

  return normalized;
}

export function getDefaultNotificationPrefs() {
  return normalizePrefs(null);
}
