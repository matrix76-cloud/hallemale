/* eslint-disable */
// src/services/chatService.js
import { db } from "./firebase";

import {
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  runTransaction,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
} from "firebase/firestore";

import {
  getStorage,
  ref as sRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

function sortPair(a, b) {
  const A = String(a || "").trim();
  const B = String(b || "").trim();
  if (!A || !B) return [];
  return [A, B].sort();
}

export function makeDmKey(uidA, uidB) {
  const pair = sortPair(uidA, uidB);
  if (pair.length !== 2) return "";
  return `${pair[0]}__${pair[1]}`;
}

export async function getOrCreateDmRoom({
  myUid,
  otherUid,
  createdFrom = "playerProfile",
  createdFromRefId = null,
} = {}) {
  if (!myUid) throw new Error("getOrCreateDmRoom: myUid is required");
  if (!otherUid) throw new Error("getOrCreateDmRoom: otherUid is required");
  if (myUid === otherUid) throw new Error("getOrCreateDmRoom: same uid");

  const dmKey = makeDmKey(myUid, otherUid);
  if (!dmKey) throw new Error("getOrCreateDmRoom: invalid dmKey");

  const roomRef = doc(db, "chatRooms", dmKey);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (snap.exists()) return;

    const participantUids = sortPair(myUid, otherUid);

    tx.set(roomRef, {
      id: dmKey,
      type: "dm",
      dmKey,
      participantUids,
      createdAt: serverTimestamp(),
      createdByUid: myUid,
      createdFrom: String(createdFrom || "playerProfile"),
      createdFromRefId: createdFromRefId ? String(createdFromRefId) : null,

      lastMessageText: "",
      lastMessageAt: null,
      lastMessageFromUid: "",

      lastReadAtBy: {},
      firstEnterAtBy: {},
      lastEnterAtBy: {},
      remindersBy: {},
      mutedBy: {},
    });
  });

  return dmKey;
}

// 매칭룸 전용 채팅방: 키를 matchRoomId 기준으로 만들어 "각 매칭룸마다 독립 채팅" 보장.
// (DM은 두 UID로만 키를 만들어 같은 두 팀의 여러 매칭룸이 채팅을 공유하는 문제가 있음)
export async function getOrCreateMatchRoomChat({
  matchRoomId,
  myUid,
  otherUid,
} = {}) {
  const roomId = String(matchRoomId || "").trim();
  if (!roomId) throw new Error("getOrCreateMatchRoomChat: matchRoomId is required");
  if (!myUid) throw new Error("getOrCreateMatchRoomChat: myUid is required");

  const chatId = `match_${roomId}`;
  const roomRef = doc(db, "chatRooms", chatId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (snap.exists()) return;

    const participantUids = otherUid ? sortPair(myUid, otherUid) : [String(myUid)];

    tx.set(roomRef, {
      id: chatId,
      type: "matchRoom",
      matchRoomId: roomId,
      participantUids,
      createdAt: serverTimestamp(),
      createdByUid: myUid,
      createdFrom: "matchRoom",
      createdFromRefId: roomId,

      lastMessageText: "",
      lastMessageAt: null,
      lastMessageFromUid: "",

      lastReadAtBy: {},
      firstEnterAtBy: {},
      lastEnterAtBy: {},
      remindersBy: {},
      mutedBy: {},
    });
  });

  return chatId;
}

