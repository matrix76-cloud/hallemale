/* eslint-disable */
// functions/auth/deleteAccount.js
// 회원탈퇴 — Firebase Auth 계정 삭제 (서버/Admin SDK)
//
// 왜 서버에서 지우나:
//  - 클라이언트 deleteUser()는 "최근 로그인"(auth/requires-recent-login)을 요구해서
//    로그인 세션이 오래되면(카카오 커스텀 토큰 + keepLogin) 거의 항상 막힌다.
//  - Admin SDK deleteUser는 이 제약이 없어 확실하게 삭제된다.
//
// 흐름:
//  1) 클라이언트가 자신의 Firebase ID 토큰을 Authorization: Bearer 로 전달
//  2) verifyIdToken 으로 본인(uid) 확인 → 남의 계정 삭제 불가
//  3) users/{uid} 문서 삭제(안전망) + Auth 계정 삭제

const { onRequest } = require("firebase-functions/v2/https");
const { getAdmin } = require("../firebaseAdmin");

// Storage 버킷(웹 firebase config와 동일) — uid 기반 업로드 파일 삭제용.
const STORAGE_BUCKET = "halle-bf789.firebasestorage.app";

/**
 * 카카오 연결 끊기(unlink) — best-effort.
 * uid 는 "kakao:{kakaoId}" 형식(kakaoCustomToken.js)이라 접두어를 떼면 카카오 회원번호다.
 * unlink 를 해야 재가입 시 카카오가 "새 연결"로 인식 → 동의화면이 다시 뜬다.
 * (KAKAO_ADMIN_KEY 미설정이면 스킵 — 탈퇴 자체는 막지 않는다)
 */
