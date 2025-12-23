/* eslint-disable */
// src/services/clubManageService.js
// ✅ 팀 관리 전용 서비스 (페이지에서 DB 직접 접근 금지)
// - clubs/{clubId} 읽기
// - 내 role 판단(팀장 여부)
// - 소개/홍보 수정(허용 필드만)
// - 팀 미디어(media[]) 저장
// - 선수 검색 + 초대(invites)
// ✅ SSOT: users.activeTeamId ("" = 무소속 / clubId = 소속 팀)

import { db } from "./firebase";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  addDoc,
  deleteDoc,
} from "firebase/firestore";

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

export async function getClubById(clubId) {
  if (!clubId) return null;
  const ref = doc(db, "clubs", clubId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: clubId, clubId, ...snap.data() };
}

export async function getMyClubRole({ clubId, uid }) {
  if (!clubId || !uid) return { role: "", isOwner: false };

  // 1) members/{uid} 우선
  try {
    const mref = doc(db, "clubs", clubId, "members", uid);
    const msnap = await getDoc(mref);
    if (msnap.exists()) {
      const d = msnap.data() || {};
      const role = d.role || "";
      const isOwner = role === "owner" || role === "captain" || d.isCaptain === true;
      return { role, isOwner };
    }
  } catch (e) {}

  // 2) clubs.ownerUid fallback
  const club = await getClubById(clubId);
  const ownerUid = club?.ownerUid || "";
  const isOwner = !!ownerUid && ownerUid === uid;
  return { role: isOwner ? "owner" : "", isOwner };
}

export async function getClubManageView({ clubId, uid }) {
  const club = await getClubById(clubId);
  if (!club) return { club: null, isOwner: false, role: "" };

  const { role, isOwner } = await getMyClubRole({ clubId, uid });
  return { club, isOwner, role };
}

/**
 * ✅ 소개/홍보 수정 (허용 필드만)
 * - 팀명/로고/지역은 절대 수정 안 함
 */
export async function updateClubIntroPromo({ clubId, description, promo }) {
  if (!clubId) throw new Error("updateClubIntroPromo: clubId is required");

  const ref = doc(db, "clubs", clubId);
  const payload = {
    updatedAt: serverTimestamp(),
  };

  if (typeof description === "string") payload.description = description;

  if (promo && typeof promo === "object") {
    payload.promo = {
      usePromoText: !!promo.usePromoText,
      promoText: promo.usePromoText ? String(promo.promoText || "") : "",
    };
  }

  await updateDoc(ref, payload);
}

export async function updateClubMedia({ clubId, media }) {
  if (!clubId) throw new Error("updateClubMedia: clubId is required");
  if (!Array.isArray(media)) throw new Error("updateClubMedia: media must be array");

  const ref = doc(db, "clubs", clubId);
  await updateDoc(ref, {
    media,
    updatedAt: serverTimestamp(),
  });
}

/**
 * ✅ (기본) 초대 가능한 선수 목록
 * - users.activeTeamId === "" 인 유저를 기본으로 보여줌
 * - ⚠️ 인덱스/권한 이슈 빨리 잡기 위해 로그 + try/catch
 * - ✅ 기본 리스트는 orderBy 제거(인덱스 요구를 최소화)
 */
export async function listInvitableUsers({ excludeUid, max = 20 }) {
  const usersCol = collection(db, "users");

  const q1 = query(usersCol, where("activeTeamId", "==", ""), limit(Math.min(Math.max(max, 1), 30)));

  try {
    const snap = await getDocs(q1);

    console.groupCollapsed("[clubManageService] listInvitableUsers");
    console.log("excludeUid:", excludeUid);
    console.log("size:", snap.size);
    console.log("ids:", snap.docs.map((d) => d.id));
    console.groupEnd();

    const list = [];
    snap.forEach((d) => {
      const v = d.data() || {};
      const uid = d.id;
      if (excludeUid && uid === excludeUid) return;
      list.push({ uid, id: uid, ...v });
    });
    return list;
  } catch (e) {
    console.warn("[clubManageService] listInvitableUsers ERROR:", e?.code, e?.message || e);
    return [];
  }
}

