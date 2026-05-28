/* eslint-disable */
// src/services/gamesService.js
// ✅ Firestore games 컬렉션에서 "오늘(한국시간) 농구 경기"만 가져오기
// - KST 날짜키 계산 버그(9시간 2번 보정) 수정
// - where(date==today) + where(sport==basketball) + limit
// - 클라에서 startAtMs 기준 정렬

import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "./firebase";

function kstTodayKey() {
  // ✅ KST 기준 "오늘" YYYY-MM-DD (보정 1번만)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toMillisAny(tsLike) {
  if (!tsLike) return 0;
  if (typeof tsLike?.toMillis === "function") return tsLike.toMillis();
  if (typeof tsLike?.seconds === "number") return tsLike.seconds * 1000;
  return 0;
}

export async function listTodayBasketballGames({
  leagues = ["kbl", "nba"],
  limitCount = 120,
} = {}) {
  const todayKey = kstTodayKey();

  const col = collection(db, "games");

  const q = query(
    col,
    where("date", "==", todayKey),
    where("sport", "==", "basketball"),
    limit(Math.max(1, safeNum(limitCount, 120)))
  );

  const snap = await getDocs(q);

  const rows = snap.docs.map((doc) => {
    const d = doc.data() || {};
    const startAtMs = safeNum(d?.startAtMs, 0) || toMillisAny(d?.startAt);

    return {
      id: doc.id,
      ...d,
      startAtMs,
    };
  });

  const normalizedLeagues = Array.isArray(leagues)
    ? leagues.map((x) => String(x || "").toLowerCase().trim()).filter(Boolean)
    : [];

  const filtered =
    normalizedLeagues.length > 0
      ? rows.filter((g) =>
          normalizedLeagues.includes(String(g?.league || "").toLowerCase().trim())
        )
      : rows;

  filtered.sort((a, b) => safeNum(a?.startAtMs, 0) - safeNum(b?.startAtMs, 0));

  return { ok: true, dateKey: todayKey, games: filtered };
}
