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
//
// ⚠️ 이 엔드포인트는 인증 없이 누구나 호출할 수 있다(로그인 창구이므로 당연). 그래서:
//  1) 계정을 만들지 않는다. 예전엔 admin 계정이 없으면 admin/admin 으로 자동 생성했는데,
//     그건 "아무나 한 번 POST 하면 슈퍼관리자 + admin 클레임을 가져간다"는 뜻이었다.
//     최초 1회 부트스트랩은 서버 환경변수(ADMIN_BOOTSTRAP_PASSWORD)를 아는 사람만 할 수 있다.
//  2) 실패 횟수를 세어 잠근다(admin_login_attempts). 없으면 4자리 비밀번호가 온라인 대입에 뚫린다.
//  3) 비밀번호는 솔트 있는 PBKDF2 로 검증한다. 구버전(무솔트 SHA-256) 계정은 로그인 성공 시
//     그 자리에서 PBKDF2 로 올려준다 — 운영자가 아무것도 안 해도 다음 로그인부터 안전해진다.

const { onRequest } = require("firebase-functions/v2/https");
const crypto = require("crypto");
const { getAdmin } = require("../firebaseAdmin");

const SUPER_ADMIN_ID = "admin";

// 로그인 실패 잠금
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

// PBKDF2 파라미터 — 클라이언트(src/services/adminAccountService.js)와 반드시 같아야 한다.
const PBKDF2_ALGO = "pbkdf2-sha256";
const PBKDF2_ITERATIONS = 210000;
const PBKDF2_KEYLEN = 32;

// 구버전 해시(무솔트 SHA-256) 검증용 — 신규 저장에는 쓰지 않는다.
function legacySha256(text) {
  return crypto.createHash("sha256").update(String(text || "")).digest("hex");
}

function pbkdf2Hex(password, saltHex, iterations) {
  const salt = Buffer.from(String(saltHex || ""), "hex");
  const it = Number(iterations) || PBKDF2_ITERATIONS;
  return crypto.pbkdf2Sync(String(password || ""), salt, it, PBKDF2_KEYLEN, "sha256").toString("hex");
}

/** 길이가 달라도 예외 없이 false — 타이밍 비교 */
function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function newPasswordFields(password) {
  const saltHex = crypto.randomBytes(16).toString("hex");
  return {
    passwordAlgo: PBKDF2_ALGO,
    passwordSalt: saltHex,
    passwordIterations: PBKDF2_ITERATIONS,
    passwordHash: pbkdf2Hex(password, saltHex, PBKDF2_ITERATIONS),
  };
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
      const attemptRef = fs.collection("admin_login_attempts").doc(id);

      // ── 잠금 확인 ──
      const attemptSnap = await attemptRef.get();
      const attempt = attemptSnap.exists ? attemptSnap.data() || {} : {};
      const lockedUntil = Number(attempt.lockedUntil || 0);
      if (lockedUntil > Date.now()) {
        const mins = Math.ceil((lockedUntil - Date.now()) / 60000);
        res.status(429).json({ error: "locked", retryAfterMinutes: mins });
        return;
      }

      const fail = async (reason) => {
        const fails = Number(attempt.fails || 0) + 1;
        await attemptRef.set(
          {
            fails,
            lockedUntil: fails >= MAX_FAILS ? Date.now() + LOCK_MS : 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        // 아이디 존재 여부를 노출하지 않도록 사유는 그대로 두되 상태코드는 동일하게 401.
        res.status(401).json({ error: reason, remainingAttempts: Math.max(0, MAX_FAILS - fails) });
      };

      let snap = await ref.get();

      // ── 최초 1회 부트스트랩 ──
      // 계정을 자동 생성하지 않는다. 서버 환경변수를 아는 사람이 그 값을 비밀번호로 넣었을 때만
      // 슈퍼관리자를 만든다(functions/.env 의 ADMIN_BOOTSTRAP_PASSWORD).
      // 생성 직후 반드시 운영자 계정 화면에서 비밀번호를 바꿀 것.
      if (!snap.exists && id === SUPER_ADMIN_ID) {
        const bootstrap = String(process.env.ADMIN_BOOTSTRAP_PASSWORD || "");
        if (!bootstrap || !safeEqualHex(password, bootstrap)) {
          await fail("not_found");
          return;
        }
        await ref.set({
          id: SUPER_ADMIN_ID,
          name: "최고 관리자",
          role: "super",
          ...newPasswordFields(bootstrap),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: "bootstrap",
        });
        console.warn("[adminLogin] 슈퍼관리자 계정을 부트스트랩으로 생성했습니다. 비밀번호를 즉시 변경하세요.");
        snap = await ref.get();
      }

      if (!snap.exists) {
        await fail("not_found");
        return;
      }

      const data = snap.data() || {};
      const storedHash = String(data.passwordHash || "");
      const algo = String(data.passwordAlgo || "");

      let ok = false;
      if (algo === PBKDF2_ALGO) {
        ok = safeEqualHex(storedHash, pbkdf2Hex(password, data.passwordSalt, data.passwordIterations));
      } else {
        // 구버전(무솔트 SHA-256)
        ok = safeEqualHex(storedHash, legacySha256(password));
        if (ok) {
          // 로그인에 성공한 지금이 유일하게 평문을 아는 순간 — 이 자리에서 올려둔다.
          try {
            await ref.set(newPasswordFields(password), { merge: true });
          } catch (e) {
            console.error("[adminLogin] 해시 업그레이드 실패:", e?.message || e);
          }
        }
      }

      if (!ok) {
        await fail("wrong_password");
        return;
      }

      // 성공 → 실패 카운터 초기화
      if (attemptSnap.exists) {
        await attemptRef.delete().catch(() => {});
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
