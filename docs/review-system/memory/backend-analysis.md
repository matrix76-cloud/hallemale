# 백엔드 분석 (functions/)

## 아키텍처
```
functions/
├── index.js              → 함수 익스포트 진입점
├── firebaseAdmin.js      → Admin SDK 싱글톤 (getDb, getAdmin)
├── env.js                → 환경변수 (REGION, TZ, CRAWL_DAYS_AHEAD, USER_AGENT)
├── crawlers/naver/       → Naver Sports API 크롤러
│   ├── fetchGames.js     → HTTP 요청
│   ├── parseGames.js     → JSON 정규화
│   └── mapTeams.js       → 팀명 정규화
├── jobs/
│   ├── crawlKblGames.js  → KBL 게임 크롤링 (3가지 트리거)
│   └── sendPushNotifications.js → FCM 푸시 발송
├── repos/
│   ├── gamesRepo.js      → games 컬렉션 (upsertGames)
│   ├── systemRepo.js     → _system 컬렉션 (acquireOnceLock)
│   ├── userRepo.js       → users 컬렉션 (FCM토큰, stale토큰)
│   └── notificationRepo.js → notifications 컬렉션 (큐/상태)
├── password/
│   └── resetPasswordViaProxy.js → 비밀번호 재설정 (HTTP)
├── sms/
│   └── sendSmsProxy.js   → SMS 발송 프록시 (HTTP)
└── utils/
    ├── logger.js          → 로깅 (scope-action-payload)
    ├── httpFetch.js        → HTTP 유틸 (12초 타임아웃)
    ├── ids.js              → 게임ID 생성 (정규화)
    ├── normalize.js        → 문자열 정규화
    └── logoCache.js        → 로고 Storage 캐싱
```

## Cloud Functions 상세

### crawlKblInitOnce (onRequest, 수동)
- CORS, 540초 타임아웃
- acquireOnceLock으로 중복 실행 방지
- CRAWL_DAYS_AHEAD일 범위 크롤링

### crawlKblDaily (onSchedule "0 5 * * *")
- 매일 05:00 KST, daysAhead=7

### crawlKblTick (onSchedule "*/15 * * * *")
- 15분마다, daysAhead=0 (오늘만)

### 크롤링 흐름 (runCrawlRange)
1. buildNaverApiUrl → Naver API URL
2. fetchNaverGamesRaw → JSON 요청
3. parseNaverGames → 정규화 (gameId, 팀, 점수, 상태)
4. allowBasketballLeagues → 필터
5. applyLogoCacheForGame → Storage 캐시
6. upsertGames → Firestore 저장

### sendPushTick (onSchedule "*/3 * * * *")
1. fetchQueuedNotifications(50) → queued 알림 조회
2. getUsersFcmInfoBatch(uids) → 토큰+설정 배치 조회
3. processNotification → prefs 확인, 토큰 수집
4. messaging.sendEach(messages) → FCM 발송
5. stale 토큰 정리 (registration-token-not-registered)
6. updatePushStatus → sent/failed/skipped

### resetPasswordViaProxy (onRequest POST)
- Bearer 토큰 인증 (RESET_PASSWORD_PROXY_KEY)
- users_by_phone/{phoneE164} → email → uid → updateUser(password)
- password_reset_logs 감사 로그

### sendSmsProxy (onRequest POST)
- SMS Gateway: `http://34.64.211.220:8080/sendSms`
- 공유키: `"sms-gateway-shared-key-2025"`
- 요청: { to, templateId, app, variables }

## Repos 상세

### gamesRepo.js
- `upsertGames(games[])`: 배치 set with merge, createdAt/updatedAt 자동

### systemRepo.js
- `acquireOnceLock(lockKey)`: 트랜잭션 기반 1회 실행 락 (_system/{lockKey})

### userRepo.js
- `getUsersFcmInfoBatch(uids)`: 100명 청크 배치 조회 → Map<uid, {fcmTokens, prefs}>
- `removeStaleToken(uid, token)`: arrayRemove

### notificationRepo.js
- `fetchQueuedNotifications(batchSize)`: push.enabled==true + JS필터 status==="queued"
- `updatePushStatus(id, {status, failReason})`: push.status/sentAt/sent 업데이트

## 로고 캐싱 (logoCache.js)
- 경로: `logos/{league}/{teamCode}/{sha1hash}.{ext}`
- 허용 도메인: `*.pstatic.net`
- 중복 업로드 방지 (exists 체크)
- Public URL 생성 (firebaseStorageDownloadTokens)

## 게임 ID 생성 (ids.js)
- 포맷: `basketball_kbl_2026_02_20_20_00_kt_skt`
- 정규화: 소문자, 특수문자 제거, 한글/숫자/문자만

## 의존성 (functions/package.json)
- firebase-admin: 13.6.0
- firebase-functions: 7.0.0
- Node: 20

## 환경변수 (functions/.env)
- FUNCTIONS_REGION=asia-northeast3
- TZ=Asia/Seoul
- CRAWL_DAYS_AHEAD=7
- USER_AGENT=Mozilla/5.0 (compatible; KBL-ScheduleBot/1.0)
- RESET_PASSWORD_PROXY_KEY (비밀번호 프록시 인증)
