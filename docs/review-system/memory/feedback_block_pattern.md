---
name: 차단 가드는 signOut 하지 않음
description: 차단된 사용자/팀 가드는 강제 로그아웃하지 말고 오버레이만 띄울 것 — 해제 즉시 재진입 가능하도록
type: feedback
originSessionId: 7184c550-6856-4810-98b8-a26affb78762
---
차단된 회원/팀에 가드(BlockedOverlay) 띄울 때 signOut 호출하지 말 것.

**Why:** 행렬이 형이 명시 — "그 사이에 해제할 수 있으니". 차단된 사용자가 새로고침 버튼을 눌렀을 때, 만약 어드민이 그 사이 차단을 풀어줬으면 곧바로 정상 진입할 수 있어야 함. 강제 signOut 시키면 사용자는 다시 로그인해야 하므로 흐름이 끊김.

**How to apply:**
- BlockedAuthGate / BlockedOverlay는 화면을 가리는 오버레이만 표시
- 새로고침 시 페이지 reload → AuthContext가 Firestore 재조회 → blocked === false면 자동으로 가드 사라짐
- 차단 시 alert/window.confirm 등 네이티브 다이얼로그 사용 금지 — 커스텀 BlockedOverlay 컴포넌트로 통일
- 클라이언트 가드는 UX 차원이고, 실제 데이터 차단은 firestore.rules에서 처리해야 안전 (별도 작업)
