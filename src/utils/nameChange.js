// src/utils/nameChange.js
// 팀 이름 / 사용자 닉네임 변경 쿨다운 (한번 정하면 3개월 뒤 변경 가능)

export const NAME_CHANGE_COOLDOWN_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

// Firestore Timestamp / {seconds} / Date / number(ms) → ms
export function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

/**
 * 이름 변경 가능 여부 계산
 * @param lastChangedAt 마지막으로 이름을 정한 시각 (Timestamp 등)
 * @returns { locked, remainingDays, availableAtMs }
 */
export function getNameChangeStatus(lastChangedAt, nowMs = Date.now()) {
  const last = toMillis(lastChangedAt);
  if (!last) return { locked: false, remainingDays: 0, availableAtMs: 0 };

  const availableAtMs = last + NAME_CHANGE_COOLDOWN_DAYS * DAY_MS;
  const locked = nowMs < availableAtMs;
  const remainingDays = locked ? Math.ceil((availableAtMs - nowMs) / DAY_MS) : 0;

  return { locked, remainingDays, availableAtMs };
}
