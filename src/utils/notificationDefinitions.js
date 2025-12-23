/* eslint-disable */
// src/utils/notificationDefinitions.js
// ✅ Notification Registry (SSOT)
// - 알림 타입별 타겟 스코프(user/team) + prefs 카테고리 + 푸시 기본값 + 딥링크 + 필수필드 정의
// - 클라/서버(Functions)에서 동일한 key를 기준으로 payload를 검증/빌드

export const NOTI_SCOPE = Object.freeze({
  USER: "user",
  TEAM: "team",
});

export const NOTI_KIND = Object.freeze({
  MATCH: "match",
  CHAT: "chat",
  NOTICE: "notice",
  TEAM_INVITE: "teamInvite",
  TEAM_DECISION: "teamDecision",
  PLAYER: "player",
  TEAM: "team",
});

export const NOTI_PUSH_STATUS = Object.freeze({
  QUEUED: "queued",
  SENT: "sent",
  FAILED: "failed",
  SKIPPED: "skipped",
});

const toStr = (v) => String(v || "").trim();

function safeObj(v) {
  return v && typeof v === "object" ? v : null;
}

function hasPath(obj, path) {
  if (!obj || !path) return false;
  const parts = String(path).split(".");
  let cur = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return false;
    if (!(p in cur)) return false;
    cur = cur[p];
  }
  return true;
}

function getMissingFields(payload, requiredFields) {
  const p = safeObj(payload) || {};
  const missing = [];

  for (const f of requiredFields || []) {
    if (!f) continue;

    if (String(f).includes(".")) {
      if (!hasPath(p, f)) missing.push(f);
      continue;
    }

    const v = p[f];
    const isEmptyString = typeof v === "string" && toStr(v) === "";
    const isEmptyArray = Array.isArray(v) && v.length === 0;

    if (v === undefined || v === null || isEmptyString || isEmptyArray) {
      missing.push(f);
    }
  }

  return missing;
}

export const NOTIFICATION_DEFINITIONS = Object.freeze({
  /* ---------- MATCH (팀 단위) ---------- */

  MATCH_REQUEST: {
    key: "MATCH_REQUEST",
    kind: NOTI_KIND.MATCH,
    subType: "matchRequest",
    targetScope: NOTI_SCOPE.TEAM,
    prefsCategory: "match",
    pushDefault: true,
    deepLink: "/matchingmanage",
    requiredFields: [
      "matchId",
      "actorClubId",
      "targetClubId",
      "fromTeamSnapshot.name",
      "fromLineupSnapshot.id",
      "fromLineupSnapshot.name",
      "fromLineupSnapshot.matchSizeKey",
      "toLineupSnapshot.id",
      "toLineupSnapshot.name",
      "toLineupSnapshot.matchSizeKey",
    ],
  },

  MATCH_ACCEPTED: {
    key: "MATCH_ACCEPTED",
    kind: NOTI_KIND.MATCH,
    subType: "matchAccepted",
    targetScope: NOTI_SCOPE.TEAM,
    prefsCategory: "match",
    pushDefault: true,
    deepLink: "/matchingmanage",
    requiredFields: [
      "matchId",
      "actorClubId",
      "targetClubId",
      "toTeamSnapshot.name",
      "toLineupSnapshot.id",
      "toLineupSnapshot.name",
      "toLineupSnapshot.matchSizeKey",
    ],
  },

  MATCH_REJECTED: {
    key: "MATCH_REJECTED",
    kind: NOTI_KIND.MATCH,
    subType: "matchRejected",
    targetScope: NOTI_SCOPE.TEAM,
    prefsCategory: "match",
    pushDefault: true,
    deepLink: "/matchingmanage",
    requiredFields: ["matchId", "actorClubId", "targetClubId"],
  },

  MATCH_CANCELLED: {
    key: "MATCH_CANCELLED",
    kind: NOTI_KIND.MATCH,
    subType: "matchCancelled",
    targetScope: NOTI_SCOPE.TEAM,
    prefsCategory: "match",
    pushDefault: true,
    deepLink: "/matchingmanage",
    requiredFields: ["matchId", "actorClubId", "targetClubId"],
  },

  /* ---------- CHAT (개인 단위 예시) ---------- */

  CHAT_MESSAGE: {
    key: "CHAT_MESSAGE",
    kind: NOTI_KIND.CHAT,
    subType: "chatMessage",
    targetScope: NOTI_SCOPE.USER,
    prefsCategory: "chat",
    pushDefault: true,
    deepLink: "/chat",
    requiredFields: ["targetUid", "chatId", "senderSnapshot.name"],
  },

  /* ---------- TEAM INVITE / DECISION (개인 단위 예시) ---------- */

  TEAM_INVITE: {
    key: "TEAM_INVITE",
    kind: NOTI_KIND.TEAM_INVITE,
    subType: "teamInvite",
    targetScope: NOTI_SCOPE.USER,
    prefsCategory: "teamInvite",
    pushDefault: true,
    deepLink: "/invites",
    requiredFields: ["targetUid", "clubId", "clubSnapshot.name"],
  },

  TEAM_DECISION: {
    key: "TEAM_DECISION",
    kind: NOTI_KIND.TEAM_DECISION,
    subType: "teamDecision",
    targetScope: NOTI_SCOPE.USER,
    prefsCategory: "teamDecision",
    pushDefault: true,
    deepLink: "/invites",
    requiredFields: ["targetUid", "clubId", "decision"],
  },
});

