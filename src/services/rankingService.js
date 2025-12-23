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

function normalizeUserRow(d) {
  const data = d.data() || {};
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
  };
}

/**
 * players list page (임시: 문서ID 정렬로 페이징)
 * - 랭킹 정렬은 나중에 Functions에서 rankingScore 채운 후 붙임
 */
export async function listPlayerRankingPage({
  pageSize = 30,
  cursor = null,
  debugLog = false,
} = {}) {

  const usersCol = collection(db, "users");

  // ✅ FieldPath.documentId() 대신 "__name__" 사용 (호환성 최고)
  const qy = cursor
    ? query(usersCol, orderBy("__name__"), startAfter(cursor), limit(pageSize))
    : query(usersCol, orderBy("__name__"), limit(pageSize));

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
      isTeamCaptain : u.isTeamCaptain,
      heightCm: u.heightCm,
      weightKg: u.weightKg,
      clubId: u.activeTeamId || "",
      clubName: club?.name || "",
      clubLogoUrl: club?.logoUrl || "",
      wins: 0,
      losses: 0,
      draws: 0,
    };
  });

  if (debugLog) {
    logJson("[rankingService] rows(sample)", rows.slice(0, 2));
    logJson("[rankingService] clubIds", clubIds);
  }

  return { rows, nextCursor };
}
