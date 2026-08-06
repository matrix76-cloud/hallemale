// 어드민 URL 베이스 — 여기 한 곳만 바꾸면 라우트·사이드바·이동이 전부 따라온다.
//
// 주의: 주소를 숨기는 건 "덜 눈에 띄게" 하는 것일 뿐 접근 통제가 아니다.
// 실제 차단은 RequireAdmin(admin 클레임) + Firestore 규칙이 한다.
export const ADMIN_BASE = "/adminhallaemallae123123";
