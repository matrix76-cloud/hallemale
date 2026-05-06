/* eslint-disable */
// src/services/adminGamesService.js
// 어드민 - 예정된 경기 / 지난 경기 목록 (match_requests 기반)
import { db } from "./firebase";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

/* ================= helpers ================= */
function toStr(v) {
  return String(v || "").trim();
}

function toDate(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function fmtKstWhen(dt) {
  const d = toDate(dt);
  if (!d) return "-";
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const tmr = new Date(today);
  tmr.setDate(tmr.getDate() + 1);
  const isTmr =
    d.getFullYear() === tmr.getFullYear() &&
    d.getMonth() === tmr.getMonth() &&
    d.getDate() === tmr.getDate();

  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());

  if (isToday) return `오늘 ${hh}:${mm}`;
  if (isTmr) return `내일 ${hh}:${mm}`;

  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

function fmtRelative(dt) {
  const d = toDate(dt);
  if (!d) return "-";
  const now = Date.now();
  const ms = now - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (ms < 0) return fmtKstWhen(dt);
  if (ms < 60 * 1000) return "방금 전";
  if (ms < 60 * 60 * 1000) return `${Math.floor(ms / (60 * 1000))}분 전`;
  if (ms < day) {
    const h = Math.floor(ms / (60 * 60 * 1000));
    return h === 0 ? "오늘" : `${h}시간 전`;
  }
  const days = Math.floor(ms / day);
  if (days === 1) return "어제";
  if (days < 30) return `${days}일 전`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `${mo}개월 전`;
  return `${Math.floor(mo / 12)}년 전`;
}

function pickRegionSido(team, field) {
  return (
    toStr(team?.regionSido) ||
    toStr(field?.regionSido) ||
    toStr((team?.region || "").split(" ")[0]) ||
    ""
  );
}

function pickPlace(field, team) {
  const addr = toStr(field?.address);
  if (addr) return addr;
  const region = toStr(team?.region);
  return region || "";
}

function pickMatchSize(data = {}) {
  const m =
    toStr(data?.matchSize) ||
    toStr(data?.fromLineupSnapshot?.matchSize) ||
    toStr(data?.toLineupSnapshot?.matchSize) ||
    toStr(data?.fromLineupSnapshot?.size) ||
    toStr(data?.toLineupSnapshot?.size);
  return m;
}

function regionToSidoKey(s) {
  const v = toStr(s);
  if (!v) return "";
  if (v.startsWith("서울")) return "서울";
  if (v.startsWith("경기")) return "경기";
  if (v.startsWith("인천")) return "인천";
  if (v.startsWith("부산")) return "부산";
  if (v.startsWith("대구")) return "대구";
  if (v.startsWith("광주")) return "광주";
  if (v.startsWith("대전")) return "대전";
  if (v.startsWith("울산")) return "울산";
  if (v.startsWith("세종")) return "세종";
  if (v.startsWith("강원")) return "강원";
  if (v.startsWith("충북")) return "충북";
  if (v.startsWith("충남")) return "충남";
  if (v.startsWith("전북")) return "전북";
  if (v.startsWith("전남")) return "전남";
  if (v.startsWith("경북")) return "경북";
  if (v.startsWith("경남")) return "경남";
  if (v.startsWith("제주")) return "제주";
  return v;
}

function mapDoc(d) {
  const data = d.data() || {};
  const fromTeam = data?.fromTeamSnapshot || {};
  const toTeam = data?.toTeamSnapshot || {};
  const field = data?.field || {};

  const home = {
    clubId: toStr(fromTeam?.clubId || fromTeam?.id),
    name: toStr(fromTeam?.name) || "팀",
    logoUrl: toStr(fromTeam?.logoUrl || ""),
  };
  const away = {
    clubId: toStr(toTeam?.clubId || toTeam?.id),
    name: toStr(toTeam?.name) || "팀",
    logoUrl: toStr(toTeam?.logoUrl || ""),
  };

  const place = pickPlace(field, fromTeam) || pickPlace(field, toTeam);
  const regionSido =
    pickRegionSido(fromTeam, field) || pickRegionSido(toTeam, field);

  return {
    id: d.id,
    status: toStr(data?.status),
    scheduledAt: toDate(data?.scheduledAt),
    acceptedAt: toDate(data?.acceptedAt),
    createdAt: toDate(data?.createdAt),
    updatedAt: toDate(data?.updatedAt),
    home,
    away,
    place,
    regionSido: regionToSidoKey(regionSido),
    matchSize: pickMatchSize(data),
    actorScore: data?.myScore ?? null,
    targetScore: data?.oppScore ?? null,
  };
}

function matchKeyword(row, keyword) {
  const k = toStr(keyword).toLowerCase();
  if (!k) return true;
  const hay = `${row.home.name} ${row.away.name} ${row.place} ${row.matchSize}`.toLowerCase();
  return hay.includes(k);
}

function matchRegion(row, regionSido) {
  if (!regionSido || regionSido === "all") return true;
  return row.regionSido === regionSido;
}

/* ================= public API ================= */

/**
 * 예정된 경기: status === "accepted" 이고 결과 미등록
 * - 정렬: scheduledAt asc (가까운 순), 없으면 acceptedAt 기준
 */
export async function fetchAdminUpcomingGames({
  keyword = "",
  regionSido = "all",
  limitCount = 200,
} = {}) {
  const col = collection(db, "match_requests");
  const q1 = query(col, where("status", "==", "accepted"), limit(limitCount));
  const snap = await getDocs(q1);
  const docs = snap?.docs || [];

  const rows = docs.map(mapDoc);

  rows.sort((a, b) => {
    const ta = a.scheduledAt ? a.scheduledAt.getTime() : a.acceptedAt?.getTime() || 0;
    const tb = b.scheduledAt ? b.scheduledAt.getTime() : b.acceptedAt?.getTime() || 0;
    if (ta === tb) return 0;
    return ta - tb;
  });

  const display = rows.map((r) => ({
    ...r,
    when: fmtKstWhen(r.scheduledAt || r.acceptedAt || r.updatedAt),
  }));

  const filtered = display.filter(
    (r) => matchKeyword(r, keyword) && matchRegion(r, regionSido)
  );

  return { rows: display, filtered };
}

/**
 * 지난 경기: status === "finished"
 * - 정렬: updatedAt desc (최신 완료순)
 */
export async function fetchAdminPastGames({
  keyword = "",
  regionSido = "all",
  limitCount = 200,
} = {}) {
  const col = collection(db, "match_requests");
  const q1 = query(
    col,
    where("status", "==", "finished"),
    orderBy("updatedAt", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q1);
  const docs = snap?.docs || [];

  const rows = docs.map(mapDoc);

  const display = rows.map((r) => {
    const a = Number.isFinite(Number(r.actorScore)) ? Number(r.actorScore) : null;
    const t = Number.isFinite(Number(r.targetScore)) ? Number(r.targetScore) : null;
    const score = a != null && t != null ? `${a} : ${t}` : "-";
    return {
      ...r,
      when: fmtRelative(r.updatedAt || r.scheduledAt),
      score,
    };
  });

  const filtered = display.filter(
    (r) => matchKeyword(r, keyword) && matchRegion(r, regionSido)
  );

  return { rows: display, filtered };
}