async function unlinkKakao(uid) {
  if (!uid || !uid.startsWith("kakao:")) return;
  const adminKey = process.env.KAKAO_ADMIN_KEY;
  if (!adminKey) {
    console.warn("[deleteAccount] KAKAO_ADMIN_KEY not set — skip kakao unlink");
    return;
  }
  const kakaoId = uid.slice("kakao:".length);
  try {
    const r = await fetch("https://kapi.kakao.com/v1/user/unlink", {
      method: "POST",
      headers: {
        Authorization: `KakaoAK ${adminKey}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      body: `target_id_type=user_id&target_id=${encodeURIComponent(kakaoId)}`,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.warn("[deleteAccount] kakao unlink failed:", r.status, t);
    }
  } catch (e) {
    console.warn("[deleteAccount] kakao unlink error:", e?.message || e);
  }
}

/** 여러 ref를 배치로 삭제 (배치 최대 500) */
async function batchDelete(fs, refs) {
  const arr = Array.from(refs);
  for (let i = 0; i < arr.length; i += 450) {
    const batch = fs.batch();
    arr.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

/** 해체되는 팀의 경기 기록(match_requests) 삭제 — actor/target 양쪽 */
async function deleteClubMatchRequests(fs, clubId) {
  const col = fs.collection("match_requests");
  const [aSnap, tSnap] = await Promise.all([
    col.where("actorClubId", "==", clubId).get(),
    col.where("targetClubId", "==", clubId).get(),
  ]);
  const refs = new Map();
  [...aSnap.docs, ...tSnap.docs].forEach((d) => refs.set(d.id, d.ref));
  await batchDelete(fs, refs.values());
}

/** 클럽 서브컬렉션 전체 삭제 */
async function deleteClubSub(fs, clubId, sub) {
  const snap = await fs.collection("clubs").doc(clubId).collection(sub).get();
  await batchDelete(fs, snap.docs.map((d) => d.ref));
}

/** 내게 온 알림 정리 — 모든 알림 targetIds 에서 uid 제거 (재가입 시 예전 알림 잔존 방지) */
async function clearNotificationsForUid(fs, uid) {
  const admin = getAdmin();
  const snap = await fs
    .collection("notifications")
    .where("targetIds", "array-contains", uid)
    .get();
  const refs = snap.docs.map((d) => d.ref);
  for (let i = 0; i < refs.length; i += 450) {
    const batch = fs.batch();
    refs.slice(i, i + 450).forEach((r) =>
      batch.update(r, { targetIds: admin.firestore.FieldValue.arrayRemove(uid) })
    );
    await batch.commit();
  }
}

/**
 * 회원탈퇴 시 내가 팀장(ownerUid)인 팀 정리 — 서버 권위적 처리(Admin SDK).
 * - 혼자뿐인 팀: 완전 해체(경기 기록·서브컬렉션·팀 문서 삭제)
 * - 팀원이 남아있는 팀: 스킵(클라이언트 위임 로직이 처리, 남은 팀원 기록 보존)
 *
 * ※ 카카오 uid 고정이라 유령 팀이 남으면 재가입 시 findOwnedClubId 로 다시 붙어
 *   예전 경기 기록이 노출됨 → best-effort 클라이언트 정리의 안전망.
 */
async function cleanupOwnedSoloClubs(fs, uid) {
  const owned = await fs.collection("clubs").where("ownerUid", "==", uid).get();
  for (const clubDoc of owned.docs) {
    const cid = clubDoc.id;
    try {
      const membersSnap = await fs
        .collection("clubs")
        .doc(cid)
        .collection("members")
        .get();
      const others = membersSnap.docs.filter((d) => {
        const mid = String(d.data()?.uid || d.data()?.userId || d.id || "").trim();
        return mid && mid !== uid;
      });
      if (others.length > 0) continue; // 팀원 남은 팀은 보존

      await deleteClubMatchRequests(fs, cid);
      await deleteClubSub(fs, cid, "members");
      await deleteClubSub(fs, cid, "invites");
      await deleteClubSub(fs, cid, "joinRequests");
      await fs.collection("clubs").doc(cid).delete();
    } catch (e) {
      console.warn(`[deleteAccount] cleanup club ${cid} failed:`, e?.message || e);
    }
  }
}

/**
 * uid에 매인 사용자 데이터 전량 삭제 — best-effort(각 단계 독립 try/catch, 탈퇴를 막지 않음).
 * - 본인 전용 컬렉션: users_by_phone, inquiries, *_reports, community_posts(+하위)
 * - 남의 글에 단 내 댓글/좋아요(collectionGroup)
 * - 내가 참여한 1:1 채팅방(chatRooms, 메시지 포함)
 * - 역참조 정리: 타인 user_blocks.blockedUids / 타인 users.favoritePlayerIds 에서 내 uid 제거
 * - Storage: uid 기반 경로 파일
 * ※ match_requests(경기 기록)/리뷰는 팀 단위 공유 데이터라 개인 탈퇴로 지우지 않는다.
 */
async function purgeUserData(fs, admin, uid) {
  // 1) 본인 전용 top-level 문서 (필드 조회 후 삭제)
  const simple = [
    { col: "users_by_phone", field: "uid" },
    { col: "inquiries", field: "uid" },
    { col: "user_reports", field: "reporterUid" },
    { col: "team_reports", field: "reporterUid" },
    { col: "community_reports", field: "reporterUid" },
  ];
  for (const { col, field } of simple) {
    try {
      const snap = await fs.collection(col).where(field, "==", uid).get();
      await batchDelete(fs, snap.docs.map((d) => d.ref));
    } catch (e) {
      console.warn(`[deleteAccount] purge ${col} failed:`, e?.message || e);
    }
  }

  // 2) 내가 쓴 커뮤니티 게시글 (하위 comments/likes 포함 재귀 삭제)
  try {
    const posts = await fs.collection("community_posts").where("authorUid", "==", uid).get();
    for (const p of posts.docs) {
      try {
        await fs.recursiveDelete(p.ref);
      } catch (e) {
        console.warn(`[deleteAccount] delete post ${p.id} failed:`, e?.message || e);
      }
    }
  } catch (e) {
    console.warn("[deleteAccount] purge community_posts failed:", e?.message || e);
  }

  // 3) 남의 글/댓글에 단 내 댓글·좋아요 (collectionGroup — 컬렉션그룹 인덱스 필요할 수 있음, best-effort)
  const groups = [
    { name: "comments", field: "authorUid" },
    { name: "likes", field: "uid" },
  ];
  for (const { name, field } of groups) {
    try {
      const snap = await fs.collectionGroup(name).where(field, "==", uid).get();
      await batchDelete(fs, snap.docs.map((d) => d.ref));
    } catch (e) {
      console.warn(`[deleteAccount] purge collectionGroup ${name} failed (index?):`, e?.message || e);
    }
  }

  // 4) 내가 참여한 1:1 채팅방 (메시지 포함 재귀 삭제)
  try {
    const rooms = await fs
      .collection("chatRooms")
      .where("participantUids", "array-contains", uid)
      .get();
    for (const r of rooms.docs) {
      try {
        await fs.recursiveDelete(r.ref);
      } catch (e) {
        console.warn(`[deleteAccount] delete chatRoom ${r.id} failed:`, e?.message || e);
      }
    }
  } catch (e) {
    console.warn("[deleteAccount] purge chatRooms failed:", e?.message || e);
  }

  // 5) 역참조 정리 — 타인 문서에서 내 uid 제거
  const reverseRefs = [
    { col: "user_blocks", field: "blockedUids" },
    { col: "users", field: "favoritePlayerIds" },
  ];
  for (const { col, field } of reverseRefs) {
    try {
      const snap = await fs.collection(col).where(field, "array-contains", uid).get();
      const refs = snap.docs.map((d) => d.ref);
      for (let i = 0; i < refs.length; i += 450) {
        const batch = fs.batch();
        refs.slice(i, i + 450).forEach((r) =>
          batch.update(r, { [field]: admin.firestore.FieldValue.arrayRemove(uid) })
        );
        await batch.commit();
      }
    } catch (e) {
      console.warn(`[deleteAccount] purge reverse ${col}.${field} failed:`, e?.message || e);
    }
  }

  // 6) Storage 파일 삭제 (uid 기반 경로 프리픽스)
  try {
    const bucket = admin.storage().bucket(STORAGE_BUCKET);
    const prefixes = [`users/${uid}/`, `media/users/${uid}/`, `community_posts/${uid}/`];
    for (const prefix of prefixes) {
      try {
        await bucket.deleteFiles({ prefix });
      } catch (e) {
        console.warn(`[deleteAccount] delete storage ${prefix} failed:`, e?.message || e);
      }
    }
  } catch (e) {
    console.warn("[deleteAccount] purge storage failed:", e?.message || e);
  }
}

exports.deleteAccount = onRequest(
  { region: "asia-northeast3", cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const authz = req.get("Authorization") || "";
    const m = authz.match(/^Bearer (.+)$/);
    const idToken = m ? m[1] : String(req.body?.idToken || "");
    if (!idToken) {
      res.status(401).json({ error: "missing id token" });
      return;
    }

    try {
      const admin = getAdmin();

      // 1) 본인 확인
      const decoded = await admin.auth().verifyIdToken(idToken);
      const uid = decoded.uid;
      if (!uid) {
        res.status(401).json({ error: "invalid token" });
        return;
      }

      const fs = admin.firestore();

      // 2) 내가 팀장인 혼자뿐인 팀 정리(경기 기록 포함) — 유령 팀 재링크 방지
      try {
        await cleanupOwnedSoloClubs(fs, uid);
      } catch (e) {
        console.warn("[deleteAccount] cleanupOwnedSoloClubs failed:", e?.message || e);
      }

      // 2-1) 내게 온 알림 정리 — 재가입 시 예전 알림 잔존 방지
      try {
        await clearNotificationsForUid(fs, uid);
      } catch (e) {
        console.warn("[deleteAccount] clearNotificationsForUid failed:", e?.message || e);
      }

      // 2-2) uid에 매인 데이터 전량 삭제(게시글·채팅·신고·문의·역참조·Storage 등)
      try {
        await purgeUserData(fs, admin, uid);
      } catch (e) {
        console.warn("[deleteAccount] purgeUserData failed:", e?.message || e);
      }

      // 3) users 문서 삭제(안전망) — 클라이언트 삭제가 규칙 등으로 막혔어도 Admin은 통과
      try {
        await fs.collection("users").doc(uid).delete();
      } catch (e) {
        console.warn("[deleteAccount] users doc delete failed:", e?.message || e);
      }

      // 3-1) 카카오 연결 끊기 — 재가입 시 동의화면이 다시 뜨도록 (best-effort)
      await unlinkKakao(uid);

      // 4) Auth 계정 삭제 — requires-recent-login 없음
      await admin.auth().deleteUser(uid);

      res.status(200).json({ ok: true, uid });
    } catch (err) {
      console.error("deleteAccount error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  }
);
