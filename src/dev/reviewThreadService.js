/* eslint-disable */
// 리뷰 스레드 백엔드 — Firestore(reviewThreads). 배포 URL 에서도 개발자·카스가 같은 기록을 공유.
// 각 문서 = 한 기록 { screenId, by, at, text, replyTo, imgs, pins, ts }
//  - pid = Firestore 문서 id (댓글 replyTo 가 이 id 를 가리킴)
//  - imgs = 압축된 dataURL 배열(문서 1MB 제한 대비 프론트에서 리사이즈). Storage 미사용.
//  - ts = serverTimestamp (정렬), at = KST 표시 문자열
import {
  collection, query, orderBy, where, onSnapshot,
  addDoc, deleteDoc, doc, getDocs, serverTimestamp,
} from "firebase/firestore";
import { db } from "../services/firebase";

const COL = "reviewThreads";
const kstNow = () =>
  new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);

// 전체 스레드 실시간 구독 → { screenId: [ {pid, by, at, text, replyTo, imgs, pins} ... ] }
export function subscribeThread(cb) {
  const q = query(collection(db, COL), orderBy("ts", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const all = {};
      snap.forEach((d) => {
        const data = d.data();
        const sid = data.screenId;
        if (!sid) return;
        if (!all[sid]) all[sid] = [];
        all[sid].push({
          pid: d.id,
          by: data.by,
          at: data.at,
          text: data.text || "",
          replyTo: data.replyTo || undefined,
          imgs: data.imgs || undefined,
          pins: data.pins || undefined,
        });
      });
      cb(all);
    },
    () => cb({}),
  );
}

// 기록 추가 (replyTo 있으면 그 글 밑 댓글)
export async function postEntry({ screenId, by, text, replyTo, imgs, pins }) {
  const payload = {
    screenId,
    by: by || "개발자",
    text: (text || "").trim(),
    at: kstNow(),
    ts: serverTimestamp(),
  };
  if (replyTo) payload.replyTo = replyTo;
  if (Array.isArray(imgs) && imgs.length) payload.imgs = imgs;
  if (Array.isArray(pins) && pins.length) payload.pins = pins.slice(0, 30);
  return addDoc(collection(db, COL), payload);
}

// 삭제 (글 삭제 시 그 글 댓글도 함께)
export async function deleteEntry(pid) {
  await deleteDoc(doc(db, COL, pid));
  const q = query(collection(db, COL), where("replyTo", "==", pid));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, COL, d.id))));
}