/**
 * ✅ 선수 검색 (닉네임 prefix 검색)
 * - keyword 없으면: 기본 후보(listInvitableUsers)
 * - keyword 있으면:
 *   where(activeTeamId=="") + nickname prefix
 * - ⚠️ 이 쿼리는 인덱스가 필요할 가능성이 큼(에러 메시지로 확인 가능)
 */
export async function searchUsersByNickname({ keyword, excludeUid, max = 20 }) {
  const k = String(keyword || "").trim();

  if (!k) {
    return await listInvitableUsers({ excludeUid, max });
  }

  const usersCol = collection(db, "users");
  const q1 = query(
    usersCol,
    where("activeTeamId", "==", ""),
    orderBy("nickname"),
    where("nickname", ">=", k),
    where("nickname", "<=", k + "\uf8ff"),
    limit(Math.min(Math.max(max, 1), 30))
  );

  try {
    const snap = await getDocs(q1);

    console.groupCollapsed("[clubManageService] searchUsersByNickname");
    console.log("keyword:", k);
    console.log("excludeUid:", excludeUid);
    console.log("size:", snap.size);
    console.log("ids:", snap.docs.map((d) => d.id));
    console.groupEnd();

    const list = [];
    snap.forEach((d) => {
      const v = d.data() || {};
      const uid = d.id;
      if (excludeUid && uid === excludeUid) return;
      list.push({ uid, id: uid, ...v });
    });
    return list;
  } catch (e) {
    console.warn("[clubManageService] searchUsersByNickname ERROR:", e?.code, e?.message || e);
    return [];
  }
}

/**
 * ✅ 팀 초대 생성
 * - clubs/{clubId}/invites/{autoId}
 */
export async function createClubInvite({ clubId, fromUid, toUid, message, toSnapshot }) {
  if (!clubId) throw new Error("createClubInvite: clubId is required");
  if (!fromUid) throw new Error("createClubInvite: fromUid is required");
  if (!toUid) throw new Error("createClubInvite: toUid is required");

  const cleanMessage = String(message || "").trim();

  const invCol = collection(db, "clubs", clubId, "invites");

  const invitePayload = {
    clubId,
    fromUid,
    toUid,
    message: cleanMessage,
    status: "pending", // pending | accepted | rejected | cancelled
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    toSnapshot:
      toSnapshot && typeof toSnapshot === "object"
        ? {
            uid: toUid,
            nickname: String(toSnapshot.nickname || ""),
            avatarUrl: String(toSnapshot.avatarUrl || ""),
            region: String(toSnapshot.region || ""),
          }
        : null,
  };

  const notiCol = collection(db, "notifications");

  const notiTitle = "팀 초대가 도착했어요";
  const notiBody = cleanMessage || "팀에서 초대가 도착했어요. 확인해 주세요.";

  const notificationPayload = {
    kind: "team",
    type: "club_invite",
    title: notiTitle,
    body: notiBody,

    clubId,
    actorUid: fromUid,
    targetIds: [toUid],
    important: false,

    meta: {
      clubId,
      fromUid,
      toUid,
    },

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    readBy: {},
  };

  const batch = writeBatch(db);

  const inviteRef = doc(invCol);
  const notiRef = doc(notiCol);

  batch.set(inviteRef, invitePayload);
  batch.set(notiRef, notificationPayload);

  await batch.commit();

  return { inviteId: inviteRef.id, notificationId: notiRef.id };
}

