// 기존 저장 이미지 중 "미압축 원본" 규모 조사 (읽기 전용, 절대 수정 안 함)
// 대상:
//  1) 팀 생성 로고 — clubs.logoPath 가 clubs/{id}/logo_ 로 시작 (createClub 경로, 과거 미압축)
//     (로고 '변경'은 media/teams/... 경로라 이미 압축됨 → 제외)
//  2) 채팅 이미지 — chatRooms/{id}/messages 의 images[] (chat_media/ 경로, 과거 미압축)
// 사용: node scripts/audit-existing-images.mjs
//
// 각 이미지의 실제 용량은 다운로드 URL 의 Content-Length(HEAD)로 추정.

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  collectionGroup,
  getDocs,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
  authDomain: "halle-bf789.firebaseapp.com",
  projectId: "halle-bf789",
  storageBucket: "halle-bf789.firebasestorage.app",
  messagingSenderId: "939913723928",
  appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const fmtMB = (b) => `${(b / 1024 / 1024).toFixed(2)}MB`;

async function headSize(url) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    const len = Number(r.headers.get("content-length") || 0);
    return Number.isFinite(len) ? len : 0;
  } catch {
    return 0;
  }
}

async function auditLogos() {
  const snap = await getDocs(collection(db, "clubs"));
  const targets = [];
  snap.forEach((d) => {
    const v = d.data() || {};
    const path = String(v.logoPath || "");
    const url = String(v.logoUrl || "");
    // createClub 로 만든 로고만 (clubs/{id}/logo_)
    if (url && /^clubs\/[^/]+\/logo_/.test(path)) {
      targets.push({ clubId: d.id, name: v.name || "", path, url });
    }
  });

  let bytes = 0;
  for (const t of targets) bytes += await headSize(t.url);
  return { count: targets.length, bytes, sample: targets.slice(0, 5) };
}

async function auditChatImages() {
  // collectionGroup("messages") 로 전체 채팅 메시지 순회
  const snap = await getDocs(collectionGroup(db, "messages"));
  let imgCount = 0;
  let msgWithImg = 0;
  let bytesFromMeta = 0;
  const urls = [];
  snap.forEach((d) => {
    const v = d.data() || {};
    const imgs = Array.isArray(v.images) ? v.images : [];
    if (!imgs.length) return;
    msgWithImg += 1;
    for (const im of imgs) {
      const path = String(im?.path || "");
      const url = String(im?.url || "");
      if (!url) continue;
      if (!/^chat_media\//.test(path)) continue; // 채팅 이미지만
      imgCount += 1;
      bytesFromMeta += Number(im?.size || 0);
      urls.push(url);
    }
  });

  // 메타 size 가 0인 게 많으면 HEAD 로 보정 (최대 40개만 표본)
  let headBytes = 0;
  const sampleUrls = urls.slice(0, 40);
  for (const u of sampleUrls) headBytes += await headSize(u);
  const avgHead = sampleUrls.length ? headBytes / sampleUrls.length : 0;

  return {
    msgWithImg,
    imgCount,
    bytesFromMeta,
    estBytesTotal: Math.round(avgHead * imgCount),
    sampledAvg: avgHead,
    sampled: sampleUrls.length,
  };
}

(async () => {
  console.log("=== 기존 미압축 이미지 조사 (읽기 전용) ===\n");

  console.log("[1] 팀 생성 로고 (clubs/{id}/logo_ 경로)");
  const logos = await auditLogos();
  console.log(`  대상 로고 수: ${logos.count}개, 총 용량(HEAD): ${fmtMB(logos.bytes)}`);
  logos.sample.forEach((s) =>
    console.log(`   - ${s.clubId} "${s.name}" ${s.path}`)
  );

  console.log("\n[2] 채팅 이미지 (chat_media/ 경로)");
  const chat = await auditChatImages();
  console.log(`  이미지 포함 메시지: ${chat.msgWithImg}개`);
  console.log(`  채팅 이미지 총 개수: ${chat.imgCount}개`);
  console.log(`  메타(size) 합계: ${fmtMB(chat.bytesFromMeta)}`);
  console.log(
    `  표본 ${chat.sampled}개 평균 ${fmtMB(chat.sampledAvg)} → 전체 추정 ${fmtMB(chat.estBytesTotal)}`
  );

  console.log("\n=== 조사 끝 (아무것도 수정하지 않음) ===");
  process.exit(0);
})().catch((e) => {
  console.error("audit failed:", e);
  process.exit(1);
});
