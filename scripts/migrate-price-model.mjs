// 수수료 모델 전환 마이그레이션 (2026-08-02)
//   이전: 구장 등록가 = 구장주가 받을 돈. 사용자에게 +5% 가산해서 표시·결제.
//   이후: 구장 등록가 = 손님이 낼 돈. 그 금액에서 5%를 떼고 구장주에게 정산.
//
// 그대로 두면 구장 정산액이 소리 없이 5% 줄어든다(30,000 받던 구장이 28,500). 그래서
// 기존 구장의 코트 요금을 "손님이 내던 금액"으로 올려, 전환 전후 정산액이 같게 맞춘다.
//   30,000 (구장 몫) → 손님은 31,500 을 내고 있었다 → 등록가를 31,500 으로 올리면
//   정산은 31,500 - 1,575 = 29,925 → 반올림 때문에 75원 차이. 이 정도 오차는
//   구장주가 다음 요금 수정에서 원하는 값으로 맞추면 된다(강제로 딱 맞추려면 요율이 무리수가 된다).
//
// 사용:
//   node scripts/migrate-price-model.mjs           # 미리보기(쓰기 없음)
//   node scripts/migrate-price-model.mjs --apply   # 실제 반영
//   node scripts/migrate-price-model.mjs --apply --grandfather   # + 기존 구장 feeRate=0 고정
//
// --grandfather: 초기 입점 구장에 feeRate=0 을 박아 "평생 0%"를 보장한다.
//   이 경우 요금 인상도 하면 안 된다(0% 인데 가격까지 올리면 손님만 더 낸다) → 가격은 그대로 두고
//   feeRate 만 0 으로 박는다.
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";

const APPLY = process.argv.includes("--apply");
const GRANDFATHER = process.argv.includes("--grandfather");
const RATE = 0.05;

const cfg = {
  apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
  authDomain: "halle-bf789.firebaseapp.com",
  projectId: "halle-bf789",
  storageBucket: "halle-bf789.firebasestorage.app",
  messagingSenderId: "939913723928",
  appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
};
const db = getFirestore(initializeApp(cfg));

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
// 전환 전 손님이 실제로 내던 금액 = 등록가 + 반올림한 이용료
const oldCustomerPrice = (venuePrice) => venuePrice + Math.round(venuePrice * RATE);

async function main() {
  const snap = await getDocs(collection(db, "venues"));
  const plans = [];

  snap.forEach((d) => {
    const v = d.data() || {};
    const courts = Array.isArray(v.courts) ? v.courts : [];
    if (!courts.length) return;

    const next = courts.map((c) => {
      const p = n(c.pricePerHour);
      if (p <= 0) return c;
      return { ...c, pricePerHour: oldCustomerPrice(p) };
    });

    const changed = next.some((c, i) => n(c.pricePerHour) !== n(courts[i].pricePerHour));
    plans.push({
      id: d.id,
      name: String(v.name || ""),
      before: courts.map((c) => n(c.pricePerHour)),
      after: next.map((c) => n(c.pricePerHour)),
      courts: next,
      changed,
    });
  });

  console.log(`구장 ${plans.length}곳 · 모드: ${GRANDFATHER ? "그랜드파더링(feeRate=0, 가격 유지)" : "가격 인상(등록가 → 기존 손님 결제가)"}`);
  for (const p of plans) {
    const label = GRANDFATHER
      ? `${p.before.join(",")} (가격 유지) + feeRate=0`
      : `${p.before.join(",")} → ${p.after.join(",")}`;
    console.log(`  - ${p.name || p.id}: ${label}`);
  }

  if (!APPLY) {
    console.log("\n미리보기입니다. 실제로 반영하려면 --apply 를 붙이세요.");
    process.exit(0);
  }

  let done = 0;
  for (const p of plans) {
    const patch = {};
    if (GRANDFATHER) {
      patch.feeRate = 0;
    } else if (p.changed) {
      patch.courts = p.courts;
    }
    if (!Object.keys(patch).length) continue;
    await updateDoc(doc(db, "venues", p.id), patch);
    done += 1;
  }
  console.log(`\n반영 완료: ${done}곳`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
