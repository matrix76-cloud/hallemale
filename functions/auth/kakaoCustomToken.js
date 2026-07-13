/* eslint-disable */
// functions/auth/kakaoCustomToken.js
const { onRequest } = require("firebase-functions/v2/https");
const { getAdmin } = require("../firebaseAdmin");

/**
 * 카카오 accessToken → Firebase Custom Token 변환
 *
 * 흐름:
 * 1) 클라이언트가 카카오 accessToken을 POST로 전달
 *    - 앱(RN): 네이티브 카카오 SDK가 발급한 accessToken을 그대로 전달
 *    - 웹 브라우저: accessToken이 없고 { code, redirectUri }를 전달 →
 *      여기서 kauth.kakao.com/oauth/token 으로 교환하여 accessToken 획득
 * 2) 카카오 /v2/user/me API로 토큰 검증 + 사용자 정보 획득
 * 3) Firebase Custom Token 생성 (uid = "kakao:{kakaoUserId}")
 * 4) Custom Token 반환 → 클라이언트가 signInWithCustomToken()
 */

// 할래말래 전용 카카오 앱(ID 1485029) REST API 키. (env KAKAO_REST_KEY 우선)
const KAKAO_REST_KEY = "25dbce8c048d516861332a9f6b682f35";
// 카카오 앱 보안 > Client Secret (카카오 로그인). 신규 앱은 기본 활성화 상태라 토큰 교환 시 필수.
const KAKAO_CLIENT_SECRET = "lkkGHtMJRaaZN7RAg0uDKHEn0iGdySfO";

/** 웹 Authorization Code → accessToken 교환 (카카오 REST API) */
async function exchangeCodeForToken({ code, redirectUri }) {
  const restKey = process.env.KAKAO_REST_KEY || KAKAO_REST_KEY;
  if (!restKey) {
    throw new Error("KAKAO_REST_KEY env is not configured");
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: restKey,
    redirect_uri: redirectUri,
    code,
  });
  // 카카오 콘솔에서 Client Secret이 활성화된 경우 필수
  const clientSecret = process.env.KAKAO_CLIENT_SECRET || KAKAO_CLIENT_SECRET;
  if (clientSecret) {
    params.append("client_secret", clientSecret);
  }

  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: params.toString(),
  });

  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    console.error("카카오 토큰 교환 실패:", tokenRes.status, JSON.stringify(tokenJson));
    throw new Error(tokenJson.error_description || "code exchange failed");
  }
  return tokenJson.access_token;
}

exports.kakaoCustomToken = onRequest(
  { region: "asia-northeast3", cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    let { accessToken } = req.body;
    const { code, redirectUri } = req.body;

    if (!accessToken && !code) {
      res.status(400).json({ error: "accessToken or code is required" });
      return;
    }

    try {
      // 웹: Authorization Code → accessToken 교환
      if (!accessToken && code) {
        if (!redirectUri) {
          res.status(400).json({ error: "redirectUri is required for code flow" });
          return;
        }
        accessToken = await exchangeCodeForToken({ code, redirectUri });
      }

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

      const userDoc = {
        provider: "kakao",
        kakaoId,
        displayName: profile.nickname || "",
        photoURL: profile.profile_image_url || "",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      // 이메일은 선택 동의 항목이라 미동의 시 응답에서 빠진다.
      // 그때 ""로 merge 하면 기존에 저장된 이메일이 지워지므로, 값이 있을 때만 쓴다.
      if (kakaoAccount.email) {
        userDoc.email = kakaoAccount.email;
      }

      await db.collection("users").doc(uid).set(userDoc, { merge: true });

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
