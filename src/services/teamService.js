/* eslint-disable */
// src/services/teamService.js
// ✅ Firestore clubs 실데이터 지원
// - getTeamProfile: ✅ 팀 기본정보/멤버/미디어 = 실데이터, ✅ stats/highlights/recruiting/reviews = 목업 유지
// - listClubsForPicker: clubs 컬렉션 팀 목록 로드
// - createJoinRequestToClub: clubs/{clubId}/joinRequests pending + notifications 생성 + users/{uid}.joinRequest 저장
// - createClub: 팀 생성 + owner members + users.activeTeamId 세팅

import { images } from "../utils/imageAssets";

import { db, storage } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

/* ===========================
 * 공통 라벨
 * =========================== */

const SKILL_LEVEL_LABEL_MAP = {
  beginner: "입문",
  amateur: "아마추어",
  intermediate: "중급",
  advanced: "상급",
  pro: "프로",
};

const POSITION_LABEL_MAP = {
  guard: "가드",
  forward: "포워드",
  center: "센터",
};

function resolveTeamLogoUrlFromClubDoc(club) {
  if (!club) return images.logo;
  if (club.logoUrl) return club.logoUrl;
  if (club.photoUrl) return club.photoUrl;
  if (club.logoKey && images[club.logoKey]) return images[club.logoKey];
  return images.logo;
}

/* ===========================
 * ✅ 목업 유지 파트 (stats/highlights/recruiting/reviews)
 * - 새로 만든 팀도 "그럴듯하게" 보이도록 clubId 기반으로 안정적 생성
 * =========================== */

