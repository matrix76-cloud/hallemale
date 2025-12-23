/* eslint-disable */
// src/services/adminTeamsService.js
import { db } from "./firebase";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  documentId,
} from "firebase/firestore";

/* ================= helpers ================= */

function toDate(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ymdToDate(s) {
  const v = String(s || "").trim();
  if (!v) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeText(s) {
  return String(s || "").trim().toLowerCase();
}

function safeNumber(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function pickMediaCreatedAt(m) {
  const d = toDate(m?.createdAt);
  return d ? d.getTime() : null;
}

function getMediaCounts(media = []) {
  const list = Array.isArray(media) ? media : [];
  const total = list.length;
  let images = 0;
  let youtube = 0;

  for (const m of list) {
    const t = String(m?.type || "").toLowerCase();
    if (t === "image") images += 1;
    else if (t === "youtube") youtube += 1;
  }

  let lastAtMs = null;
  for (const m of list) {
    const ms = pickMediaCreatedAt(m);
    if (ms && (!lastAtMs || ms > lastAtMs)) lastAtMs = ms;
  }

  return { total, images, youtube, lastAtMs };
}

function daysBetween(now, past) {
  if (!now || !past) return null;
  const diff = now.getTime() - past.getTime();
  const days = Math.floor(diff / 86400000);
  return days < 0 ? 0 : days;
}

async function mapWithConcurrency(items, limitCount, mapper) {
  const arr = Array.isArray(items) ? items : [];
  const limitN = Math.max(1, Number(limitCount) || 6);
  const results = new Array(arr.length);

  let idx = 0;

  async function worker() {
    while (true) {
      const current = idx;
      idx += 1;
      if (current >= arr.length) return;
      try {
        results[current] = await mapper(arr[current], current);
      } catch (e) {
        results[current] = null;
      }
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(limitN, arr.length); i += 1) workers.push(worker());
  await Promise.all(workers);

  return results;
}

/* ✅ getCountFromServer lazy import */
let _getCountFromServer = null;
let _countApiLoaded = false;

async function ensureCountApi() {
  if (_countApiLoaded) return;
  _countApiLoaded = true;
  try {
    const mod = await import("firebase/firestore");
    _getCountFromServer = mod?.getCountFromServer || null;
  } catch (e) {
    _getCountFromServer = null;
  }
}

/* ✅ members count = clubs/{clubId}/members count */
export async function getMembersCount(clubId) {
  const id = String(clubId || "").trim();
  if (!id) return 0;

  await ensureCountApi();

  const membersCol = collection(db, "clubs", id, "members");

  if (_getCountFromServer) {
    try {
      const snap = await _getCountFromServer(membersCol);
      return safeNumber(snap?.data()?.count, 0);
    } catch (e) {}
  }

  const docs = await getDocs(membersCol);
  return safeNumber(docs.size, 0);
}

/* ✅ users/{uid} 배치 조회 (ownerUid → 닉네임) */
async function fetchUserNamesByUids(uids = []) {
  const uniq = Array.from(new Set((uids || []).map((x) => String(x || "").trim()).filter(Boolean)));
  if (!uniq.length) return {};

  const map = {};
  const usersCol = collection(db, "users");

  const chunkSize = 10;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    try {
      const q1 = query(usersCol, where(documentId(), "in", chunk));
      const snap = await getDocs(q1);
      snap.forEach((d) => {
        const v = d.data() || {};
        const uid = d.id;
        const name =
          String(v.nickname || "").trim() ||
          String(v.name || "").trim() ||
          String(v.displayName || "").trim() ||
          "";
        map[uid] = name;
      });
    } catch (e) {}
  }

  return map;
}

/* ================= firestore loaders ================= */

export async function listRecentClubs({ limitCount = 200 } = {}) {
  const q1 = query(
    collection(db, "clubs"),
    orderBy("updatedAt", "desc"),
    limit(Math.min(Math.max(limitCount, 1), 300))
  );

  const snap = await getDocs(q1);
  const list = [];
  snap.forEach((d) => {
    const v = d.data() || {};
    list.push({
      id: d.id,
      clubId: d.id,
      ...v,
    });
  });
  return list;
}

export async function getPendingJoinRequestsCountForClub({ clubId, maxScan = 500 } = {}) {
  const id = String(clubId || "").trim();
  if (!id) return 0;

  const col = collection(db, "clubs", id, "joinRequests");
  const q1 = query(col, where("status", "==", "pending"), limit(Math.min(Math.max(maxScan, 1), 1000)));

  try {
    const snap = await getDocs(q1);
    return Number.isFinite(snap.size) ? snap.size : 0;
  } catch (e) {
    return 0;
  }
}

/**
 * ✅ Admin Teams list view helper
 * - 최근 N개 가져와서 클라 필터
 * - membersCount / pendingJoinRequestsCount를 병렬 제한으로 계산
 * - ownerUid → ownerName 배치 맵핑
 */
export async function fetchTeamsAdminView({
  limitCount = 200,
  keyword = "",
  regionSido = "all",
  dateFrom = "",
  dateTo = "",
} = {}) {
  const rows = await listRecentClubs({ limitCount });

  const k = normalizeText(keyword);
  const from = ymdToDate(dateFrom);
  const to = ymdToDate(dateTo);
  const toEnd = to ? new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1) : null;

  const filteredBase = rows.filter((r) => {
    if (regionSido && regionSido !== "all") {
      if (String(r.regionSido || "").trim() !== regionSido) return false;
    }

    const cd = toDate(r.createdAt);
    if (from && (!cd || cd < from)) return false;
    if (toEnd && (!cd || cd > toEnd)) return false;

    if (k) {
      const name = normalizeText(r.name);
      const region = normalizeText(r.region);
      const tags = Array.isArray(r.tags) ? r.tags.map(normalizeText).join(" ") : "";
      const hay = `${name} ${region} ${tags}`;
      if (!hay.includes(k)) return false;
    }

    return true;
  });

  // ✅ 팀장 이름 배치 조회
  const ownerUids = filteredBase.map((r) => String(r.ownerUid || "").trim()).filter(Boolean);
  const ownerNameMap = await fetchUserNamesByUids(ownerUids);

  // ✅ 멤버수 + 승인대기 동시에 병렬 제한 처리
  const countPairs = await mapWithConcurrency(
    filteredBase,
    10,
    async (club) => {
      const clubId = club.id || club.clubId || "";
      const [membersCount, pendingCount] = await Promise.all([
        getMembersCount(clubId),
        getPendingJoinRequestsCountForClub({ clubId }),
      ]);
      return {
        membersCount: safeNumber(membersCount, 0),
        pendingCount: safeNumber(pendingCount, 0),
      };
    }
  );

  const now = new Date();

  const filtered = filteredBase.map((r, idx) => {
    const mediaStat = getMediaCounts(r.media || []);
    const createdAt = toDate(r.createdAt);
    const updatedAt = toDate(r.updatedAt);
    const daysSinceUpdated = updatedAt ? daysBetween(now, updatedAt) : null;

    const wins = Number(r?.stats?.wins) || 0;
    const draws = Number(r?.stats?.draws) || 0;
    const losses = Number(r?.stats?.losses) || 0;
    const totalMatches = Number(r?.stats?.totalMatches) || 0;
    const winRate = typeof r?.stats?.winRate === "number" ? r.stats.winRate : 0;

    const ownerUid = String(r.ownerUid || "").trim();
    const ownerName = ownerUid ? String(ownerNameMap[ownerUid] || "").trim() : "";

    const regionShort = `${String(r.regionSido || "").trim()}${r.regionGu ? ` / ${String(r.regionGu).trim()}` : ""}`.trim();
    const hasPromo = !!r?.promo?.usePromoText && String(r?.promo?.promoText || "").trim().length > 0;
    const hasLogo = !!String(r.logoUrl || "").trim();

    const mediaBreakdown = `img:${mediaStat.images} yt:${mediaStat.youtube}`;
    const lastMediaAt = mediaStat.lastAtMs ? new Date(mediaStat.lastAtMs) : null;

    const pair = countPairs[idx] || { membersCount: 0, pendingCount: 0 };

    return {
      ...r,

      ownerName,
      // ✅ 표시 SSOT: 서브컬렉션 카운트 결과
      memberCountValue: safeNumber(pair.membersCount, 0),
      pendingJoinRequestsCount: safeNumber(pair.pendingCount, 0),

      regionShort,
      hasPromo,
      hasLogo,

      mediaTotal: mediaStat.total,
      mediaImages: mediaStat.images,
      mediaYoutube: mediaStat.youtube,
      mediaBreakdown,
      lastMediaAt,
      daysSinceUpdated,

      recordText: `${wins}-${draws}-${losses}`,
      winRatePct: `${Math.round(winRate * 100)}%`,
      totalMatches,
    };
  });

  return { rows, filtered };
}
