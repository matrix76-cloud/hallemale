/* eslint-disable */
// functions/auth/adminLogin.js
// 어드민 로그인 — 서버(Admin SDK)에서 비밀번호 검증 후 Firebase 커스텀 토큰 발급.
//
// 왜 서버에서:
//  - 기존엔 클라이언트가 admin_accounts 를 직접 읽어 해시 비교 후 localStorage 플래그만 세팅 →
//    devtools 로 플래그 위조 시 관리자 패널 접근 가능(실질 인증 아님).
//  - 서버에서 검증하고 { admin: true } 클레임이 담긴 커스텀 토큰을 발급하면,
//    클라이언트는 signInWithCustomToken 으로 진짜 Firebase 세션을 얻는다.
//    → 이후 Firestore 보안규칙을 request.auth.token.admin 으로 잠글 수 있다.

const { onRequest } = require("firebase-functions/v2/https");
const crypto = require("crypto");
const { getAdmin } = require("../firebaseAdmin");

const SUPER_ADMIN_ID = "admin";

// 클라이언트(Web Crypto)와 동일한 SHA-256 hex
function sha256(text) {
  return crypto.createHash("sha256").update(String(text || "")).digest("hex");
}

exports.adminLogin = onRequest(
  { region: "asia-northeast3", cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const id = String(req.body?.id || "").trim();
    const password = String(req.body?.password || "").trim();
    if (!id || !password) {
      res.status(400).json({ error: "empty" });
      return;
    }

    try {
      const admin = getAdmin();
      const fs = admin.firestore();
      const ref = fs.collection("admin_accounts").doc(id);

      let snap = await ref.get();

      // 슈퍼관리자(admin/admin) 최초 자동 시드
      if (!snap.exists && id === SUPER_ADMIN_ID) {
        await ref.set({
          id: SUPER_ADMIN_ID,
          name: "최고 관리자",
          role: "super",
          passwordHash: sha256("admin"),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: "system",
        });
        snap = await ref.get();
      }

      if (!snap.exists) {
        res.status(401).json({ error: "not_found" });
        return;
      }

      const data = snap.data() || {};
      if (String(data.passwordHash || "") !== sha256(password)) {
        res.status(401).json({ error: "wrong_password" });
        return;
      }

      const role = String(data.role || "admin");
      const name = String(data.name || id);
      const uid = `admin_${id}`;

      const token = await admin.auth().createCustomToken(uid, {
        admin: true,
        adminId: id,
        adminRole: role,
        adminName: name,
      });

      res.status(200).json({ ok: true, token, id, name, role });
    } catch (err) {
      console.error("adminLogin error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  }
);
