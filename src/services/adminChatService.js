/* eslint-disable */
// src/services/adminChatService.js
// 관리자가 채팅방을 모니터링/잠금/삭제하는 서비스
// Firestore: chatRooms/{id} 에 locked, lockedAt, lockedBy 필드 사용
// 메시지: chatRooms/{id}/messages

import { db } from "./firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  deleteField,
  writeBatch,
} from "firebase/firestore";

import { getUserPublicMeta } from "./counterpartService";

function toDate(v) {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeString(v) {
  return String(v || "").trim();
}

/**
 * 어드민용 채팅방 목록
 * - chatRooms 전체 (createdAt desc)
 * - 참여자 닉네임 매핑
 * - 메시지 수는 비싸서 lastMessageText/lastMessageAt만 사용
 */
export async function listAdminChatRooms() {
  const col = collection(db, "chatRooms");
  let snap;
  try {
    snap = await getDocs(query(col, orderBy("createdAt", "desc")));
  } catch (e) {
    snap = await getDocs(col);
  }

  const raws = [];
  snap.forEach((d) => raws.push({ id: d.id, ...d.data() }));

  const uniqUids = new Set();
  raws.forEach((r) => {
    const ps = Array.isArray(r.participantUids) ? r.participantUids : [];
    ps.forEach((u) => {
      const s = safeString(u);
      if (s) uniqUids.add(s);
    });
  });

  const metaByUid = {};
  for (const uid of uniqUids) {
    metaByUid[uid] = await getUserPublicMeta(uid);
  }

  const rows = raws.map((r) => {
    const ps = Array.isArray(r.participantUids) ? r.participantUids : [];
    const participants = ps.map((uid) => {
      const meta = metaByUid[safeString(uid)] || { name: "", avatar: "" };
      return {
        uid: safeString(uid),
        name: safeString(meta.name) || "(이름없음)",
        avatar: safeString(meta.avatar),
      };
    });

    return {
      id: r.id,
      type: safeString(r.type) || "dm",
      dmKey: safeString(r.dmKey),
      participants,
      participantUids: ps.map((u) => safeString(u)),
      lastMessageText: safeString(r.lastMessageText),
      lastMessageAt: toDate(r.lastMessageAt),
      lastMessageFromUid: safeString(r.lastMessageFromUid),
      createdAt: toDate(r.createdAt),
      createdByUid: safeString(r.createdByUid),
      createdFrom: safeString(r.createdFrom),
      locked: !!r.locked,
      lockedAt: toDate(r.lockedAt),
      lockedBy: safeString(r.lockedBy),
      lockedReason: safeString(r.lockedReason),
    };
  });

  // 잠긴 방은 뒤로 빼고, 그 다음 lastMessageAt(없으면 createdAt) 최신순
  rows.sort((a, b) => {
    if (a.locked !== b.locked) return a.locked ? 1 : -1;
    const ta = (a.lastMessageAt || a.createdAt)?.getTime() || 0;
    const tb = (b.lastMessageAt || b.createdAt)?.getTime() || 0;
    return tb - ta;
  });

  return rows;
}

/**
 * 채팅방 상세 (방 + 메시지 + 참여자 메타)
 */
export async function loadAdminChatRoomDetail(chatId) {
  const id = safeString(chatId);
  if (!id) return { room: null, messages: [] };

  const ref = doc(db, "chatRooms", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { room: null, messages: [] };

  const data = snap.data() || {};
  const ps = Array.isArray(data.participantUids) ? data.participantUids : [];

  const metaByUid = {};
  for (const uid of ps) {
    const u = safeString(uid);
    if (!u) continue;
    metaByUid[u] = await getUserPublicMeta(u);
  }

  const participants = ps.map((uid) => {
    const u = safeString(uid);
    const meta = metaByUid[u] || { name: "", avatar: "" };
    return {
      uid: u,
      name: safeString(meta.name) || "(이름없음)",
      avatar: safeString(meta.avatar),
    };
  });

  const room = {
    id: snap.id,
    type: safeString(data.type) || "dm",
    dmKey: safeString(data.dmKey),
    participants,
    participantUids: ps.map((u) => safeString(u)),
    createdAt: toDate(data.createdAt),
    createdByUid: safeString(data.createdByUid),
    createdFrom: safeString(data.createdFrom),
    lastMessageText: safeString(data.lastMessageText),
    lastMessageAt: toDate(data.lastMessageAt),
    lastMessageFromUid: safeString(data.lastMessageFromUid),
    locked: !!data.locked,
    lockedAt: toDate(data.lockedAt),
    lockedBy: safeString(data.lockedBy),
    lockedReason: safeString(data.lockedReason),
  };

  const ms = await getDocs(
    query(collection(db, "chatRooms", id, "messages"), orderBy("createdAt", "asc"))
  );

  const messages = [];
  ms.forEach((d) => {
    const m = d.data() || {};
    messages.push({
      id: d.id,
      kind: safeString(m.kind) || "text",
      text: safeString(m.text),
      images: Array.isArray(m.images) ? m.images : [],
      fromUid: safeString(m.fromUid),
      createdAt: toDate(m.createdAt),
    });
  });

  return { room, messages };
}

/**
 * 채팅방 잠금/해제 (잠그면 사용자 측 송신 함수가 차단)
 */
export async function setChatRoomLocked({ chatId, locked, reason = "", byAdmin = "admin" }) {
  const id = safeString(chatId);
  if (!id) throw new Error("chatId가 비어있습니다.");

  const ref = doc(db, "chatRooms", id);
  if (locked) {
    await updateDoc(ref, {
      locked: true,
      lockedAt: serverTimestamp(),
      lockedBy: safeString(byAdmin) || "admin",
      lockedReason: safeString(reason),
    });
  } else {
    await updateDoc(ref, {
      locked: false,
      lockedAt: deleteField(),
      lockedBy: deleteField(),
      lockedReason: deleteField(),
    });
  }
  return { chatId: id, locked: !!locked };
}

/**
 * 어드민이 메시지 1개 삭제
 */
export async function deleteChatMessageByAdmin({ chatId, messageId }) {
  const cid = safeString(chatId);
  const mid = safeString(messageId);
  if (!cid || !mid) throw new Error("chatId/messageId가 비어있습니다.");
  await deleteDoc(doc(db, "chatRooms", cid, "messages", mid));
  return { chatId: cid, messageId: mid };
}

/**
 * 채팅방 전체 삭제 (메시지 서브컬렉션 포함, 하드 삭제)
 */
export async function deleteChatRoomByAdmin({ chatId }) {
  const id = safeString(chatId);
  if (!id) throw new Error("chatId가 비어있습니다.");

  // 메시지 일괄 삭제 (배치 500개씩)
  try {
    const ms = await getDocs(collection(db, "chatRooms", id, "messages"));
    const docsArr = [];
    ms.forEach((d) => docsArr.push(d.ref));
    while (docsArr.length > 0) {
      const chunk = docsArr.splice(0, 400);
      const batch = writeBatch(db);
      chunk.forEach((r) => batch.delete(r));
      await batch.commit();
    }
  } catch (e) {
    console.warn("[adminChat] delete messages failed:", e?.message || e);
  }

  await deleteDoc(doc(db, "chatRooms", id));
  return { chatId: id };
}
