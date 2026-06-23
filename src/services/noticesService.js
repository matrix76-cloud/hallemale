/* eslint-disable */
// src/services/noticesService.js
// 공지사항 컬렉션: notices
// fields:
//   - title: string
//   - content: string (multi-line)
//   - pinned: boolean (상단 고정)
//   - published: boolean (사용자 노출 여부)
//   - createdAt / updatedAt: Timestamp
//   - createdBy: string (admin uid 또는 이름)
import { db } from "./firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

const COL = "notices";

function toStr(v) {
  return String(v || "").trim();
}

function mapDoc(d) {
  const data = d.data() || {};
  return {
    id: d.id,
    title: toStr(data.title),
    content: toStr(data.content),
    pinned: !!data.pinned,
    published: data.published !== false, // 기본 true
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    createdBy: toStr(data.createdBy),
  };
}

/* ============== Admin: 전체 목록 ============== */
export async function listNoticesAdmin({ limitCount = 200 } = {}) {
  const col = collection(db, COL);
  const q = query(col, orderBy("createdAt", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  const rows = (snap?.docs || []).map(mapDoc);
  // 핀 우선 + createdAt desc (이미 desc로 옴)
  rows.sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return 0;
  });
  return rows;
}

/* ============== Public: 발행된 공지만 ============== */
export async function listPublishedNotices({ limitCount = 100 } = {}) {
  const col = collection(db, COL);
  const q = query(col, orderBy("createdAt", "desc"), limit(limitCount));
  const snap = await getDocs(q);
  const rows = (snap?.docs || []).map(mapDoc).filter((n) => n.published);
  rows.sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return 0;
  });
  return rows;
}

/* ============== Public: 발행된 공지 실시간 구독 ============== */
// 관리자가 공지를 추가/수정/삭제하면 사용자 화면에 즉시 반영된다.
// 반환값은 구독 해제 함수(unsubscribe).
export function subscribePublishedNotices(onChange, { limitCount = 100 } = {}) {
  const col = collection(db, COL);
  const q = query(col, orderBy("createdAt", "desc"), limit(limitCount));
  return onSnapshot(
    q,
    (snap) => {
      const rows = (snap?.docs || []).map(mapDoc).filter((n) => n.published);
      rows.sort((a, b) => {
        const ap = a.pinned ? 1 : 0;
        const bp = b.pinned ? 1 : 0;
        if (ap !== bp) return bp - ap;
        return 0;
      });
      onChange && onChange(rows);
    },
    (err) => {
      console.error("[noticesService] subscribePublishedNotices failed", err);
    }
  );
}

export async function getNotice(id) {
  const ref = doc(db, COL, String(id));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapDoc(snap);
}

/* ============== Admin: 작성/수정/삭제 ============== */
export async function createNotice({
  title,
  content,
  pinned = false,
  published = true,
  createdBy = "admin",
} = {}) {
  const t = toStr(title);
  const c = toStr(content);
  if (!t) throw new Error("제목을 입력해주세요.");
  if (!c) throw new Error("내용을 입력해주세요.");

  const ref = await addDoc(collection(db, COL), {
    title: t,
    content: c,
    pinned: !!pinned,
    published: !!published,
    createdBy: toStr(createdBy) || "admin",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateNotice(id, partial = {}) {
  const ref = doc(db, COL, String(id));
  const patch = {};
  if (partial.title !== undefined) patch.title = toStr(partial.title);
  if (partial.content !== undefined) patch.content = toStr(partial.content);
  if (partial.pinned !== undefined) patch.pinned = !!partial.pinned;
  if (partial.published !== undefined) patch.published = !!partial.published;
  patch.updatedAt = serverTimestamp();
  await updateDoc(ref, patch);
}

export async function deleteNotice(id) {
  await deleteDoc(doc(db, COL, String(id)));
}

/* ============== Admin: 공지 전체 푸시 발송 ============== */
// notifications 컬렉션에 queued 문서를 만들면 sendPushTick 크론이 FCM으로 발송한다.
// targetIds: [] = 전체 브로드캐스트(토큰 보유 + 알림설정 ON 사용자).
// 이 문서는 인앱 알림창 쿼리(array-contains uid)에 잡히지 않으므로 공지와 중복 노출되지 않는다.
export async function queueNoticeBroadcastPush({ noticeId, title, content } = {}) {
  const t = toStr(title);
  const c = toStr(content);
  if (!t) throw new Error("제목이 필요합니다.");

  await addDoc(collection(db, "notifications"), {
    kind: "notice",
    type: "admin_notice",
    title: t,
    body: c,
    targetIds: [],
    prefsCategory: "notice",
    deepLink: noticeId ? `/notificationsdetail/${noticeId}` : "/notifications",
    push: { enabled: true, status: "queued", sentAt: null, failReason: null },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
