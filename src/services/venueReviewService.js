/* eslint-disable */
// src/services/venueReviewService.js
// 구장 리뷰·평점 — venueReviews 컬렉션(유저당 구장 1리뷰, 업서트) + venues.rating/reviewCount 집계.
// 무결제/승인제와 호환: 예약 status "done"(이용 완료) 이후 작성. 집계 필드가 채워지면
// 목록/상세의 기존 별점 UI(항상 "신규"였던 죽은 UI)가 자동 활성화된다.

import { db } from "./firebase";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, limit, serverTimestamp,
} from "firebase/firestore";

const toStr = (v) => String(v || "").trim();

/** 리뷰 작성/수정(업서트) 후 구장 평점 재집계 */
export async function addVenueReview({ venueId, uid, userName, rating, text } = {}) {
  const vid = toStr(venueId);
  const u = toStr(uid);
  const score = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)));
  if (!vid || !u) throw new Error("리뷰 정보가 부족해요.");
  if (!(score >= 1)) throw new Error("별점을 선택해 주세요.");

  await setDoc(
    doc(db, "venueReviews", `${vid}_${u}`),
    {
      venueId: vid,
      uid: u,
      userName: toStr(userName) || "회원",
      rating: score,
      text: toStr(text).slice(0, 1000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await recomputeVenueRating(vid);
  return true;
}

async function recomputeVenueRating(venueId) {
  const vid = toStr(venueId);
  let sum = 0;
  let count = 0;
  try {
    const snap = await getDocs(query(collection(db, "venueReviews"), where("venueId", "==", vid)));
    snap.forEach((d) => {
      const r = Number(d.data()?.rating) || 0;
      if (r > 0) { sum += r; count += 1; }
    });
  } catch (e) {
    console.warn("[venueReview] recompute read failed:", e?.message || e);
    return;
  }
  const avg = count ? Math.round((sum / count) * 10) / 10 : 0;
  try {
    await updateDoc(doc(db, "venues", vid), {
      rating: avg,
      reviewCount: count,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    // venue 문서 없거나 규칙 — 집계 실패는 무시(리뷰 자체는 저장됨)
  }
}

/** 구장 리뷰 목록(최신순). 복합 인덱스 없으면 where만으로 폴백 후 클라 정렬. */
export async function listVenueReviews(venueId, max = 20) {
  const vid = toStr(venueId);
  if (!vid) return [];
  const sortDesc = (rows) =>
    rows.sort((a, b) => (b?.createdAt?.seconds || 0) - (a?.createdAt?.seconds || 0));
  try {
    const snap = await getDocs(
      query(collection(db, "venueReviews"), where("venueId", "==", vid), orderBy("createdAt", "desc"), limit(max))
    );
    const rows = [];
    snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
    return rows;
  } catch (e) {
    try {
      const snap = await getDocs(
        query(collection(db, "venueReviews"), where("venueId", "==", vid), limit(max))
      );
      const rows = [];
      snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      return sortDesc(rows);
    } catch {
      return [];
    }
  }
}

/** 내가 이 구장에 남긴 리뷰(수정 프리필용) */
export async function getMyVenueReview(venueId, uid) {
  const vid = toStr(venueId);
  const u = toStr(uid);
  if (!vid || !u) return null;
  try {
    const s = await getDoc(doc(db, "venueReviews", `${vid}_${u}`));
    return s.exists() ? { id: s.id, ...s.data() } : null;
  } catch {
    return null;
  }
}