export async function getChatRoom({ chatId } = {}) {
  if (!chatId) throw new Error("getChatRoom: chatId is required");

  const refDoc = doc(db, "chatRooms", chatId);
  const snap = await getDoc(refDoc);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ✅ 매치 채팅이 종료(닫힘)됐는지: 경기가 완료(finished)거나 취소(cancelled)면 더 이상 메시지 불가.
//    chatId가 match_{matchId} 인 경우에만 검사. 일반 채팅(DM 등)은 항상 열림.
//    경기 종료 후 상대팀과 연락할 수 없도록 채팅을 막는 데 사용(서비스/화면 공용).
export async function isMatchChatClosed({ chatId } = {}) {
  const cid = String(chatId || "").trim();
  if (!cid.startsWith("match_")) return { closed: false, reason: "" };
  const matchId = cid.slice("match_".length);
  if (!matchId) return { closed: false, reason: "" };
  try {
    const s = await getDoc(doc(db, "match_requests", matchId));
    if (!s.exists()) return { closed: false, reason: "" };
    const data = s.data() || {};
    const st = String(data.status || "").trim();

    if (st === "finished")
      return { closed: true, reason: "이미 종료된 경기예요. 더 이상 메시지를 보낼 수 없어요." };
    if (st === "cancelled")
      return { closed: true, reason: "취소된 경기예요. 더 이상 메시지를 보낼 수 없어요." };

    // 확정 경기가 경기 종료시각(예정시각 + 경기시간)을 지났으면 닫힘
    // (앱이 isPast로 매칭룸 채팅 진입을 숨기는 것과 동일 기준)
    if (st === "confirmed") {
      const schedMs = data.scheduledAt ? new Date(data.scheduledAt).getTime() : NaN;
      if (Number.isFinite(schedMs)) {
        const durMin = Number(data.durationMin) > 0 ? Number(data.durationMin) : 120;
        if (Date.now() >= schedMs + durMin * 60 * 1000) {
          return { closed: true, reason: "경기가 끝나 더 이상 메시지를 보낼 수 없어요." };
        }
      }
    }

    return { closed: false, reason: "" };
  } catch (e) {
    // 조회 실패 시에는 차단하지 않음(오탐 방지)
    return { closed: false, reason: "" };
  }
}

export async function enterChat({ chatId, myUid } = {}) {
  if (!chatId) throw new Error("enterChat: chatId is required");
  if (!myUid) throw new Error("enterChat: myUid is required");


  const refDoc = doc(db, "chatRooms", chatId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(refDoc);
    if (!snap.exists()) throw new Error("enterChat: room not found");
    const data = snap.data() || {};

    const first = data?.firstEnterAtBy || {};
    const now = serverTimestamp();

    const patch = {
      [`lastEnterAtBy.${myUid}`]: now,
      [`lastReadAtBy.${myUid}`]: now,
    };

    if (!first || !first[myUid]) {
      patch[`firstEnterAtBy.${myUid}`] = now;
    }

    tx.update(refDoc, patch);
  });
}


export async function listMyChatRooms({ myUid, limitCount = 50 } = {}) {
  if (!myUid) throw new Error("listMyChatRooms: myUid is required");

  const q = query(
    collection(db, "chatRooms"),
    where("participantUids", "array-contains", myUid),
    orderBy("createdAt", "desc"),
    limit(Math.max(1, Math.min(200, Number(limitCount) || 50)))
  );

  return new Promise((resolve, reject) => {
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        try {
          unsub && unsub();
        } catch (e) {}
        resolve(list);
      },
      (err) => {
        console.error("[chatService.listMyChatRooms] onSnapshot error", {
          code: err?.code,
          message: err?.message,
          name: err?.name,
          stack: err?.stack,
        });
        try {
          unsub && unsub();
        } catch (e) {}
        reject(err);
      }
    );
  });
}


