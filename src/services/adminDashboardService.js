/* eslint-disable */
// src/services/adminDashboardService.js
// 어드민 대시보드 KPI / 집계
import { db } from "./firebase";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  Timestamp,
} from "firebase/firestore";

/* ============== helpers ============== */
function startOfTodayKst() {
  // KST(UTC+9) 자정을 UTC Date로 환산
  const now = new Date();
  // 현재 KST 기준 연/월/일 추출
  const utcMs = now.getTime();
  const kstMs = utcMs + 9 * 60 * 60 * 1000;
  const kstDate = new Date(kstMs);
  const y = kstDate.getUTCFullYear();
  const m = kstDate.getUTCMonth();
  const d = kstDate.getUTCDate();
  // KST 자정 = UTC 전날 15:00
  return new Date(Date.UTC(y, m, d, -9, 0, 0));
}

async function safeCount(qq) {
  try {
    const s = await getCountFromServer(qq);
    return s.data().count || 0;
  } catch (e) {
    // count() 인덱스가 없을 때 fallback: getDocs (작은 컬렉션 대상에서만 안전)
    try {
      const snap = await getDocs(qq);
      return snap.size || 0;
    } catch {
      return 0;
    }
  }
}

/* ============== matches ============== */
function pad2(n) {
  return String(n).padStart(2, "0");
}
function toJsDate(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function startOfDayKstFor(ms) {
  const kstMs = ms + 9 * 60 * 60 * 1000;
  const k = new Date(kstMs);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), -9, 0, 0));
}
function fmtHm(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function fmtRelativePast(d) {
  const ms = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (ms < 0) return fmtHm(d);
  if (ms < 60 * 60 * 1000) return `${Math.max(1, Math.floor(ms / 60000))}분 전`;
  if (ms < day) return `${Math.floor(ms / (60 * 60 * 1000))}시간 전`;
  const days = Math.floor(ms / day);
  if (days === 1) return "어제";
  return `${days}일 전`;
}
function fmtFutureWhen(d) {
  const today = startOfDayKstFor(Date.now());
  const target = startOfDayKstFor(d.getTime());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  const hm = fmtHm(d);
  if (diffDays === 0) return hm;
  if (diffDays === 1) return `내일 ${hm}`;
  if (diffDays > 1) return `D+${diffDays} ${hm}`;
  return hm;
}
function pickPlace(field, fromTeam, toTeam) {
  const addr = String(field?.address || "").trim();
  if (addr) return addr;
  return String(fromTeam?.region || toTeam?.region || "").trim();
}
function pickMatchSize(data) {
  return (
    String(data?.matchSize || "").trim() ||
    String(data?.fromLineupSnapshot?.matchSizeKey || "").trim() ||
    String(data?.toLineupSnapshot?.matchSizeKey || "").trim() ||
    ""
  );
}
function buildMeta(data) {
  const place = pickPlace(data?.field, data?.fromTeamSnapshot, data?.toTeamSnapshot);
  const size = pickMatchSize(data);
  return [place, size].filter(Boolean).join(" · ");
}
function buildTeamsText(data) {
  const a = String(data?.fromTeamSnapshot?.name || "팀A").trim();
  const b = String(data?.toTeamSnapshot?.name || "팀B").trim();
  return `${a} vs ${b}`;
}

/**
 * 대시보드 매치 카드 — 오늘 예정 / 지난 7일 / 앞으로 7일
 */
export async function fetchAdminDashboardMatches() {
  const now = Date.now();
  const startToday = startOfDayKstFor(now);
  const endToday = new Date(startToday.getTime() + 24 * 60 * 60 * 1000);
  const start7Past = new Date(startToday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const end7Future = new Date(startToday.getTime() + 8 * 24 * 60 * 60 * 1000);

  const col = collection(db, "match_requests");

  const [acceptedSnap, finishedSnap] = await Promise.all([
    getDocs(query(col, where("status", "==", "accepted"), limit(200))).catch(
      () => null
    ),
    getDocs(
      query(
        col,
        where("status", "==", "finished"),
        orderBy("updatedAt", "desc"),
        limit(50)
      )
    ).catch(() => null),
  ]);

  const today = [];
  const next7days = [];
  if (acceptedSnap) {
    for (const d of acceptedSnap.docs) {
      const data = d.data() || {};
      const sched = toJsDate(data?.scheduledAt);
      if (!sched) continue;
      const t = sched.getTime();
      const row = {
        time: "",
        teams: buildTeamsText(data),
        meta: buildMeta(data),
        status: "scheduled",
        statusLabel: "예정",
      };
      if (t >= startToday.getTime() && t < endToday.getTime()) {
        row.time = fmtHm(sched);
        today.push({ _t: t, ...row });
      } else if (t >= endToday.getTime() && t < end7Future.getTime()) {
        row.time = fmtFutureWhen(sched);
        next7days.push({ _t: t, ...row });
      }
    }
    today.sort((a, b) => a._t - b._t);
    next7days.sort((a, b) => a._t - b._t);
  }

  const last7days = [];
  if (finishedSnap) {
    for (const d of finishedSnap.docs) {
      const data = d.data() || {};
      const upd = toJsDate(data?.updatedAt) || toJsDate(data?.scheduledAt);
      if (!upd) continue;
      if (upd.getTime() < start7Past.getTime()) continue;
      last7days.push({
        _t: upd.getTime(),
        time: fmtRelativePast(upd),
        teams: buildTeamsText(data),
        meta: buildMeta(data),
        status: "done",
        statusLabel: "완료",
      });
    }
    last7days.sort((a, b) => b._t - a._t);
  }

  const strip = (arr) =>
    arr.slice(0, 8).map(({ _t, ...rest }) => rest);
  return {
    today: strip(today),
    last7days: strip(last7days),
    next7days: strip(next7days),
  };
}

/* ============== region ============== */
const SIDO_LIST = [
  "서울","경기","인천","부산","대구","광주","대전","울산","세종",
  "강원","충북","충남","전북","전남","경북","경남","제주",
];

function normalizeSido(s) {
  const v = String(s || "").trim();
  if (!v) return "";
  for (const sido of SIDO_LIST) {
    if (v.startsWith(sido)) return sido;
  }
  return "";
}

/**
 * 지역별 팀 수 (clubs 컬렉션 regionSido 그룹핑)
 * - 17개 시도 + "기타" 합산
 */
export async function fetchAdminRegionCounts() {
  const col = collection(db, "clubs");
  const snap = await getDocs(col);
  const docs = snap?.docs || [];

  const counts = new Map();
  SIDO_LIST.forEach((s) => counts.set(s, 0));
  let etc = 0;

  for (const d of docs) {
    const data = d.data() || {};
    const sido =
      normalizeSido(data?.regionSido) ||
      normalizeSido(data?.region) ||
      normalizeSido(data?.regionFull);
    if (sido && counts.has(sido)) {
      counts.set(sido, counts.get(sido) + 1);
    } else {
      etc += 1;
    }
  }

  const rows = SIDO_LIST.map((s) => ({ key: s, label: s, count: counts.get(s) || 0 }));
  rows.push({ key: "etc", label: "기타", count: etc });
  return rows;
}

/* ============== public ============== */

/**
 * 대시보드 KPI 집계
 * - 오늘 가입자 / 오늘 신규 팀 / 오늘 매칭 신청 / 오늘 채팅방 생성
 * - 누적 finished 매치 + 승/무/패 (actor 기준)
 */
export async function fetchAdminDashboardKpi() {
  const todayStart = Timestamp.fromDate(startOfTodayKst());

  const usersCol = collection(db, "users");
  const clubsCol = collection(db, "clubs");
  const mrCol = collection(db, "match_requests");
  const chatRoomsCol = collection(db, "chatRooms");

  const [
    todaySignups,
    todayNewTeams,
    todayMatches,
    createdChatRoomsToday,
    totalFinishedSnap,
  ] = await Promise.all([
    safeCount(query(usersCol, where("createdAt", ">=", todayStart))),
    safeCount(query(clubsCol, where("createdAt", ">=", todayStart))),
    safeCount(query(mrCol, where("createdAt", ">=", todayStart))),
    safeCount(query(chatRoomsCol, where("createdAt", ">=", todayStart))),
    getDocs(query(mrCol, where("status", "==", "finished"))).catch(() => null),
  ]);

  let totalMatches = 0;
  let totalW = 0;
  let totalD = 0;
  let totalL = 0;

  if (totalFinishedSnap) {
    const docs = totalFinishedSnap.docs || [];
    totalMatches = docs.length;
    for (const d of docs) {
      const data = d.data() || {};
      const a = Number(data?.myScore);
      const t = Number(data?.oppScore);
      if (!Number.isFinite(a) || !Number.isFinite(t)) continue;
      if (a > t) totalW += 1;
      else if (a === t) totalD += 1;
      else totalL += 1;
    }
  }

  return {
    todaySignups,
    todayNewTeams,
    todayMatches,
    createdChatRoomsToday,
    totalMatches,
    totalW,
    totalD,
    totalL,
    // 승인 시스템 미구현 → 0 고정
    pendingTeamApprovals: 0,
    pendingPlayerApprovals: 0,
  };
}
