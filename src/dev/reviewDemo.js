/* eslint-disable */
// 리뷰 도구(/review) iframe 안에서만 데모 계정으로 자동 로그인.
// → 인증 게이트는 AppRoutes 의 inReviewFrame() 우회로 통과되고, 여기서 실제 세션까지 만들어
//   Firestore 데이터(홈·기록·매칭·마이·관리자)가 실제로 로드된다.
// 계정/데이터는 scripts/seed-review-demo.mjs 로 생성. (팀청춘 가입 + isAdmin)
// ⚠️ 앱은 평소 iframe 안에서 돌지 않으므로(RN은 WebView라 top===self) 리뷰 프레임에서만 동작.
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, ownerAuth } from "../services/firebase";

const DEMO_EMAIL = "review-demo@hallamalle.com";
const DEMO_PW = "reviewDemo2026!";

function inReviewFrame() {
  try {
    return typeof window !== "undefined" && window.top !== window.self;
  } catch {
    return true; // 크로스오리진이면 접근 불가 → iframe 임베드로 간주
  }
}

export function maybeAutoLoginReviewDemo() {
  if (!inReviewFrame()) return;
  // 사용자 앱 세션 + 구장주 세션 모두 데모로 로그인 → 모든 도메인 화면 데이터 로드
  signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PW).catch(() => {});
  try {
    signInWithEmailAndPassword(ownerAuth, DEMO_EMAIL, DEMO_PW).catch(() => {});
  } catch { /* ownerAuth 미초기화 예외 무시 */ }
}
