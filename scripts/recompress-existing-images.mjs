// 기존 저장 이미지 중 "미압축 원본"만 소급 재압축.
// 대상:
//   1) 팀 생성 로고 (clubs.logoPath = clubs/{id}/logo_…) — createClub 과거 미압축분
//   2) 채팅 이미지 (chatRooms/{id}/messages[].images[], chat_media/ 경로)
//
// 정책(원본만 재압축):
//   - 이미 작은 이미지(최대변 ≤ 임계 && 용량 작음)는 건너뜀
//   - 포맷 유지(PNG→PNG / JPEG→JPEG)로 투명도/배경 훼손 없이 리사이즈+재인코딩
//   - 새 객체로 업로드 후 Firestore URL 갱신, 기존 객체는 삭제하지 않음
//     (매치/랭킹 등 비정규화된 옛 URL이 깨지지 않도록)
//
// 사용:
//   node scripts/recompress-existing-images.mjs           → DRY-RUN (읽기/계산만, 수정 없음)
//   node scripts/recompress-existing-images.mjs --apply    → 실제 재압축/업로드/갱신

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  collectionGroup,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  getStorage,
  ref as sRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import Jimp from "jimp";

const firebaseConfig = {
  apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
  authDomain: "halle-bf789.firebaseapp.com",
  projectId: "halle-bf789",
  storageBucket: "halle-bf789.firebasestorage.app",
  messagingSenderId: "939913723928",
  appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
};

const APPLY = process.argv.includes("--apply");
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const KB = 1024;
const fmt = (b) => (b >= KB * KB ? `${(b / KB / KB).toFixed(2)}MB` : `${Math.round(b / KB)}KB`);

// 로고: 최대 1080, 채팅: 최대 1280
const PROFILE = {
  logo: { maxDim: 1080, quality: 78, minBytes: 120 * KB },
  chat: { maxDim: 1280, quality: 70, minBytes: 120 * KB },
};

