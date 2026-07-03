/* eslint-disable */
// src/services/clubManageService.js
// ✅ 팀 관리 전용 서비스 (페이지에서 DB 직접 접근 금지)
// - teams(clubs) 즉시 반영 + tasks 적재(배치 스냅샷/파생데이터는 서버 스케줄 처리)
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
  onSnapshot,
  writeBatch,
  deleteDoc,
  addDoc,
} from "firebase/firestore";

import { enqueueTeamSnapshotRefreshTask } from "./taskService";
import { getNameChangeStatus } from "../utils/nameChange";

async function notifyTeamEvent({ clubId, targetUids, subType, type, title, body, actorUid }) {
  const targets = (Array.isArray(targetUids) ? targetUids : []).filter(Boolean);
  if (!targets.length) return;
  try {
    await addDoc(collection(db, "notifications"), {
      clubId,
      kind: "team",
      subType,
      type,
      title,
      body,
      targetType: "USER",
      targetIds: targets,
      actorUid: actorUid || "",
      linkType: "team",
      linkTargetId: clubId,
      meta: { clubId, deepLink: "/my" },
      push: { enabled: true, status: "queued", sentAt: null, failReason: null },
      prefsCategory: "teamDecision",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      readBy: {},
    });
  } catch (e) {
    console.warn("[clubManage] notifyTeamEvent failed:", subType, e?.message || e);
  }
}

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
export async function updateClubIntroPromo({ clubId, description, promo, tags }) {
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

  // ✅ 태그(생성 시 입력 → 관리에서 수정). 배열일 때만 갱신.
  if (Array.isArray(tags)) {
    payload.tags = tags
      .map((t) => String(t || "").trim())
      .filter(Boolean)
      .slice(0, 12);
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
 * ✅ 팀명 변경
 * - SSOT: clubs/{clubId}.name 즉시 반영
 * - 파생 스냅샷은 tasks로 적재해서 서버 스케줄에서 처리
 */
export async function updateClubName({ clubId, name }) {
  const id = String(clubId || "").trim();
  const nextName = String(name || "").trim().replace(/\s+/g, " ");

  if (!id) throw new Error("updateClubName: clubId is required");
  if (!nextName) throw new Error("updateClubName: name is required");

  const ref = doc(db, "clubs", id);
  const curSnap = await getDoc(ref);
  if (!curSnap.exists()) throw new Error("updateClubName: club not found");
  const cur = curSnap.data() || {};

  // ✅ 변경 없음 → no-op (쿨다운/중복 검사 스킵)
  const curName = String(cur.name || "").trim().replace(/\s+/g, " ");
  if (nextName === curName) return true;

  // ✅ 쿨다운 가드: 최초 rename 이후(nameUpdatedAt 존재)부터 90일 이내면 거부
  // (생성 직후엔 nameUpdatedAt이 없어 잠기지 않음 → 오타 즉시 수정 가능)
  const { locked, remainingDays } = getNameChangeStatus(cur.nameUpdatedAt);
  if (locked) {
    throw new Error(`팀 이름은 ${remainingDays}일 후에 변경할 수 있어요.`);
  }

  // ✅ 중복 가드: 같은 이름을 가진 다른 팀이 있으면 거부
  const dupSnap = await getDocs(
    query(collection(db, "clubs"), where("name", "==", nextName), limit(2))
  );
  const takenByOther = dupSnap.docs.some((d) => d.id !== id);
  if (takenByOther) {
    throw new Error("이미 사용 중인 팀 이름이에요. 다른 이름을 입력해 주세요.");
  }

  await updateDoc(ref, {
    name: nextName,
    nameUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await enqueueTeamSnapshotRefreshTask({
    clubId: id,
    patch: { name: nextName },
    reason: "club name changed",
  });

  return true;
}

/**
 * ✅ 팀 미소속 판정 (SSOT)
 * - 무소속 = activeTeamId 와 (레거시) clubId 가 모두 비어 있어야 함
 * - 가입 경로별로 둘 중 하나만 세팅된 데이터가 있어 둘 다 검사
 */
function isTeamless(v) {
  const activeTeamId = String(v?.activeTeamId || "").trim();
  const clubId = String(v?.clubId || "").trim();
  return !activeTeamId && !clubId;
}

/**
 * ✅ 팀 미소속 후보 로드 (내부 헬퍼)
 * - ⚠️ where("activeTeamId","==","") 는 activeTeamId 가 null/미설정인 유저를 놓친다.
 *   (팀에 한 번도 가입 안 한 유저는 이 필드가 아예 없는 경우가 많음)
 *   → users 를 넉넉히 로드해 클라이언트에서 isTeamless(활동팀/clubId 모두 없음)로 정확히 필터.
 * - 인덱스/prefix 제약이 없어 이름 일부만 입력해도 검색 가능.
 */
async function loadTeamlessCandidates({ excludeUid, cap = 500 }) {
  const snap = await getDocs(query(collection(db, "users"), limit(cap)));
  const list = [];
  snap.forEach((d) => {
    const v = d.data() || {};
    const uid = d.id;
    if (excludeUid && uid === excludeUid) return;
    if (!isTeamless(v)) return; // ✅ 팀 있는 유저 제외 (null/미설정도 정확히 판정)
    list.push({ uid, id: uid, ...v });
  });
  list.sort((a, b) =>
    String(a.nickname || "").localeCompare(String(b.nickname || ""), "ko")
  );
  return list;
}

/**
 * ✅ (기본) 초대 가능한 선수 목록 — 팀 미소속 유저만
 */
export async function listInvitableUsers({ excludeUid, max = 20 }) {
  try {
    const all = await loadTeamlessCandidates({ excludeUid });
    return all.slice(0, Math.max(max, 1));
  } catch (e) {
    console.warn("[clubManageService] listInvitableUsers ERROR:", e?.code, e?.message || e);
    return [];
  }
}

/**
 * ✅ 선수 검색 — 팀 미소속 유저 중 닉네임 부분일치(대소문자 무시)
 * - keyword 없으면: 기본 후보(listInvitableUsers)
 * - 인덱스/prefix 제약 없이 클라이언트 substring 필터 → 이름 일부만 입력해도 검색됨
 */
export async function searchUsersByNickname({ keyword, excludeUid, max = 20 }) {
  const k = String(keyword || "").trim().toLowerCase();
  if (!k) return await listInvitableUsers({ excludeUid, max });

  try {
    const all = await loadTeamlessCandidates({ excludeUid });
    const filtered = all.filter((u) =>
      String(u.nickname || "").toLowerCase().includes(k)
    );
    return filtered.slice(0, Math.max(max, 1));
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

  // ✅ 중복 초대 가드: 같은 유저에게 pending 초대가 이미 있으면 거부
  const dupSnap = await getDocs(
    query(invCol, where("toUid", "==", toUid), where("status", "==", "pending"), limit(1))
  );
  if (!dupSnap.empty) {
    throw new Error("이미 초대를 보낸 사용자예요.");
  }

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

    push: { enabled: true, status: "queued", sentAt: null, failReason: null },
    prefsCategory: "teamInvite",

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

// ✅ 팀 로고 업데이트
// - SSOT: clubs.logoUrl/logoPath 즉시 반영
// - 파생 스냅샷은 tasks에 적재해서 서버 스케줄에서 처리
export async function updateClubLogo({ clubId, logoUrl, logoPath }) {
  const id = String(clubId || "").trim();
  if (!id) throw new Error("updateClubLogo: clubId is required");

  const nextUrl = typeof logoUrl === "string" ? String(logoUrl || "").trim() : "";
  const nextPath = typeof logoPath === "string" ? String(logoPath || "").trim() : "";

  const ref = doc(db, "clubs", id);

  const patch = {
    updatedAt: serverTimestamp(),
  };

  const taskPatch = {};

  if (nextUrl) {
    patch.logoUrl = nextUrl;
    taskPatch.logoUrl = nextUrl;
  }
  if (nextPath) {
    patch.logoPath = nextPath;
    taskPatch.logoPath = nextPath;
  }

  await updateDoc(ref, patch);

  if (Object.keys(taskPatch).length > 0) {
    await enqueueTeamSnapshotRefreshTask({
      clubId: id,
      patch: taskPatch,
      reason: "club logo changed",
    });
  }

  return true;
}

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
  }

  const members = Array.isArray(club?.members) ? club.members : [];
  const nextMembers = members.filter((m) => {
    const mid = norm(m?.userId || m?.id);
    return !same(mid, _uid);
  });

  const batch = writeBatch(db);

  if (members.length !== nextMembers.length) {
    batch.update(clubRef, {
      members: nextMembers,
      updatedAt: serverTimestamp(),
    });
  }

  batch.delete(memberRef);

  batch.update(userRef, {
    activeTeamId: "",
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  // 자발적 탈퇴이므로 본인에게 별도 알림은 보내지 않는다.
  return { ok: true };
}

export async function deleteClubAndCleanup({ clubId, uid }) {
  const _clubId = norm(clubId);
  const _uid = norm(uid);

  if (!_clubId) throw new Error("deleteClubAndCleanup: clubId is required");
  if (!_uid) throw new Error("deleteClubAndCleanup: uid is required");

  const { isOwner } = await getMyClubRole({ clubId: _clubId, uid: _uid });
  if (!isOwner) {
    throw new Error("팀장만 팀을 삭제할 수 있습니다.");
  }

  const clubRef = doc(db, "clubs", _clubId);
  const clubSnap = await getDoc(clubRef);
  if (!clubSnap.exists()) throw new Error("팀 정보를 찾을 수 없습니다.");

  // ✅ 멤버가 1명(팀장만)일 때만 삭제 허용
  // - clubs/{clubId}/members 서브컬렉션 기준
  // - 문서 수가 1 초과면 삭제 금지
  try {
    const membersCol = collection(db, "clubs", _clubId, "members");
    const membersSnap = await getDocs(query(membersCol, limit(2)));
    const memberCount = membersSnap.size;

    if (memberCount === 0) {
      // 비정상 상태지만, 안전하게 막음(데이터 꼬임 방지)
      throw new Error("팀 멤버 정보를 찾을 수 없습니다. 잠시 후 다시 시도해 주세요.");
    }

    if (memberCount > 1) {
      throw new Error("팀 멤버가 남아 있어 팀을 삭제할 수 없습니다. 멤버를 모두 내보낸 뒤 다시 시도해 주세요.");
    }
  } catch (e) {
    // 위에서 던진 에러는 그대로 전달
    throw new Error(e?.message || "팀 멤버 확인 중 오류가 발생했습니다.");
  }

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

  // ✅ 알림용 메타를 먼저 읽고, 클럽 문서를 "먼저" 삭제한다.
  //    (ClubContext.ensureActiveTeamId 의 findOwnedClubId 재치유가 삭제 중인 팀을
  //     다시 activeTeamId 로 되살려 "팀 불러오는중"에서 멈추는 레이스 방지)
  const clubMeta = await resolveClubMetaSafe(_clubId);
  await deleteDoc(clubRef);

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

  const subNames = ["members", "invites", "joinRequests"];
  let deletedSubDocs = 0;

  for (const sub of subNames) {
    const refs = await collectSubRefs(sub);
    if (refs.length > 0) {
      deletedSubDocs += await commitDeleteChunks(refs);
    }
  }

  // ✅ 해체 알림 (영향 받은 멤버 전원) — 클럽/메타는 위에서 이미 처리됨
  const affectedUids = Array.from(uniq.keys()).filter((x) => x && x !== _uid);

  if (affectedUids.length) {
    await notifyTeamEvent({
      clubId: _clubId,
      targetUids: affectedUids,
      subType: "TEAM_DISBANDED",
      type: "team_disbanded",
      title: "팀이 해체되었습니다",
      body: clubMeta.clubName
        ? `${clubMeta.clubName} 팀이 해체되었습니다.`
        : "소속 팀이 해체되었습니다.",
      actorUid: _uid,
    });
  }

  return { ok: true, updatedUsers, deletedSubDocs };
}


function safeStr(v) {
  return String(v ?? "").trim();
}

function cleanActivity(activity = {}) {
  const days = safeStr(activity.days);
  const time = safeStr(activity.time);

  const validDays = ["WEEKDAY", "WEEKEND", "ANY"].includes(days) ? days : "";
  const validTime = ["MORNING", "AFTERNOON", "EVENING", "NIGHT", "ANY"].includes(time) ? time : "";

  const out = {};
  if (validDays) out.days = validDays;
  if (validTime) out.time = validTime;

  return out;
}

export async function updateClubActivity({ clubId, activity }) {
  const id = safeStr(clubId);
  if (!id) throw new Error("clubId is required");

  const next = cleanActivity(activity);
  await updateDoc(doc(db, "clubs", id), {
    activity: next,
    updatedAt: serverTimestamp(),
  });

  return true;
}



export async function updateClubIntroAndActivity({ clubId, description, promo, activity }) {

  const ref = doc(db, "clubs", String(clubId || "").trim());

  const desc = String(description || "").trim();
  const promoObj = promo || {};
  const activityObj = activity || {};

  await updateDoc(ref, {
    description: desc,
    promo: {
      usePromoText: !!promoObj.usePromoText,
      promoText: String(promoObj.promoText || "").trim(),
    },
    activity: {
      days: String(activityObj.days || "ANY"),
      time: String(activityObj.time || "ANY"),
    },
    updatedAt: serverTimestamp(),
  });
}



// ✅ 팀원 강제 탈퇴
// - clubs/{clubId}/members/{targetUid} 삭제
// - users/{targetUid}.activeTeamId / clubId 정리 (SSOT 기준)
// - users.roleInTeam / isTeamCaptain 정리
// - users.joinRequest가 이 clubId면 제거
export async function kickClubMember({ clubId, targetUid, actorUid } = {}) {
  const cid = String(clubId || "").trim();
  const tuid = String(targetUid || "").trim();
  const auid = String(actorUid || "").trim();

  if (!cid) throw new Error("kickClubMember: clubId is required");
  if (!tuid) throw new Error("kickClubMember: targetUid is required");

  const memberRef = doc(db, "clubs", cid, "members", tuid);
  const userRef = doc(db, "users", tuid);

  const batch = writeBatch(db);

  // 1) 멤버십 삭제
  batch.delete(memberRef);

  // 2) 유저 팀 연결 해제 (해당 clubId에 소속된 경우만)
  let patch = {
    updatedAt: serverTimestamp(),
  };

  try {
    const usnap = await getDoc(userRef);
    if (usnap.exists()) {
      const u = usnap.data() || {};
      const activeTeamId = String(u.activeTeamId || "").trim();
      const clubIdField = String(u.clubId || "").trim();

      if (activeTeamId === cid) patch.activeTeamId = "";
      if (clubIdField === cid) patch.clubId = "";

      // 팀 내 역할/캡틴 정보 정리
      patch.roleInTeam = null;
      patch.isTeamCaptain = null;

      // joinRequest 정리 (해당 clubId에 대한 pending이면 제거)
      const jr = u.joinRequest || null;
      const jrClubId = String(jr?.clubId || "").trim();
      if (jr && jrClubId === cid) {
        patch.joinRequest = null;
      }
    } else {
      // users 문서가 없으면 멤버만 삭제하고 끝
      patch = null;
    }
  } catch (e) {
    // users 읽기 실패해도 멤버 삭제는 진행
    patch.lastKickError = String(e?.message || "user read failed");
  }

  if (patch) {
    if (auid) patch.lastKickedBy = auid;
    batch.update(userRef, patch);
  }

  await batch.commit();

  return { ok: true };
}

/**
 * 팀 멤버 목록 조회
 * @param {Object} params
 * @param {string} params.clubId
 * @param {number} params.limitCount
 * @returns {Promise<Array<{uid:string, nickname:string, avatarUrl:string, region:string, role?:string}>>}
 */
export async function listClubMembers({ clubId, limitCount = 100 }) {
  const cid = String(clubId || "").trim();
  if (!cid) return [];

  const q = query(
    collection(db, "users"),
    where("activeTeamId", "==", cid),
    limit(Number(limitCount || 100))
  );

  const snap = await getDocs(q);

  // ✅ 팀장(ownerUid) 기준으로 역할 라벨 산출 (users doc엔 role이 없어 항상 공백이던 버그 수정)
  const { ownerUid } = await resolveClubMetaSafe(cid);

  const rows = snap.docs.map((d) => {
    const v = d.data() || {};
    return {
      uid: d.id,
      nickname: String(v.nickname || ""),
      avatarUrl: String(v.avatarUrl || ""),
      region: String(v.region || ""),
      role: ownerUid && d.id === ownerUid ? "리더" : "멤버",
    };
  });

  // UI 보기 좋게 정렬(인덱스 필요 없도록 client sort)
  rows.sort((a, b) => {
    const an = (a.nickname || "").toLowerCase();
    const bn = (b.nickname || "").toLowerCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
    return String(a.uid || "").localeCompare(String(b.uid || ""));
  });

  return rows;
}

/**
 * ✅ 팀 멤버 실시간 구독 — 초대 수락 등으로 users.activeTeamId 가 바뀌면 즉시 콜백.
 * (listClubMembers 와 동일한 SSOT: users where activeTeamId == clubId)
 * @returns unsubscribe 함수
 */
export function subscribeClubMembers({ clubId, limitCount = 100 }, cb) {
  const cid = String(clubId || "").trim();
  if (!cid || typeof cb !== "function") return () => {};

  const q = query(
    collection(db, "users"),
    where("activeTeamId", "==", cid),
    limit(Number(limitCount || 100))
  );

  return onSnapshot(
    q,
    async (snap) => {
      try {
        const { ownerUid } = await resolveClubMetaSafe(cid);
        const rows = snap.docs.map((d) => {
          const v = d.data() || {};
          return {
            uid: d.id,
            nickname: String(v.nickname || ""),
            avatarUrl: String(v.avatarUrl || ""),
            region: String(v.region || ""),
            role: ownerUid && d.id === ownerUid ? "리더" : "멤버",
          };
        });
        rows.sort((a, b) => {
          const an = (a.nickname || "").toLowerCase();
          const bn = (b.nickname || "").toLowerCase();
          if (an < bn) return -1;
          if (an > bn) return 1;
          return String(a.uid || "").localeCompare(String(b.uid || ""));
        });
        cb(rows);
      } catch (e) {
        console.warn("[subscribeClubMembers] map failed:", e?.message || e);
      }
    },
    (err) => console.warn("[subscribeClubMembers] snapshot error:", err?.message || err)
  );
}

/**
 * ✅ 보낸 초대(대기중) 실시간 구독 — 수락/거절로 status 가 바뀌면 즉시 콜백.
 * @returns unsubscribe 함수
 */
export function subscribeClubInvites({ clubId, status = "pending", limitCount = 30 }, cb) {
  const cid = String(clubId || "").trim();
  if (!cid || typeof cb !== "function") return () => {};

  const q = query(
    collection(db, "clubs", cid, "invites"),
    where("status", "==", status),
    orderBy("createdAt", "desc"),
    limit(Math.min(Math.max(limitCount, 1), 50))
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, inviteId: d.id, ...d.data() }));
      cb(list);
    },
    (err) => console.warn("[subscribeClubInvites] snapshot error:", err?.message || err)
  );
}

// ✅ 매치 라이프사이클 알림 fan-out용: 팀원 uid 목록 (팀장=ownerUid 제외)
// - 팀장은 기존 알림으로 이미 받으므로 중복 방지를 위해 제외
export async function listClubMemberUidsExceptOwner(clubId) {
  const cid = String(clubId || "").trim();
  if (!cid) return [];

  const { ownerUid } = await resolveClubMetaSafe(cid);

  let members = [];
  try {
    members = await listClubMembers({ clubId: cid, limitCount: 100 });
  } catch (e) {
    members = [];
  }

  return members
    .map((m) => String(m?.uid || "").trim())
    .filter(Boolean)
    .filter((u) => u !== ownerUid);
}

/**
 * 팀 멤버 강제 탈퇴
 * @param {Object} params
 * @param {string} params.clubId
 * @param {string} params.targetUid  - 탈퇴시킬 유저 uid(users doc id)
 * @param {string} params.actorUid   - 실행자 uid(클럽장)
 */
export async function forceRemoveClubMember({ clubId, targetUid, actorUid }) {
  const cid = String(clubId || "").trim();
  const tuid = String(targetUid || "").trim();
  const auid = String(actorUid || "").trim();

  if (!cid) throw new Error("clubId가 필요합니다.");
  if (!tuid) throw new Error("targetUid가 필요합니다.");
  if (!auid) throw new Error("actorUid가 필요합니다.");
  if (tuid === auid) throw new Error("본인은 강제 탈퇴할 수 없습니다.");

  // 1) 유저 소속 해제 (SSOT: activeTeamId) — 유저 문서가 있을 때만 갱신
  const userRef = doc(db, "users", tuid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    await updateDoc(userRef, {
      activeTeamId: "",
      teamRole: "",
      updatedAt: serverTimestamp(),
    });
  }

  const memberRef = doc(db, "clubs", cid, "members", tuid);
  const memberSnap = await getDoc(memberRef);
  if (memberSnap.exists()) {
    await deleteDoc(memberRef);
  }

  // ✅ 강퇴 알림
  const fmeta = await resolveClubMetaSafe(cid);
  await notifyTeamEvent({
    clubId: cid,
    targetUids: [tuid],
    subType: "TEAM_MEMBER_KICKED",
    type: "team_kicked",
    title: "팀에서 내보내졌습니다",
    body: fmeta.clubName
      ? `${fmeta.clubName} 팀에서 강퇴되었습니다.`
      : "팀에서 강퇴되었습니다.",
    actorUid: auid,
  });

  return true;
}

export async function updateClubRegion({ clubId, region, regionSido, regionGu }) {
  const cid = String(clubId || "").trim();
  const reg = String(region || "").trim();
  const sido = String(regionSido || "").trim();
  const gu = String(regionGu || "").trim();

  if (!cid) throw new Error("clubId가 필요합니다.");
  if (!reg) throw new Error("region이 필요합니다.");
  if (!sido) throw new Error("regionSido가 필요합니다.");
  if (!gu) throw new Error("regionGu가 필요합니다.");

  // ✅ 형식 일치 검증(실수 방지)
  const expected = `${sido} ${gu}`.trim();
  if (reg !== expected) {
    throw new Error("region 값이 regionSido/regionGu 조합과 일치하지 않습니다.");
  }

  const clubRef = doc(db, "clubs", cid);
  await updateDoc(clubRef, {
    region: reg,
    regionSido: sido,
    regionGu: gu,
    updatedAt: serverTimestamp(),
  });

  return { ok: true };
}
