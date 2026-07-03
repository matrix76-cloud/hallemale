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

      // 2) users 문서 삭제(안전망) — 클라이언트 삭제가 규칙 등으로 막혔어도 Admin은 통과
      try {
        await admin.firestore().collection("users").doc(uid).delete();
      } catch (e) {
        console.warn("[deleteAccount] users doc delete failed:", e?.message || e);
      }

      // 3) Auth 계정 삭제 — requires-recent-login 없음
      await admin.auth().deleteUser(uid);

      res.status(200).json({ ok: true, uid });
    } catch (err) {
      console.error("deleteAccount error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  }
);
