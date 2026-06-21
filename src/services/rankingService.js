// src/services/rankingService.js
/* eslint-disable */

import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  limit,
  startAfter,
  orderBy,
} from "firebase/firestore";

function positionLabel(pos) {
  const p = String(pos || "").trim();
  if (p === "guard") return "가드";
  if (p === "forward") return "포워드";
  if (p === "center") return "센터";
  return "";
}

function logJson(label, obj) {
  try {
    console.log(label, JSON.stringify(obj, null, 2));
  } catch (e) {
    console.log(label, obj);
  }
}

function toNum(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function normalizeRecentResult(x) {
  const v = String(x || "").toLowerCase();
  if (v === "w" || v === "win") return "W";
  if (v === "l" || v === "lose") return "L";
  if (v === "d" || v === "draw") return "D";
  return null;
}

function getRecentFormsFromStats(stats) {
  const src =
    (Array.isArray(stats?.recentForms) && stats.recentForms) ||
    (Array.isArray(stats?.recentResults) && stats.recentResults) ||
    [];
  return src.map(normalizeRecentResult).filter(Boolean).slice(0, 5);
}

function calcWinRatePercent({ wins, losses, draws }) {
  const w = toNum(wins, 0);
  const l = toNum(losses, 0);
  const d = toNum(draws, 0);
  const total = w + l + d;
  if (total <= 0) return 0;
  return Math.round((w / total) * 100);
}

function calcPoints({ wins, losses, draws }) {
  const w = toNum(wins, 0);
  const l = toNum(losses, 0);
  const d = toNum(draws, 0);
  return w * 5 + d * 2 + l * 1;
}

function normalizeUserRow(d) {
  const data = d.data() || {};
  const stats = (data.stats && typeof data.stats === "object") ? data.stats : {};

  const wins = toNum(stats.wins, 0);
  const losses = toNum(stats.losses, 0);
  const draws = toNum(stats.draws, 0);

  return {
    userId: d.id,
    uid: d.id,
    nickname: String(data.nickname || "").trim(),
    avatarUrl: data.avatarUrl || "",
    mainPosition: data.mainPosition || "",
    positionLabel: positionLabel(data.mainPosition),
    heightCm: data.heightCm ?? null,
    weightKg: data.weightKg ?? null,
    activeTeamId: String(data.activeTeamId || "").trim(),
    isTeamCaptain: data.isTeamCaptain === true,

    // ✅ 경기 스탯(원천)
    wins,
    losses,
    draws,
    recentForms: getRecentFormsFromStats(stats),
  };
}

/**
 * players list page
 * - 1차 정렬: stats.wins desc (홈 Top과 동일한 후보 풀)
 * - 화면 표시 정렬은 프론트에서 점수 기반으로 재정렬
 */
export async function listPlayerRankingPage({
  pageSize = 30,
  cursor = null,
  debugLog = false,
} = {}) {
  const usersCol = collection(db, "users");

  const qy = cursor
    ? query(usersCol, orderBy("stats.wins", "desc"), startAfter(cursor), limit(pageSize))
    : query(usersCol, orderBy("stats.wins", "desc"), limit(pageSize));

  const snap = await getDocs(qy);

  const users = [];
  snap.forEach((d) => users.push(normalizeUserRow(d)));

  const nextCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;

  // 팀 메타(클럽명/로고) 붙이기
  const clubIds = Array.from(new Set(users.map((u) => u.activeTeamId).filter(Boolean)));

  const clubMap = {};
  await Promise.all(
    clubIds.map(async (cid) => {
      try {
        const cs = await getDoc(doc(db, "clubs", cid));
        if (!cs.exists()) return;
        const c = cs.data() || {};
        clubMap[cid] = {
          clubId: cid,
          name: String(c.name || "").trim(),
          logoUrl: c.logoUrl || "",
        };
      } catch (e) {}
    })
  );

  const rows = users.map((u) => {
    const club = u.activeTeamId ? clubMap[u.activeTeamId] : null;

    return {
      rank: null,
      userId: u.userId,
      nickname: u.nickname || "사용자",
      name: u.nickname || "사용자",
      avatarUrl: u.avatarUrl || "",
      mainPosition: u.mainPosition || "",
      positionLabel: u.positionLabel || "",
      isTeamCaptain: u.isTeamCaptain === true,
      heightCm: u.heightCm,
      weightKg: u.weightKg,
      clubId: u.activeTeamId || "",
      clubName: club?.name || "",
      clubLogoUrl: club?.logoUrl || "",

      // ✅ 화면/정렬/점수 계산에 쓰임
      wins: toNum(u.wins, 0),
      losses: toNum(u.losses, 0),
      draws: toNum(u.draws, 0),
      recentForms: Array.isArray(u.recentForms) ? u.recentForms : [],
    };
  });

  if (debugLog) {
    logJson("[rankingService] rows(sample)", rows.slice(0, 2));
    logJson("[rankingService] clubIds", clubIds);
  }

  return { rows, nextCursor };
}

/**
 * ✅ 전체 선수 랭킹을 계산해 userId → 등수(1부터) Map 으로 반환
 * - PlayerRankingFullPage 와 동일한 정렬 기준(점수→승률→승수→경기수→이름)
 * - 프로필 상세 등에서 단일 선수의 전역 순위 조회용
 */
export async function getPlayerRankMap({ debugLog = false } = {}) {
  const usersCol = collection(db, "users");
  const snap = await getDocs(usersCol);

  const enriched = [];
  snap.forEach((d) => {
    const u = normalizeUserRow(d);
    const wins = toNum(u.wins, 0);
    const losses = toNum(u.losses, 0);
    const draws = toNum(u.draws, 0);
    enriched.push({
      userId: u.userId,
      name: u.nickname || "사용자",
      wins,
      _points: calcPoints({ wins, losses, draws }),
      _winRate: calcWinRatePercent({ wins, losses, draws }),
      _total: wins + losses + draws,
    });
  });

  const sorted = enriched.sort((a, b) => {
    if (b._points !== a._points) return b._points - a._points;
    if (b._winRate !== a._winRate) return b._winRate - a._winRate;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b._total !== a._total) return b._total - a._total;
    const na = String(a.name || "").toLowerCase();
    const nb = String(b.name || "").toLowerCase();
    if (na === nb) return 0;
    return na > nb ? 1 : -1;
  });

  const map = new Map();
  sorted.forEach((u, idx) => {
    if (u.userId) map.set(u.userId, idx + 1);
  });

  if (debugLog) {
    console.log("[rankingService] getPlayerRankMap size:", map.size);
  }

  return map;
}