function hashInt(str) {
  const s = String(str || "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function buildMockStats(clubId) {
  const h = hashInt(clubId);
  const total = 8 + (h % 23); // 8~30
  const wins = Math.floor((total * (45 + (h % 41))) / 100); // 45~86% 정도
  const losses = Math.max(0, total - wins);
  const draws = (h % 5) === 0 ? 1 : 0; // 가끔 무승부 1
  const totalMatches = total + draws;
  const winRate = totalMatches > 0 ? wins / totalMatches : 0;

  return {
    totalMatches,
    wins,
    losses,
    draws,
    winRate,
    winRatePercent: Math.round(winRate * 100),
    updatedAt: null,
  };
}

function buildMockStreak(stats, clubId) {
  const h = hashInt(clubId);
  const count = 1 + (h % 5); // 1~5
  const type = (h % 2) === 0 ? "WIN" : "LOSE";

  const label = type === "WIN" ? `${count}연승 중` : `${count}연패 중`;
  return { type, count, label };
}

function buildHighlightsMock({ clubId, clubName, region }) {
  const baseRegion = region || "서울";
  const rivalName = clubName === "한강불독" ? "청춘호랑이" : "한강불독";

  return [
    {
      id: `${clubId}-h1`,
      date: "2025-12-04",
      opponentName: rivalName,
      location: `${baseRegion} 공원`,
      score: "72 : 65",
      result: "WIN",
      note: "4쿼터 역전승",
    },
    {
      id: `${clubId}-h2`,
      date: "2025-11-20",
      opponentName: "신촌샤크",
      location: "성북 체육관",
      score: "68 : 70",
      result: "LOSE",
      note: "접전 끝 한 점차 패배",
    },
  ];
}

function buildRecruitingMock() {
  return {
    isRecruiting: true,
    recruitPositions: ["센터", "포워드"],
    recruitLevel: "중급 이상 선호, 누구나 환영",
    recruitNote:
      "주말 위주로 함께 즐겁게 뛰실 팀원을 찾고 있어요. 성실하게 나와주시는 분이면 실력은 상관없습니다.",
    contactMethod: "매칭 신청으로 먼저 남겨주세요.",
  };
}

/* ===========================
 * ✅ 실데이터: TeamProfilePage용 getTeamProfile
 * - 팀 기본정보/멤버/미디어는 실데이터
 * - stats/highlights/recruiting/reviews는 목업 유지
 * =========================== */

async function loadClubDoc(clubId) {
  if (!clubId) return null;
  const snap = await getDoc(doc(db, "clubs", clubId));
  if (!snap.exists()) return null;
  return { id: snap.id, clubId: snap.id, ...snap.data() };
}

async function loadClubMemberRefs(clubId) {
  if (!clubId) return [];
  const snap = await getDocs(collection(db, "clubs", clubId, "members"));
  const rows = [];
  snap.forEach((d) => {
    rows.push({ id: d.id, ...d.data() });
  });
  return rows;
}

async function loadUserDoc(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { id: snap.id, uid: snap.id, ...snap.data() };
}

function youtubeThumb(youtubeId) {
  if (!youtubeId) return "";
  return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
}

function normalizeClubMedia(mediaArr) {
  // clubs.media는 TeamManagePage에서 저장하는 배열(사진 업로드/유튜브 링크)
  if (!Array.isArray(mediaArr)) return [];

  const list = [];
  mediaArr.forEach((m, idx) => {
    const it = m || {};
    const id = it.id || `media_${idx}`;

    // 사진 업로드: { id, type:"image", url, caption? ... }
    // 유튜브: { id, type:"youtube", url, youtubeId, caption? }
    const typeRaw = String(it.type || "").trim();
    const url = String(it.url || "").trim();

    if (!url) return;

    const isYoutube = typeRaw === "youtube";
    const type = isYoutube ? "video" : "photo"; // ✅ TeamProfilePage 표현 규칙에 맞춤
    const thumbnailUrl = isYoutube ? youtubeThumb(it.youtubeId) : String(it.thumbnailUrl || "").trim() || url;

    list.push({
      id,
      type,
      title: String(it.caption || it.title || "").trim(),
      thumbnailUrl,
      url,
      youtubeId: String(it.youtubeId || "").trim(),
    });
  });

  return list;
}

async function buildMembersFromClub(clubId) {
  const memberRefs = await loadClubMemberRefs(clubId);

  const uids = memberRefs
    .map((m) => String(m.uid || m.userId || m.id || "").trim())
    .filter(Boolean);

  const users = await Promise.all(uids.map((x) => loadUserDoc(x)));
  const byUid = new Map();
  users.forEach((u) => {
    if (!u?.uid) return;
    byUid.set(u.uid, u);
  });

  return uids.map((uid) => {
    const u = byUid.get(uid) || {};
    const mainPosition = u.mainPosition || null;
    const skillLevel = u.skillLevel || null;

    return {
      id: uid,
      userId: uid,
      name: u.nickname || "",
      nickname: u.nickname || "",
      avatarUrl: u.avatarUrl || "",
      heightCm: typeof u.heightCm === "number" ? u.heightCm : null,
      weightKg: typeof u.weightKg === "number" ? u.weightKg : null,
      mainPosition,
      skillLevel,
      positionLabel: POSITION_LABEL_MAP[mainPosition] || null,
      position: POSITION_LABEL_MAP[mainPosition] || null,
      skillLabel: SKILL_LEVEL_LABEL_MAP[skillLevel] || null,
      careerText: u.intro || null,
    };
  });
}

export async function getTeamProfile(teamId) {
  if (!teamId) return null;

  const club = await loadClubDoc(teamId);
  if (!club) return null;

  const logoUrl = resolveTeamLogoUrlFromClubDoc(club);

  const members = await buildMembersFromClub(teamId);

  const realMedia = normalizeClubMedia(club.media);
  const media =
    Array.isArray(realMedia) && realMedia.length > 0
      ? realMedia
      : [
          // (샘플 미디어 있으면 여기 유지)
        ];

  const stats = buildMockStats(teamId);
  const streak = buildMockStreak(stats, teamId);
  const highlights = buildHighlightsMock({
    clubId: teamId,
    clubName: String(club.name || "").trim(),
    region: String(club.region || "").trim(),
  });
  const recruiting = buildRecruitingMock();
  const reviews = [];

  const lineups = Array.isArray(club.lineups) ? club.lineups : [];

  const ownerUid =
    String(club.ownerUid || "").trim() ||
    String(club.ownerId || "").trim() ||
    "";

  return {
    id: teamId,
    clubId: teamId,

    // ✅ 팀장(SSOT)
    ownerUid,

    // ✅ 실데이터
    name: String(club.name || "").trim(),
    region: String(club.region || "").trim(),
    description: String(club.description || "").trim(),
    logoUrl,
    tags: Array.isArray(club.tags) ? club.tags : [],
    promo: club.promo || null,
    media,

    // ✅ 목업 유지
    stats,
    streak,
    highlights,
    recruiting,
    reviews,
    reviewSummary: { count: 0, average: 0 },

    // ✅ 실데이터 멤버
    members,

    updatedAt: club.updatedAt || null,
    createdAt: club.createdAt || null,

    lineups,
  };
}

/* ===========================
 * (A-2) ✅ 실데이터: Team Picker (clubs)
 * =========================== */

function calcStatsForPicker(stats) {
  const s = stats || {};

  const wins = typeof s.wins === "number" ? s.wins : 0;
  const losses = typeof s.losses === "number" ? s.losses : 0;
  const draws = typeof s.draws === "number" ? s.draws : 0;

  const totalMatches =
    typeof s.totalMatches === "number"
      ? s.totalMatches
      : typeof s.total === "number"
      ? s.total
      : wins + losses + draws;

  const winRateRaw =
    typeof s.winRate === "number"
      ? s.winRate
      : totalMatches > 0
      ? wins / totalMatches
      : 0;

  const winRatePercent = Math.round(winRateRaw * 100);

  return {
    totalMatches: totalMatches || 0,
    wins,
    losses,
    draws,
    winRateRaw: winRateRaw || 0,
    winRatePercent: winRatePercent || 0,
  };
}

export async function listClubsForPicker({
  limitCount = 60,
  regionSido = "",
} = {}) {
  const col = collection(db, "clubs");

  let qy = null;

  if (regionSido && String(regionSido).trim() && regionSido !== "전체 지역") {
    qy = query(
      col,
      where("regionSido", "==", String(regionSido).trim()),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
  } else {
    qy = query(col, orderBy("createdAt", "desc"), limit(limitCount));
  }

  const snap = await getDocs(qy);

  const rows = snap.docs.map((d) => {
    const data = d.data() || {};
    const clubId = d.id;

    const name = String(data.name || "").trim();
    const region = String(data.region || "").trim();

    const regionSidoV = String(data.regionSido || "").trim();
    const regionGuV = String(data.regionGu || "").trim();
    const regionLabel =
      region ||
      `${regionSidoV}${regionSidoV && regionGuV ? " " : ""}${regionGuV}`.trim() ||
      "지역 미지정";

    const logoUrl = String(data.logoUrl || "").trim();
    const tags = Array.isArray(data.tags) ? data.tags : [];

    const stats = calcStatsForPicker(data.stats);

    return {
      clubId,
      id: clubId,
      name: name || "팀 이름 없음",
      regionLabel,
      regionSido: regionSidoV || "",
      regionGu: regionGuV || "",
      logoUrl: logoUrl || images.logo,
      tags,
      totalMatches: stats.totalMatches,
      winRatePercent: stats.winRatePercent,
    };
  });

  return rows;
}

/* ===========================
 * (A-3) ✅ 팀 신청 생성 + ✅ 알림 생성 + ✅ users/{uid}.joinRequest 저장
 * =========================== */

async function resolveClubMetaSafe(clubId) {
  try {
    const snap = await getDoc(doc(db, "clubs", clubId));
    if (!snap.exists()) return { clubName: "", ownerUid: "" };
    const data = snap.data() || {};
    return {
      clubName: String(data.name || "").trim(),
      ownerUid: String(data.ownerUid || "").trim(),
    };
  } catch (e) {
    return { clubName: "", ownerUid: "" };
  }
}

export async function createJoinRequestToClub({
  clubId,
  playerUid,
  message = "",
  playerSnapshot = null,
} = {}) {
  if (!clubId) throw new Error("createJoinRequestToClub: clubId is required");
  if (!playerUid) throw new Error("createJoinRequestToClub: playerUid is required");

  const payload = {
    clubId,
    playerUid,
    status: "pending",
    message: String(message || "").trim(),
    playerSnapshot: playerSnapshot || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const refDoc = await addDoc(collection(db, "clubs", clubId, "joinRequests"), payload);
  const requestId = refDoc.id;

  const { clubName, ownerUid } = await resolveClubMetaSafe(clubId);

  const actorName = String(playerSnapshot?.nickname || "").trim() || "새 사용자";
  const teamName = clubName || "팀";

  const notiPayload = {
    // ✅ SSOT: 팀 관련 알림은 최상위 clubId를 반드시 가진다
    clubId,

    kind: "team",
    subType: "JOIN_REQUEST_CREATED",
    title: "팀 참가 요청이 도착했어요",
    body: `${actorName}님이 ${teamName}에 참가 요청을 보냈습니다.`,

    // ✅ 조회 SSOT: targetIds
    targetType: "USER",
    targetIds: ownerUid ? [ownerUid] : [],

    // ✅ 상세 이동/참조용
    linkType: "team",
    linkTargetId: requestId,

    important: true,

    actor: {
      uid: playerUid,
      nickname: String(playerSnapshot?.nickname || "").trim() || "",
      avatarUrl: String(playerSnapshot?.avatarUrl || "").trim() || "",
    },

    meta: {
      clubId, // meta에도 남겨도 OK (하지만 필터는 최상위 clubId를 SSOT로 사용)
      clubName: clubName || "",
      joinRequestId: requestId,
      ownerUid: ownerUid || "",
    },

    push: {
      enabled: true,
      sent: false,
    },

    createdAt: serverTimestamp(),
  };


  const notiRef = await addDoc(collection(db, "notifications"), notiPayload);

  await setDoc(
    doc(db, "users", playerUid),
    {
      joinRequest: {
        clubId,
        requestId,
        notificationId: notiRef.id,
        status: "pending",
        message: String(message || "").trim() || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { requestId, clubId, notificationId: notiRef.id };
}

/* ===========================
 * (B) 실제 팀 생성 (Firestore + Storage)
 * =========================== */

function safeSlug(input) {
  const base = String(input || "").trim().toLowerCase();
  if (!base) return "";
  return base
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

export async function createClub({
  ownerUid,
  name,
  region,
  regionSido,
  regionGu,
  description,
  tags,
  promo,
  logoFile,
}) {
  if (!ownerUid) throw new Error("createClub: ownerUid is required");
  if (!String(name || "").trim()) throw new Error("createClub: name is required");
  if (!String(region || "").trim()) throw new Error("createClub: region is required");

  const basePayload = {
    name: String(name || "").trim(),
    region: String(region || "").trim(),
    regionSido: regionSido || null,
    regionGu: regionGu || null,
    description: String(description || "").trim(),
    tags: Array.isArray(tags) ? tags : [],
    promo: {
      usePromoText: !!promo?.usePromoText,
      promoText: promo?.usePromoText ? String(promo?.promoText || "").trim() : "",
    },
    slug: safeSlug(name),
    ownerUid,
    logoUrl: null,

    stats: {
      totalMatches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      updatedAt: serverTimestamp(),
    },

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const createdRef = await addDoc(collection(db, "clubs"), basePayload);
  const clubId = createdRef.id;

  await setDoc(
    doc(db, "clubs", clubId, "members", ownerUid),
    {
      uid: ownerUid,
      role: "owner",
      status: "active",
      isCaptain: true,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  if (logoFile) {
    const ext = String(logoFile.name || "").split(".").pop() || "jpg";
    const storagePath = `clubs/${clubId}/logo_${Date.now()}.${ext}`;

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, logoFile);
    const url = await getDownloadURL(storageRef);

    await updateDoc(doc(db, "clubs", clubId), {
      logoUrl: url,
      logoPath: storagePath,
      updatedAt: serverTimestamp(),
    });
  }

  await setDoc(
    doc(db, "users", ownerUid),
    {
      clubId,
      activeTeamId: clubId,
      roleInTeam: "owner",
      isTeamCaptain: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { clubId };
}

/* ===========================
 * (C) 팀 요약 1건 로드 (팀 선택 표시용)
 * =========================== */

export async function getClubForPickerRow(clubId) {
  if (!clubId) return null;

  const snap = await getDoc(doc(db, "clubs", clubId));
  if (!snap.exists()) return null;

  const data = snap.data() || {};

  const name = String(data.name || "").trim() || "팀 이름 없음";
  const region = String(data.region || "").trim();

  const regionSidoV = String(data.regionSido || "").trim();
  const regionGuV = String(data.regionGu || "").trim();
  const regionLabel =
    region ||
    `${regionSidoV}${regionSidoV && regionGuV ? " " : ""}${regionGuV}`.trim() ||
    "지역 미지정";

  const logoUrl = String(data.logoUrl || "").trim() || images.logo;
  const tags = Array.isArray(data.tags) ? data.tags : [];

  const stats = data.stats || {};
  const wins = typeof stats.wins === "number" ? stats.wins : 0;
  const losses = typeof stats.losses === "number" ? stats.losses : 0;
  const draws = typeof stats.draws === "number" ? stats.draws : 0;

  const totalMatches =
    typeof stats.totalMatches === "number" ? stats.totalMatches : wins + losses + draws;

  const winRateRaw =
    typeof stats.winRate === "number"
      ? stats.winRate
      : totalMatches > 0
      ? wins / totalMatches
      : 0;

  const winRatePercent = Math.round(winRateRaw * 100);

  return {
    clubId,
    id: clubId,
    name,
    regionLabel,
    regionSido: regionSidoV || "",
    regionGu: regionGuV || "",
    logoUrl,
    tags,
    totalMatches: totalMatches || 0,
    winRatePercent: winRatePercent || 0,
  };
}

