// 카카오 로그인 사용자 조회 (읽기 전용) — 웹/앱 uid 불일치 진단용
// 카카오 회원번호(id)는 "카카오 앱"별로 다르게 발급되므로,
// 웹(REST 키)과 앱(네이티브 키)이 서로 다른 카카오 앱이면 같은 사람이 2개 계정이 됨.
// 사용: node scripts/audit-kakao-users.mjs

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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

const tsMs = (v) => {
  try {
    if (v?.toMillis) return v.toMillis();
    if (v?.seconds) return v.seconds * 1000;
  } catch {}
  return 0;
};

(async () => {
  const snap = await getDocs(collection(db, "users"));
  const kakao = [];
  snap.forEach((d) => {
    const v = d.data() || {};
    const id = d.id;
    const isKakao =
      String(v.provider || "") === "kakao" || /^kakao:/.test(id) || v.kakaoId;
    if (!isKakao) return;
    kakao.push({
      id,
      kakaoId: String(v.kakaoId || (/^kakao:(.+)$/.exec(id)?.[1] ?? "")),
      nickname: String(v.nickname || v.displayName || ""),
      email: String(v.email || ""),
      phoneE164: String(v.phoneE164 || ""),
      createdAt: tsMs(v.createdAt),
    });
  });

  kakao.sort((a, b) => a.createdAt - b.createdAt);

  console.log(`=== 카카오 사용자 ${kakao.length}명 ===`);
  for (const u of kakao) {
    const when = u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 16) : "-";
    console.log(
      `  ${u.id}  kakaoId=${u.kakaoId}  "${u.nickname}"  ${u.email || "(no email)"}  ${u.phoneE164 || ""}  ${when}`
    );
  }

  // 같은 사람으로 의심되는 그룹핑 (닉네임 / 이메일 / 전화 기준)
  const groupBy = (keyFn, label) => {
    const m = new Map();
    for (const u of kakao) {
      const k = keyFn(u);
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(u);
    }
    const dups = [...m.entries()].filter(([, arr]) => arr.length > 1);
    if (dups.length) {
      console.log(`\n[중복 의심 · ${label} 동일한데 uid 다름]`);
      for (const [k, arr] of dups) {
        console.log(`  ${label}="${k}" → ${arr.length}개 계정: ${arr.map((x) => x.id).join(" , ")}`);
      }
    }
  };
  groupBy((u) => u.nickname.trim().toLowerCase(), "닉네임");
  groupBy((u) => u.email.trim().toLowerCase(), "이메일");
  groupBy((u) => u.phoneE164.trim(), "전화");

  process.exit(0);
})().catch((e) => {
  console.error("audit failed:", e);
  process.exit(1);
});
