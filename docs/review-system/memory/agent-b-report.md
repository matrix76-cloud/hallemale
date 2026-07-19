---
name: Agent B 완료 보고 (2026-04-15)
description: 지휘 에이전트에게 전달할 Agent B(Functions) 스프린트 결과 — sendTestPush + 객체형 토큰 호환 + KBL 신규경기 공지
type: project
originSessionId: f3e1c886-ef0b-4f4a-9b7b-e2b231ddd2aa
---
# 📨 Agent B → 지휘 에이전트 완료 보고

**일시**: 2026-04-15
**스프린트**: 10분 — sendTestPush + 객체형 토큰 + KBL 공지
**상태**: ✅ 완료, smoke load OK

## 변경 파일
1. **`functions/jobs/sendTestPush.js`** (신규)
   - `onRequest` POST `{uid, title, body}` → `users/{uid}.fcmTokens` 조회 → `sendEachForMulticast` 즉시 발송
   - stale 토큰 자동 정리
2. **`functions/index.js`**
   - `exports.sendTestPush` 추가
3. **`functions/repos/userRepo.js`**
   - `normalizeTokens()` 추가: `string[]` 및 `[{token, platform}]` 둘 다 정규화
   - `getAllUsersFcmInfo()` 신규 — 브로드캐스트용 (토큰 보유자만)
   - `removeStaleToken()` 트랜잭션 read-modify-write로 변경 (string/object 둘 다 안전 제거)
4. **`functions/jobs/sendPushNotifications.js`**
   - `targetIds: []` → 전체 사용자 브로드캐스트 분기
   - 빈 타겟이 섞이면 `getAllUsersFcmInfo()` + 누락 보강 조회
5. **`functions/repos/gamesRepo.js`**
   - `upsertGames` 사전 존재확인(`db.getAll` 청크 100) → `newGameIds` 함께 반환
6. **`functions/jobs/crawlKblGames.js`**
   - `runCrawlRange` `newGames` 누적
   - `enqueueNewGameNotices()` 추가 — `notifications` addDoc(`prefsCategory:"notice"`, `targetIds:[]`, `push:{enabled:true, status:"queued"}`, `meta.gameId/league/date`)
   - `crawlKblDaily` 종료 시점에 호출

## 검증
- `node -e "require('./index.js')"` → `OK` (export 정상)

## 주의/후속 (지휘에 알림용)
- `upsertGames`가 게임당 1회 추가 read 발생 → daily/tick 모두 영향. 비용 OK 수준이지만 인지 필요.
- `getAllUsersFcmInfo()`는 `users` 컬렉션 풀스캔. 사용자 수 늘면 페이지네이션 검토.
- 신규 게임 공지는 **`crawlKblDaily`에만** 연결. `crawlKblTick`(15분)에는 미연결 — 중복 공지 방지 의도. 원하면 tick에도 연결 가능.
- `sendTestPush`는 인증 없음(디버깅용). 운영 노출 전 토큰/IP 가드 권장.

## 의존 파일 (다른 에이전트 충돌 체크)
- 건드린 영역: `functions/**` 만. `src/**`, `2026Mobile/**` 무수정.
