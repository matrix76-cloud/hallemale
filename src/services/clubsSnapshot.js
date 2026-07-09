// src/services/clubsSnapshot.js
/* eslint-disable */
// clubs 컬렉션 전체 스캔을 한 번만 하도록 묶는다.
//
// 스플래시에서 preloadHomeData 와 preloadMatchingHomeData 가 동시에 뜨는데,
// 둘 다 clubs 를 통째로 읽고 있었다(homeService.listAllClubs / matchingHomeService.getDocs).
// 같은 데이터를 부팅할 때마다 두 번 내려받던 셈이다.
//
// TTL 캐시가 아니라 "진행 중인 요청 공유(in-flight dedupe)" 다. 요청이 끝나면 캐시를 비우므로
// 다음 호출은 항상 새로 읽는다 → 데이터가 낡을 여지가 없고, 동시 호출만 하나로 합쳐진다.
//
// 반환값은 QuerySnapshot.docs (QueryDocumentSnapshot 배열). 호출측이 각자 normalize 한다.

import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";

let inflight = null;

export async function getAllClubDocs() {
  if (inflight) return inflight;

  inflight = getDocs(collection(db, "clubs"))
    .then((snap) => snap.docs)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
