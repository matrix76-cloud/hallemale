/* eslint-disable */
// src/services/adminChatService.js
// 관리자가 채팅방을 모니터링/잠금/삭제하는 서비스
// Firestore: chatRooms/{id} 에 locked, lockedAt, lockedBy 필드 사용
// 메시지: chatRooms/{id}/messages

import { db } from "./firebase";
import { hasMock, mockData, mockQuerySnap } from "../dev/mockBus";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
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
  if (hasMock("adminChatRooms")) {
    snap = mockQuerySnap(mockData("adminChatRooms"));
  } else {
    try {
      snap = await getDocs(query(col, orderBy("createdAt", "desc")));
    } catch (e) {
      snap = await getDocs(col);
    }
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

  let data;
  if (hasMock("adminChatRooms")) {
    data = mockData("adminChatRooms")[id];
    if (!data) return { room: null, messages: [] };
  } else {
    const ref = doc(db, "chatRooms", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { room: null, messages: [] };
    data = snap.data() || {};
  }
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
    id,
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

  const ms = hasMock("adminChatMessages")
    ? mockQuerySnap(
        Object.keys(mockData("adminChatMessages"))
          .filter((k) => mockData("adminChatMessages")[k].chatId === id)
          .map((k) => ({ id: k, ...mockData("adminChatMessages")[k] }))
      )
    : await getDocs(
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
  await refreshLastMessageMeta(cid);
  return { chatId: cid, messageId: mid };
}

/** 채팅 목록 미리보기 문구 — 보낼 때 쓰는 형식(chatService.js:593-594)과 같게 맞춘다. */
function previewOf(msg) {
  const text = safeString(msg?.text);
  const imgs = Array.isArray(msg?.images) ? msg.images.length : 0;
  if (!imgs) return text.slice(0, 140);
  const preview = imgs === 1 ? "사진" : `사진 ${imgs}장`;
  return (text ? `${preview} · ${text}` : preview).slice(0, 140);
}

/**
 * 방 문서의 "최신 메시지" 를 남아 있는 마지막 메시지로 다시 맞춘다.
 *
 * 메시지 문서만 지우면 방 문서의 lastMessageText 는 그대로라, 지운 문장이 어드민 채팅 목록과
 * **사용자 채팅 목록** 미리보기에 계속 보인다. 부적절 메시지를 지운 의미가 없어지는 자리라
 * 삭제 직후 여기서 되맞춘다. 남은 메시지가 없으면 비운다.
 */
async function refreshLastMessageMeta(chatId) {
  const cid = safeString(chatId);
  if (!cid) return;
  try {
    const snap = await getDocs(
      query(
        collection(db, "chatRooms", cid, "messages"),
        orderBy("createdAt", "desc"),
        limit(1),
      )
    );
    const last = snap.docs[0]?.data() || null;
    await updateDoc(doc(db, "chatRooms", cid), last
      ? {
          lastMessageText: previewOf(last),
          lastMessageAt: last.createdAt || null,
          lastMessageFromUid: safeString(last.fromUid),
        }
      : { lastMessageText: "", lastMessageAt: null, lastMessageFromUid: "" });
  } catch (e) {
    // 미리보기 갱신 실패가 삭제를 되돌리지는 않는다.
    console.warn("[adminChat] refresh last message failed:", e?.message || e);
  }
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
