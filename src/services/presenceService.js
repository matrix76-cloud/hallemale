/* eslint-disable */
// src/services/presenceService.js
// 접속 현황(presence) — 누가 지금 앱을 켜 두고 있는지 어드민이 보기 위한 기록.
//
// 컬렉션: presence/{uid}  (회원 1명당 문서 1개, 계속 덮어쓴다)
//   lastActiveAt   마지막 하트비트 시각 — "지금 접속중"의 판정 기준
//   sessionStartAt 이번 페이지 로드에서 처음 하트비트를 보낸 시각
//   route          그 시점에 보고 있던 화면 경로
//   platform       "app"(RN 웹뷰) | "web"
//
// 왜 이 방식인가:
//  · Firestore 에는 접속이 끊긴 걸 알려주는 장치(RTDB 의 onDisconnect)가 없다. 그래서
//    "끊김"을 기록하지 않고 lastActiveAt 이 낡았는지로 판정한다 — 창을 강제로 닫든
//    비행기모드가 되든 ONLINE_WINDOW_MS 가 지나면 자동으로 접속중에서 빠진다.
//  · 회원당 문서 1개라 아무리 오래 써도 문서 수가 회원 수를 넘지 않는다.
//    (접속 "이력"을 매번 새 문서로 쌓으면 금방 수십만 건이 된다)
//
// ⚠️ 열람은 어드민만 — firestore.rules 의 presence 규칙에서 막는다.
//    닉네임을 문서에 같이 적어 두는 건(비정규화) 어드민 목록에서 회원 문서를 uid 마다
//    다시 읽지 않기 위해서다.

import { db } from "./firebase";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const COL = "presence";

/** 하트비트 주기. 이 값보다 ONLINE_WINDOW_MS 가 넉넉해야 정상 사용자가 깜빡이지 않는다. */
export const HEARTBEAT_MS = 60 * 1000;

/** 이 시간 안에 하트비트가 있었으면 "접속중". 주기의 2.5배 — 한 번 놓쳐도 안 튕긴다. */
export const ONLINE_WINDOW_MS = 150 * 1000;

const s = (v) => String(v ?? "").trim();

function toDate(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** RN 웹뷰 안이면 "app", 아니면 "web" */
function detectPlatform() {
  return typeof window !== "undefined" && window.ReactNativeWebView ? "app" : "web";
}

/**
 * 하트비트 1회.
 * @param {object} p
 * @param {string} p.uid        로그인 uid — 문서 id 가 된다(규칙이 본인 문서만 허용)
 * @param {string} [p.nickname]
 * @param {string} [p.profileUid] 통합 계정의 대표 uid (로그인 uid 와 다를 수 있다)
 * @param {string} [p.route]    현재 경로
 * @param {boolean} [p.isNewSession] 이번 페이지 로드의 첫 하트비트인가 — sessionStartAt 을 새로 찍는다
 */
export async function sendHeartbeat({ uid, nickname, profileUid, route, isNewSession }) {
  const id = s(uid);
  if (!id) return;

  const patch = {
    uid: id,
    nickname: s(nickname),
    profileUid: s(profileUid),
    route: s(route).slice(0, 120),
    platform: detectPlatform(),
    lastActiveAt: serverTimestamp(),
  };
  // 세션 시작 시각은 첫 하트비트에서만 — 매번 찍으면 "얼마나 머물렀는지"를 알 수 없다.
  if (isNewSession) patch.sessionStartAt = serverTimestamp();

  await setDoc(doc(db, COL, id), patch, { merge: true });
}

/**
 * 어드민용 접속 현황 목록. lastActiveAt 최신순.
 *
 * 접속중/최근접속을 따로 쿼리하지 않고 한 번 읽어 화면에서 가른다 —
 * "지금 몇 명"과 "최근에 누가 왔나"를 같은 화면에서 같이 보기 때문이다.
 *
 * @param {number} [limitCount] 최대 문서 수. 넘으면 truncated=true 로 알린다.
 * @returns {{rows:Array, onlineCount:number, truncated:boolean, now:number}}
 */
export async function listPresence({ limitCount = 500 } = {}) {
  const snap = await getDocs(
    query(collection(db, COL), orderBy("lastActiveAt", "desc"), limit(limitCount))
  );

  const now = Date.now();
  const rows = [];
  snap.forEach((d) => {
    const v = d.data() || {};
    const lastActiveAt = toDate(v.lastActiveAt);
    const sessionStartAt = toDate(v.sessionStartAt);
    const ms = lastActiveAt ? now - lastActiveAt.getTime() : Infinity;
    rows.push({
      uid: d.id,
      profileUid: s(v.profileUid),
      nickname: s(v.nickname) || "(이름없음)",
      route: s(v.route),
      platform: s(v.platform) || "web",
      lastActiveAt,
      sessionStartAt,
      online: ms <= ONLINE_WINDOW_MS,
      // 접속중인 사람의 체류 시간(ms). 끊긴 사람은 의미가 없어 null.
      stayMs:
        lastActiveAt && sessionStartAt && ms <= ONLINE_WINDOW_MS
          ? Math.max(0, lastActiveAt.getTime() - sessionStartAt.getTime())
          : null,
    });
  });

  return {
    rows,
    onlineCount: rows.filter((r) => r.online).length,
    truncated: rows.length >= limitCount,
    now,
  };
}