// 채팅방 문서(메타) 실시간 구독 — lastReadAtBy(읽음 표시)·locked 등 변화 감지용
export function listenChatRoom({ chatId, onChange } = {}) {
  if (!chatId) throw new Error("listenChatRoom: chatId is required");
  if (typeof onChange !== "function")
    throw new Error("listenChatRoom: onChange is required");

  const refDoc = doc(db, "chatRooms", chatId);
  return onSnapshot(
    refDoc,
    (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    () => onChange(null)
  );
}

export function listenChatMessages({
  chatId,
  onChange,
  limitCount = 200,
} = {}) {
  if (!chatId) throw new Error("listenChatMessages: chatId is required");
  if (typeof onChange !== "function")
    throw new Error("listenChatMessages: onChange is required");


  const q = query(
    collection(db, "chatRooms", chatId, "messages"),
    orderBy("createdAt", "asc"),
    limit(Math.max(1, Math.min(500, Number(limitCount) || 200)))
  );

  const unsub = onSnapshot(
    q,
    (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      onChange(list);
    },
    () => {
      onChange([]);
    }
  );

  return unsub;
}

async function updateLastMessageMeta({
  chatId,
  fromUid,
  lastMessageText,
} = {}) {

  const refDoc = doc(db, "chatRooms", chatId);
  await updateDoc(refDoc, {
    lastMessageText: String(lastMessageText || "").slice(0, 140),
    lastMessageAt: serverTimestamp(),
    lastMessageFromUid: String(fromUid || ""),
  });

  // 매칭룸 채팅이면 match_requests 활동 갱신 → 상대 클럽에 "미확인" 배지(보낸 사람은 본 것으로 처리)
  const cid = String(chatId || "");
  if (cid.startsWith("match_")) {
    const matchId = cid.slice("match_".length);
    const sender = String(fromUid || "");
    if (matchId) {
      try {
        const patch = { lastActivityAt: serverTimestamp() };
        if (sender) patch[`lastSeenBy.${sender}`] = serverTimestamp();
        await updateDoc(doc(db, "match_requests", matchId), patch);
      } catch (e) {
        console.warn("[chat] bump match activity failed:", e?.message || e);
      }
    }
  }
}

async function notifyChatRecipients({ chatId, fromUid, preview } = {}) {
  try {
    const room = await getChatRoom({ chatId });
    if (!room) return;
    const participants = Array.isArray(room.participantUids) ? room.participantUids : [];
    const targets = participants.filter((u) => String(u || "") && String(u) !== String(fromUid));
    if (!targets.length) return;

    // 발신자 팀 정보로 알림 보강: 팀 프로필 사진 + 팀명 + 팀장명(매치룸 채팅의 발신자=팀장)
    let actorTeamName = "";
    let actorLeaderName = "";
    let actorTeamLogoUrl = "";
    try {
      const uSnap = await getDoc(doc(db, "users", String(fromUid)));
      const u = uSnap.exists() ? uSnap.data() : null;
      if (u) {
        actorLeaderName = String(u.nickname || u.name || "");
        actorTeamName = String(u.activeTeamName || u.teamName || "");
        const teamId = String(u.activeTeamId || u.clubId || "");
        if (teamId) {
          const cSnap = await getDoc(doc(db, "clubs", teamId));
          if (cSnap.exists()) {
            const c = cSnap.data() || {};
            actorTeamLogoUrl = String(c.logoUrl || "");
            if (!actorTeamName) actorTeamName = String(c.name || "");
          }
        }
      }
    } catch (e) {
      // 보강 실패 시 기본 제목으로 폴백
    }
    const actorTitle = actorTeamName
      ? (actorLeaderName ? `${actorTeamName} · ${actorLeaderName}` : actorTeamName)
      : "새 메시지";

    await addDoc(collection(db, "notifications"), {
      kind: "chat",
      subType: "chatMessage",
      type: "chat_message",
      title: actorTitle,
      body: String(preview || "메시지가 도착했어요").slice(0, 140),
      targetType: "USER",
      targetIds: targets,
      actorUid: String(fromUid || ""),
      linkType: "chat",
      linkTargetId: chatId,
      meta: { chatId, fromUid, deepLink: `/chats/${chatId}`, actorTeamName, actorLeaderName, actorTeamLogoUrl },
      push: { enabled: true, status: "queued", sentAt: null, failReason: null },
      prefsCategory: "chat",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      readBy: {},
    });
  } catch (e) {
    console.warn("[chat] notifyChatRecipients failed:", e?.message || e);
  }
}

export async function sendTextMessage({ chatId, fromUid, text } = {}) {
  if (!chatId) throw new Error("sendTextMessage: chatId is required");
  if (!fromUid) throw new Error("sendTextMessage: fromUid is required");
  const v = String(text || "").trim();
  if (!v) return;

  // 어드민이 잠근 방은 송신 차단
  const room = await getChatRoom({ chatId });
  if (room?.locked) {
    throw new Error("관리자가 잠근 채팅방입니다. 메시지를 보낼 수 없습니다.");
  }

  // 종료(완료/취소)된 경기 채팅은 송신 차단 — 경기 끝나면 상대팀과 연락 불가
  const closedT = await isMatchChatClosed({ chatId });
  if (closedT.closed) {
    throw new Error(closedT.reason || "종료된 경기라 메시지를 보낼 수 없습니다.");
  }

  await addDoc(collection(db, "chatRooms", chatId, "messages"), {
    chatId,
    fromUid,
    kind: "text",
    text: v,
    images: [],
    createdAt: serverTimestamp(),
  });

  await updateLastMessageMeta({ chatId, fromUid, lastMessageText: v });
  await notifyChatRecipients({ chatId, fromUid, preview: v });
}

// 시스템 메시지(라인업 확정 등) — 양 팀 모두에게 채팅창 가운데 안내로 표시.
// fromUid는 "system" 고정 → 어느 쪽에서도 "내 말풍선"이 아니라 시스템 알림으로 렌더됨.
export async function sendSystemMessage({ chatId, text, meta = {} } = {}) {
  if (!chatId) throw new Error("sendSystemMessage: chatId is required");
  const v = String(text || "").trim();
  if (!v) return;

  await addDoc(collection(db, "chatRooms", chatId, "messages"), {
    chatId,
    fromUid: "system",
    kind: "system",
    text: v,
    images: [],
    meta: meta || {},
    createdAt: serverTimestamp(),
  });

  // 채팅 목록 미리보기만 갱신 (매칭 활동 배지는 호출부에서 이미 처리됨).
  // 방 문서가 아직 없을 수 있으니 실패는 무시.
  try {
    await updateDoc(doc(db, "chatRooms", chatId), {
      lastMessageText: v.slice(0, 140),
      lastMessageAt: serverTimestamp(),
      lastMessageFromUid: "system",
    });
  } catch (e) {
    console.warn("[chat] system message meta update failed:", e?.message || e);
  }
}

function safeExt(file) {
  const name = String(file?.name || "").toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  const ext = name.slice(dot + 1).replace(/[^a-z0-9]/g, "");
  return ext ? `.${ext}` : "";
}

function buildStoragePath({ chatId, fromUid, file } = {}) {
  const ext = safeExt(file) || ".jpg";
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const rand = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `chat_media/${chatId}/${yyyy}/${mm}/${fromUid}_${rand}${ext}`;
}

async function uploadImageFile({ chatId, fromUid, file } = {}) {
  const storage = getStorage();
  const path = buildStoragePath({ chatId, fromUid, file });
  const storageRef = sRef(storage, path);

  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file?.type || "image/jpeg",
  });

  const url = await getDownloadURL(snapshot.ref);

  let w = 0;
  let h = 0;
  try {
    const img = new Image();
    const p = new Promise((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
    });
    img.src = URL.createObjectURL(file);
    const ok = await p;
    if (ok) {
      w = img.naturalWidth || 0;
      h = img.naturalHeight || 0;
    }
    try {
      URL.revokeObjectURL(img.src);
    } catch (e) {}
  } catch (e) {}

  return {
    url,
    path,
    w,
    h,
    size: Number(file?.size || 0),
    contentType: String(file?.type || "image/jpeg"),
  };
}

