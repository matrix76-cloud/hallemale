---
name: A 에이전트 완료 보고
description: A(푸시) 에이전트 #1 스프린트 결과 — 지휘 에이전트 확인용
type: project
originSessionId: a3810225-d2e6-41ea-a251-9382871cac09
---
# 🔔 A 에이전트 #1 완료 보고 (2026-04-15)

지휘 에이전트가 바쁜 동안 작업 완료. 다음 지시서 발행 시 참고.

## 작업 파일
- `src/services/fcmService.js`
- `src/context/AuthContext.jsx`
- `src/services/chatService.js`
- `src/services/matchRoomService.js`
- `src/services/joinRequestService.js`
- `src/services/inviteService.js`
- `src/services/communityService.js`
- `src/services/clubManageService.js`

⛔ 금지 영역(authService / functions/** / pages/** / gymService) 미수정

## 변경 내역

### 1) WebView FCM 토큰 차단
- `fcmService.registerFcmToken()` 최상단에 `isInWebView()` 가드 추가 → RN WebView 안에서는 웹 토큰 등록 스킵 (`return null`)
- `import { isInWebView } from "../bridge/webviewBridge"`

### 2) RN → 웹 PUSH_TOKEN 수신 → Firestore 저장
- `AuthContext`에서 `window.addEventListener("message")` 직접 등록
  - 이유: Provider 순서가 `Theme→Auth→...→WebviewBridge→Routes`로 WebviewBridgeProvider가 Auth 안쪽에 있어 `useWebviewBridgeContext()` 사용 불가
- `PUSH_TOKEN` / `FCM_TOKEN` 두 타입 모두 처리
- 저장 형식: `users/{uid}.fcmTokens` arrayUnion **객체형**
  ```js
  { token, platform, updatedAt: ISO string }
  ```
- `uid` 준비 전 도착 시 `pendingRnTokenRef`에 보류 → 로그인 완료(`firebaseUser?.uid` 변경) 시 자동 저장

### 3) 알림 6종 추가
모두 공통: `push: { enabled: true, status: "queued", sentAt: null, failReason: null }` + `prefsCategory` + `meta.deepLink` 포함.

| # | 위치 | 트리거 | 타겟 | prefsCategory | subType |
|---|------|--------|------|---------------|---------|
| A | `chatService.sendTextMessage` / `sendImagesMessage` | 메시지 발송 후 | 상대 참여자 | `chat` | `chatMessage` |
| B | `matchRoomService.acceptMatchResult` | 트랜잭션 후 | 양 팀(TEAM 타겟) | `match` | `matchResultConfirmed` |
| C | `joinRequestService.rejectJoinRequest` | 거절 직후 | 신청자 | `teamDecision` | `JOIN_REQUEST_REJECTED` |
| D | `inviteService.rejectClubInvite` | 거절 직후 | 초대자(팀장) | `teamDecision` | `CLUB_INVITE_REJECTED` |
| E | `communityService.addCommunityComment` / `toggleCommunityLike` | 댓글/좋아요 직후 | 글쓴이 | `community` | `community_comment` / `community_like` |
| F | `clubManageService.kickClubMember` / `forceRemoveClubMember` / `deleteClubAndCleanup` | 강퇴/해체 직후 | 대상자/잔여 멤버 | `teamDecision` | `TEAM_MEMBER_KICKED` / `TEAM_DISBANDED` |

## 신규 export (E번)
- `addCommunityComment({ postId, authorUid, content, parentId? })` — 댓글 추가 + `stats.commentsCount` increment
- `toggleCommunityLike({ postId, uid })` — 좋아요 토글 + `stats.likes` increment
- 둘 다 본인 글에는 알림 미발송

## 메모
- `WebviewBridgeContext`는 이미 타입별 `subscribe` 라우팅 지원 → 별도 수정 없음
- 모든 알림에 `addDoc(collection(db, "notifications"), {...})` 사용. 트랜잭션 안쪽이 아닌 후처리(try/catch) 패턴 → 알림 실패가 본 작업을 차단하지 않음
- self-actor 알림 제외 로직 포함(chat, community)

## ✅ 다음 지시서 대기 중