export async function listClubInvites({ clubId, status = "pending", limitCount = 30 }) {
  if (!clubId) return [];

  const col = collection(db, "clubs", clubId, "invites");
  const q1 = query(
    col,
    where("status", "==", status),
    orderBy("createdAt", "desc"),
    limit(Math.min(Math.max(limitCount, 1), 50))
  );

  const snap = await getDocs(q1);
  const list = [];
  snap.forEach((d) => {
    list.push({ id: d.id, inviteId: d.id, ...d.data() });
  });
  return list;
}

// ✅ 팀 로고 업데이트 전용
export async function updateClubLogo({ clubId, logoUrl, logoPath }) {
  if (!clubId) throw new Error("updateClubLogo: clubId is required");

  const ref = doc(db, "clubs", clubId);

  const patch = {
    updatedAt: serverTimestamp(),
  };

  if (typeof logoUrl === "string") patch.logoUrl = logoUrl;
  if (typeof logoPath === "string") patch.logoPath = logoPath;

  await updateDoc(ref, patch);

  return true;
}

/* ============================================================================
   ✅ 팀 탈퇴 (추가)
   - 팀장(Owner/Captain)은 탈퇴 불가
   - clubs/{clubId}.members 배열에서 uid 제거
   - clubs/{clubId}/members/{uid} 문서가 있으면 삭제(있을 수도 있어서 정리)
   - users/{uid}.activeTeamId SSOT를 "" 로 초기화
   - ✅ batch로 원샷 처리
============================================================================ */

function norm(v) {
  return String(v || "").trim();
}

function same(a, b) {
  const aa = norm(a);
  const bb = norm(b);
  return !!aa && !!bb && aa === bb;
}

