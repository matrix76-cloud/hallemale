# Firestore 스키마 통합

## users/{uid}
```
uid, email, nickname, avatarUrl
onboardingDone: boolean
regionSido, regionGu, region
activeTeamId: string (SSOT, ""=무소속)
mainPosition, skillLevel, heightCm, weightKg
intro, careers: []
media: []
stats: { totalMatches, wins, losses, draws, winRate, recentResults }
marketingConsent, termsConsent, privacyConsent
roleInTeam, isTeamCaptain: boolean
isAdmin: boolean
fcmTokens: string[] (FCM 토큰 배열)
notificationPrefs: { enabled, categories: { notice, chat, teamInvite, teamDecision, match, player, team } }
favoriteTeamIds: string[]
favoritePlayerIds: string[]
createdAt, updatedAt
```

## users_by_phone/{phoneE164}
```
email, uid, phoneVerified
```
→ 아이디 찾기용 인덱스

## clubs/{clubId}
```
name, region, regionSido, regionGu
description, tags: [], promo
logoUrl, logoPath
ownerUid: string
stats: { totalMatches, wins, losses, draws, winRate, recentResults: [], updatedAt }
activity: { days: [], time: string }
members: [] (요약)
lineups: [{
  id, name, matchSizeKey: "5v5"|"4v4"|"3v3"
  memberIds: [], memberCount
  previewMembers: [{ userId, nickname, photoUrl, mainPosition }]
  source: "auto"|"user"
  createdAt, updatedAt
}]
media: []
createdAt, updatedAt
```

### clubs/{clubId}/members/{uid}
```
uid, nickname, avatarUrl, role, joinedAt
```

### clubs/{clubId}/joinRequests/{docId}
```
clubId, playerUid, message, playerSnapshot, status, createdAt
```

### clubs/{clubId}/invites/{inviteId}
```
clubId, fromUid, toUid, message
status: "pending"|"accepted"|"rejected"|"cancelled"
toSnapshot: { uid, nickname, avatarUrl, region }
createdAt, updatedAt
```

## match_requests/{docId}
```
actorClubId, targetClubId
status: "pending"|"accepted"|"proposed"|"confirmed"|"finished"|"cancelled"
fromTeamSnapshot, toTeamSnapshot (스냅샷 보존)
fromLineupSnapshot, toLineupSnapshot

# 일정
scheduledAtISO, fieldAddress, fieldLatLng, proposedByClubId, confirmedByClubId

# 결과
myScore, oppScore (SSOT)
resultState: "waiting_accept"|"confirmed"|"disputed"
result: {
  submittedByClubId, authorUid, authorName, authorRole
  comment, photoUrls: []
  submittedAt
}
statsAppliedAt: Timestamp (중복 반영 방지)

createdAt, updatedAt
```

## notifications/{docId}
```
kind: "system"|"team"|"matching"|...
subType: "JOIN_REQUEST_CREATED"|"MATCH_REQUEST"|"MATCH_ACCEPTED"|...
title, body
targetType: "GLOBAL"|"USER"
targetIds: string[] (SSOT 조회 필터)
clubId: string
linkType, linkTargetId
important: boolean
actor: { uid, nickname, avatarUrl }
meta: { deepLink, ... }
push: {
  enabled: boolean
  status: "queued"|"sent"|"failed"|"skipped"
  sentAt: Timestamp|null
  failReason: string|null
  sent: boolean (레거시)
}
prefsCategory: "teamInvite"|"match"|"chat"|"notice"|...
readBy: { [uid]: Timestamp }
createdAt, updatedAt
```

## games/{gameId}
```
gameId: string (정규화 ID)
sport: "basketball"
league: "kbl"|"nba"
leagueName: string
date: "YYYY-MM-DD"
startTime: "HH:mm"
startAtMs: number
stadium: string
home: { code, name, score, emblemUrl, emblemRawUrl }
away: { code, name, score, emblemUrl, emblemRawUrl }
status: "scheduled"|"live"|"final"|"cancelled"
statusCode, statusInfo
cancel, suspended: boolean
source: { provider: "naver", url, fetchedAt, rawGameId }
createdAt, updatedAt
```

## community_posts/{docId}
```
authorUid, title, content
media: { images: string[] }
stats: { views, commentsCount, likes }
createdAt, updatedAt
```

### community_posts/{docId}/comments/{commentId}
```
authorUid, content, createdAt
```

## tasks/{docId}
```
kind: "team_snapshot_refresh"
status: "queued"|"processing"|"done"|"failed"
clubId, patch: { name?, logoUrl?, logoPath? }
reason: string
attempts, createdAt, updatedAt
```

## _system/{lockKey}
```
done: boolean, doneAt: Timestamp
```
→ 1회 실행 락 (crawlKblInitOnce)

## chatRooms/{docId}
```
participantUids: string[]
createdAt
```

## password_reset_logs/{docId}
```
phoneE164, email, uid, app, createdAt
```

## Firestore 인덱스 (firestore.indexes.json)
1. **chatRooms**: participantUids(ARRAY_CONTAINS) + createdAt(DESC)
2. **clubs**: stats.winRate(DESC) + updatedAt(DESC)
3. **invites**: status(ASC) + createdAt(DESC) + toUid(collectionGroup)
4. **users**: rankingScore(DESC) + updatedAt(DESC)