/**
 * ✅ 홈 전용: "근사 Top5" (rankingScore 저장 없이)
 * - 후보를 wins 내림차순으로 candidateSize만 뽑고
 * - 점수(승*5 + 무*2 + 패*1) 계산해서 Top N 반환
 * - 정확 Top5 보장은 아니지만, 홈 섹션용으로 “그럴듯한” Top을 빠르게 만든다.
 */
export async function listPlayerRankingTopApprox({
  top = 5,
  candidateSize = 200,
  debugLog = false,
} = {}) {
  const usersCol = collection(db, "users");

  // ✅ wins 기반 후보군 확보(단일 필드 orderBy → 보통 인덱스 추가 없이 동작)
  const qy = query(usersCol, orderBy("stats.wins", "desc"), limit(candidateSize));
  const snap = await getDocs(qy);

  const users = [];
  snap.forEach((d) => users.push(normalizeUserRow(d)));

  // 팀 메타(클럽명/로고) 붙이기
  const clubIds = Array.from(new Set(users.map((u) => u.activeTeamId).filter(Boolean)));

  const clubMap = {};
  await Promise.all(
    clubIds.map(async (cid) => {
      try {
        const cs = await getDoc(doc(db, "clubs", cid));
        if (!cs.exists()) return;
        const c = cs.data() || {};
        clubMap[cid] = {
          clubId: cid,
          name: String(c.name || "").trim(),
          logoUrl: c.logoUrl || "",
        };
      } catch (e) {}
    })
  );

  const enriched = users.map((u) => {
    const club = u.activeTeamId ? clubMap[u.activeTeamId] : null;

    const wins = toNum(u.wins, 0);
    const losses = toNum(u.losses, 0);
    const draws = toNum(u.draws, 0);

    const points = calcPoints({ wins, losses, draws });
    const winRate = calcWinRatePercent({ wins, losses, draws });
    const total = wins + losses + draws;

    return {
      userId: u.userId,
      nickname: u.nickname || "사용자",
      name: u.nickname || "사용자",
      avatarUrl: u.avatarUrl || "",
      mainPosition: u.mainPosition || "",
      positionLabel: u.positionLabel || "",
      isTeamCaptain: u.isTeamCaptain === true,
      heightCm: u.heightCm,
      weightKg: u.weightKg,
      clubId: u.activeTeamId || "",
      clubName: club?.name || "",
      clubLogoUrl: club?.logoUrl || "",
      wins,
      losses,
      draws,
      recentForms: Array.isArray(u.recentForms) ? u.recentForms : [],
      _points: points,
      _winRate: winRate,
      _total: total,
    };
  });

  // ✅ 점수 > 승률 > 승수 > 경기수 > 이름
  const sorted = [...enriched].sort((a, b) => {
    if (b._points !== a._points) return b._points - a._points;
    if (b._winRate !== a._winRate) return b._winRate - a._winRate;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b._total !== a._total) return b._total - a._total;

    const na = String(a.name || "").toLowerCase();
    const nb = String(b.name || "").toLowerCase();
    if (na === nb) return 0;
    return na > nb ? 1 : -1;
  });

  const topRows = sorted.slice(0, Math.max(0, Number(top) || 0)).map((r, idx) => ({
    ...r,
    rank: idx + 1,
  }));

  if (debugLog) {
    logJson("[rankingService][topApprox] topRows", topRows);
  }

  // 내부 정렬필드 제거
  return topRows.map(({ _points, _winRate, _total, ...rest }) => rest);
}
