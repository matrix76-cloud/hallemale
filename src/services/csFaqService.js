/* eslint-disable */
// src/services/csFaqService.js
// ✅ CS 답변 원본(FAQ) 읽기
// - SSOT: csFaq/{id}  (보안규칙상 읽기 공개 / 쓰기 어드민)
// - 앱 FAQ 화면과 카카오톡 챗봇 스킬 서버가 같은 컬렉션을 본다.
// - DB 가 비었거나 조회에 실패하면 csFaqDefaults 로 폴백한다 — FAQ 화면이 빈 화면이 되지 않게.
// - 인덱스 최소화 원칙: where/orderBy 없이 전량 조회 후 메모리 필터·정렬.
//   (문항 수가 수십 건 규모라 전량 조회가 인덱스보다 싸다)

import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import { hasMock, mockData, mockQuerySnap } from "../dev/mockBus";
import { defaultFaqsFor } from "../data/csFaqDefaults";

const toStr = (v) => String(v ?? "").trim();

function normalize(id, d) {
  return {
    id,
    audience: toStr(d?.audience) || "user",
    q: toStr(d?.q),
    a: toStr(d?.a),
    keywords: Array.isArray(d?.keywords) ? d.keywords : [],
    order: Number(d?.order) || 0,
    active: d?.active !== false,
  };
}

/**
 * 노출 대상 FAQ 목록.
 * @param {"user"|"owner"} audience
 */
export async function listCsFaq(audience = "user") {
  try {
    const snap = hasMock("csFaq")
      ? mockQuerySnap(mockData("csFaq"))
      : await getDocs(collection(db, "csFaq"));

    const list = [];
    snap.forEach((d) => list.push(normalize(d.id, d.data())));

    const visible = list
      .filter((f) => f.active && f.audience === audience && f.q && f.a)
      .sort((a, b) => a.order - b.order);

    // 아직 시드하지 않은 환경 — 코드 기본값으로 채운다.
    if (!visible.length) return defaultFaqsFor(audience);
    return visible;
  } catch (e) {
    console.warn("[csFaq] 조회 실패, 기본값 사용:", e?.message || e);
    return defaultFaqsFor(audience);
  }
}
