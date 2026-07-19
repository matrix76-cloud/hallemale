# 서비스 레이어 분석 (src/services/)

## firebase.js — Firebase 초기화
- 내보내기: `app`, `auth`, `db` (Firestore), `storage`
- Analytics 동적 import (선택적)
- 중복 초기화 방지 (getApps().length 체크)

## authService.js — 인증
| 함수 | 접근 컬렉션 | 설명 |
|------|-------------|------|
| signUpWithEmail({email,password,nickname,consents,phoneE164,phoneVerified}) | users/{uid}, users_by_phone/{phoneE164} | 가입+인덱스 생성 |
| signInWithEmail({email,password,keepLogin}) | users/{uid} | 로그인 (로컬/세션 영속성) |
| sendPasswordReset({email}) | - | 비밀번호 재설정 메일 |
| signOutUser() | - | 로그아웃 |
| watchAuthState(onChange) | users/{uid} | Auth 상태 구독 |

## userService.js — 사용자
| 함수 | 접근 컬렉션 | 설명 |
|------|-------------|------|
| ensureUserDoc({uid,email}) | users/{uid} | 유저 문서 보장 |
| getUserDoc(uid) | users/{uid} | 유저 정보 조회 |
| updateUserProfile({uid,...fields}) | users/{uid} | 프로필 업데이트 |
| upsertUserPhoneIndex({phoneE164,uid,email}) | users_by_phone/{phoneE164} | 전화번호 인덱스 |

## teamService.js — 팀
| 함수 | 접근 컬렉션 | 설명 |
|------|-------------|------|
| getTeamProfile(teamId) | clubs/{teamId}, clubs/{teamId}/members | 팀 전체 프로필 |
| listClubsForPicker({limitCount,regionSido}) | clubs | 팀 목록 조회 |
| createJoinRequestToClub({clubId,...}) | clubs/{clubId}/joinRequests, notifications, users | 참가 신청 |
| createClub({ownerUid,...,logoFile}) | clubs, clubs/{clubId}/members, users, Storage | 팀 생성 |

## matchingService.js — 매칭 요청
| 함수 | 접근 컬렉션 | 설명 |
|------|-------------|------|
| createMatchRequest({actorClubId,...}) | match_requests, notifications (2개) | 매칭 신청 |
| acceptMatchRequest({myClubId,latestNoti}) | match_requests, notifications (2개) | 수락 |
| rejectMatchRequest({myClubId,latestNoti}) | match_requests, notifications (2개) | 거절 |
| cancelMatchRequest({myClubId,latestNoti}) | match_requests, notifications (2개) | 취소 |

## matchRoomService.js — 경기방
| 함수 | 접근 컬렉션 | 특징 |
|------|-------------|------|
| loadMatchRoomListPageData(myTeamId) | match_requests (2쿼리) | 내 팀 경기 목록 |
| loadMatchRoomDetail(matchRequestId) | match_requests/{id} | 상세 |
| proposeMatchSchedule({...}) | match_requests/{id} | 일정 제안 |
| confirmProposedSchedule({...}) | match_requests/{id} | 일정 확정 |
| submitMatchResultWithMedia({...}) | match_requests/{id} + Storage | 결과+사진 |
| acceptMatchResult({...}) | **Transaction**: match_requests, clubs, users | stats 반영 |
| listFinishedMatchesPage({pageSize,cursor}) | match_requests (finished) | 페이지네이션 |

## clubManageService.js — 팀 관리
| 함수 | 접근 컬렉션 | 특징 |
|------|-------------|------|
| getMyClubRole({clubId,uid}) | clubs/{clubId}/members/{uid} | 역할 확인 |
| updateClubIntroPromo/Name/Logo/Activity | clubs/{clubId} (+tasks) | 팀 정보 수정 |
| leaveClub({clubId,uid}) | **Batch**: clubs, members, users | 팀 탈퇴 |
| deleteClubAndCleanup({clubId,uid}) | **Batch**: 다중 쿼리+청소 | 팀 삭제 |
| kickClubMember({clubId,targetUid}) | **Batch**: members, users | 멤버 추방 |
| listClubMembers/listInvitableUsers/searchUsersByNickname | users | 멤버 조회 |
| createClubInvite({clubId,...}) | **Batch**: invites, notifications | 초대 생성 |

## inviteService.js — 초대
| 함수 | 접근 컬렉션 | 특징 |
|------|-------------|------|
| listMyReceivedInvites({uid}) | invites (collectionGroup) | 받은 초대 |
| acceptClubInvite({clubId,inviteId,uid}) | **Batch**: invites, users, members, notifications | 수락 |
| rejectClubInvite({clubId,inviteId}) | clubs/{clubId}/invites | 거절 |

## lineupService.js — 라인업
| 함수 | 접근 컬렉션 | 설명 |
|------|-------------|------|
| upsertClubLineup({clubId,lineupDraft}) | clubs/{clubId} | 라인업 저장 |
| ensureDefaultLineupIfMissing(clubId) | clubs/{clubId}, members | 기본 라인업 |
| deleteClubLineup({clubId,lineupId}) | clubs/{clubId} | 라인업 삭제 |

## rankingService.js — 랭킹
| 함수 | 접근 컬렉션 | 정렬 |
|------|-------------|------|
| listPlayerRankingPage({pageSize,cursor}) | users | 점수=wins×5+draws×2+losses×1 |
| listPlayerRankingTopApprox({top}) | users (wins desc) | 근사 Top5 |

## homeService.js — 홈
| 함수 | 접근 컬렉션 | 설명 |
|------|-------------|------|
| loadHomePageData({uid}) | users/{uid}, clubs 전체, users 상위50 | 홈 대시보드 |
| loadHomeFavorites({uid}) | users/{uid}, clubs | 즐겨찾기 |

## notificationService.js — 알림
| 함수 | 접근 컬렉션 | 설명 |
|------|-------------|------|
| listNotificationsForUser({uid,clubId}) | notifications (array-contains) | 알림 목록 |
| markNotificationRead({notificationId,uid}) | notifications/{id} readBy | 읽음 처리 |

## 기타 서비스
- **fcmService.js**: registerFcmToken, unregisterFcmToken, onForegroundMessage
- **mediaService.js**: uploadUserAvatar (350x350), uploadCompressedImageMedia (1080x1080), parseYoutubeId
- **communityService.js**: loadCommunityList, loadCommunityPostDetail, createCommunityPost
- **favoriteService.js**: setFavoriteTeam, setFavoritePlayer (arrayUnion/arrayRemove)
- **counterpartService.js**: getUserPublicMeta (메모리 Map 캐시)
- **taskService.js**: enqueueTeamSnapshotRefreshTask (tasks 컬렉션)
- **playerService.js**: getPlayerProfile (users + clubs 조합)
- **gamesService.js**: 오늘 경기 조회
- **recoveryService.js**: 계정 복구
- **schemaDumpService.js**: 스키마 덤프 (개발용)

## 핵심 설계 패턴
- **SSOT**: activeTeamId(팀), targetIds(알림), memberIds(라인업)
- **Batch/Transaction**: 다중 문서 동시 업데이트 (acceptMatchResult, acceptClubInvite, leaveClub)
- **스냅샷 보존**: match_requests에 fromTeamSnapshot/toTeamSnapshot 저장
- **중복 방지**: statsAppliedAt 플래그 (결과 반영 1회만)
- **인덱스 최소화**: 클라이언트 메모리 정렬, array-contains만 사용
- **알림 패턴**: 상대팀 push.enabled:true, 우리팀 push.enabled:false (기록용)
