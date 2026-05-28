/* eslint-disable */
// functions/utils/logoCache.js
const crypto = require("crypto");
const fetch = require("node-fetch");
const { getAdmin } = require("../firebaseAdmin");

/**
 * =========================================
 * Logo Cache (External URL -> Firebase Storage)
 * =========================================
 * - 외부 도메인 이미지(CORS 문제) -> Storage에 캐시해서 우리 도메인 URL로 교체
 * - 허용 도메인 화이트리스트로 악용 방지
 * - 이미 캐시된 파일은 재업로드 스킵
 *
 * 반환: { ok, publicUrl, path, reason? }
 */

const ALLOWED_HOSTS = new Set([
  "sports-phinf.pstatic.net",
  "sports-phinf.pstatic.net.",
  "phinf.pstatic.net",
  "phinf.pstatic.net.",
  "sports-phinf.pstatic.net",
]);

function safeStr(v) {
  return String(v || "").trim();
}

function isHttpUrl(u) {
  return /^https?:\/\//i.test(safeStr(u));
}

function getHost(u) {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
}

function isAllowedHost(u) {
  const host = String(getHost(u) || "").toLowerCase();
  if (!host) return false;
  if (ALLOWED_HOSTS.has(host)) return true;
  // ✅ pstatic 계열 확장 허용(필요시 좁혀도 됨)
  if (host.endsWith(".pstatic.net")) return true;
  return false;
}

function sha1(input) {
  return crypto.createHash("sha1").update(String(input || "")).digest("hex");
}

function inferExtFromContentType(ct = "") {
  const v = String(ct || "").toLowerCase();
  if (v.includes("image/png")) return "png";
  if (v.includes("image/jpeg")) return "jpg";
  if (v.includes("image/jpg")) return "jpg";
  if (v.includes("image/webp")) return "webp";
  return "png";
}

function inferExtFromUrl(url = "") {
  const u = safeStr(url).toLowerCase();
  if (u.endsWith(".png")) return "png";
  if (u.endsWith(".jpg")) return "jpg";
  if (u.endsWith(".jpeg")) return "jpg";
  if (u.endsWith(".webp")) return "webp";
  return "";
}

async function getPublicUrlFromFile(file) {
  // ✅ 다운로드 토큰 방식(publicUrl 생성)
  const [meta] = await file.getMetadata();
  const token =
    meta?.metadata?.firebaseStorageDownloadTokens ||
    meta?.metadata?.downloadToken ||
    "";

  const bucketName = file.bucket.name;
  const path = file.name;
  if (!token) return "";

  const encPath = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encPath}?alt=media&token=${token}`;
}

async function ensureDownloadToken(file) {
  const [meta] = await file.getMetadata();
  const existing =
    meta?.metadata?.firebaseStorageDownloadTokens ||
    meta?.metadata?.downloadToken ||
    "";
  if (existing) return existing;

  const token = crypto.randomUUID();
  const newMeta = {
    metadata: {
      firebaseStorageDownloadTokens: token,
    },
    cacheControl: "public, max-age=31536000",
  };
  await file.setMetadata(newMeta);
  return token;
}

/**
 * logo를 Storage로 캐시하고 public download URL을 반환
 * @param {string} url
 * @param {object} opts
 * @param {string} opts.league
 * @param {string} opts.teamCode
 */
async function cacheLogoToStorage(url, opts = {}) {
  const rawUrl = safeStr(url);
  if (!rawUrl) return { ok: false, publicUrl: "", path: "", reason: "empty_url" };
  if (!isHttpUrl(rawUrl)) return { ok: false, publicUrl: "", path: "", reason: "not_http" };
  if (!isAllowedHost(rawUrl)) return { ok: false, publicUrl: "", path: "", reason: "host_not_allowed" };

  const league = safeStr(opts?.league).toLowerCase() || "unknown";
  const teamCode = safeStr(opts?.teamCode).toUpperCase() || "UNK";

  // ✅ URL 기반 고정 해시로 중복 업로드 방지
  const hash = sha1(rawUrl).slice(0, 16);
  const urlExt = inferExtFromUrl(rawUrl);
  const ext = urlExt || "png";

  const path = `logos/${league}/${teamCode}/${hash}.${ext}`;

  const admin = getAdmin();
  const bucket = admin.storage().bucket();
  const file = bucket.file(path);

  // ✅ 이미 존재하면 URL만 생성해서 반환
  const [exists] = await file.exists();
  if (exists) {
    await ensureDownloadToken(file);
    const publicUrl = await getPublicUrlFromFile(file);
    return { ok: true, publicUrl, path };
  }

  // ✅ 다운로드
  const res = await fetch(rawUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; hallemalle-bot/1.0)",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    return { ok: false, publicUrl: "", path: "", reason: `fetch_${res.status}` };
  }

  const ct = res.headers.get("content-type") || "";
  const realExt = inferExtFromContentType(ct) || ext;
  const finalPath = realExt === ext ? path : `logos/${league}/${teamCode}/${hash}.${realExt}`;
  const finalFile = realExt === ext ? file : bucket.file(finalPath);

  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf || !buf.length) {
    return { ok: false, publicUrl: "", path: "", reason: "empty_body" };
  }

  // ✅ 업로드
  await finalFile.save(buf, {
    resumable: false,
    contentType: ct || `image/${realExt}`,
    metadata: {
      firebaseStorageDownloadTokens: crypto.randomUUID(),
    },
    public: false,
    validation: false,
  });

  await finalFile.setMetadata({
    cacheControl: "public, max-age=31536000",
  });

  const publicUrl = await getPublicUrlFromFile(finalFile);
  return { ok: true, publicUrl, path: finalPath };
}

module.exports = { cacheLogoToStorage };