export async function sendImagesMessage({
  chatId,
  fromUid,
  files = [],
  text = "",
} = {}) {
  if (!chatId) throw new Error("sendImagesMessage: chatId is required");
  if (!fromUid) throw new Error("sendImagesMessage: fromUid is required");

  const picked = Array.isArray(files) ? files.slice(0, 4) : [];
  if (!picked.length) return;

  const vText = String(text || "").trim();

  // 어드민이 잠근 방은 송신 차단
  const room = await getChatRoom({ chatId });
  if (room?.locked) {
    throw new Error("관리자가 잠근 채팅방입니다. 메시지를 보낼 수 없습니다.");
  }

  // 종료(완료/취소)된 경기 채팅은 송신 차단
  const closedI = await isMatchChatClosed({ chatId });
  if (closedI.closed) {
    throw new Error(closedI.reason || "종료된 경기라 메시지를 보낼 수 없습니다.");
  }

  const images = [];
  for (const f of picked) {
    if (!f || !(String(f.type || "").startsWith("image/"))) continue;
    const meta = await uploadImageFile({ chatId, fromUid, file: f });
    images.push(meta);
  }

  if (!images.length) return;

  const kind = vText ? "mixed" : "image";

  await addDoc(collection(db, "chatRooms", chatId, "messages"), {
    chatId,
    fromUid,
    kind,
    text: vText,
    images,
    createdAt: serverTimestamp(),
  });

  const preview = images.length === 1 ? "사진" : `사진 ${images.length}장`;
  const last = vText ? `${preview} · ${vText}` : preview;

  await updateLastMessageMeta({ chatId, fromUid, lastMessageText: last });
  await notifyChatRecipients({ chatId, fromUid, preview: last });
}
