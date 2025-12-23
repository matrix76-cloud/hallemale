/* eslint-disable */
// src/services/notificationService.js
// ✅ notifications(전역) 조회/읽음 처리 서비스
// ✅ system(kind==="system")만 목업 유지, 그 외는 실데이터
// ✅ 대상: GLOBAL + USER(uid)
// ✅ 인덱스 요구를 피하기 위해 Firestore orderBy는 쓰지 않고, JS에서 정렬
// ✅ 디버깅 로그 포함

import { db } from "./firebase";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { NOTIFICATIONS as NOTIFICATIONS_MOCK } from "../mock/notificationsMock";

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

export function getSystemMockNotifications() {
  const all = Array.isArray(NOTIFICATIONS_MOCK) ? NOTIFICATIONS_MOCK : [];
  const rows = all.filter((n) => n && n.kind === "system");
  return sortByCreatedAtDesc(rows);
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
    .filter((n) => (clubId ? String(n.clubId || "") === String(clubId) : true));

  const sorted = sortByCreatedAtDesc(merged);

  console.log("merged (non-system) =", merged.length);
  console.log("sorted[0] =", sorted[0] ? debugRowShape(sorted[0]) : null);
  console.groupEnd();

  return sorted;
}





export function computeReadForUi({ items, uid, localSystemReadMap }) {
  console.groupCollapsed("[noti] computeReadForUi");
  console.log("uid =", uid);
  console.log("items(fs) =", (items || []).length);

  const systemMocks = getSystemMockNotifications().map((n) => ({
    ...n,
    _from: "mock",
    read: (localSystemReadMap && localSystemReadMap[n.id]) ?? !!n.read,
  }));

  console.log("systemMocks =", systemMocks.length);

  const merged = sortByCreatedAtDesc([...(items || []), ...systemMocks]);

  const withRead = merged.map((n) => {
    if (n._from === "mock") return n;

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
