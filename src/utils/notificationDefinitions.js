/* eslint-disable */
// src/utils/notificationDefinitions.js
// ✅ Notification Registry (SSOT)
// - 알림 타입별 타겟 스코프(user/team) + prefs 카테고리 + 푸시 기본값 + 딥링크 + 필수필드 정의
// - 클라/서버(Functions)에서 동일한 key를 기준으로 payload를 검증/빌드

export const NOTI_SCOPE = Object.freeze({
  USER: "user",
  TEAM: "team",
});

/**
 * ✅ 알림이 어느 앱(사용자앱 / 구장주 워크스페이스)에 속하는지.
 * 카카오 uid는 `kakao:{id}`로 결정론적이라, 같은 계정으로 양쪽에 로그인하면 uid가 동일해진다.
 * uid만으로는 구분이 불가능하므로 알림 문서 자체에 대상 앱을 기록한다.
 */
export const NOTI_AUDIENCE = Object.freeze({
  USER: "user",
  OWNER: "owner",
});

/**
 * 알림 1건의 대상 앱을 판정한다.
 * - audience 필드가 있으면 그대로 사용 (신규 알림)
 * - 없으면 기존 신호로 추론 (이 필드가 생기기 전에 쌓인 알림)
 *   · prefsCategory === "owner"  → 구장 승인/사업자 인증 등 구장주 전용
 *   · deepLink가 "/owner"로 시작 → 구장주 워크스페이스로 보내는 알림
 *   · 그 외는 사용자앱
 */
export function resolveNotiAudience(n) {
  const explicit = toStr(n?.audience).toLowerCase();
  if (explicit === NOTI_AUDIENCE.OWNER || explicit === NOTI_AUDIENCE.USER) return explicit;

  if (toStr(n?.prefsCategory).toLowerCase() === "owner") return NOTI_AUDIENCE.OWNER;

  const link = toStr(n?.meta?.deepLink) || toStr(n?.deepLink);
  if (link.startsWith("/owner")) return NOTI_AUDIENCE.OWNER;

  return NOTI_AUDIENCE.USER;
}

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
      "matchSizeKey",
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

// 알림 배지 카테고리 — 실제 저장되는 kind 문자열을 표시용 라벨/색으로 매핑.
// 미매핑 kind는 "시스템"으로 폴백. (알림창/상세 공통 사용)
export function getNotiCategory(kind) {
  const k = String(kind || "").trim().toLowerCase();

  if (k === "notice") return { label: "공지", color: "#2563eb" };
  if (k === "event") return { label: "이벤트", color: "#2563eb" };
  if (k === "match" || k === "result") return { label: "매칭", color: "#22c55e" };
  if (k === "chat") return { label: "메시지", color: "#0ea5e9" };
  if (k === "team" || k === "teaminvite" || k === "teamdecision" || k === "player")
    return { label: "팀", color: "#7c3aed" };
  if (k.startsWith("community")) return { label: "커뮤니티", color: "#f59e0b" };
  if (k === "venue") return { label: "구장", color: "#0d9488" };
  if (k === "game_added") return { label: "경기소식", color: "#6366f1" };

  return { label: "시스템", color: "#6b7280" };
}

// 팀장 전용(팀장만 처리 가능) 매칭 알림 subType — 매칭 요청/수락/거절/취소 + 라인업·결제·결과입력 독촉.
// 팀장 → 팀원 강등 시 권한이 없으므로 알림창/배지에서 숨겨 자동 리셋한다.
export const LEADER_ONLY_MATCH_SUBTYPES = new Set([
  "matchrequest",
  "matchaccepted",
  "matchrejected",
  "matchcancelled",
  "matchlineupreminder",
  "matchpaymentreminder",
  "matchresultreminder",
]);

export function isLeaderOnlyMatchNoti(n) {
  return LEADER_ONLY_MATCH_SUBTYPES.has(String(n?.subType || "").toLowerCase());
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
    // 레지스트리 알림(매칭·채팅·팀)은 모두 사용자앱용
    audience: NOTI_AUDIENCE.USER,

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
  const sizeKey = toStr(p?.matchSizeKey);
  const sizeLabel = ["3v3", "4v4", "5v5"].includes(sizeKey) ? sizeKey.replace("v", " vs ") : "";

  if (k === "MATCH_REQUEST") {
    return {
      title: "매칭 신청 도착",
      body: `${fromTeamName || "상대 팀"}이(가) ${sizeLabel || "매칭"}을 신청했어요`,
    };
  }

  if (k === "MATCH_ACCEPTED") {
    return {
      title: "매칭 수락",
      body: `${toTeamName || "상대 팀"}이(가) 매칭을 수락했어요. 라인업을 확정해 주세요.`,
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
