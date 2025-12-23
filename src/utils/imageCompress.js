/* eslint-disable */
// src/utils/imageCompress.js
// ✅ 이미지 업로드 전: 350x350 리사이즈 + JPEG 품질 20% 압축
// - input: File (image/*)
// - output: { blob, file, dataUrl, width, height, sizeBytes }
// - 브라우저(Canvas) 기반이라 CRA에서 바로 사용 가능

const DEFAULT_OPTIONS = {
  maxWidth: 350,
  maxHeight: 350,
  quality: 0.2, // 20%
  mimeType: "image/jpeg", // 용량 줄이기 좋음
  background: "#ffffff", // PNG 투명 배경 처리용
  preferSquare: true, // 350x350에 맞춰 센터 크롭
};

export async function compressImageFile(inputFile, opts = {}) {
  const options = { ...DEFAULT_OPTIONS, ...(opts || {}) };

  if (!inputFile) throw new Error("compressImageFile: inputFile is required");
  if (!inputFile.type || !inputFile.type.startsWith("image/")) {
    throw new Error("compressImageFile: inputFile must be an image/* file");
  }

  const img = await loadImageFromFile(inputFile);

  const { sx, sy, sWidth, sHeight, dw, dh } = getDrawPlan(img, options);

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("compressImageFile: cannot get canvas 2d context");

  // 배경(투명 PNG → 흰 배경)
  ctx.fillStyle = options.background;
  ctx.fillRect(0, 0, dw, dh);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, dw, dh);

  const blob = await canvasToBlob(canvas, options.mimeType, options.quality);

  const ext = mimeToExt(options.mimeType);
  const safeName = stripExt(inputFile.name) + `_c${dw}x${dh}_q${Math.round(options.quality * 100)}` + ext;

  const file = new File([blob], safeName, { type: options.mimeType, lastModified: Date.now() });

  const dataUrl = await blobToDataUrl(blob);

  return {
    blob,
    file,
    dataUrl,
    width: dw,
    height: dh,
    sizeBytes: blob.size,
  };
}

/* ================= helpers ================= */

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error("loadImageFromFile: failed to load image"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("canvasToBlob: failed to create blob"));
        else resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("blobToDataUrl: failed"));
    r.readAsDataURL(blob);
  });
}

/**
 * draw plan
 * - preferSquare=true: 정사각형에 맞춰 센터 크롭 → 350x350
 * - preferSquare=false: 비율 유지 리사이즈 → 최대 350
 */
function getDrawPlan(img, options) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  const maxW = clampInt(options.maxWidth, 1, 4096);
  const maxH = clampInt(options.maxHeight, 1, 4096);

  if (options.preferSquare) {
    const side = Math.min(iw, ih);
    const sx = Math.floor((iw - side) / 2);
    const sy = Math.floor((ih - side) / 2);

    return {
      sx,
      sy,
      sWidth: side,
      sHeight: side,
      dw: maxW,
      dh: maxH,
    };
  }

  // 비율 유지 리사이즈
  const scale = Math.min(maxW / iw, maxH / ih, 1);
  const dw = Math.max(1, Math.round(iw * scale));
  const dh = Math.max(1, Math.round(ih * scale));

  return {
    sx: 0,
    sy: 0,
    sWidth: iw,
    sHeight: ih,
    dw,
    dh,
  };
}

function mimeToExt(mime) {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

function stripExt(name) {
  if (!name) return "image";
  return name.replace(/\.[^/.]+$/, "");
}

function clampInt(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}
