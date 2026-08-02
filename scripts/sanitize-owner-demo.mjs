// 데모 구장 이름·주소·전화 무해화 — 실존 기관/시설과 겹치는 값을 전부 가상값으로 교체.
// 운영 DB에 노출 중인 16개 데모 구장 문서를 수정하고, PDF 원본 JSON도 갱신한다.
// 사용: node scripts/sanitize-owner-demo.mjs
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { readFileSync, writeFileSync } from "fs";

const app = initializeApp({
  apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
  authDomain: "halle-bf789.firebaseapp.com",
  projectId: "halle-bf789",
  storageBucket: "halle-bf789.firebasestorage.app",
  messagingSenderId: "939913723928",
  appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
});
const auth = getAuth(app);
const db = getFirestore(app);
const PW = "HalleDemo2026!";

// 이메일 → 교체값. 이름은 자사 브랜드 + '데모'만 써서 실존 기관과 겹칠 여지를 없앤다.
// 주소는 실제 도로명을 쓰지 않고 '데모로'(존재하지 않는 도로명), 전화는 0000 국번.
const MAP = {
  "demo-biz1@hallemale-demo.com":   { venue: "[데모] 할래말래 테스트구장 1호",   biz: "할래말래데모스포츠1", addr: "서울 용산구 데모로 1",     phone: "02-0000-0001" },
  "demo-biz2@hallemale-demo.com":   { venue: "[데모] 할래말래 테스트구장 2호",   biz: "할래말래데모스포츠2", addr: "서울 강남구 데모로 2",     phone: "02-0000-0002" },
  "demo-biz3@hallemale-demo.com":   { venue: "[데모] 할래말래 테스트구장 3호",   biz: "할래말래데모스포츠3", addr: "경기 수원시 팔달구 데모로 3", phone: "031-0000-0003" },
  "demo-biz4@hallemale-demo.com":   { venue: "[데모] 할래말래 테스트야외코트",   biz: "할래말래데모스포츠4", addr: "부산 해운대구 데모로 4",   phone: "051-0000-0004" },

  "demo-school1@hallemale-demo.com": { venue: "[데모] 할래말래테스트초등학교 체육관", biz: "할래말래테스트초등학교", addr: "서울 성동구 데모로 11",         phone: "02-0000-0011", school: { name: "할래말래테스트초등학교", kind: "초등학교" } },
  "demo-school2@hallemale-demo.com": { venue: "[데모] 할래말래데모초등학교 강당",     biz: "할래말래데모초등학교",   addr: "경기 고양시 일산동구 데모로 12", phone: "031-0000-0012", school: { name: "할래말래데모초등학교", kind: "초등학교" } },
  "demo-school3@hallemale-demo.com": { venue: "[데모] 할래말래테스트중학교 체육관",   biz: "할래말래테스트중학교",   addr: "서울 노원구 데모로 13",         phone: "02-0000-0013", school: { name: "할래말래테스트중학교", kind: "중학교" } },
  "demo-school4@hallemale-demo.com": { venue: "[데모] 할래말래데모중학교 실내코트",   biz: "할래말래데모중학교",     addr: "인천 연수구 데모로 14",         phone: "032-0000-0014", school: { name: "할래말래데모중학교", kind: "중학교" } },
  "demo-school5@hallemale-demo.com": { venue: "[데모] 할래말래테스트고등학교 체육관", biz: "할래말래테스트고등학교", addr: "서울 관악구 데모로 15",         phone: "02-0000-0015", school: { name: "할래말래테스트고등학교", kind: "고등학교" } },
  "demo-school6@hallemale-demo.com": { venue: "[데모] 할래말래데모고등학교 다목적관", biz: "할래말래데모고등학교",   addr: "대전 유성구 데모로 16",         phone: "042-0000-0016", school: { name: "할래말래데모고등학교", kind: "고등학교" } },
  "demo-school7@hallemale-demo.com": { venue: "[데모] 할래말래테스트대학교 체육관",   biz: "할래말래테스트대학교",   addr: "서울 서대문구 데모로 17",       phone: "02-0000-0017", school: { name: "할래말래테스트대학교", kind: "대학교" } },
  "demo-school8@hallemale-demo.com": { venue: "[데모] 할래말래데모대학교 실내체육관", biz: "할래말래데모대학교",     addr: "강원 강릉시 데모로 18",         phone: "033-0000-0018", school: { name: "할래말래데모대학교", kind: "대학교" } },

  "demo-org1@hallemale-demo.com":   { venue: "[데모] 할래말래데모공단 체육관",   biz: "할래말래데모시설공단",   addr: "서울 성동구 데모로 21",   phone: "02-0000-0021" },
  "demo-org2@hallemale-demo.com":   { venue: "[데모] 할래말래데모문화체육센터", biz: "할래말래데모문화체육센터", addr: "서울 광진구 데모로 22", phone: "02-0000-0022" },
  "demo-org3@hallemale-demo.com":   { venue: "[데모] 할래말래데모단체 체육관",   biz: "할래말래데모단체",       addr: "경기 성남시 분당구 데모로 23", phone: "031-0000-0023" },
  "demo-org4@hallemale-demo.com":   { venue: "[데모] 할래말래데모복지관 다목적홀", biz: "할래말래데모복지관",   addr: "대구 수성구 데모로 24",   phone: "053-0000-0024" },
};

const rows = JSON.parse(readFileSync("scripts/.demo-owner-accounts.json", "utf8"));

async function main() {
  for (const r of rows) {
    const m = MAP[r.email];
    if (!m || !r.venueId) continue;
    await signInWithEmailAndPassword(auth, r.email, PW);

    const cur = (await getDoc(doc(db, "venues", r.venueId))).data() || {};
    const patch = {
      name: m.venue,
      displayName: m.venue,
      address: m.addr,
      addressDetail: "",
      directions: "데모 데이터입니다. 실제 시설이 아니에요.",
      phone: m.phone,
      contactPhone: m.phone,
      bizName: m.biz,
      description: `${cur.description || ""}`.replace(/^/, "[데모 데이터] "),
      keywords: ["데모", "테스트"],
      "business.bizName": m.biz,
      updatedAt: serverTimestamp(),
    };
    if (m.school) {
      patch["business.school"] = {
        ...(cur.business?.school || {}),
        name: m.school.name,
        kind: m.school.kind,
        address: m.addr,
        tel: m.phone,
      };
    }
    await updateDoc(doc(db, "venues", r.venueId), patch);
    console.log(`✔ ${r.email} → ${m.venue} / ${m.addr} / ${m.phone}`);

    // PDF 원본 JSON 갱신
    r.venue = m.venue;
    r.bizName = m.biz;
    await signOut(auth);
  }
  writeFileSync("scripts/.demo-owner-accounts.json", JSON.stringify(rows, null, 2), "utf8");
  console.log("\n완료 — 실존 상호·주소·국번 제거, JSON 갱신");
  process.exit(0);
}
main().catch((e) => { console.error("실패:", e); process.exit(1); });
