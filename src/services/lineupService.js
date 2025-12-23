/* eslint-disable */
// src/services/lineupService.js
// ✅ 프론트에서 라인업 저장(업서트) + 기본 라인업 자동 생성(상대팀/내팀 공용)

import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

function pickMatchSizeKeyByCount(count) {
  if (count >= 5) return "5v5";
  if (count === 4) return "4v4";
  if (count === 3) return "3v3";
  return "";
}

function needCountByKey(matchSizeKey) {
  if (matchSizeKey === "5v5") return 5;
  if (matchSizeKey === "4v4") return 4;
  if (matchSizeKey === "3v3") return 3;
  return 5;
}

async function loadClubDoc(clubId) {
  const snap = await getDoc(doc(db, "clubs", clubId));
  if (!snap.exists()) return null;
  return { id: snap.id, clubId: snap.id, ...snap.data() };
}

async function loadClubMemberIds(clubId, max = 6) {
  const ref = collection(db, "clubs", clubId, "members");
  const qy = query(ref, limit(max));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => String(d.id || "").trim()).filter(Boolean);
}

function buildDefaultLineup({ clubName, matchSizeKey, memberIds, regionLabel }) {
  return {
    id: `lu_default_${Date.now()}`,
    name: `${clubName || "팀"} 기본 라인업`,
    matchSizeKey,
    memberIds,
    regionLabel: String(regionLabel || "").trim(),
    source: "auto",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeLineupDraft(input) {
  const x = input || {};
  const id = String(x.id || "").trim();
  const name = String(x.name || "").trim();
  const matchSizeKey = String(x.matchSizeKey || "").trim() || "5v5";
  const regionLabel = String(x.regionLabel || "").trim();
  const memberIds = Array.isArray(x.memberIds)
    ? x.memberIds.map((v) => String(v || "").trim()).filter(Boolean)
    : [];

  return {
    id,
    name,
    matchSizeKey,
    regionLabel,
    memberIds,
  };
}

function defaultNameByKey(teamName, matchSizeKey) {
  const base = String(teamName || "우리팀").trim() || "우리팀";
  if (matchSizeKey === "5v5") return `${base} 5:5 라인업`;
  if (matchSizeKey === "4v4") return `${base} 4:4 라인업`;
  if (matchSizeKey === "3v3") return `${base} 3:3 라인업`;
  return `${base} 라인업`;
}

/**
 * ✅ lineups 업서트
 * - clubs/{clubId}.lineups 배열에서 id로 찾고 있으면 replace, 없으면 push
 * - name 비어있으면 기본 이름 부여
 * - memberIds는 matchSizeKey 인원수로 컷(초과 저장 방지)
 */
export async function upsertClubLineup({ clubId, lineupDraft, teamName = "" }) {
  if (!clubId) throw new Error("upsertClubLineup: clubId is required");

  const club = await loadClubDoc(clubId);
  if (!club) throw new Error("upsertClubLineup: club not found");

  const existing = Array.isArray(club.lineups) ? club.lineups : [];

  const draft = normalizeLineupDraft(lineupDraft);

  const matchSizeKey = draft.matchSizeKey || "5v5";
  const need = needCountByKey(matchSizeKey);

  const fixedId = draft.id || `lu_${Date.now()}`;
  const fixedName = draft.name || defaultNameByKey(teamName || club.name, matchSizeKey);

  const fixed = {
    id: fixedId,
    name: fixedName,
    matchSizeKey,
    regionLabel: draft.regionLabel || "",
    memberIds: (draft.memberIds || []).slice(0, need),
    source: draft.source || "user",
    createdAt: draft.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const next = [];
  let replaced = false;

  existing.forEach((l) => {
    const lid = String(l?.id || "").trim();
    if (lid && lid === fixedId) {
      next.push({ ...l, ...fixed });
      replaced = true;
    } else {
      next.push(l);
    }
  });

  if (!replaced) next.push(fixed);

  await setDoc(
    doc(db, "clubs", clubId),
    { lineups: next, updatedAt: serverTimestamp() },
    { merge: true }
  );

  return { lineup: fixed, lineups: next, replaced };
}

/**
 * ✅ 상대팀 포함 어떤 팀이든 lineups가 비어있으면 기본 라인업 1개 생성
 * @returns { status: "created" | "exists" | "insufficient" | "not_found", lineupId?: string }
 */
export async function ensureDefaultLineupIfMissing(clubId) {
  if (!clubId) return { status: "not_found" };

  const club = await loadClubDoc(clubId);
  if (!club) return { status: "not_found" };

  const existing = Array.isArray(club.lineups) ? club.lineups : [];
  if (existing.length > 0) return { status: "exists" };

  const memberIds = await loadClubMemberIds(clubId, 6);
  const count = memberIds.length;

  const matchSizeKey = pickMatchSizeKeyByCount(count);
  if (!matchSizeKey) return { status: "insufficient" };

  const need = needCountByKey(matchSizeKey);

  const lineup = buildDefaultLineup({
    clubName: club.name,
    matchSizeKey,
    memberIds: memberIds.slice(0, need),
    regionLabel: club.region || "",
  });

  await setDoc(
    doc(db, "clubs", clubId),
    {
      lineups: [lineup],
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { status: "created", lineupId: lineup.id };
}

function safeString(v) {
  return String(v || "").trim();
}

export async function deleteClubLineup({ clubId, lineupId } = {}) {
  const cid = safeString(clubId);
  const lid = safeString(lineupId);
  if (!cid) throw new Error("deleteClubLineup: clubId is required");
  if (!lid) throw new Error("deleteClubLineup: lineupId is required");

  const ref = doc(db, "clubs", cid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("팀 정보를 찾을 수 없습니다.");

  const data = snap.data() || {};
  const prev = Array.isArray(data.lineups) ? data.lineups : [];
  const next = prev.filter((l) => safeString(l?.id) !== lid);

  await updateDoc(ref, { lineups: next });

  return { lineups: next };
}