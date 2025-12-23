/* eslint-disable */
// src/services/mediaService.js
// ✅ Storage 업로드 전용 서비스 (페이지에서 직접 Storage 접근 금지)
// - 기존: uploadUserAvatar 유지
// - 추가: 공용 이미지 업로드(압축) + 유튜브 링크 파싱/아이템 생성 + 스토리지 삭제
import { storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { compressImageFile } from "../utils/imageCompress";

/* ===========================
 * 공용 유틸
 * =========================== */

const nowIso = () => new Date().toISOString();

const safeRandomId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
};

const safeExtFromMime = (mime) => {
  const m = String(mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  return "jpg";
};

/**
 * ✅ 유튜브 링크 → youtubeId 파싱
 * 지원:
 * - https://www.youtube.com/watch?v=ID
 * - https://youtu.be/ID
 * - https://www.youtube.com/shorts/ID
 * - https://www.youtube.com/embed/ID
 */
export const parseYoutubeId = (url) => {
  const u = String(url || "").trim();
  if (!u) return "";

  try {
    const parsed = new URL(u);

    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "").trim();
      return id || "";
    }

    if (parsed.hostname.includes("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (v) return v;

      const parts = parsed.pathname.split("/").filter(Boolean);

      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];

      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    }

    return "";
  } catch (e) {
    // URL 파싱 실패 fallback
    const m1 = u.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
    if (m1?.[1]) return m1[1];

    const m2 = u.match(/v=([a-zA-Z0-9_-]{6,})/);
    if (m2?.[1]) return m2[1];

    const m3 = u.match(/shorts\/([a-zA-Z0-9_-]{6,})/);
    if (m3?.[1]) return m3[1];

    const m4 = u.match(/embed\/([a-zA-Z0-9_-]{6,})/);
    if (m4?.[1]) return m4[1];

    return "";
  }
};

export const createYoutubeMediaItem = (url) => {
  const youtubeId = parseYoutubeId(url);
  if (!youtubeId) throw new Error("유효한 유튜브 링크가 아닙니다.");

  return {
    id: safeRandomId(),
    type: "youtube",
    url: String(url || "").trim(),
    youtubeId,
    createdAt: nowIso(),
  };
};

/* ===========================
 * 기존: 사용자 아바타 업로드
 * =========================== */

/**
 * 사용자 아바타 업로드
 * - 350x350, JPEG, 품질 20% 압축
 * - Storage 경로: users/{uid}/avatar_{timestamp}.jpg
 * - return: { url, meta }
 */
export const uploadUserAvatar = async ({ uid, file }) => {
  if (!uid) throw new Error("uploadUserAvatar: uid is required");
  if (!file) throw new Error("uploadUserAvatar: file is required");

  // ✅ 압축(350x350, q=0.2)
  const compressed = await compressImageFile(file, {
    maxWidth: 350,
    maxHeight: 350,
    quality: 0.2,
    mimeType: "image/jpeg",
    preferSquare: true,
    background: "#ffffff",
  });

  const ts = Date.now();
  const path = `users/${uid}/avatar_${ts}.jpg`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, compressed.file, {
    contentType: compressed.file.type || "image/jpeg",
    cacheControl: "public,max-age=31536000",
  });

  const url = await getDownloadURL(storageRef);
  return { url, meta: compressed };
};

/* ===========================
 * 추가: 공용 이미지 업로드(즉시 업로드 + 압축)
 * =========================== */

/**
 * ✅ 공용 이미지 업로드 (경기 사진/팀 사진/프로필 하이라이트 등)
 * - kind = "highlight": 긴 변 1080px, JPEG q=0.78
 * - Storage 경로: media/{scope}/{ownerId}/{id}_{ts}.{ext}
 *
 * scope 예: "users" | "teams" | "matches"
 * ownerId 예: uid | teamId | matchId
 *
 * return: MediaItem(image)
 *  {
 *    id, type:"image", url, storagePath, createdAt
 *  }
 */
export const uploadCompressedImageMedia = async ({ scope, ownerId, file, kind = "highlight" }) => {
  if (!scope) throw new Error("uploadCompressedImageMedia: scope is required");
  if (!ownerId) throw new Error("uploadCompressedImageMedia: ownerId is required");
  if (!file) throw new Error("uploadCompressedImageMedia: file is required");

  // 원본 용량 가드(너무 큰 파일 방지)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("이미지는 최대 10MB까지 업로드할 수 있어요.");
  }

  // ✅ 압축 정책
  // - highlight: 1080px, q=0.78
  // - avatar:   350x350, q=0.25 (아바타는 uploadUserAvatar가 SSOT지만 혹시 재사용할 때 대비)
  const compressOpts =
    kind === "avatar"
      ? {
          maxWidth: 350,
          maxHeight: 350,
          quality: 0.25,
          mimeType: "image/jpeg",
          preferSquare: true,
          background: "#ffffff",
        }
      : {
          maxWidth: 1080,
          maxHeight: 1080,
          quality: 0.78,
          mimeType: "image/jpeg",
          preferSquare: false,
          background: "#ffffff",
        };

  const compressed = await compressImageFile(file, compressOpts);
  const id = safeRandomId();
  const ts = Date.now();

  const ext = safeExtFromMime(compressed?.file?.type || "image/jpeg");
  const storagePath = `media/${scope}/${ownerId}/${id}_${ts}.${ext}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, compressed.file, {
    contentType: compressed.file.type || "image/jpeg",
    cacheControl: "public,max-age=31536000",
  });

  const url = await getDownloadURL(storageRef);

  return {
    id,
    type: "image",
    url,
    storagePath,
    createdAt: nowIso(),
  };
};

/**
 * ✅ 스토리지 파일 삭제 (image일 때만 사용)
 * - youtube는 외부 링크라 삭제 없음
 */
export const deleteMediaItem = async ({ item }) => {
  if (!item) return;

  if (item.type === "image" && item.storagePath) {
    const r = ref(storage, item.storagePath);
    await deleteObject(r);
  }
  // youtube는 삭제 없음
};
