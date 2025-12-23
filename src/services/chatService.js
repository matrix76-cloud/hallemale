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

export async function getChatRoom({ chatId } = {}) {
  if (!chatId) throw new Error("getChatRoom: chatId is required");

  const refDoc = doc(db, "chatRooms", chatId);
  const snap = await getDoc(refDoc);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
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
}

export async function sendTextMessage({ chatId, fromUid, text } = {}) {
  if (!chatId) throw new Error("sendTextMessage: chatId is required");
  if (!fromUid) throw new Error("sendTextMessage: fromUid is required");
  const v = String(text || "").trim();
  if (!v) return;



  await addDoc(collection(db, "chatRooms", chatId, "messages"), {
    chatId,
    fromUid,
    kind: "text",
    text: v,
    images: [],
    createdAt: serverTimestamp(),
  });

  await updateLastMessageMeta({ chatId, fromUid, lastMessageText: v });
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
}
