---
name: owner-venue-system
description: "구장 관리자(구장주) 워크스페이스 — /owner 별도 라우트 트리, 구장 등록 심사 + 코트별 예약 관리"
metadata: 
  node_type: memory
  type: project
  originSessionId: fc45836e-4e46-476a-a998-e509bbeb9af7
---

# 구장 관리자 시스템 (2026-06-25 1차 완성)

**목적**: 구장주가 자기 구장을 등록→어드민 심사→승인되면 사용자 앱에 노출→예약받고 코트별 슬롯/가격 관리. 별도 RN WebView 앱이 이 `/owner/*` 라우트를 띄움(서버는 halle-bf789 공유).

## 결정사항
- 로그인: 기존 소셜(`signInWithSocial` 카카오/구글) 재활용 + `users/{uid}.role="owner"` 마킹 (`markUserAsOwner`)
- 한 구장(venue)에 **예약 대상 코트 여러 개**(courts[]) — 코트마다 운영시간·가격·슬롯단위
- 심사: venues.status `pending|approved|rejected` (없으면 approved=레거시/어드민 등록 호환). 승인 시 active=true로 사용자 노출

## 데이터 모델
- `venues` 확장: ownerUid, status, rejectReason, region/lat/lng(주소검색 자동), photos[], storagePaths[], facilities[], description, rules, refundPolicy, bizName/bizNo/ownerName/contactPhone, courts[]{id,name,type,pricePerHour,slotMinutes,hours{mon..sun:{open,close,closed}}}
- 코트 운영시간은 **요일별**(주중/주말 다름). `defaultCourtHours()`,`DAY_KEYS`,`dowToKey()`,`normalizeHours`(레거시 openTime/closeTime 호환). 편집 UI=`CourtHoursEditor`(평일/주말 일괄적용 버튼). 슬롯 생성은 선택 날짜 요일의 hours 사용, closed면 휴무 표시
- 주소: `components/addressSearch.js`의 `openDaumPostcode`(다음 우편번호 팝업 + 카카오 지오코더로 lat/lng). index.html에 postcode.v2.js+kakao sdk 이미 로드됨
- `venueReservations`: venueId,courtId,ownerUid,date,startTime,endTime,user…,price,status(requested|confirmed|rejected|cancelled|done)
- `venueBlocks`: 구장주가 막은 시간 venueId,courtId,date,start,end
- 인덱스 최소화: venueId 단일 where + 클라 필터(date/court)

## 라우트 (`/owner/*`, RequireOwnerAuth→OwnerLayout)
- `/owner/login` 소셜 로그인 / `/owner` 진입분기(OwnerEntry) / `/owner/register` 등록폼(반려시 재신청 prefill) / `/owner/pending` 심사현황 / `/owner/home` 예약(슬롯그리드+승인거절+막기) / `/owner/venue` 내구장(코트관리) / `/owner/my` 내정보
- 어드민 승인: `/admin/venues` 상단 "심사 대기" 카드 (approveVenue/rejectVenue)

## 주요 파일
- `src/services/ownerVenueService.js`, `src/context/OwnerContext.jsx`
- `src/layouts/OwnerLayout.jsx` + `components/OwnerBottomTabBar.jsx`
- `src/pages/owner/*` (Entry/Login/Register/Status/Home/Venue/My + components/ownerUi.js,OwnerSpinner,RequireApproved)

## TODO (다음 단계)
- 사용자 앱에서 구장 예약 생성 UI (지금은 createReservation 서비스만 있음, 시드/테스트용)
- 결제("피지" — 가상결제수단인지 PG인지 미확정) 연동
- 푸시: 예약 들어오면 구장주에게 실시간 알림
- 주소 검색(카카오)·지도 좌표는 등록폼에서 텍스트 입력만 (lat/lng 미수집) — 추후 VenuePickerSheet 패턴 적용 가능
