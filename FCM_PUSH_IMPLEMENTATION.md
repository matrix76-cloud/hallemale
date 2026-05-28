# FCM 푸시 알림 구현 상세 (2026-02-11)

## 생성된 파일

### 1. `functions/repos/notificationRepo.js`
- `fetchQueuedNotifications(batchSize)` — `push.enabled == true` 쿼리 → JS에서 `push.status === "queued"` OR 레거시(`push.sent === false && !push.status`) 필터
- `updatePushStatus(notificationId, { status, failReason })` — push.status, push.sentAt, push.sent(레거시) 업데이트

### 2. `functions/repos/userRepo.js`
- `getUsersFcmInfoBatch(uids)` — `db.getAll()`, 100명씩 청크, `{ fcmTokens, prefs }` Map 반환
- `removeStaleToken(uid, token)` — `arrayRemove`로 만료 토큰 제거

### 3. `functions/jobs/sendPushNotifications.js`
- `sendPushTick` — `onSchedule("*/3 * * * *")`, 매 tick 최대 50개 queued 알림 처리
- 흐름: targetIds → prefs 확인 → FCM 토큰 수집 → `messaging.sendEach()` → 상태 업데이트
- stale 토큰 자동 정리 (`messaging/registration-token-not-registered`)
- 실패 시 `push.status: "failed"` + failReason (무한 재시도 방지)

### 4. `src/services/fcmService.js`
- `registerFcmToken(uid)` — 권한 요청 → `getToken()` → `users/{uid}.fcmTokens` arrayUnion
- `unregisterFcmToken(uid, token)` — 로그아웃 시 arrayRemove
- `onForegroundMessage(callback)` — 포그라운드 메시지 리스너
- `firebase/messaging` 동적 import (브라우저 미지원 환경 안전)

### 5. `public/firebase-messaging-sw.js`
- Firebase compat SDK (`importScripts`)
- `onBackgroundMessage` — 알림 표시 (title, body, icon)
- `notificationclick` — deepLink 네비게이션

## 수정된 파일

### 6. `functions/index.js`
- `sendPushTick` export 추가

### 7. `src/context/AuthContext.jsx`
- `fcmTokenRef` (useRef) 추가
- 로그인 성공 후 `registerFcmToken(uid)` 비동기 호출 (실패해도 로그인 안 막힘)
- `signOut`에서 `unregisterFcmToken(uid, token)` 호출 후 ref 초기화

### 8. `src/services/clubManageService.js`
- `createClubInvite`의 알림 payload에 추가:
  ```js
  push: { enabled: true, status: "queued", sentAt: null, failReason: null },
  prefsCategory: "teamInvite",
  ```

---

## 배포 전 필수
- `.env`에 `REACT_APP_FCM_VAPID_KEY` 설정
  - Firebase Console > Project Settings > Cloud Messaging > Web Push certificates

## 알림 문서 스키마 (notifications 컬렉션)
```
{
  kind, type, title, body,
  targetIds: [uid, ...],
  push: {
    enabled: true,
    status: "queued" | "sent" | "failed" | "skipped",
    sentAt: Timestamp | null,
    failReason: string | null,
    sent: boolean  // 레거시 호환
  },
  prefsCategory: "teamInvite" | "match" | "chat" | ...,
  readBy: { [uid]: Timestamp },
  createdAt, updatedAt
}
```

## 알림 설정 (users.notificationPrefs)
- `notificationPrefsService.js`에서 관리
- `{ enabled: bool, categories: { notice, chat, teamInvite, teamDecision, match, player, team } }`
- Cloud Function에서 `prefsCategory`와 매칭하여 발송 여부 결정

## 검증 체크리스트
1. `firebase deploy --only functions` → Firestore `push.status: "queued"` → 3분 내 `"sent"` 변경
2. 브라우저 알림 권한 허용 → `users/{uid}.fcmTokens`에 토큰 저장
3. 백그라운드 푸시 알림 수신
4. 알림 클릭 → deepLink 이동
5. 알림 설정 OFF → `push.status: "skipped"`

## 다음 작업 후보
- 다른 알림 생성 지점에도 `push` 필드 추가 (매칭, 채팅 등)
- `onForegroundMessage`를 실제 UI 토스트와 연결
- VAPID 키 설정 후 E2E 테스트