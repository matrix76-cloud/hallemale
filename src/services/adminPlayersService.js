/* eslint-disable */
// src/services/adminPlayersService.js
import { db } from "./firebase";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  startAfter,
  documentId,
} from "firebase/firestore";

function toDate(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeString(v) {
  return String(v || "").trim();
}

function safeNumber(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function normalizeText(s) {
  return String(s || "").trim().toLowerCase();
}

function pickMediaCounts(media = []) {
  const list = Array.isArray(media) ? media : [];
  let images = 0;
  let youtube = 0;
  for (const m of list) {
    const t = String(m?.type || "").toLowerCase();
    if (t === "image") images += 1;
    else if (t === "youtube") youtube += 1;
  }
  return { total: list.length, images, youtube };
}

/**
 * ✅ clubs 배치 조회: clubId[] -> { [clubId]: { name, logoUrl, region, ownerUid } }
 * - Firestore 'in' 최대 10개 제한 → chunk 처리
 */
async function fetchClubsMetaByIds(clubIds = []) {
  const uniq = Array.from(new Set((clubIds || []).map(safeString).filter(Boolean)));
  if (!uniq.length) return {};

  const map = {};
  const clubsCol = collection(db, "clubs");

  const chunkSize = 10;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    try {
      const q1 = query(clubsCol, where(documentId(), "in", chunk));
      const snap = await getDocs(q1);
      snap.forEach((d) => {
        const v = d.data() || {};
        const id = d.id;
        map[id] = {
          clubId: id,
          name: safeString(v.name),
          logoUrl: safeString(v.logoUrl),
          region: safeString(v.region),
          ownerUid: safeString(v.ownerUid),
        };
      });
    } catch (e) {}
  }

  return map;
}

function mapUserRow(docSnap) {
  const v = docSnap?.data ? docSnap.data() : docSnap || {};
  const uid = safeString(docSnap?.id || v?.uid || v?.id || v?.userId);

  const nickname = safeString(v?.nickname);
  const region = safeString(v?.region);
  const regionSido = safeString(v?.regionSido);
  const regionGu = safeString(v?.regionGu);

  const mainPosition = safeString(v?.mainPosition);
  const mainPositionLabel = safeString(v?.mainPositionLabel);

  const skillLevel = safeString(v?.skillLevel);
  const skillLevelLabel = safeString(v?.skillLevelLabel);

  const clubId = safeString(v?.clubId);

  const isTeamCaptain = !!v?.isTeamCaptain;

  const createdAt = v?.createdAt || null;
  const updatedAt = v?.updatedAt || null;

  // ✅ 아바타 SSOT: users.avatarUrl
  const avatarUrl = safeString(v?.avatarUrl);

  const intro = safeString(v?.intro);

  const heightCm = safeNumber(v?.heightCm, 0);
  const weightKg = safeNumber(v?.weightKg, 0);

  const media = Array.isArray(v?.media) ? v.media : [];
  const mediaStat = pickMediaCounts(media);

  return {
    id: uid,
    uid,
    userId: uid,

    nickname,
    avatarUrl,

    region,
    regionSido,
    regionGu,

    mainPosition,
    mainPositionLabel,

    skillLevel,
    skillLevelLabel,

    heightCm,
    weightKg,

    intro,

    // ✅ 팀 SSOT: clubId만 들고 있다가 clubs에서 채움
    clubId,
    clubName: "",
    clubRegion: "",
    clubLogoUrl: "",
    ownerUid: "",

    isTeamCaptain,

    media,
    mediaTotal: mediaStat.total,
    mediaImages: mediaStat.images,
    mediaYoutube: mediaStat.youtube,

    createdAt,
    updatedAt,

    _createdAtMs: toDate(createdAt)?.getTime() || 0,
    _updatedAtMs: toDate(updatedAt)?.getTime() || 0,
    _nicknameLower: normalizeText(nickname),
  };
}

export async function fetchPlayersAdminView({
  limitCount = 15,
  cursor = null,
  regionSido = "all",
  mainPosition = "all",
  skillLevel = "all",
  onlyCaptains = false,
} = {}) {
  const usersCol = collection(db, "users");
  const constraints = [];

  if (regionSido && regionSido !== "all") {
    constraints.push(where("regionSido", "==", safeString(regionSido)));
  }
  if (mainPosition && mainPosition !== "all") {
    constraints.push(where("mainPosition", "==", safeString(mainPosition)));
  }
  if (skillLevel && skillLevel !== "all") {
    constraints.push(where("skillLevel", "==", safeString(skillLevel)));
  }
  if (onlyCaptains) {
    constraints.push(where("isTeamCaptain", "==", true));
  }

  constraints.push(orderBy("updatedAt", "desc"));

  const size = Math.min(Math.max(Number(limitCount) || 15, 1), 50);
  constraints.push(limit(size));

  const baseQ = query(usersCol, ...constraints);
  const q1 = cursor ? query(baseQ, startAfter(cursor)) : baseQ;

  const snap = await getDocs(q1);

  const baseRows = [];
  snap.forEach((docSnap) => baseRows.push(mapUserRow(docSnap)));

  // ✅ clubs 메타 배치로 채우기 (clubId 기준)
  const clubIds = baseRows.map((r) => safeString(r.clubId)).filter(Boolean);
  const clubMetaMap = await fetchClubsMetaByIds(clubIds);

  const rows = baseRows.map((r) => {
    const cid = safeString(r.clubId);
    if (!cid) return r;

    const meta = clubMetaMap[cid] || null;
    if (!meta) return r;

    console.log("meta information", meta);

    return {
      ...r,
      clubName: safeString(meta.name),
      clubLogoUrl: safeString(meta.logoUrl),
      clubRegion: safeString(meta.region),
      ownerUid: safeString(meta.ownerUid),
    };
  });

  const lastDoc = snap.docs && snap.docs.length ? snap.docs[snap.docs.length - 1] : null;

  return {
    rows,
    nextCursor: lastDoc,
    hasMore: !!lastDoc && rows.length >= size,
  };
}
