/* eslint-disable */
// src/services/adminDashboardService.js
// 어드민 대시보드 KPI / 집계
import { db } from "./firebase";
import {
  collection,
  getCountFromServer,
  getDocs,
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
