/* eslint-disable */
// functions/auth/kakaoCustomToken.js
const { onRequest } = require("firebase-functions/v2/https");
const { getAdmin } = require("../firebaseAdmin");

/**
 * 카카오 accessToken → Firebase Custom Token 변환
 *
 * 흐름:
 * 1) 클라이언트가 카카오 accessToken을 POST로 전달
 * 2) 카카오 /v2/user/me API로 토큰 검증 + 사용자 정보 획득
 * 3) Firebase Custom Token 생성 (uid = "kakao:{kakaoUserId}")
 * 4) Custom Token 반환 → 클라이언트가 signInWithCustomToken()
 */
exports.kakaoCustomToken = onRequest(
  { region: "asia-northeast3", cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { accessToken } = req.body;
    if (!accessToken) {
      res.status(400).json({ error: "accessToken is required" });
      return;
    }

    try {
      // 1) 카카오 API로 사용자 정보 조회 (토큰 검증)
      const kakaoRes = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!kakaoRes.ok) {
        const errText = await kakaoRes.text();
        console.error("카카오 API 오류:", kakaoRes.status, errText);
        res.status(401).json({ error: "Invalid kakao accessToken" });
        return;
      }

      const kakaoUser = await kakaoRes.json();
      const kakaoId = String(kakaoUser.id);

      if (!kakaoId) {
        res.status(401).json({ error: "Failed to get kakao user id" });
        return;
      }

      // 2) Firebase uid 생성
      const uid = `kakao:${kakaoId}`;

      // 3) (선택) Firestore에 사용자 정보 저장/업데이트
      const admin = getAdmin();
      const db = admin.firestore();
      const kakaoAccount = kakaoUser.kakao_account || {};
      const profile = kakaoAccount.profile || {};

      await db.collection("users").doc(uid).set(
        {
          provider: "kakao",
          kakaoId,
          displayName: profile.nickname || "",
          photoURL: profile.profile_image_url || "",
          email: kakaoAccount.email || "",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // 4) Firebase Custom Token 생성
      const customToken = await admin.auth().createCustomToken(uid, {
        provider: "kakao",
        kakaoId,
      });

      res.status(200).json({ customToken, uid });
    } catch (err) {
      console.error("kakaoCustomToken error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  }
);
