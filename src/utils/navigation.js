/* eslint-disable */
// src/utils/navigation.js
// 뒤로가기 동작 통일 헬퍼
// - history 스택이 있으면 navigate(-1)
// - 스택이 없으면(딥링크/푸시 등으로 화면에 바로 진입) 홈으로 fallback
// 이렇게 하지 않으면 navigate(-1)이 무동작이 되어 "일부 화면만 뒤로가기가 안 되는" 버그가 생긴다.
export function goBackOrHome(navigate, fallback = "/home") {
  try {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
  } catch (e) {}
  navigate(fallback);
}
