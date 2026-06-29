/* eslint-disable */
// src/services/notificationService.js
// ✅ notifications(전역) 조회/읽음 처리 서비스
// ✅ 전부 실데이터 (목업 없음)
// ✅ 대상: GLOBAL + USER(uid)
// ✅ 인덱스 요구를 피하기 위해 Firestore orderBy는 쓰지 않고, JS에서 정렬
// ✅ 디버깅 로그 포함

import { db } from "./firebase";
import {
  arrayRemove,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

function toDateSafe(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function sortByCreatedAtDesc(list) {
  return [...(list || [])].sort((a, b) => {
    const ta = toDateSafe(a.createdAt)?.getTime() || 0;
    const tb = toDateSafe(b.createdAt)?.getTime() || 0;
    return tb - ta;
  });
}

function uniqById(list) {
  const map = {};
  for (const n of list || []) {
    if (!n?.id) continue;
    map[n.id] = n;
  }
  return Object.values(map);
}

function debugRowShape(n) {
  return {
    id: n?.id,
    kind: n?.kind,
    subType: n?.subType,
    targetType: n?.targetType,
    targetIds: Array.isArray(n?.targetIds) ? n.targetIds : null,
    title: n?.title,
    createdAt: n?.createdAt ? "has" : "none",
    _from: n?._from,
  };
}


export async function listNotificationsForUser({ uid, clubId = "", limitCount = 60 } = {}) {
  if (!uid) {
    console.warn("[noti] listNotificationsForUser: uid is empty");
    return [];
  }

  const col = collection(db, "notifications");

  // ✅ 새 스키마 기준: targetIds 배열에 내 uid가 들어있는 것만 가져온다
  // (추가 where를 걸면 인덱스 요구가 생길 수 있어 여기서는 단일 조건만)
  const qUser = query(col, where("targetIds", "array-contains", uid), limit(limitCount));

  console.groupCollapsed("[noti] listNotificationsForUser");
  console.log("uid =", uid);
  console.log("clubId =", clubId || "(none)");
  console.log("limitCount =", limitCount);
  console.log("query = targetIds array-contains uid");

  let snapU = null;

  try {
    snapU = await getDocs(qUser);
  } catch (e) {
    console.log("[noti] getDocs error =", e);
    console.groupEnd();
    throw e;
  }

  console.log("snapU.docs =", snapU?.docs?.length || 0);

  const listU = (snapU?.docs || []).map((d) => ({
    id: d.id,
    ...d.data(),
    _from: "fs:USER",
  }));

  console.log("sample USER[0] =", listU[0] ? debugRowShape(listU[0]) : null);

  // ✅ system은 목업만 유지하니까 실데이터에서는 제외
  // ✅ clubId 필터는 JS에서만(인덱스 피하려고)
  const merged = listU
    .filter((n) => String(n.kind || "").trim() !== "system")
    // 개인(user) 알림(clubId 없음)은 항상 표시, 팀 알림만 활성팀으로 필터
    .filter((n) => {
      const nClub = String(n.clubId || "");
      return !clubId || !nClub || nClub === String(clubId);
    });

  const sorted = sortByCreatedAtDesc(merged);

  console.log("merged (non-system) =", merged.length);
  console.log("sorted[0] =", sorted[0] ? debugRowShape(sorted[0]) : null);
  console.groupEnd();

  return sorted;
}





// ✅ 실시간 구독 버전 — 알림이 추가/삭제되면 사용자 화면에 즉시 반영
// 반환값은 구독 해제 함수(unsubscribe).
export function subscribeNotificationsForUser(
  { uid, clubId = "", limitCount = 60 } = {},
  onChange
) {
  if (!uid) {
    onChange && onChange([]);
    return () => {};
  }

  const col = collection(db, "notifications");
  const qUser = query(col, where("targetIds", "array-contains", uid), limit(limitCount));

  return onSnapshot(
    qUser,
    (snapU) => {
      const listU = (snapU?.docs || []).map((d) => ({
        id: d.id,
        ...d.data(),
        _from: "fs:USER",
      }));
      const merged = listU
        .filter((n) => String(n.kind || "").trim() !== "system")
    // 개인(user) 알림(clubId 없음)은 항상 표시, 팀 알림만 활성팀으로 필터
    .filter((n) => {
      const nClub = String(n.clubId || "");
      return !clubId || !nClub || nClub === String(clubId);
    });
      onChange && onChange(sortByCreatedAtDesc(merged));
    },
    (err) => {
      console.error("[noti] subscribeNotificationsForUser failed", err);
      onChange && onChange([]);
    }
  );
}

export function computeReadForUi({ items, uid }) {
  console.groupCollapsed("[noti] computeReadForUi");
  console.log("uid =", uid);
  console.log("items(fs) =", (items || []).length);

  const merged = sortByCreatedAtDesc([...(items || [])]);

  const withRead = merged.map((n) => {
    const readBy = n?.readBy || null;
    const isRead =
      !!(uid && readBy && typeof readBy === "object" && readBy[uid]);

    return { ...n, read: isRead };
  });

  const unread = withRead.filter((x) => !x.read).length;
  const read = withRead.length - unread;

  console.log("merged total =", withRead.length, "unread =", unread, "read =", read);
  console.groupEnd();

  return withRead;
}

// ✅ 여러 알림을 한 번에 읽음 처리 (자동읽음용)
export async function markNotificationsRead({ ids, uid }) {
  const list = Array.from(new Set((ids || []).filter(Boolean)));
  if (!uid || list.length === 0) return;

  // writeBatch는 1회 500건 제한 → 안전하게 나눠서 처리
  const CHUNK = 400;
  for (let i = 0; i < list.length; i += CHUNK) {
    const batch = writeBatch(db);
    list.slice(i, i + CHUNK).forEach((id) => {
      batch.update(doc(db, "notifications", id), {
        [`readBy.${uid}`]: serverTimestamp(),
      });
    });
    try {
      await batch.commit();
    } catch (e) {
      console.warn("[noti] markNotificationsRead chunk failed:", e?.message || e);
    }
  }
}

// ✅ 알림창 리셋 — 해당 uid를 모든 알림의 targetIds에서 제거해 그 사람 알림 패널을 비운다.
//    (팀장→팀원 전환 시, 예전 팀장 시절 알림이 남아 클릭 시 팀장 경로로 가 깨지는 문제 방지)
//    targetIds에서 본인 uid만 빼므로 다른 대상자에겐 영향 없음.
export async function clearNotificationsForUser({ uid } = {}) {
  const id = String(uid || "").trim();
  if (!id) return;

  const col = collection(db, "notifications");
  let snap = null;
  try {
    snap = await getDocs(query(col, where("targetIds", "array-contains", id)));
  } catch (e) {
    console.warn("[noti] clearNotificationsForUser query failed:", e?.message || e);
    return;
  }

  const ids = (snap?.docs || []).map((d) => d.id);
  if (ids.length === 0) return;

  const CHUNK = 400; // writeBatch 1회 500건 제한 → 안전하게 분할
  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = writeBatch(db);
    ids.slice(i, i + CHUNK).forEach((nid) => {
      batch.update(doc(db, "notifications", nid), {
        targetIds: arrayRemove(id),
        updatedAt: serverTimestamp(),
      });
    });
    try {
      await batch.commit();
    } catch (e) {
      console.warn("[noti] clearNotificationsForUser chunk failed:", e?.message || e);
    }
  }
}

export async function markNotificationRead({ notificationId, uid }) {
  if (!notificationId) return;
  if (!uid) return;

  console.groupCollapsed("[noti] markNotificationRead");
  console.log("notificationId =", notificationId);
  console.log("uid =", uid);

  try {
    await updateDoc(doc(db, "notifications", notificationId), {
      [`readBy.${uid}`]: serverTimestamp(),
    });
    console.log("ok");
  } catch (e) {
    console.log("failed:", e);
    throw e;
  } finally {
    console.groupEnd();
  }
}
