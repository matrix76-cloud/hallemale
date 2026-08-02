// 데모 계정 생성 결과 검증 + 가입 흐름 취약점 실증 (데모 데이터에만 수행, 즉시 원복)
// 사용: node scripts/verify-owner-demo.mjs
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, deleteUser } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

const cfg = {
  apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
  authDomain: "halle-bf789.firebaseapp.com",
  projectId: "halle-bf789",
  storageBucket: "halle-bf789.firebasestorage.app",
  messagingSenderId: "939913723928",
  appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
};
const app = initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);
const PW = "HalleDemo2026!";

const ok = (b) => (b ? "✅" : "❌");

async function main() {
  /* 1) 생성 결과 확인 */
  const snap = await getDocs(query(collection(db, "venues"), where("ownerType", "in", ["business", "school", "org"])));
  const demos = snap.docs.filter((d) => String(d.data()?.name || "").startsWith("[데모]"));
  const byType = {};
  for (const d of demos) byType[d.data().ownerType] = (byType[d.data().ownerType] || 0) + 1;
  console.log(`\n[1] 데모 구장 ${demos.length}건`, byType);
  const approved = demos.filter((d) => d.data().status === "approved" && d.data().active === true).length;
  console.log(`    승인+노출: ${approved}/${demos.length}`);

  /* 2) 로그인 → 내 구장·유저문서 확인 (구장주 앱이 실제로 읽는 경로) */
  const cred = await signInWithEmailAndPassword(auth, "demo-biz1@hallemale-demo.com", PW);
  const uid = cred.user.uid;
  const u = (await getDoc(doc(db, "users", uid))).data();
  console.log(`\n[2] demo-biz1 로그인 OK uid=${uid}`);
  console.log(`    ownerType=${u.ownerType} 동의=${u.ownerTermsConsent && u.ownerPrivacyConsent && u.ownerAdultConsent} 담당자=${u.ownerManagerName}/${u.ownerManagerPhone} phoneVerified=${u.phoneVerified}`);
  const mine = await getDocs(query(collection(db, "venues"), where("ownerUid", "==", uid)));
  console.log(`    내 구장 ${mine.size}건, status=${mine.docs[0]?.data()?.status}, business.status=${mine.docs[0]?.data()?.business?.status}`);

  /* 3) [실증] 남의 구장 문서를 다른 구장주 세션으로 수정할 수 있는가 */
  const victim = demos.find((d) => d.data().ownerUid !== uid);
  const before = victim.data();
  let crossWrite = false;
  try {
    await updateDoc(doc(db, "venues", victim.id), {
      settlement: { bank: "토스뱅크", account: "9999999999", holder: "공격자", verified: false },
    });
    crossWrite = true;
    // 즉시 원복
    await updateDoc(doc(db, "venues", victim.id), { settlement: before.settlement || {} });
  } catch (e) {
    console.log(`    (차단됨: ${e?.code})`);
  }
  console.log(`\n[3] ${ok(!crossWrite)} 남의 구장(${before.name}) 정산계좌 변경 시도 → ${crossWrite ? "성공(취약)" : "차단"}`);

  /* 4) [실증] 심사 상태를 구장주 본인이 바꿀 수 있는가 (승인 우회) */
  let selfApprove = false;
  try {
    await updateDoc(doc(db, "venues", mine.docs[0].id), { status: "pending", active: false });
    await updateDoc(doc(db, "venues", mine.docs[0].id), { status: "approved", active: true, "business.status": "verified" });
    selfApprove = true;
  } catch (e) {
    console.log(`    (차단됨: ${e?.code})`);
  }
  console.log(`[4] ${ok(!selfApprove)} 구장주 본인이 status=approved·business.verified 설정 → ${selfApprove ? "성공(심사 우회 가능)" : "차단"}`);

  /* 5) [실증] 같은 휴대폰번호로 구장주 계정을 여러 개 만들 수 있는가 */
  const sameP = await getDocs(query(collection(db, "users"), where("ownerManagerPhone", "==", "01099991000")));
  console.log(`[5] ${ok(sameP.size <= 1)} 동일 번호(01099991000) 구장주 계정 수 = ${sameP.size} ${sameP.size > 1 ? "(중복 허용)" : ""}`);

  /* 6) [실증] phones/{번호} 매핑이 남는가 (번호↔계정 연결) */
  const ph = await getDoc(doc(db, "phones", "+821099991000"));
  console.log(`[6] ${ok(ph.exists())} phones/+821099991000 문서 ${ph.exists() ? "존재" : "없음 — 구장주 번호는 인덱싱되지 않음"}`);
  await signOut(auth);

  /* 7) [실증] SMS 인증 없이 users 문서를 phoneVerified:true 로 생성할 수 있는가 (사용자앱 게이트) */
  const probeEmail = `probe-${Math.floor(Math.random() * 1e6)}@hallemale-demo.com`;
  const p = await createUserWithEmailAndPassword(auth, probeEmail, PW);
  let bypass = false;
  try {
    await setDoc(doc(db, "users", p.user.uid), {
      uid: p.user.uid, email: probeEmail, nickname: "probe",
      phoneE164: "+821012349999", phoneVerified: true, provider: "password",
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    bypass = true;
  } catch (e) {
    console.log(`    (차단됨: ${e?.code})`);
  }
  console.log(`[7] ${ok(!bypass)} SMS 인증 0회로 users.phoneVerified=true 문서 생성 → ${bypass ? "성공(전화인증 게이트 우회)" : "차단"}`);
  // 프로브 정리
  try { await deleteDoc(doc(db, "users", p.user.uid)); } catch {}
  try { await deleteUser(p.user); } catch {}
  console.log("    (프로브 계정 삭제 완료)");

  process.exit(0);
}
main().catch((e) => { console.error("검증 실패:", e); process.exit(1); });
