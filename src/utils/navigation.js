/* eslint-disable */
// src/utils/navigation.js
// 뒤로가기 동작 통일 헬퍼
// - 앱 내부에 뒤로 갈 항목이 있으면 navigate(-1)
// - 없으면(딥링크/푸시/OAuth 리다이렉트/새로고침으로 바로 진입) 홈으로 fallback
//
// ⚠️ window.history.length 로 판정하면 안 된다:
//    WebView는 앱 시작·OAuth 리다이렉트 등으로 length가 이미 >1 인 경우가 많아,
//    앱 내부엔 뒤로 갈 항목이 없어도 navigate(-1)이 실행돼 SPA 밖(빈 페이지)으로
//    나가거나 무동작이 된다 → "일부 화면만 뒤로가기가 안 되는" 버그.
//
// ✅ React Router(v6.4+/v7)는 history.state.idx 로 앱 내부 네비 인덱스를 관리한다.
//    idx>0 이면 내부 백스택이 있음 → navigate(-1). idx===0/undefined 면 첫 진입 → 홈.
export function goBackOrHome(navigate, fallback = "/home") {
  try {
    const idx =
      typeof window !== "undefined" ? window.history.state?.idx : undefined;
    if (typeof idx === "number" && idx > 0) {
      navigate(-1);
      return;
    }
  } catch (e) {}
  navigate(fallback);
}