async function fetchBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${r.status}`);
  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}

/**
 * @returns {null | { buf: Uint8Array, ext: string, contentType: string, w: number, h: number, from: number, to: number }}
 * null 이면 재압축 불필요(건너뜀).
 */
async function recompress(buf, { maxDim, quality, minBytes }, pathHint = "") {
  const img = await Jimp.read(buf);
  const w0 = img.bitmap.width;
  const h0 = img.bitmap.height;
  const isPng = /\.png$/i.test(pathHint) || img.getMIME() === Jimp.MIME_PNG;

  // 이미 충분히 작으면 건너뜀 (원본만 재압축)
  if (Math.max(w0, h0) <= maxDim && buf.length < minBytes) return null;

  if (Math.max(w0, h0) > maxDim) img.scaleToFit(maxDim, maxDim);

  const mime = isPng ? Jimp.MIME_PNG : Jimp.MIME_JPEG;
  if (!isPng) img.quality(quality);
  const out = await img.getBufferAsync(mime);

  // 오히려 커지면 건너뜀
  if (out.length >= buf.length) return null;

  return {
    buf: new Uint8Array(out),
    ext: isPng ? "png" : "jpg",
    contentType: mime,
    w: img.bitmap.width,
    h: img.bitmap.height,
    from: buf.length,
    to: out.length,
  };
}

async function uploadNew(path, data, contentType) {
  const ref = sRef(storage, path);
  await uploadBytes(ref, data, {
    contentType,
    cacheControl: "public,max-age=31536000",
  });
  return await getDownloadURL(ref);
}

// ───────────────────────── 팀 로고 ─────────────────────────
async function processLogos() {
  const snap = await getDocs(collection(db, "clubs"));
  const targets = [];
  snap.forEach((d) => {
    const v = d.data() || {};
    const path = String(v.logoPath || "");
    const url = String(v.logoUrl || "");
    if (url && /^clubs\/[^/]+\/logo_/.test(path)) {
      targets.push({ clubId: d.id, name: v.name || "", path, url });
    }
  });

  console.log(`\n[로고] 대상 ${targets.length}개`);
  let saved = 0, done = 0, skipped = 0, failed = 0;

  for (const t of targets) {
    try {
      const buf = await fetchBuffer(t.url);
      const r = await recompress(buf, PROFILE.logo, t.path);
      if (!r) {
        skipped += 1;
        console.log(`  · skip  ${t.clubId} "${t.name}" (${fmt(buf.length)})`);
        continue;
      }
      console.log(
        `  ${APPLY ? "✓" : "→"} ${t.clubId} "${t.name}" ${fmt(r.from)} → ${fmt(r.to)} (${r.w}x${r.h})`
      );
      saved += r.from - r.to;
      if (APPLY) {
        const newPath = `clubs/${t.clubId}/logo_${Date.now()}_c.${r.ext}`;
        const newUrl = await uploadNew(newPath, r.buf, r.contentType);
        await updateDoc(doc(db, "clubs", t.clubId), {
          logoUrl: newUrl,
          logoPath: newPath,
          updatedAt: serverTimestamp(),
        });
      }
      done += 1;
    } catch (e) {
      failed += 1;
      console.log(`  ✗ ${t.clubId} "${t.name}" 실패: ${e?.message || e}`);
    }
  }
  console.log(`  → 재압축 ${done} / 건너뜀 ${skipped} / 실패 ${failed} / 절감 ${fmt(saved)}`);
  return { done, skipped, failed, saved };
}

// ───────────────────────── 채팅 이미지 ─────────────────────────
async function processChatImages() {
  const snap = await getDocs(collectionGroup(db, "messages"));
  const msgs = [];
  snap.forEach((d) => {
    const v = d.data() || {};
    const imgs = Array.isArray(v.images) ? v.images : [];
    if (imgs.some((im) => /^chat_media\//.test(String(im?.path || "")) && im?.url)) {
      msgs.push({ ref: d.ref, images: imgs });
    }
  });

  const totalImgs = msgs.reduce(
    (n, m) => n + m.images.filter((im) => /^chat_media\//.test(String(im?.path || ""))).length,
    0
  );
  console.log(`\n[채팅] 이미지 포함 메시지 ${msgs.length}개 / 이미지 ${totalImgs}개`);
  let saved = 0, done = 0, skipped = 0, failed = 0;

  for (const m of msgs) {
    let changed = false;
    const nextImages = [...m.images];
    for (let i = 0; i < nextImages.length; i++) {
      const im = nextImages[i];
      const path = String(im?.path || "");
      const url = String(im?.url || "");
      if (!/^chat_media\//.test(path) || !url) continue;
      try {
        const buf = await fetchBuffer(url);
        const r = await recompress(buf, PROFILE.chat, path);
        if (!r) {
          skipped += 1;
          console.log(`  · skip  ${path.split("/").pop()} (${fmt(buf.length)})`);
          continue;
        }
        console.log(`  ${APPLY ? "✓" : "→"} ${path.split("/").pop()} ${fmt(r.from)} → ${fmt(r.to)}`);
        saved += r.from - r.to;
        if (APPLY) {
          const base = path.replace(/\.[^./]+$/, "");
          const newPath = `${base}_c.${r.ext}`;
          const newUrl = await uploadNew(newPath, r.buf, r.contentType);
          nextImages[i] = { ...im, url: newUrl, path: newPath, size: r.to, w: r.w, h: r.h };
          changed = true;
        }
        done += 1;
      } catch (e) {
        failed += 1;
        console.log(`  ✗ ${path}: ${e?.message || e}`);
      }
    }
    if (APPLY && changed) {
      await updateDoc(m.ref, { images: nextImages });
    }
  }
  console.log(`  → 재압축 ${done} / 건너뜀 ${skipped} / 실패 ${failed} / 절감 ${fmt(saved)}`);
  return { done, skipped, failed, saved };
}

(async () => {
  console.log(`=== 기존 이미지 소급 재압축 ${APPLY ? "(APPLY: 실제 적용)" : "(DRY-RUN: 계산만)"} ===`);
  const a = await processLogos();
  const b = await processChatImages();
  console.log(
    `\n=== 합계: 재압축 ${a.done + b.done} / 건너뜀 ${a.skipped + b.skipped} / 실패 ${a.failed + b.failed} / 총 절감 ${fmt(a.saved + b.saved)} ===`
  );
  if (!APPLY) console.log("※ DRY-RUN 이었습니다. 실제 적용하려면 --apply 를 붙여 다시 실행하세요.");
  process.exit(0);
})().catch((e) => {
  console.error("recompress failed:", e);
  process.exit(1);
});