export function getNotificationDef(key) {
  return NOTIFICATION_DEFINITIONS[toStr(key)] || null;
}

export function validateNotificationPayload(key, payload) {
  const def = getNotificationDef(key);
  if (!def) return `Unknown notification key: ${toStr(key)}`;

  const p = safeObj(payload) || {};

  if (def.targetScope === NOTI_SCOPE.USER && !toStr(p.targetUid)) {
    return `Notification(${def.key}) requires targetUid`;
  }

  if (def.targetScope === NOTI_SCOPE.TEAM && !toStr(p.targetClubId)) {
    return `Notification(${def.key}) requires targetClubId`;
  }

  const missing = getMissingFields(p, def.requiredFields);
  if (missing.length > 0) {
    return `Notification(${def.key}) missing fields: ${missing.join(", ")}`;
  }

  return null;
}

export function buildNotificationDoc({
  key,
  payload,
  title,
  body,
  pushEnabled,
} = {}) {
  const def = getNotificationDef(key);
  if (!def) throw new Error(`Unknown notification key: ${key}`);

  const err = validateNotificationPayload(def.key, payload);
  if (err) throw new Error(err);

  const enabled =
    typeof pushEnabled === "boolean" ? pushEnabled : def.pushDefault;

  return {
    key: def.key,
    kind: def.kind,
    subType: def.subType,
    targetScope: def.targetScope,
    prefsCategory: def.prefsCategory,
    deepLink: def.deepLink || null,

    title: toStr(title) || null,
    body: toStr(body) || null,

    readBy: {},

    push: {
      enabled,
      status: enabled ? NOTI_PUSH_STATUS.QUEUED : NOTI_PUSH_STATUS.SKIPPED,
      sentAt: null,
      failReason: null,
    },

    ...payload,
  };
}

export function buildMatchTitleBody(key, payload) {
  const k = toStr(key);
  const p = safeObj(payload) || {};

  const fromTeamName = toStr(p?.fromTeamSnapshot?.name);
  const toTeamName = toStr(p?.toTeamSnapshot?.name);
  const fromLineupName = toStr(p?.fromLineupSnapshot?.name);
  const toLineupName = toStr(p?.toLineupSnapshot?.name);

  if (k === "MATCH_REQUEST") {
    return {
      title: "매칭 신청 도착",
      body: `${fromTeamName || "상대 팀"}이(가) '${fromLineupName || "라인업"}'으로 '${toLineupName || "라인업"}'에 신청했어요`,
    };
  }

  if (k === "MATCH_ACCEPTED") {
    return {
      title: "매칭 수락",
      body: `${toTeamName || "상대 팀"}이(가) 라인업 '${toLineupName || "라인업"}'으로 수락했어요`,
    };
  }

  if (k === "MATCH_REJECTED") {
    return {
      title: "매칭 거절",
      body: `${toTeamName || "상대 팀"}이(가) 매칭을 거절했어요`,
    };
  }

  if (k === "MATCH_CANCELLED") {
    return {
      title: "매칭 취소",
      body: `${fromTeamName || "상대 팀"}이(가) 매칭 요청을 취소했어요`,
    };
  }

  return { title: null, body: null };
}
