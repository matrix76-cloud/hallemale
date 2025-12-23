/* eslint-disable */
// src/services/teamRankingService.js
// ✅ 팀 랭킹 페이지 데이터 로더
// - clubs 전체를 pageSize 만큼 가져오고(커서 기반) client에서 정렬/필터는 페이지에서 처리
// - ✅ id undefined 버그 제거: 항상 snap.id 사용
// - ✅ recentResults: stats.recentResults 포함해서 내려줌

import { db } from "./firebase";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
} from "firebase/firestore";

const toStr = (v) => String(v || "").trim();

function safeNum(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function calcWinRate(stats) {
  const winRate = Number(stats?.winRate);
  if (Number.isFinite(winRate)) return winRate;

  const wins = safeNum(stats?.wins, 0);
  const losses = safeNum(stats?.losses, 0);
  const draws = safeNum(stats?.draws, 0);
  const total = safeNum(stats?.totalMatches, wins + losses + draws);
  if (total <= 0) return 0;
  return wins / total;
}

function normalizeClubDoc(clubId, data) {
  const id = toStr(clubId);
  const d = data || {};
  const stats = d.stats || {};

  const wins = safeNum(stats.wins, 0);
  const losses = safeNum(stats.losses, 0);
  const draws = safeNum(stats.draws, 0);
  const totalMatches = safeNum(stats.totalMatches, wins + losses + draws);
  const winRate = calcWinRate({ ...stats, wins, losses, draws, totalMatches });

  const recentResults = Array.isArray(stats?.recentResults) ? stats.recentResults : [];

  return {
    clubId: id,
    id,

    name: toStr(d.name),
    description: toStr(d.description),
    region: toStr(d.region),
    regionSido: toStr(d.regionSido),
    regionGu: toStr(d.regionGu),

    logoUrl: d.logoUrl || "",
    logoPath: d.logoPath || "",

    stats: {
      wins,
      losses,
      draws,
      totalMatches,
      winRate,
      recentResults, // ✅ 이거 필수
      updatedAt: stats?.updatedAt || null,
    },

    // ✅ 페이지 안전망(원하면 페이지에서 여기로도 읽을 수 있게)
    recentResults,

    createdAt: d.createdAt || null,
    updatedAt: d.updatedAt || null,
  };
}

/**
 * ✅ 팀 랭킹 페이지네이션 로더
 * @param {number} pageSize
 * @param {string|null} cursor  // 직전 마지막 docId
 */
export async function listTeamRankingPage({ pageSize = 30, cursor = null, debugLog = false } = {}) {
  const col = collection(db, "clubs");

  // ✅ 커서 기반: createdAt 기준(없으면 docId 기준으로도 가능하지만, 우선 createdAt으로 통일)
  // createdAt 인덱스 없으면 콘솔 링크 뜸
  const base = [
    col,
    orderBy("createdAt", "desc"),
    limit(Math.min(Math.max(pageSize, 1), 50)),
  ];

  let q1 = null;

  if (cursor) {
    // cursor는 "마지막 docId"
    // startAfter는 DocumentSnapshot이 제일 정확하지만, docId만 갖고 있으면 1회 조회해서 snapshot 얻는다
    // (페이지에서 커서를 docSnapshot으로 들고 있으면 더 빠름. 지금은 단순화를 위해 docId 방식)
    const snapAll = await getDocs(
      query(col, orderBy("createdAt", "desc"), limit(1))
    );

    // fallback: cursorSnapshot을 못 얻으면 그냥 cursor 없이
    // (실서비스에서는 cursorSnapshot을 state에 저장하는게 정석)
    let cursorSnap = null;
    try {
      const docs = await getDocs(
        query(col, orderBy("createdAt", "desc"), limit(200))
      );
      cursorSnap = docs.docs.find((d) => d.id === cursor) || null;
    } catch (e) {
      cursorSnap = null;
    }

    q1 = cursorSnap
      ? query(col, orderBy("createdAt", "desc"), startAfter(cursorSnap), limit(Math.min(Math.max(pageSize, 1), 50)))
      : query(...base);
  } else {
    q1 = query(...base);
  }

  if (debugLog) {
    console.groupCollapsed("[teamRankingService] listTeamRankingPage");
    console.log("pageSize:", pageSize);
    console.log("cursor:", cursor);
  }

  const snap = await getDocs(q1);

  const rows = (snap.docs || []).map((d) => normalizeClubDoc(d.id, d.data()));

  const last = snap.docs && snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  const nextCursor = last ? last.id : null;

  if (debugLog) {
    console.log("rows:", rows.length);
    console.log("sample:", rows[0]);
    console.log("nextCursor:", nextCursor);
    console.groupEnd();
  }

  return { rows, nextCursor };
}
