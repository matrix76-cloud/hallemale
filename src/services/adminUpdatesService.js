/* eslint-disable */
// src/services/adminUpdatesService.js
// 어드민 앱 업데이트 — app_updates 문서를 만들면 접속 중인 클라이언트가
// checkAppUpdate(App.js VersionChecker)에서 최신 문서를 읽어 자기 로컬 버전과 비교하고,
// 더 높으면 토스트를 띄운 뒤 캐시를 비우고 새로고침한다.
// 즉 여기서 버전을 올리는 것 = 사용자 화면을 강제로 새로고침시키는 것이다.
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { isVersionNewer } from "./appVersionService";

const toStr = (v) => String(v ?? "").trim();

// 1.2 / 1.2.3 / 1.2.3.4 처럼 숫자와 점만. isVersionNewer 가 점 단위 숫자 비교라
// 다른 형식(v1.2, 1.2-beta)을 넣으면 비교가 0 으로 무너진다.
export function isValidVersion(v) {
  return /^\d+(\.\d+){0,3}$/.test(toStr(v));
}

/**
 * 등록된 버전 이력 (최신순).
 * 컬렉션 전체를 받아 클라이언트에서 정렬한다 — orderBy("createdAt") 는 그 필드가 없는 문서
 * (콘솔에서 수동으로 만든 건)를 통째로 빼버려서, 관리자 화면이 사용자 앱과 다른 "최신"을
 * 보게 된다. 버전 문서는 몇십 건 규모라 전체를 읽어도 부담이 없다.
 */
export async function listAppUpdates(max = 30) {
  const snap = await getDocs(collection(db, "app_updates"));
  const out = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    out.push({
      id: d.id,
      version: toStr(x.version),
      content: toStr(x.content),
      createdAt: x.createdAt?.toDate ? x.createdAt.toDate() : null,
    });
  });
  // 등록 시각이 없는 문서는 뒤로 — 사용자 앱(fetchLatestUpdate)의 정렬과 같은 기준
  out.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  return out.slice(0, max);
}

/**
 * 새 버전 등록.
 * @param {string} version  숫자·점 형식 (예: 1.2.3)
 * @param {string} content  토스트에 표시할 변경 내용
 * @param {string} latest   현재 최신 버전 — 이보다 높지 않으면 아무 일도 일어나지 않으므로 막는다
 */
export async function publishAppUpdate({ version, content, latest } = {}) {
  const v = toStr(version);
  if (!isValidVersion(v)) throw new Error("버전은 숫자와 점으로만 적어주세요. (예: 1.2.3)");
  if (toStr(latest) && !isVersionNewer(v, latest)) {
    throw new Error(`현재 최신(${latest})보다 높은 버전이어야 새로고침이 걸려요.`);
  }
  const ref = await addDoc(collection(db, "app_updates"), {
    version: v,
    content: toStr(content),
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

/** 잘못 올린 버전 삭제 — 이미 새로고침된 사용자는 되돌아가지 않는다(다음 배포 기준만 바로잡힌다) */
export async function deleteAppUpdate(id) {
  const key = toStr(id);
  if (!key) return;
  await deleteDoc(doc(db, "app_updates", key));
}
