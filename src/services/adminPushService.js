/* eslint-disable */
// src/services/adminPushService.js
// 어드민 푸시 발송 — notifications 문서를 만들면 서버 트리거(onNotificationCreated)가 FCM 을 쏜다.
// 실패해도 status 를 queued 로 두면 sendPushTick(스케줄 폴백)이 재시도한다.
//
// targetIds: []      → 브로드캐스트(토큰 보유 전체)
// targetIds: [uid..] → 개별 발송
import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, where,
} from "firebase/firestore";
import { db } from "./firebase";
import { hasMock, mockData, mockQuerySnap } from "../dev/mockBus";

const toStr = (v) => String(v ?? "").trim();

/** 발송 대상 후보 조회 — 닉네임·이름·이메일로 찾는다(어드민 화면 전용) */
export async function searchPushTargets(keyword) {
  const k = toStr(keyword).toLowerCase();
  if (k.length < 2) return [];
  const snap = hasMock("userDocs")
    ? mockQuerySnap(mockData("userDocs"))
    : await getDocs(query(collection(db, "users"), limit(500)));
  const out = [];
  snap.forEach((d) => {
    const u = d.data() || {};
    const hay = [u.nickname, u.name, u.email, u.ownerManagerName].map((x) => toStr(x).toLowerCase());
    if (hay.some((h) => h && h.includes(k))) {
      out.push({
        uid: d.id,
        label: toStr(u.nickname) || toStr(u.name) || toStr(u.ownerManagerName) || d.id,
        email: toStr(u.email),
        tokens: Array.isArray(u.fcmTokens) ? u.fcmTokens.length : 0,
      });
    }
  });
  return out.slice(0, 20);
}

/** 토큰을 가진 사용자 수 — 브로드캐스트 전에 "몇 명에게 가는지" 보여주려고 센다 */
export async function countPushReachable() {
  const snap = hasMock("userDocs")
    ? mockQuerySnap(mockData("userDocs"))
    : await getDocs(query(collection(db, "users"), limit(1000)));
  let n = 0;
  snap.forEach((d) => {
    const t = d.data()?.fcmTokens;
    if (Array.isArray(t) && t.length) n += 1;
  });
  return n;
}

/**
 * 푸시 발송(예약 아님 — 즉시 큐잉).
 * @param {string} title  제목 (필수)
 * @param {string} body   본문
 * @param {string} deepLink 눌렀을 때 열 앱 내 경로 (기본 /notifications)
 * @param {string[]} targetIds 빈 배열이면 전체 발송
 */
export async function sendAdminPush({ title, body, deepLink, targetIds = [] } = {}) {
  const t = toStr(title);
  if (!t) throw new Error("제목을 입력해주세요.");
  const ids = (Array.isArray(targetIds) ? targetIds : []).map(toStr).filter(Boolean);

  const ref = await addDoc(collection(db, "notifications"), {
    kind: "admin",
    type: "admin_push",
    title: t,
    body: toStr(body),
    targetType: ids.length ? "USER" : "ALL",
    targetIds: ids,
    prefsCategory: "notice",
    deepLink: toStr(deepLink) || "/notifications",
    push: { enabled: true, status: "queued", sentAt: null, failReason: null },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    readBy: {},
  });
  return { id: ref.id };
}

/**
 * 발송 결과 조회.
 * 서버 트리거(sendPushNotifications.js)는 push.status 와 failReason 만 기록한다.
 *   queued  대기 · sent 발송됨 · skipped 받을 사람 없음(토큰 없음/알림 끔) · failed 실패
 * 건수(성공 N건)는 서버가 남기지 않아 여기서 보여줄 수 없다 — 필요하면 트리거에서
 * response.successCount 를 문서에 기록하도록 먼저 고쳐야 한다.
 */
export async function getPushResult(notificationId) {
  const id = toStr(notificationId);
  if (!id) return null;
  const s = await getDoc(doc(db, "notifications", id));
  if (!s.exists()) return null;
  const d = s.data() || {};
  return {
    id,
    status: toStr(d.push?.status) || "queued",
    failReason: toStr(d.push?.failReason),
  };
}

/** 최근 발송 이력 — 발송 로그 화면에서도 쓴다 */
export async function listRecentPushes(max = 30) {
  if (hasMock("notificationDocs")) {
    const rows = Object.entries(mockData("notificationDocs") || {}).map(([id, d]) => ({ id, ...d }));
    return rows.slice(0, max);
  }
  const snap = await getDocs(
    query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(max)),
  );
  const out = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    out.push({
      id: d.id,
      kind: toStr(x.kind),
      type: toStr(x.type),
      title: toStr(x.title),
      body: toStr(x.body),
      targetType: toStr(x.targetType) || (Array.isArray(x.targetIds) && x.targetIds.length ? "USER" : "ALL"),
      targetCount: Array.isArray(x.targetIds) ? x.targetIds.length : 0,
      status: toStr(x.push?.status),
      failReason: toStr(x.push?.failReason),
      createdAt: x.createdAt?.toDate ? x.createdAt.toDate() : null,
    });
  });
  return out;
}
