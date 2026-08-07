/* eslint-disable */
// src/services/adminPlayersService.js
import { db } from "./firebase";
import { hasMock, mockData, mockQuerySnap } from "../dev/mockBus";
import {
  collection,
  getCountFromServer,
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

  // 가입 기본정보 (이름·생년월일·성별) — 관리자 신원 확인용
  const realName = safeString(v?.realName);
  const birthDate = safeString(v?.birthDate);
  const birthYear = safeNumber(v?.birthYear, 0);
  const gender = safeString(v?.gender);

  const region = safeString(v?.region);
  const regionSido = safeString(v?.regionSido);
  const regionGu = safeString(v?.regionGu);

  const mainPosition = safeString(v?.mainPosition);
  const mainPositionLabel = safeString(v?.mainPositionLabel);

  const skillLevel = safeString(v?.skillLevel);
  const skillLevelLabel = safeString(v?.skillLevelLabel);

  const clubId = safeString(v?.clubId);

  // 가입 시 수집하는 연락처 정보 (관리자 신원 확인용)
  const email = safeString(v?.email);
  const phoneE164 = safeString(v?.phoneE164);
  const phoneVerified = !!v?.phoneVerified;
  const provider = safeString(v?.provider);

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

    // ✅ 가입 기본정보
    realName,
    birthDate,
    birthYear,
    gender,

    email,
    phoneE164,
    phoneVerified,
    provider,

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
    _emailLower: normalizeText(email),
    // 검색어를 숫자만 남겨 비교하므로 "010-1234", "+8210" 어느 쪽으로 쳐도 잡힌다
    _phoneDigits: phoneE164.replace(/\D/g, ""),
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

  // ⚠️ 정렬 기준은 화면 표기("새로 가입한 사람 순")와 같아야 한다.
  //    예전엔 updatedAt 으로 뽑아 놓고 화면에서 createdAt 으로 다시 정렬해서,
  //    "프로필을 최근 고친 사람"이 조회 창을 차지하고 더 최근 가입자가 밀려났다.
  //    ⚠️ orderBy 는 그 필드가 없는 문서를 결과에서 통째로 뺀다 — 레거시 계정이
  //       관리자 눈에 안 보이게 된다. 그래서 countPlayersAdminView() 로 전체 건수를
  //       따로 세어 화면이 "정렬 기준 필드가 없어 빠진 N명"을 경고한다.
  constraints.push(orderBy("createdAt", "desc"));

  const size = Math.min(Math.max(Number(limitCount) || 25, 1), 500);
  constraints.push(limit(size));

  const baseQ = query(usersCol, ...constraints);
  const q1 = cursor ? query(baseQ, startAfter(cursor)) : baseQ;

  const snap = hasMock("userDocs") ? mockQuerySnap(mockData("userDocs")) : await getDocs(q1);

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

/** 같은 필터의 전체 회원 수. orderBy 를 걸지 않으므로 createdAt 없는 문서도 포함된다 —
 *  목록에 실제로 뜬 수와 비교하면 "정렬 기준 필드가 없어 빠진" 인원을 알 수 있다. */
export async function countPlayersAdminView({
  regionSido,
  mainPosition,
  skillLevel,
  onlyCaptains,
} = {}) {
  if (hasMock("userDocs")) return Object.keys(mockData("userDocs") || {}).length;

  const constraints = [];
  if (regionSido && regionSido !== "all") constraints.push(where("regionSido", "==", safeString(regionSido)));
  if (mainPosition && mainPosition !== "all") constraints.push(where("mainPosition", "==", safeString(mainPosition)));
  if (skillLevel && skillLevel !== "all") constraints.push(where("skillLevel", "==", safeString(skillLevel)));
  if (onlyCaptains) constraints.push(where("isTeamCaptain", "==", true));

  const snap = await getCountFromServer(query(collection(db, "users"), ...constraints));
  return snap.data().count || 0;
}

/** 접두 검색 범위의 끝으로 쓰는 U+F8FF(사용자 정의 영역). 화면에 안 보이는 문자이니 편집 주의. */
const PREFIX_END = "";

/**
 * 회원 검색 — 목록에 이미 받아 온 것만 훑지 않고 users 전체에서 찾는다.
 *
 * 예전엔 화면이 200명을 받아 놓고 그 배열만 필터링해서, 201번째부터는 검색해도 영영 안 나왔다.
 * Firestore 는 부분일치(LIKE)를 못 하므로 이렇게 나눈다:
 *   · 숫자만 있는 검색어 → 전화번호 정확일치 (끝 8자리 이상이면 E.164 로 맞춰 본다)
 *   · 그 외             → 닉네임·이메일 "앞부분" 일치
 * 관리자 용도는 "이 사람을 찾는다"라서 접두 검색으로 충분하다.
 *
 * @returns {{rows:Array, exact:boolean}} exact=true 면 정확일치 검색이었다는 뜻
 */
export async function searchPlayersAdminView({ keyword, limitCount = 50 } = {}) {
  const kw = safeString(keyword);
  if (!kw) return { rows: [], exact: false };

  const usersCol = collection(db, "users");
  const size = Math.min(Math.max(Number(limitCount) || 50, 1), 200);
  const digits = kw.replace(/\D/g, "");

  const byUid = {};
  const collect = async (q) => {
    try {
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const row = mapUserRow(d);
        if (row.uid) byUid[row.uid] = row;
      });
    } catch (e) {
      // 색인이 없거나 필드가 없는 경우 — 한 갈래가 실패해도 나머지 결과는 살린다.
      console.warn("[adminPlayers] 검색 갈래 실패:", e?.message || e);
    }
  };

  // 전화번호는 부분일치가 무의미하다(중간 자리로 찾지 않는다) → 정확일치로만 본다.
  if (digits.length >= 8) {
    const local = digits.startsWith("0") ? digits : `0${digits}`;
    const e164 = `+82${local.replace(/^0/, "")}`;
    await collect(query(usersCol, where("phoneE164", "==", e164), limit(size)));
    await collect(query(usersCol, where("phone", "==", local), limit(size)));
    const rows = Object.values(byUid);
    if (rows.length) return { rows, exact: true };
  }

  await collect(
    query(usersCol, orderBy("nickname"), where("nickname", ">=", kw), where("nickname", "<=", kw + PREFIX_END), limit(size))
  );
  await collect(
    query(usersCol, orderBy("email"), where("email", ">=", kw), where("email", "<=", kw + PREFIX_END), limit(size))
  );

  return { rows: Object.values(byUid), exact: false };
}