export async function leaveClub({ clubId, uid }) {
  const _clubId = norm(clubId);
  const _uid = norm(uid);

  if (!_clubId) throw new Error("leaveClub: clubId is required");
  if (!_uid) throw new Error("leaveClub: uid is required");

  const clubRef = doc(db, "clubs", _clubId);
  const userRef = doc(db, "users", _uid);
  const memberRef = doc(db, "clubs", _clubId, "members", _uid);

  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) throw new Error("팀 정보를 찾을 수 없습니다.");

  const club = clubSnap.data() || {};

  // ✅ 팀장 방어: ownerUid 기준 + members/{uid} role 기준 둘 다 체크
  const ownerUid = norm(club?.ownerUid);
  if (ownerUid && same(ownerUid, _uid)) {
    const err = new Error("팀장은 팀 탈퇴를 할 수 없습니다.");
    err.code = "team-leader-cannot-leave";
    throw err;
  }

  try {
    const msnap = await getDoc(memberRef);
    if (msnap.exists()) {
      const md = msnap.data() || {};
      const role = md.role || "";
      const isOwner = role === "owner" || role === "captain" || md.isCaptain === true;
      if (isOwner) {
        const err = new Error("팀장은 팀 탈퇴를 할 수 없습니다.");
        err.code = "team-leader-cannot-leave";
        throw err;
      }
    }
  } catch (e) {
    if (e?.code === "team-leader-cannot-leave") throw e;
    // members 문서가 없거나 읽기 실패여도 ownerUid로 1차 방어 했으니 진행
  }

  const members = Array.isArray(club?.members) ? club.members : [];
  const nextMembers = members.filter((m) => {
    const mid = norm(m?.userId || m?.id);
    return !same(mid, _uid);
  });

  const batch = writeBatch(db);

  // clubs.members 배열이 있을 때만 업데이트
  if (members.length !== nextMembers.length) {
    batch.update(clubRef, {
      members: nextMembers,
      updatedAt: serverTimestamp(),
    });
  } else {
    // 멤버 배열에 없더라도 updatedAt은 굳이 안 찍음 (불필요한 쓰기 방지)
  }

  // members/{uid} 문서가 있으면 정리 (없어도 deleteDoc는 실패할 수 있으니 try 대신 batch.delete)
  batch.delete(memberRef);

  // ✅ SSOT: users.activeTeamId 비우기
  batch.update(userRef, {
    activeTeamId: "",
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  return { ok: true };
}


// ✅ 팀 삭제 + users 정리 (TeamManagePage의 "팀삭제" 버튼에서 호출)
// - 팀장만 삭제 가능
// - clubs/{clubId} 삭제
// - clubs/{clubId}/members, invites, joinRequests 서브컬렉션 문서 삭제
// - users 컬렉션에서:
//   - activeTeamId == clubId → activeTeamId ""
//   - careers.clubId == clubId → careers.clubId ""
//   - clubId == clubId → clubId ""
export async function deleteClubAndCleanup({ clubId, uid }) {
  const _clubId = norm(clubId);
  const _uid = norm(uid);

  if (!_clubId) throw new Error("deleteClubAndCleanup: clubId is required");
  if (!_uid) throw new Error("deleteClubAndCleanup: uid is required");

  // ✅ 권한: 팀장만
  const { isOwner } = await getMyClubRole({ clubId: _clubId, uid: _uid });
  if (!isOwner) {
    throw new Error("팀장만 팀을 삭제할 수 있습니다.");
  }

  const clubRef = doc(db, "clubs", _clubId);
  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) throw new Error("팀 정보를 찾을 수 없습니다.");

  const CHUNK = 450;

  const commitUpdateChunks = async (updates) => {
    if (!Array.isArray(updates) || updates.length === 0) return 0;
    let done = 0;

    for (let i = 0; i < updates.length; i += CHUNK) {
      const slice = updates.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      slice.forEach(({ ref, data }) => batch.update(ref, data));
      await batch.commit();
      done += slice.length;
    }

    return done;
  };

  const commitDeleteChunks = async (refs) => {
    if (!Array.isArray(refs) || refs.length === 0) return 0;
    let done = 0;

    for (let i = 0; i < refs.length; i += CHUNK) {
      const slice = refs.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      slice.forEach((r) => batch.delete(r));
      await batch.commit();
      done += slice.length;
    }

    return done;
  };

  const collectSubRefs = async (subName) => {
    try {
      const col = collection(db, "clubs", _clubId, subName);
      const snap = await getDocs(col);
      return snap.docs.map((d) => d.ref);
    } catch (e) {
      return [];
    }
  };

  // 1) users 정리 (3개 쿼리 결과를 합쳐서 중복 제거)
  const usersCol = collection(db, "users");

  const q1 = query(usersCol, where("activeTeamId", "==", _clubId), limit(500));
  const s1 = await getDocs(q1);

  const q2 = query(usersCol, where("careers.clubId", "==", _clubId), limit(500));
  const s2 = await getDocs(q2);

  const q3 = query(usersCol, where("clubId", "==", _clubId), limit(500));
  const s3 = await getDocs(q3);

  const uniq = new Map();
  s1.docs.forEach((d) => uniq.set(d.id, d.ref));
  s2.docs.forEach((d) => uniq.set(d.id, d.ref));
  s3.docs.forEach((d) => uniq.set(d.id, d.ref));

  const userUpdates = Array.from(uniq.values()).map((ref) => ({
    ref,
    data: {
      activeTeamId: "",
      clubId: "",
      "careers.clubId": "",
      updatedAt: serverTimestamp(),
    },
  }));

  const updatedUsers = await commitUpdateChunks(userUpdates);

  // 2) clubs/{clubId} 서브컬렉션 문서 삭제
  const subNames = ["members", "invites", "joinRequests"];
  let deletedSubDocs = 0;

  for (const sub of subNames) {
    const refs = await collectSubRefs(sub);
    if (refs.length > 0) {
      deletedSubDocs += await commitDeleteChunks(refs);
    }
  }

  // 3) clubs/{clubId} 문서 삭제
  await deleteDoc(clubRef);

  return { ok: true, updatedUsers, deletedSubDocs };
}

