/* eslint-disable */
// src/dev/mockScenarios.js — 개발 전용 목업 시나리오 정의 (mockBus 가 읽는다).
//
// 목적: /review/board 의 각 프레임을 "언제 열어도 똑같은 화면"으로 고정한다.
//  · 로그인하지 않아도 로그인된 것처럼 보이게 한다(auth/club/owner 컨텍스트 주입)
//    → RequireAuth·RequireConsent·RequirePhone·RequireBasicInfo·RequireWelcome 게이트가
//      전부 통과되어 /login 으로 튕기지 않는다.
//  · 화면별 데이터(매치룸 문서·채팅 메시지 등)를 시나리오마다 다르게 줘서 경우의 수를 만든다.
//
// 시나리오 = { extends?: <다른 시나리오 id>, label, data: { <주입키>: <값> } }
// 주입키는 mockBus.hasMock(key) 로 서비스·컨텍스트가 확인한다.
//   auth              → AuthContext value 에 머지
//   club              → ClubContext value 에 머지
//   owner             → OwnerContext value 에 머지
//   matchRequestDoc   → loadMatchRoomDetail 이 쓰는 raw match_requests 문서
//   matchReviews      → 매치룸 상세의 선수 평점 목록
//   matchRequestDocs  → loadMatchRoomListPageData 가 쓰는 raw 문서 배열
//   clubTeamSummaries → clubId → 팀 요약 (목록/상세 공용)
//   matchInbox        → listMatchInboxForClub 결과
//   chatMessages      → listenChatMessages 결과
//   chatRoom          → listenChatRoom 결과
//   matchReservation  → getMatchReservationStatus 결과
//   teamRankMap / playerRankMap → 랭킹 등수 맵

/* ========================= 공통 픽스처 ========================= */

const MY_UID = "mock_uid_me";
const MY_CLUB = "mock_club_me";
const OPP_CLUB = "mock_club_opp";
const OPP_LEADER_UID = "mock_uid_opp_leader";

// Firestore Timestamp 대신 Date 를 쓴다. 앱의 tsMs/fmtDate 유틸이 Date 도 처리하도록
// toDate() 를 흉내 내는 얇은 래퍼를 준다(실제 Timestamp 와 같은 인터페이스).
function ts(iso) {
  const d = new Date(iso);
  return { toDate: () => d, seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 };
}

// scheduledAt 은 실데이터에서 ISO 문자열이다(matchRoomService.proposeMatchSchedule).
// Timestamp 흉내 객체로 주면 `new Date(v)` 를 쓰는 화면에서 Invalid Date 가 된다.
const iso = (v) => new Date(v).toISOString();

// 보드 프레임을 언제 열어도 같은 화면이 나와야 하므로 날짜도 고정값으로 박는다.
const T = {
  createdAt: ts("2026-07-20T10:00:00+09:00"),
  acceptedAt: ts("2026-07-21T14:30:00+09:00"),
  proposedAt: ts("2026-07-22T09:10:00+09:00"),
  confirmedAt: ts("2026-07-22T18:40:00+09:00"),
  scheduledAt: iso("2026-08-02T19:00:00+09:00"),
  pastScheduledAt: iso("2026-07-12T19:00:00+09:00"),
  cancelledAt: ts("2026-07-23T11:05:00+09:00"),
  updatedAt: ts("2026-07-23T11:05:00+09:00"),
};

const player = (i, nickname, pos, h, w, skill) => ({
  userId: `mock_p_${i}`,
  nickname,
  mainPosition: pos,
  heightCm: h,
  weightKg: w,
  photoUrl: "",
  skillLevel: skill,
});

const MY_PLAYERS = [
  player("m1", "김도현", "PG", 178, 72, "상"),
  player("m2", "이준서", "SG", 183, 76, "상"),
  player("m3", "박시우", "SF", 187, 81, "중"),
  player("m4", "최민재", "PF", 191, 88, "상"),
  player("m5", "정하람", "C", 195, 95, "중"),
];
const MY_SUBS = [player("m6", "오태양", "SG", 180, 74, "중"), player("m7", "윤서준", "PF", 189, 85, "하")];

const OPP_PLAYERS = [
  player("o1", "강선우", "PG", 176, 70, "상"),
  player("o2", "임재현", "SG", 182, 75, "중"),
  player("o3", "송지호", "SF", 186, 80, "상"),
  player("o4", "한동윤", "PF", 190, 87, "중"),
  player("o5", "배건우", "C", 197, 98, "상"),
];
const OPP_SUBS = [player("o6", "노현빈", "SF", 184, 78, "중")];

const MY_TEAM_SNAP = {
  clubId: MY_CLUB,
  name: "팀청춘",
  region: "서울 용산구",
  regionSido: "서울",
  regionGu: "용산구",
  logoUrl: "",
  stats: { wins: 12, losses: 5, draws: 1, matches: 18 },
};
const OPP_TEAM_SNAP = {
  clubId: OPP_CLUB,
  name: "한강 슬램",
  region: "서울 마포구",
  regionSido: "서울",
  regionGu: "마포구",
  logoUrl: "",
  stats: { wins: 9, losses: 8, draws: 0, matches: 17 },
};

const lineup = (players, subs, confirmed) => ({
  id: `lineup_${confirmed ? "c" : "d"}`,
  matchSizeKey: "5v5",
  memberCount: players.length,
  memberIds: players.map((p) => p.userId),
  previewMembers: players,
  subMemberIds: subs.map((p) => p.userId),
  subPreviewMembers: subs,
  confirmed,
});

const FIELD = {
  name: "용산 더베이스 농구장",
  address: "서울 용산구 한강대로 100",
  lat: 37.5298,
  lng: 126.9648,
};

// 매치룸 raw 문서 기본형 — 시나리오별로 status/일정/결과만 덮어쓴다.
function matchDoc(over) {
  return {
    status: "accepted",
    actorClubId: MY_CLUB,
    targetClubId: OPP_CLUB,
    matchSizeKey: "5v5",
    fromTeamSnapshot: MY_TEAM_SNAP,
    toTeamSnapshot: OPP_TEAM_SNAP,
    fromLineupSnapshot: lineup(MY_PLAYERS, MY_SUBS, true),
    toLineupSnapshot: lineup(OPP_PLAYERS, OPP_SUBS, true),
    createdAt: T.createdAt,
    acceptedAt: T.acceptedAt,
    updatedAt: T.updatedAt,
    lastActivityAt: T.updatedAt,
    lastSeenBy: {},
    scheduledAt: null,
    durationMin: 120,
    field: null,
    // myScore/oppScore/resultState/result 는 기본값을 넣지 않는다 —
    // 실제 문서도 결과 입력 전에는 필드가 없고, null 을 넣으면 Number(null)===0 이라
    // 점수가 "0 : 0" 으로 굳는다(관리자 매칭목록).
    ...over,
  };
}

/* ========================= 신원(로그인 흉내) ========================= */

const MOCK_USER_DOC = {
  uid: MY_UID,
  id: MY_UID,
  nickname: "리뷰데모",
  name: "김리뷰",
  realName: "김리뷰",
  email: "review@hallaemallae.com",
  provider: "kakao",
  phone: "010-1234-5678",
  phoneE164: "+821012345678",
  birthYear: 1996,
  gender: "M",
  region: "서울 용산구",
  regionSido: "서울",
  regionGu: "용산구",
  avatarUrl: "",
  mainPosition: "PG",
  heightCm: 178,
  weightKg: 72,
  skillLevel: "상",
  intro: "주 2회 뜁니다. 픽앤롤 좋아해요.",
  careers: [],
  media: [],
  favVenueIds: ["mock_venue", "mock_venue2"],
  favoriteTeamIds: [],
  favoritePlayerIds: [],
  clubId: MY_CLUB,
  activeTeamId: MY_CLUB,
  activeTeamName: "팀청춘",
  teamName: "팀청춘",
  // 게이트 통과 플래그 — 이게 있어야 /login·약관·전화인증·기본정보 화면으로 안 튕긴다
  termsConsent: true,
  privacyConsent: true,
  ageOver14Consent: true,
  phoneVerified: true,
  basicInfoDone: true,
  welcomeSeen: true,
  isAdmin: false,
  adminClaim: false,
};

const MOCK_CLUB_DOC = {
  id: MY_CLUB,
  clubId: MY_CLUB,
  name: "팀청춘",
  ownerUid: MY_UID,
  logoUrl: "",
  region: "서울 용산구",
  regionSido: "서울",
  regionGu: "용산구",
  intro: "용산 기반 아마추어 농구팀입니다.",
  memberCount: 8,
  stats: MY_TEAM_SNAP.stats,
};

const MOCK_MEMBERS = [
  { id: MY_UID, uid: MY_UID, nickname: "리뷰데모", role: "owner", mainPosition: "PG" },
  ...MY_PLAYERS.map((p) => ({ id: p.userId, uid: p.userId, nickname: p.nickname, role: "member", mainPosition: p.mainPosition })),
  ...MY_SUBS.map((p) => ({ id: p.userId, uid: p.userId, nickname: p.nickname, role: "member", mainPosition: p.mainPosition })),
];

// 코트 운영시간 — ownerVenueService.defaultCourtHours() 와 같은 형태(요일별 open/close/closed)
const courtHours = () => {
  const day = { open: "08:00", close: "23:00", closed: false };
  return { mon: { ...day }, tue: { ...day }, wed: { ...day }, thu: { ...day }, fri: { ...day }, sat: { ...day }, sun: { ...day } };
};

// 구장주 워크스페이스용 구장 — OwnerGate 가 venue 없으면 온보딩으로 튕긴다
const MOCK_VENUE = {
  id: "mock_venue",
  venueId: "mock_venue",
  name: "용산 더베이스 농구장",
  ownerUid: "mock_uid_owner",
  ownerName: "박구장",
  status: "approved",
  address: "서울 용산구 한강대로 100",
  regionSido: "서울",
  regionGu: "용산구",
  phone: "02-1234-5678",
  defaultOwnerNote: "주차는 지하 1층을 이용해 주세요.",
  photos: [],
  courts: [
    { id: "court_a", name: "A코트", type: "indoor", pricePerHour: 40000, slotMinutes: 60, openTime: "08:00", closeTime: "23:00", hours: courtHours(), priceBands: [], priceOverrides: [], notices: [], cautions: [] },
    { id: "court_b", name: "B코트", type: "indoor", pricePerHour: 35000, slotMinutes: 60, openTime: "08:00", closeTime: "23:00", hours: courtHours(), priceBands: [], priceOverrides: [], notices: [], cautions: [] },
  ],
};

// 인증·정산계좌·통신판매업 신고까지 마친 구장 (owner-verified 시나리오용).
// 사업자번호·계좌·신고번호는 형식만 맞춘 가짜값이다 — 실존 사업자 정보를 넣지 말 것.
const VERIFIED_VENUE = {
  ...MOCK_VENUE,
  bizName: "더베이스스포츠",
  bizNo: "123-45-67890",
  business: {
    bizName: "더베이스스포츠",
    ownerName: "박구장",
    bizNo: "123-45-67890",
    openDate: "2021-03-02",
    taxType: "general",
    licenseUrl: "",
    status: "verified",
    ntsChecked: true,
    rejectReason: "",
  },
  settlement: {
    bank: "국민",
    account: "12345601234567",
    holder: "박구장",
    taxEmail: "tax@example.com",
    verified: true,
  },
  salesReport: {
    number: "2026-서울용산-01234",
    certUrl: "",
    exempt: false,
    status: "submitted",
  },
};

/* ========================= 목업 DB (clubs / users) =========================
 * 서비스의 "Firestore 를 읽는 지점"에만 꽂아, 그 뒤 가공 로직은 실제 코드가 그대로 돌게 한다.
 * 이 한 벌로 팀 프로필·팀 관리·팀원·매칭홈·상대공개·랭킹 화면이 전부 채워진다. */

const OTHER_CLUBS = [
  { id: "mock_club_c", name: "성수 리바운드", regionSido: "서울", regionGu: "성동구", stats: { wins: 14, losses: 3, draws: 0, totalMatches: 17, recentResults: ["W", "W", "W", "L", "W"] } },
  { id: "mock_club_d", name: "노원 덩커스", regionSido: "서울", regionGu: "노원구", stats: { wins: 6, losses: 11, draws: 1, totalMatches: 18, recentResults: ["L", "L", "W", "L", "D"] } },
  { id: "mock_club_e", name: "강남 앨리웁", regionSido: "서울", regionGu: "강남구", stats: { wins: 10, losses: 10, draws: 0, totalMatches: 20, recentResults: ["W", "L", "W", "L", "W"] } },
];

const clubDoc = (o) => ({
  id: o.id,
  clubId: o.id,
  name: o.name,
  ownerUid: o.ownerUid || `${o.id}_owner`,
  logoUrl: "",
  region: `${o.regionSido} ${o.regionGu}`,
  regionSido: o.regionSido,
  regionGu: o.regionGu,
  intro: `${o.regionGu} 기반 아마추어 농구팀입니다.`,
  tags: ["주말경기", "매너중시"],
  media: [],
  lineups: [],
  // winRate 는 넣지 않는다 — calcWinRate 가 승/패/무로 계산하게 둔다(null 을 넣으면 0% 로 굳는다)
  stats: { updatedAt: null, ...o.stats },
});

const MOCK_CLUB_DOCS = {
  [MY_CLUB]: clubDoc({ id: MY_CLUB, name: "팀청춘", regionSido: "서울", regionGu: "용산구", ownerUid: MY_UID, stats: { ...MY_TEAM_SNAP.stats, totalMatches: 18, recentResults: ["W", "W", "L", "W", "D"] } }),
  [OPP_CLUB]: clubDoc({ id: OPP_CLUB, name: "한강 슬램", regionSido: "서울", regionGu: "마포구", ownerUid: OPP_LEADER_UID, stats: { ...OPP_TEAM_SNAP.stats, totalMatches: 17, recentResults: ["L", "W", "W", "L", "L"] } }),
  ...Object.fromEntries(OTHER_CLUBS.map((c) => [c.id, clubDoc(c)])),
};

// users — 라인업 선수 + 나 + 상대 팀장
const userDocOf = (p, clubId) => ({
  id: p.userId,
  uid: p.userId,
  nickname: p.nickname,
  name: p.nickname,
  avatarUrl: "",
  mainPosition: p.mainPosition,
  skillLevel: p.skillLevel,
  heightCm: p.heightCm,
  weightKg: p.weightKg,
  region: "서울",
  regionSido: "서울",
  activeTeamId: clubId,
  clubId,
  intro: "",
  careers: [],
  media: [],
});

const MOCK_USER_DOCS = {
  [MY_UID]: MOCK_USER_DOC,
  [OPP_LEADER_UID]: {
    id: OPP_LEADER_UID,
    uid: OPP_LEADER_UID,
    nickname: "한강슬램 팀장",
    name: "이슬램",
    avatarUrl: "",
    mainPosition: "SG",
    skillLevel: "상",
    heightCm: 181,
    weightKg: 75,
    regionSido: "서울",
    regionGu: "마포구",
    activeTeamId: OPP_CLUB,
    clubId: OPP_CLUB,
  },
  ...Object.fromEntries([...MY_PLAYERS, ...MY_SUBS].map((p) => [p.userId, userDocOf(p, MY_CLUB)])),
  ...Object.fromEntries([...OPP_PLAYERS, ...OPP_SUBS].map((p) => [p.userId, userDocOf(p, OPP_CLUB)])),
  // 나머지 팀의 팀장 — 관리자 팀목록의 "팀장" 열이 비지 않게(clubDoc 의 ownerUid 규칙과 맞춤)
  ...Object.fromEntries(
    OTHER_CLUBS.map((c, i) => [
      `${c.id}_owner`,
      {
        id: `${c.id}_owner`,
        uid: `${c.id}_owner`,
        nickname: ["성수 캡틴", "노원 캡틴", "강남 캡틴"][i] || "캡틴",
        name: ["윤성수", "노민기", "강도윤"][i] || "캡틴",
        avatarUrl: "",
        mainPosition: "SF",
        skillLevel: "상",
        heightCm: 185,
        weightKg: 80,
        regionSido: c.regionSido,
        regionGu: c.regionGu,
        activeTeamId: c.id,
        clubId: c.id,
        isTeamCaptain: true,
      },
    ])
  ),
};

// clubs/{id}/members 서브컬렉션
const memberRef = (uid, role) => ({ id: uid, uid, userId: uid, role, joinedAt: T.createdAt });
const MOCK_CLUB_MEMBER_REFS = {
  [MY_CLUB]: [memberRef(MY_UID, "owner"), ...[...MY_PLAYERS, ...MY_SUBS].map((p) => memberRef(p.userId, "member"))],
  [OPP_CLUB]: [memberRef(OPP_LEADER_UID, "owner"), ...[...OPP_PLAYERS, ...OPP_SUBS].map((p) => memberRef(p.userId, "member"))],
};

const MOCK_MEMBER_COUNTS = new Map(
  Object.keys(MOCK_CLUB_DOCS).map((cid) => [cid, (MOCK_CLUB_MEMBER_REFS[cid] || []).length || 5])
);

// getAllClubDocs() 는 Firestore QueryDocumentSnapshot 배열을 돌려준다 → 최소 인터페이스만 흉내
const MOCK_CLUB_SNAPSHOTS = Object.values(MOCK_CLUB_DOCS).map((c) => ({
  id: c.id,
  exists: () => true,
  data: () => c,
}));

// 팀에 온 가입 신청 (clubs/{id}/joinRequests)
const MOCK_JOIN_REQUESTS = {
  [MY_CLUB]: [
    {
      id: "mock_joinreq", requestId: "mock_joinreq", status: "pending",
      clubId: MY_CLUB, uid: "mock_p_o6", userId: "mock_p_o6",
      nickname: "노현빈", name: "노현빈", avatarUrl: "",
      mainPosition: "SF", skillLevel: "중", heightCm: 184, weightKg: 78,
      message: "주 2회 정기적으로 참여 가능합니다. 잘 부탁드립니다!",
      createdAt: T.createdAt,
    },
    {
      id: "mock_joinreq2", requestId: "mock_joinreq2", status: "pending",
      clubId: MY_CLUB, uid: "mock_p_o2", userId: "mock_p_o2",
      nickname: "임재현", name: "임재현", avatarUrl: "",
      mainPosition: "SG", skillLevel: "중", heightCm: 182, weightKg: 75,
      message: "주말에 함께 뛰고 싶습니다.",
      createdAt: T.createdAt,
    },
  ],
};

// 나에게 온 팀 초대 (clubs/{id}/invites)
const MOCK_INVITES = [
  {
    id: "mock_invite", inviteId: "mock_invite", status: "pending",
    clubId: OPP_CLUB, clubName: "한강 슬램", clubLogoUrl: "",
    region: "서울 마포구",
    toUid: MY_UID, fromUid: OPP_LEADER_UID, fromNickname: "한강슬램 팀장",
    message: "같이 뛰실래요? 저희 팀에 딱 맞을 것 같아요.",
    createdAt: T.createdAt,
    _path: `clubs/${OPP_CLUB}/invites/mock_invite`,
  },
];

// 이벤트 팝업 (event_popups/{id})
const MOCK_EVENT = {
  id: "mock_event",
  title: "여름 3x3 토너먼트",
  body: "8월 한 달간 열리는 길거리 3x3 토너먼트에 참가하세요. 우승팀에게는 유니폼 풀세트를 드립니다.",
  imageUrl: "",
  linkUrl: "",
  active: true,
  startAt: T.createdAt,
  endAt: ts("2026-08-31T23:59:00+09:00"),
};

/* ── 구장 예약 흐름 ────────────────────────────────────────
 * venues / venueReservations 는 서비스의 venueRow()·reservationRow() 가
 * 스냅샷을 받아 정규화하므로, raw 데이터 + 최소 스냅샷 인터페이스만 준다. */
const snapOf = (id, data) => ({ id, exists: () => true, data: () => data });

const VENUE_RAW = {
  ownerUid: "mock_uid_owner",
  status: "approved",
  name: "용산 더베이스 농구장",
  displayName: "용산 더베이스 농구장",
  address: "서울 용산구 한강대로 100",
  addressDetail: "지하 2층",
  region: "서울 용산구",
  lat: 37.5298,
  lng: 126.9648,
  phone: "02-1234-5678",
  photos: [],
  facilities: ["샤워실", "주차장", "탈의실", "정수기"],
  sportTypes: ["농구"],
  parking: { available: true, fee: "free", info: "지하 1층 20대" },
  directions: "4호선 신용산역 2번 출구에서 도보 5분",
  keywords: ["용산", "실내농구장", "야간가능"],
  description: "우레탄 바닥 실내 코트 2면. 야간 조명 완비.",
  rules: "실내화 필수 · 음식물 반입 금지",
  refundPolicy: "이용 3일 전까지 전액 환불",
  defaultOwnerNote: "주차는 지하 1층을 이용해 주세요.",
  type: "indoor",
  cost: "paid",
  active: true,
  displayMode: "grouped",
  courts: [
    { id: "court_a", name: "A코트", type: "indoor", surface: "우레탄", pricePerHour: 40000, slotMinutes: 60, hours: courtHours() },
    { id: "court_b", name: "B코트", type: "indoor", surface: "마루", pricePerHour: 35000, slotMinutes: 60, hours: courtHours() },
  ],
};

const VENUE2_RAW = {
  ...VENUE_RAW,
  ownerUid: "mock_uid_owner2",
  name: "마포 슛포인트 체육관",
  displayName: "마포 슛포인트 체육관",
  address: "서울 마포구 월드컵로 200",
  region: "서울 마포구",
  lat: 37.5563,
  lng: 126.9236,
  type: "outdoor",
  description: "야외 하프코트 2면. 무료 개방 시간대 있음.",
  courts: [{ id: "court_a", name: "1번 코트", type: "outdoor", surface: "아스팔트", pricePerHour: 25000, slotMinutes: 60, openTime: "06:00", closeTime: "22:00" }],
};

const MOCK_VENUE_DOCS = { mock_venue: VENUE_RAW, mock_venue2: VENUE2_RAW };

const resvRaw = (over) => ({
  venueId: "mock_venue",
  courtId: "court_a",
  ownerUid: "mock_uid_owner",
  courtName: "A코트",
  venueName: "용산 더베이스 농구장",
  venuePhone: "02-1234-5678",
  reservationCode: "HM-260802-001",
  date: "2026-08-02",
  startTime: "19:00",
  endTime: "21:00",
  userId: MY_UID,
  userName: "리뷰데모",
  teamName: "팀청춘",
  phone: "010-1234-5678",
  price: 80000,
  status: "requested",
  source: "app",
  userNote: "농구공 2개 대여 가능할까요?",
  createdAt: T.createdAt,
  ...over,
});

// 사용자 관점(내 구장 예약) + 구장주 관점(예약관리·매출) 공용.
// 구장주 매출/가동률 화면은 "이번 달" 확정·완료 예약을 집계하므로 이번 달(7월) 건을 충분히 넣는다.
const MOCK_RESERVATION_DOCS = {
  // 다가오는 예약 (승인 대기 / 확정)
  mock_reservation: resvRaw({ status: "requested" }),
  mock_resv_confirmed: resvRaw({ reservationCode: "HM-260802-002", status: "confirmed", startTime: "21:00", endTime: "23:00", ownerNote: "주차는 지하 1층을 이용해 주세요." }),
  // 이번 달 이용 완료 — 매출·가동률 집계 대상
  mock_resv_done1: resvRaw({ reservationCode: "HM-260705-011", status: "done", date: "2026-07-05", startTime: "19:00", endTime: "21:00" }),
  mock_resv_done2: resvRaw({ reservationCode: "HM-260708-012", status: "done", date: "2026-07-08", startTime: "20:00", endTime: "22:00", courtId: "court_b", courtName: "B코트", price: 70000 }),
  mock_resv_done3: resvRaw({ reservationCode: "HM-260712-013", status: "done", date: "2026-07-12", startTime: "19:00", endTime: "21:00" }),
  mock_resv_done4: resvRaw({ reservationCode: "HM-260718-014", status: "done", date: "2026-07-18", startTime: "18:00", endTime: "20:00", userName: "이준서", teamName: "팀청춘" }),
  mock_resv_done5: resvRaw({ reservationCode: "HM-260722-015", status: "done", date: "2026-07-22", startTime: "21:00", endTime: "23:00", courtId: "court_b", courtName: "B코트", price: 70000 }),
  mock_resv_conf6: resvRaw({ reservationCode: "HM-260729-016", status: "confirmed", date: "2026-07-29", startTime: "20:00", endTime: "22:00" }),
  // 취소 / 노쇼 — 취소·노쇼 카운터 확인용
  mock_resv_cancelled: resvRaw({ reservationCode: "HM-260726-003", status: "cancelled", date: "2026-07-26" }),
  mock_resv_noshow: resvRaw({ reservationCode: "HM-260715-017", status: "noshow", date: "2026-07-15", startTime: "19:00", endTime: "21:00" }),
};

// 결제 원장(payments) — 어드민 정산·구장주 매출 화면이 집계하는 단일 진실.
// functions/payments/toss.js 가 쓰는 필드 그대로. 규약: amount = venueAmount + platformFee,
// netVenueAmount = 환불하고 남은 구장 몫(정산은 항상 이 값을 더한다).
const payRaw = (over = {}) => {
  const venueAmount = over.venueAmount ?? 80000;
  const platformFee = Math.round(venueAmount * 0.05);
  const refundedVenueAmount = over.refundedVenueAmount ?? 0;
  return {
    venueId: "mock_venue",
    venueName: "용산 더베이스 농구장",
    ownerUid: "mock_uid_owner",
    uid: MY_UID,
    side: "SINGLE",
    matchId: "",
    status: "DONE",
    method: "카드",
    feeRate: 0.05,
    venueAmount,
    platformFee,
    amount: venueAmount + platformFee,
    netVenueAmount: Math.max(0, venueAmount - refundedVenueAmount),
    refundedVenueAmount,
    cancelled: false,
    payoutId: "",
    settled: false,
    ...over,
  };
};

const MOCK_PAYMENT_DOCS = {
  // 이용 완료 · 미지급 — "미지급액"에 잡힌다
  mock_pay_1: payRaw({ reservationId: "mock_resv_done1", reservationDate: "2026-07-05" }),
  mock_pay_2: payRaw({ reservationId: "mock_resv_done2", reservationDate: "2026-07-08", venueAmount: 70000 }),
  // 부분환불 — 정가 80,000 중 30,000 환불 → 지급액은 50,000 이어야 한다(예전 집계는 80,000 이었다)
  mock_pay_3: payRaw({ reservationId: "mock_resv_done3", reservationDate: "2026-07-12", refundedVenueAmount: 30000 }),
  // 분담결제 — 한 예약에 결제 2건(A/B)
  mock_pay_4a: payRaw({ reservationId: "mock_resv_done4", reservationDate: "2026-07-18", side: "A", matchId: "mock_room", venueAmount: 40000 }),
  mock_pay_4b: payRaw({ reservationId: "mock_resv_done4", reservationDate: "2026-07-18", side: "B", matchId: "mock_room", venueAmount: 40000 }),
  // 지급 완료
  mock_pay_5: payRaw({ reservationId: "mock_resv_done5", reservationDate: "2026-07-22", venueAmount: 70000, settled: true }),
  // 전액 환불 — 지급 대상에서 아예 빠진다
  mock_pay_6: payRaw({ reservationId: "mock_resv_cancelled", reservationDate: "2026-07-26", refundedVenueAmount: 80000, cancelled: true }),
  // 아직 이용 전 — 구장주 화면에서 "정산 예정"
  mock_pay_7: payRaw({ reservationId: "mock_resv_confirmed", reservationDate: "2026-08-02" }),
};

// 토스 위젯 주문 — 서버(createTossOrder)가 확정하는 값을 그 형태 그대로 준다.
// 규약: amount = venueAmount + platformFee (platformFee = venueAmount * PLATFORM_FEE_RATE 0.05)
// 이 필드를 안 채우면 결제화면 내역이 "구장 이용료 0원 / 플랫폼 이용료 0원 / 결제 80,000원" 으로 어긋난다.
const MOCK_TOSS_ORDER = (() => {
  const venueAmount = 80000;
  const feeRate = 0.05;
  const platformFee = Math.round(venueAmount * feeRate);
  return {
    orderId: "mock_order_20260802_001",
    orderName: "용산 더베이스 농구장 A코트 (8/2 19:00~21:00)",
    side: "SINGLE",
    venueAmount,
    platformFee,
    amount: venueAmount + platformFee,
    feeRate,
    customerName: "리뷰데모",
  };
})();

/* ── 커뮤니티 ──────────────────────────────────────────────
 * loadCommunityList / loadCommunityPostDetail 은 작성자 메타·차단목록까지 조립하므로
 * 최종 뷰모델을 그대로 준다(형태는 위 서비스 반환부와 1:1). */
const kst = (iso) => {
  const d = new Date(iso);
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
};
const kstMs = (iso) => new Date(iso).getTime();

const postRow = (o) => ({
  id: o.id,
  authorId: o.authorId,
  authorName: o.authorName,
  authorAvatar: "",
  authorTeamName: o.authorTeamName || "",
  authorClubId: o.authorClubId || "",
  canChat: o.authorId !== MY_UID,
  category: o.category || "free",
  title: o.title,
  content: o.content,
  image: "",
  pinned: !!o.pinned,
  createdAt: kst(o.at),
  createdAtMs: kstMs(o.at),
  views: o.views ?? 0,
  commentsCount: o.comments ?? 0,
  likes: o.likes ?? 0,
});

const MOCK_POSTS = [
  postRow({ id: "mock_post_pin", authorId: OPP_LEADER_UID, authorName: "한강슬램 팀장", authorTeamName: "한강 슬램", authorClubId: OPP_CLUB,
    category: "notice", pinned: true, title: "8월 정기 리그 참가팀 모집",
    content: "8월 한 달간 주말 저녁 정기 리그를 엽니다. 참가 희망 팀은 댓글로 팀명과 연락처를 남겨주세요.",
    at: "2026-07-25T10:00:00+09:00", views: 412, comments: 8, likes: 23 }),
  postRow({ id: "mock_post", authorId: MY_UID, authorName: "리뷰데모", authorTeamName: "팀청춘", authorClubId: MY_CLUB,
    category: "free", title: "픽앤롤 수비 어떻게 하세요?",
    content: "요즘 상대가 픽앤롤을 자주 씁니다. 스위치로 가는 게 맞을까요, 아니면 헤지 후 복귀가 나을까요?\n주말에 5대5 뛰면서 계속 뚫려서 고민입니다.",
    at: "2026-07-24T21:14:00+09:00", views: 186, comments: 5, likes: 12 }),
  postRow({ id: "mock_post_2", authorId: "mock_p_o3", authorName: "송지호", authorTeamName: "한강 슬램", authorClubId: OPP_CLUB,
    category: "free", title: "용산 실내구장 추천 부탁드려요",
    content: "평일 밤 10시 이후에도 열려있는 실내구장 아시는 분?",
    at: "2026-07-23T19:40:00+09:00", views: 97, comments: 3, likes: 4 }),
  postRow({ id: "mock_post_3", authorId: "mock_p_m2", authorName: "이준서", authorTeamName: "팀청춘", authorClubId: MY_CLUB,
    category: "review", title: "성수 리바운드와 경기 후기",
    content: "전력 차가 꽤 났는데도 끝까지 매너 좋게 해주셨습니다. 다음에 또 붙고 싶네요.",
    at: "2026-07-22T08:05:00+09:00", views: 240, comments: 6, likes: 18 }),
  postRow({ id: "mock_post_4", authorId: MY_UID, authorName: "리뷰데모", authorTeamName: "팀청춘", authorClubId: MY_CLUB,
    category: "free", title: "무릎 보호대 어떤 거 쓰세요?",
    content: "점프 착지할 때 무릎이 시큰해서 보호대를 알아보고 있습니다.",
    at: "2026-07-20T12:30:00+09:00", views: 143, comments: 4, likes: 7 }),
  postRow({ id: "mock_post_5", authorId: "mock_p_o5", authorName: "배건우", authorTeamName: "한강 슬램", authorClubId: OPP_CLUB,
    category: "free", title: "센터 포지션 스크린 팁 공유",
    content: "스크린 각도만 바꿔도 가드가 훨씬 편해집니다. 어깨를 수비 진행 방향으로 90도 세우는 게 핵심.",
    at: "2026-07-19T17:55:00+09:00", views: 321, comments: 11, likes: 29 }),
];

const commentRow = (o) => ({
  id: o.id,
  postId: "mock_post",
  parentId: o.parentId || null,
  authorId: o.authorId,
  authorName: o.authorName,
  authorAvatar: "",
  authorTeamName: o.authorTeamName || "",
  authorClubId: o.authorClubId || "",
  content: o.content,
  createdAt: kst(o.at),
  createdAtMs: kstMs(o.at),
  likes: o.likes ?? 0,
  likedByMe: false,
  isMine: o.authorId === MY_UID,
  canEdit: o.authorId === MY_UID,
  canDelete: o.authorId === MY_UID,
});

const MOCK_POST_DETAIL = {
  post: {
    ...MOCK_POSTS[1],
    images: [],
    updatedAt: "",
    likedByMe: true,
    isMine: true,
    canEdit: true,
    canDelete: true,
  },
  comments: [
    commentRow({ id: "mc1", authorId: OPP_LEADER_UID, authorName: "한강슬램 팀장", authorTeamName: "한강 슬램", authorClubId: OPP_CLUB,
      content: "빅맨 발이 느리면 헤지보다 스위치가 안전합니다.", at: "2026-07-24T21:30:00+09:00", likes: 5 }),
    commentRow({ id: "mc2", parentId: "mc1", authorId: MY_UID, authorName: "리뷰데모", authorTeamName: "팀청춘", authorClubId: MY_CLUB,
      content: "저희 센터가 195라 스위치하면 가드에게 털릴 것 같아서요…", at: "2026-07-24T21:35:00+09:00", likes: 1 }),
    commentRow({ id: "mc3", parentId: "mc1", authorId: "mock_p_o5", authorName: "배건우", authorTeamName: "한강 슬램", authorClubId: OPP_CLUB,
      content: "그럼 드롭백으로 페인트만 지키고 3점은 내주는 것도 방법입니다.", at: "2026-07-24T22:02:00+09:00", likes: 3 }),
    commentRow({ id: "mc4", authorId: "mock_p_m4", authorName: "최민재", authorTeamName: "팀청춘", authorClubId: MY_CLUB,
      content: "주말에 연습해봅시다", at: "2026-07-25T09:10:00+09:00", likes: 0 }),
    commentRow({ id: "mc5", authorId: "mock_p_o3", authorName: "송지호", authorTeamName: "한강 슬램", authorClubId: OPP_CLUB,
      content: "스크린 나올 때 가드가 미리 불러주는 게 반이에요.", at: "2026-07-25T13:22:00+09:00", likes: 2 }),
  ],
};

/* ── 알림 (notifications raw 문서) ─────────────────────────
 * listNotificationsForUser 는 kind!=="system" 필터 + clubId 필터 + 최신순만 하므로 raw 로 준다. */
const notiDoc = (o) => ({
  id: o.id,
  kind: o.kind,
  subType: o.subType || "",
  type: o.type || "",
  title: o.title,
  body: o.body,
  targetType: "USER",
  targetIds: [MY_UID],
  linkType: o.linkType || "",
  linkTargetId: o.linkTargetId || "",
  meta: o.meta || {},
  prefsCategory: o.kind,
  createdAt: ts(o.at),
  updatedAt: ts(o.at),
  readBy: o.read ? { [MY_UID]: ts(o.at) } : {},
});

const MOCK_NOTIFICATIONS = [
  notiDoc({ id: "mock_noti", kind: "match", subType: "schedule_proposed", title: "구장·일정 제안 도착",
    body: "한강 슬램이 8월 2일 (토) 오후 7:00 · 용산 더베이스 농구장을 제안했어요. 확인하고 수락해 주세요.",
    linkType: "match", linkTargetId: "mock_room", meta: { matchId: "mock_room", deepLink: "/match-roomdetail/mock_room" },
    at: "2026-07-22T09:10:00+09:00", read: false }),
  notiDoc({ id: "mock_noti_2", kind: "match", subType: "match_accepted", title: "매칭이 성사됐어요",
    body: "한강 슬램이 매칭 요청을 수락했어요. 이제 구장과 일정을 정해보세요.",
    linkType: "match", linkTargetId: "mock_room", meta: { matchId: "mock_room" },
    at: "2026-07-21T14:30:00+09:00", read: false }),
  notiDoc({ id: "mock_noti_3", kind: "reservation", subType: "reservation_requested", title: "예약 신청이 접수됐어요",
    body: "용산 더베이스 농구장 A코트 · 8/2 19:00~21:00 · 구장 승인을 기다리고 있어요.",
    linkType: "reservation", linkTargetId: "mock_reservation",
    at: "2026-07-21T11:02:00+09:00", read: true }),
  notiDoc({ id: "mock_noti_4", kind: "team", subType: "team_invite", title: "팀 초대가 도착했어요",
    body: "한강 슬램에서 함께 뛰자고 초대했어요.",
    linkType: "invite", linkTargetId: "mock_invite",
    at: "2026-07-20T10:00:00+09:00", read: true }),
  notiDoc({ id: "mock_noti_5", kind: "team", subType: "join_request", title: "팀 가입 신청이 왔어요",
    body: "노현빈 선수가 팀청춘에 가입을 신청했어요.",
    linkType: "joinRequest", linkTargetId: "mock_joinreq",
    at: "2026-07-20T09:12:00+09:00", read: true }),
  notiDoc({ id: "mock_noti_6", kind: "community", subType: "comment", title: "내 글에 댓글이 달렸어요",
    body: "한강슬램 팀장: 빅맨 발이 느리면 헤지보다 스위치가 안전합니다.",
    linkType: "post", linkTargetId: "mock_post",
    at: "2026-07-24T21:30:00+09:00", read: true }),
];

/* ── 공지사항 (noticesService.mapDoc 결과) ───────────────── */
const MOCK_NOTICES = [
  { id: "mock_notice_1", title: "8월 정기 점검 안내", pinned: true, published: true, createdBy: "운영팀",
    content: "8월 12일(수) 오전 2시~4시 서버 점검이 있습니다. 해당 시간에는 예약·매칭이 일시 중단됩니다.",
    createdAt: ts("2026-07-27T10:00:00+09:00"), updatedAt: ts("2026-07-27T10:00:00+09:00") },
  { id: "mock_notice_2", title: "구장 예약 결제 기능 오픈", pinned: false, published: true, createdBy: "운영팀",
    content: "이제 앱에서 바로 구장 예약을 결제할 수 있어요. 두 팀 분담결제도 지원합니다.",
    createdAt: ts("2026-07-15T14:00:00+09:00"), updatedAt: ts("2026-07-15T14:00:00+09:00") },
  { id: "mock_notice_3", title: "커뮤니티 이용 수칙 안내", pinned: false, published: true, createdBy: "운영팀",
    content: "상호 존중하는 커뮤니티를 위해 비방·욕설·광고성 글은 통보 없이 삭제될 수 있습니다.",
    createdAt: ts("2026-06-30T09:00:00+09:00"), updatedAt: ts("2026-06-30T09:00:00+09:00") },
];

/* ── 채팅 목록 (chatRooms raw 문서) ─────────────────────────
 * ⚠️ 현재 앱에서 DM 은 만들어질 수 없다.
 *    ChatListPage 는 type==="dm" 만 렌더하는데(매치룸 채팅은 매치룸 안 MatchRoomChat 으로만 존재),
 *    getOrCreateDmRoom 을 호출하는 화면이 하나도 없다(주석에만 남아 있음).
 *    커뮤니티의 canChat 필드도 계산만 되고 UI 에서 쓰이지 않는다.
 *    → 그래서 기본 시나리오의 채팅 목록은 "비어있음"이 실제 앱 상태다.
 *    아래 DM 픽스처는 "DM 진입점을 만들었을 때" 레이아웃을 미리 보기 위한 것으로,
 *    chat-dm 시나리오에서만 쓴다(기본에는 넣지 않는다). */
const makeDmKey = (a, b) => [a, b].sort().join("__");

const MOCK_CHAT_ROOMS = [
  {
    id: "match_mock_room", type: "matchRoom", matchRoomId: "mock_room",
    participantUids: [MY_UID, OPP_LEADER_UID],
    lastMessageText: "네 조심히 오세요. 주차는 건물 지하 1층입니다.",
    lastMessageAt: ts("2026-07-22T18:45:00+09:00"), lastMessageFromUid: MY_UID,
    lastReadAtBy: { [MY_UID]: ts("2026-07-22T18:45:00+09:00"), [OPP_LEADER_UID]: ts("2026-07-22T18:50:00+09:00") },
    mutedBy: {},
  },
  {
    id: "match_mock_r2", type: "matchRoom", matchRoomId: "mock_r2",
    participantUids: [MY_UID, "mock_club_c_owner"],
    lastMessageText: "일정 제안 확인 부탁드려요!",
    lastMessageAt: ts("2026-07-26T20:12:00+09:00"), lastMessageFromUid: "mock_club_c_owner",
    // 내 lastReadAt 이 마지막 메시지보다 이전 → 안읽음 배지
    lastReadAtBy: { [MY_UID]: ts("2026-07-25T10:00:00+09:00") },
    mutedBy: {},
  },
  // 아래 DM 들이 실제로 채팅 목록에 뜬다 (매치룸 방은 매치룸 안에서만 본다)
  {
    id: makeDmKey(MY_UID, OPP_LEADER_UID), type: "dm", dmKey: makeDmKey(MY_UID, OPP_LEADER_UID),
    participantUids: [MY_UID, OPP_LEADER_UID].sort(),
    lastMessageText: "다음 주에 한 번 더 붙어요!",
    lastMessageAt: ts("2026-07-27T21:10:00+09:00"), lastMessageFromUid: OPP_LEADER_UID,
    // 내 읽음시각이 마지막 메시지보다 이전 → 안읽음 배지
    lastReadAtBy: { [MY_UID]: ts("2026-07-26T10:00:00+09:00") },
    mutedBy: {},
  },
  {
    id: makeDmKey(MY_UID, "mock_p_o3"), type: "dm", dmKey: makeDmKey(MY_UID, "mock_p_o3"),
    participantUids: [MY_UID, "mock_p_o3"].sort(),
    lastMessageText: "구장 추천 감사합니다 🙏",
    lastMessageAt: ts("2026-07-24T09:30:00+09:00"), lastMessageFromUid: "mock_p_o3",
    lastReadAtBy: { [MY_UID]: ts("2026-07-24T09:40:00+09:00") },
    mutedBy: {},
  },
  {
    id: makeDmKey(MY_UID, "mock_p_m2"), type: "dm", dmKey: makeDmKey(MY_UID, "mock_p_m2"),
    participantUids: [MY_UID, "mock_p_m2"].sort(),
    lastMessageText: "형 이번 주 경기 몇 시예요?",
    lastMessageAt: ts("2026-07-23T18:02:00+09:00"), lastMessageFromUid: "mock_p_m2",
    lastReadAtBy: { [MY_UID]: ts("2026-07-23T18:30:00+09:00") },
    mutedBy: {},
  },
];

/* ── 선수 랭킹 페이지 (listPlayerRankingPage 결과) ────────── */
const rankRow = (i, p, clubId, w, l, d, forms) => ({
  rank: null,
  userId: p.userId,
  nickname: p.nickname,
  name: p.nickname,
  avatarUrl: "",
  mainPosition: p.mainPosition,
  positionLabel: p.mainPosition,
  isTeamCaptain: i === 0,
  heightCm: p.heightCm,
  weightKg: p.weightKg,
  clubId,
  clubName: MOCK_CLUB_DOCS[clubId] ? MOCK_CLUB_DOCS[clubId].name : "",
  clubLogoUrl: "",
  wins: w,
  losses: l,
  draws: d,
  recentForms: forms,
});

const MOCK_PLAYER_RANK_ROWS = [
  rankRow(0, MY_PLAYERS[0], MY_CLUB, 12, 3, 1, ["W", "W", "L", "W", "W"]),
  rankRow(1, OPP_PLAYERS[4], OPP_CLUB, 11, 5, 0, ["W", "L", "W", "W", "W"]),
  rankRow(2, MY_PLAYERS[3], MY_CLUB, 10, 5, 1, ["W", "W", "W", "L", "D"]),
  rankRow(3, OPP_PLAYERS[0], OPP_CLUB, 9, 6, 0, ["L", "W", "W", "L", "W"]),
  rankRow(4, MY_PLAYERS[1], MY_CLUB, 9, 7, 0, ["W", "L", "L", "W", "W"]),
  rankRow(5, OPP_PLAYERS[2], OPP_CLUB, 8, 6, 2, ["D", "W", "L", "W", "W"]),
  rankRow(6, MY_PLAYERS[4], MY_CLUB, 7, 8, 1, ["L", "W", "L", "D", "W"]),
  rankRow(7, OPP_PLAYERS[1], OPP_CLUB, 6, 9, 0, ["L", "L", "W", "L", "W"]),
  rankRow(8, MY_PLAYERS[2], MY_CLUB, 6, 10, 0, ["L", "W", "L", "L", "W"]),
  rankRow(9, OPP_PLAYERS[3], OPP_CLUB, 5, 11, 1, ["L", "L", "D", "L", "W"]),
  rankRow(10, MY_SUBS[0], MY_CLUB, 4, 9, 0, ["L", "W", "L", "L", "L"]),
  rankRow(11, OPP_SUBS[0], OPP_CLUB, 3, 12, 0, ["L", "L", "L", "W", "L"]),
  rankRow(12, MY_SUBS[1], MY_CLUB, 2, 13, 1, ["L", "D", "L", "L", "L"]),
];

/* ── 매치룸 목록용 문서 세트 ────────────────────────────────
 * 탭 분류(MatchRoomListPage): 조율중 = accepted·proposed·awaiting_venue_approval
 *                             확정   = confirmed (종료시각 전)
 *                             지난   = finished (또는 종료시각 지난 confirmed)
 *                             취소   = cancelled
 * 각 탭에 2건씩 들어가도록 짠다. 상대 팀은 돌려 써서 카드가 구분되게 한다. */
const otherSnap = (cid) => {
  const c = MOCK_CLUB_DOCS[cid];
  return { clubId: cid, name: c.name, region: c.region, regionSido: c.regionSido, regionGu: c.regionGu, logoUrl: "", stats: c.stats };
};

const ROOMLIST_DOCS = [
  // 조율중 ①: 라인업 확정 대기 (상대 미확정)
  { id: "mock_r1", ...matchDoc({ status: "accepted", toLineupSnapshot: lineup(OPP_PLAYERS, OPP_SUBS, false) }) },
  // 조율중 ②: 상대가 구장·일정 제안 → 내가 확정해야 함
  { id: "mock_r2", ...matchDoc({
      status: "proposed", targetClubId: "mock_club_c", toTeamSnapshot: otherSnap("mock_club_c"),
      proposedByClubId: "mock_club_c", proposedAt: T.proposedAt, scheduledAt: T.scheduledAt, field: FIELD,
    }) },
  // 확정 ①: 앞으로 열릴 경기
  { id: "mock_r3", ...matchDoc({
      status: "confirmed", proposedByClubId: MY_CLUB, confirmedByClubId: OPP_CLUB,
      proposedAt: T.proposedAt, confirmedAt: T.confirmedAt, scheduledAt: T.scheduledAt, field: FIELD,
    }) },
  // 확정 ②: 제휴구장 분담결제 진행 중
  { id: "mock_r4", ...matchDoc({
      status: "confirmed", targetClubId: "mock_club_e", toTeamSnapshot: otherSnap("mock_club_e"),
      proposedByClubId: MY_CLUB, confirmedByClubId: "mock_club_e",
      confirmedAt: T.confirmedAt, scheduledAt: iso("2026-08-09T20:00:00+09:00"), field: FIELD,
      partnerBooking: {
        accepted: true, approvalState: "approved", payState: "waiting", finalized: false,
        paidByA: true, paidByB: false, venueName: "용산 더베이스 농구장", courtName: "A코트", totalPrice: 80000,
      },
    }) },
  // 지난 경기는 아래 FINISHED_DOCS 에서만 관리한다(여기 또 넣으면 카드가 두 번 뜬다).
  // 취소 ①: 상대 팀 사정
  { id: "mock_r7", ...matchDoc({
      status: "cancelled", scheduledAt: T.scheduledAt, field: FIELD,
      cancelledByClubId: OPP_CLUB, cancelReasonKey: "team_issue",
      cancelReason: "팀 사정으로 경기 진행이 어려워졌습니다.", cancelledAt: T.cancelledAt,
      refund: { amount: 40000, rate: 100, state: "done" },
    }) },
  // 취소 ②: 우리 팀이 취소 (환불 부분)
  { id: "mock_r8", ...matchDoc({
      status: "cancelled", targetClubId: "mock_club_c", toTeamSnapshot: otherSnap("mock_club_c"),
      scheduledAt: iso("2026-07-30T19:00:00+09:00"), field: FIELD,
      cancelledByClubId: MY_CLUB, cancelReasonKey: "weather",
      cancelReason: "우천으로 경기를 진행할 수 없었습니다.", cancelledAt: ts("2026-07-27T09:00:00+09:00"),
      refund: { amount: 20000, rate: 50, state: "done" },
    }) },
];

/* ── 경기기록·활동·분석용 문서 세트 ────────────────────────
 * 내 팀 관점의 match_requests 원문서. 선수 기록 화면은 "내 팀 라인업 memberIds 에
 * 내 uid 가 있는" 경기만 세므로, 라인업에 MY_UID 를 반드시 포함시킨다. */
const myLineupWithMe = (confirmed = true) => ({
  ...lineup(MY_PLAYERS, MY_SUBS, confirmed),
  memberIds: [MY_UID, ...MY_PLAYERS.map((p) => p.userId)],
  previewMembers: [
    { userId: MY_UID, nickname: "리뷰데모", mainPosition: "PG", heightCm: 178, weightKg: 72, photoUrl: "", skillLevel: "상" },
    ...MY_PLAYERS,
  ],
});

// 종료 경기 6건 (승4·패1·무1) — 월별 활동/참여율/전적 그래프가 채워질 정도
const finishedDoc = (id, oppId, isoAt, my, opp) =>
  ({ id, ...matchDoc({
      status: "finished",
      targetClubId: oppId,
      toTeamSnapshot: otherSnap(oppId),
      fromLineupSnapshot: myLineupWithMe(),
      scheduledAt: iso(isoAt),
      updatedAt: ts(isoAt),
      field: FIELD,
      myScore: my,
      oppScore: opp,
      resultState: "confirmed",
      statsAppliedAt: ts(isoAt),
      predictionOutcome: { result: my > opp ? "hit" : "miss" },
    }) });

const FINISHED_DOCS = [
  finishedDoc("mock_f1", OPP_CLUB,       "2026-07-12T19:00:00+09:00", 68, 61),
  finishedDoc("mock_f2", "mock_club_d",  "2026-07-05T19:00:00+09:00", 54, 62),
  finishedDoc("mock_f3", "mock_club_c",  "2026-06-28T20:00:00+09:00", 71, 65),
  finishedDoc("mock_f4", "mock_club_e",  "2026-06-14T19:00:00+09:00", 59, 59),
  finishedDoc("mock_f5", OPP_CLUB,       "2026-05-31T19:00:00+09:00", 77, 70),
  finishedDoc("mock_f6", "mock_club_c",  "2026-05-17T18:00:00+09:00", 64, 58),
];

// 내 팀의 match_requests 전체 = 목록용(진행/취소 포함) + 종료 경기
const MY_MATCH_DOCS = [...ROOMLIST_DOCS, ...FINISHED_DOCS];

/* ========================= 채팅 메시지 ========================= */

const msg = (id, fromUid, text, iso, extra) => ({
  id,
  chatId: "mock_chat",
  fromUid,
  kind: "text",
  text,
  images: [],
  createdAt: ts(iso),
  ...extra,
});

const CHAT_COORDINATING = [
  msg("c1", "system", "매칭이 성사되었어요! 구장과 일정을 정해보세요.", "2026-07-21T14:30:00+09:00", { kind: "system" }),
  msg("c2", OPP_LEADER_UID, "안녕하세요! 한강 슬램입니다. 잘 부탁드려요 🙌", "2026-07-21T14:33:00+09:00"),
  msg("c3", MY_UID, "안녕하세요! 저희도 기대하고 있습니다.", "2026-07-21T14:35:00+09:00"),
  msg("c4", OPP_LEADER_UID, "혹시 8월 초 주말 저녁 가능하실까요?", "2026-07-21T14:36:00+09:00"),
  msg("c5", MY_UID, "8/2 토요일 저녁 7시 어떠세요? 용산 더베이스 잡아볼게요.", "2026-07-21T14:40:00+09:00"),
  msg("c6", OPP_LEADER_UID, "좋습니다! 제안 주시면 바로 확인할게요.", "2026-07-21T14:41:00+09:00"),
];

const CHAT_PROPOSED = [
  ...CHAT_COORDINATING,
  msg("c7", MY_UID, "구장·일정을 제안했어요", "2026-07-22T09:10:00+09:00", {
    kind: "system",
    fromUid: "system",
    meta: { type: "schedule_proposed" },
  }),
];

const CHAT_CONFIRMED = [
  ...CHAT_PROPOSED,
  msg("c8", "system", "경기 일정이 확정되었어요. 8월 2일 (토) 오후 7:00 · 용산 더베이스 농구장", "2026-07-22T18:40:00+09:00", { kind: "system" }),
  msg("c9", OPP_LEADER_UID, "확정했습니다! 그날 뵐게요 💪", "2026-07-22T18:42:00+09:00"),
  msg("c10", MY_UID, "네 조심히 오세요. 주차는 건물 지하 1층입니다.", "2026-07-22T18:45:00+09:00"),
];

const CHAT_EMPTY = [
  msg("c1", "system", "매칭이 성사되었어요! 구장과 일정을 정해보세요.", "2026-07-21T14:30:00+09:00", { kind: "system" }),
];

const CHAT_ROOM = {
  id: "mock_chat",
  locked: false,
  lastMessageText: "네 조심히 오세요.",
  lastMessageAt: ts("2026-07-22T18:45:00+09:00"),
  lastReadAtBy: { [OPP_LEADER_UID]: ts("2026-07-22T18:50:00+09:00") },
};

/* ── 내 신고내역 / 차단 관리 ────────────────────────────── */
const MOCK_MY_REPORTS = [
  { id: "mock_rep_1", type: "player", targetId: "mock_p_o2", targetName: "임재현",
    reason: "경기 중 욕설", status: "reviewing", createdAt: new Date("2026-07-24T20:10:00+09:00") },
  { id: "mock_rep_2", type: "player", targetId: "mock_p_o4", targetName: "한동윤",
    reason: "노쇼", status: "resolved", createdAt: new Date("2026-07-14T09:00:00+09:00") },
];
const MOCK_MY_TEAM_REPORTS = [
  { id: "mock_trep_1", type: "team", targetId: "mock_club_d", targetName: "노원 덩커스",
    reason: "확정 경기 반복 취소", status: "pending", createdAt: new Date("2026-07-26T13:20:00+09:00") },
];

const MOCK_BLOCK_LIST = {
  blockedUids: ["mock_p_o2", "mock_p_o4"],
  hiddenPostIds: ["mock_post_hidden"],
};

/* ── 관리자(10-xx) 픽스처 ──────────────────────────────────
 * 관리자 서비스는 전부 "getDocs → snapshot.forEach(map)" 형태라
 * raw 문서만 주면 정규화·메타조립·정렬은 실제 코드가 그대로 돈다(mockQuerySnap 사용).
 * users / clubs / match_requests 는 앞서 만든 목업 DB 를 그대로 재사용한다. */

// 커뮤니티 raw 문서 (사용자앱은 뷰모델을 쓰지만 관리자 서비스는 raw 를 읽는다)
const communityRaw = (o) => ({
  authorUid: o.authorId,
  authorNickname: o.authorName,
  category: o.category,
  title: o.title,
  content: o.content,
  pinned: !!o.pinned,
  hidden: !!o.hidden,
  media: { images: [] },
  stats: { views: o.views, likes: o.likes, commentsCount: o.comments },
  createdAt: ts(o.at),
  updatedAt: ts(o.at),
});

const MOCK_COMMUNITY_RAW = {
  mock_post_pin: communityRaw({ authorId: OPP_LEADER_UID, authorName: "한강슬램 팀장", category: "notice", pinned: true,
    title: "8월 정기 리그 참가팀 모집", content: "8월 한 달간 주말 저녁 정기 리그를 엽니다.", at: "2026-07-25T10:00:00+09:00", views: 412, likes: 23, comments: 8 }),
  mock_post: communityRaw({ authorId: MY_UID, authorName: "리뷰데모", category: "free",
    title: "픽앤롤 수비 어떻게 하세요?", content: "요즘 상대가 픽앤롤을 자주 씁니다.", at: "2026-07-24T21:14:00+09:00", views: 186, likes: 12, comments: 5 }),
  mock_post_2: communityRaw({ authorId: "mock_p_o3", authorName: "송지호", category: "free",
    title: "용산 실내구장 추천 부탁드려요", content: "평일 밤 10시 이후에도 열려있는 실내구장 아시는 분?", at: "2026-07-23T19:40:00+09:00", views: 97, likes: 4, comments: 3 }),
  mock_post_hidden: communityRaw({ authorId: "mock_p_o2", authorName: "임재현", category: "free", hidden: true,
    title: "[신고 접수] 광고성 게시글", content: "○○용품 할인 링크입니다.", at: "2026-07-21T15:00:00+09:00", views: 33, likes: 0, comments: 1 }),
};

// 관리자 게시글 상세의 댓글 raw
const MOCK_COMMUNITY_COMMENTS_RAW = [
  { id: "mc1", postId: "mock_post", authorUid: OPP_LEADER_UID, content: "빅맨 발이 느리면 헤지보다 스위치가 안전합니다.", stats: { likes: 5 }, createdAt: ts("2026-07-24T21:30:00+09:00") },
  { id: "mc2", postId: "mock_post", parentId: "mc1", authorUid: MY_UID, content: "저희 센터가 195라 스위치하면 가드에게 털릴 것 같아서요…", stats: { likes: 1 }, createdAt: ts("2026-07-24T21:35:00+09:00") },
  { id: "mc3", postId: "mock_post", parentId: "mc1", authorUid: "mock_p_o5", content: "그럼 드롭백으로 페인트만 지키고 3점은 내주는 것도 방법입니다.", stats: { likes: 3 }, createdAt: ts("2026-07-24T22:02:00+09:00") },
  { id: "mc4", postId: "mock_post", authorUid: "mock_p_m4", content: "주말에 연습해봅시다", stats: { likes: 0 }, createdAt: ts("2026-07-25T09:10:00+09:00") },
  { id: "mc5", postId: "mock_post", authorUid: "mock_p_o3", content: "스크린 나올 때 가드가 미리 불러주는 게 반이에요.", stats: { likes: 2 }, createdAt: ts("2026-07-25T13:22:00+09:00") },
  { id: "mcp1", postId: "mock_post_pin", authorUid: "mock_p_m2", content: "팀청춘 참가 신청합니다!", stats: { likes: 2 }, createdAt: ts("2026-07-25T11:00:00+09:00") },
];

// 관리자 채팅 목록 — 매치룸 채팅까지 전부 보인다(관리자는 감시 목적)
const MOCK_ADMIN_CHAT_ROOMS = {
  match_mock_room: {
    type: "matchRoom", matchRoomId: "mock_room", participantUids: [MY_UID, OPP_LEADER_UID],
    lastMessageText: "네 조심히 오세요. 주차는 건물 지하 1층입니다.",
    lastMessageAt: ts("2026-07-22T18:45:00+09:00"), lastMessageFromUid: MY_UID,
    createdAt: ts("2026-07-21T14:30:00+09:00"), locked: false,
  },
  match_mock_r2: {
    type: "matchRoom", matchRoomId: "mock_r2", participantUids: [MY_UID, "mock_club_c_owner"],
    lastMessageText: "일정 제안 확인 부탁드려요!",
    lastMessageAt: ts("2026-07-26T20:12:00+09:00"), lastMessageFromUid: "mock_club_c_owner",
    createdAt: ts("2026-07-22T09:00:00+09:00"), locked: false,
  },
  match_mock_f1: {
    type: "matchRoom", matchRoomId: "mock_f1", participantUids: [MY_UID, OPP_LEADER_UID],
    lastMessageText: "좋은 경기였습니다!",
    lastMessageAt: ts("2026-07-13T11:00:00+09:00"), lastMessageFromUid: OPP_LEADER_UID,
    createdAt: ts("2026-07-01T10:00:00+09:00"), locked: true,
  },
};

// 채팅방 상세용 메시지 (관리자 조회)
const MOCK_ADMIN_CHAT_MESSAGES = {
  m1: { chatId: "match_mock_room", fromUid: "system", kind: "system", text: "매칭이 성사되었어요! 구장과 일정을 정해보세요.", images: [], createdAt: ts("2026-07-21T14:30:00+09:00") },
  m2: { chatId: "match_mock_room", fromUid: OPP_LEADER_UID, kind: "text", text: "안녕하세요! 한강 슬램입니다. 잘 부탁드려요 🙌", images: [], createdAt: ts("2026-07-21T14:33:00+09:00") },
  m3: { chatId: "match_mock_room", fromUid: MY_UID, kind: "text", text: "안녕하세요! 저희도 기대하고 있습니다.", images: [], createdAt: ts("2026-07-21T14:35:00+09:00") },
  m4: { chatId: "match_mock_room", fromUid: MY_UID, kind: "text", text: "8/2 토요일 저녁 7시 어떠세요?", images: [], createdAt: ts("2026-07-21T14:40:00+09:00") },
  m5: { chatId: "match_mock_room", fromUid: OPP_LEADER_UID, kind: "text", text: "좋습니다! 제안 주시면 바로 확인할게요.", images: [], createdAt: ts("2026-07-21T14:41:00+09:00") },
};

// 1:1 문의
const MOCK_INQUIRIES = {
  mock_inq_1: { uid: MY_UID, nickname: "리뷰데모", category: "매칭/경기", title: "상대팀이 노쇼했어요",
    content: "확정된 경기에 상대가 안 왔습니다. 어떻게 처리되나요?", status: "pending", answer: "",
    createdAt: ts("2026-07-27T14:20:00+09:00") },
  mock_inq_2: { uid: "mock_p_o3", nickname: "송지호", category: "계정/로그인", title: "카카오 로그인이 안 됩니다",
    content: "어제부터 카카오 로그인 시 오류가 납니다.", status: "answered",
    answer: "앱을 최신 버전으로 업데이트한 뒤 다시 시도해 주세요. 계속 안 되면 기기 정보를 알려주세요.",
    answeredAt: ts("2026-07-26T10:00:00+09:00"), createdAt: ts("2026-07-25T22:10:00+09:00") },
  mock_inq_3: { uid: "mock_uid_owner", nickname: "박구장", category: "구장/예약", title: "정산은 언제 되나요",
    content: "7월 예약분 정산 일정을 알고 싶습니다.", status: "pending", answer: "",
    createdAt: ts("2026-07-24T09:05:00+09:00") },
};

// 차단된 회원 / 팀 (users.blocked / clubs.blocked === true)
const MOCK_BLOCKED_USERS = {
  mock_p_o2: { ...MOCK_USER_DOCS.mock_p_o2, blocked: true, blockedReason: "경기 중 욕설 신고 3회",
    blockedAt: ts("2026-07-25T11:00:00+09:00") },
  mock_p_o4: { ...MOCK_USER_DOCS.mock_p_o4, blocked: true, blockedReason: "반복 노쇼",
    blockedAt: ts("2026-07-18T16:30:00+09:00") },
};
const MOCK_BLOCKED_TEAMS = {
  mock_club_d: { ...MOCK_CLUB_DOCS.mock_club_d, blocked: true, blockedReason: "확정 경기 반복 취소",
    blockedAt: ts("2026-07-26T13:40:00+09:00") },
};

// 관리자 계정
const MOCK_ADMIN_ACCOUNTS = {
  superadmin: { name: "총괄관리자", role: "superadmin", createdAt: ts("2026-01-05T09:00:00+09:00") },
  ops01: { name: "운영1", role: "admin", createdAt: ts("2026-03-11T09:00:00+09:00") },
  cs01: { name: "고객지원", role: "admin", createdAt: ts("2026-05-02T09:00:00+09:00") },
};

// 배너 / 이벤트팝업 / 앱 버전
const MOCK_BANNERS = {
  mock_banner_1: { title: "8월 정기 리그 모집", imageUrl: "", linkUrl: "/community", active: true, order: 1,
    createdAt: ts("2026-07-25T10:00:00+09:00") },
  mock_banner_2: { title: "구장 예약 결제 오픈", imageUrl: "", linkUrl: "/venues", active: true, order: 2,
    createdAt: ts("2026-07-15T14:00:00+09:00") },
  mock_banner_3: { title: "(비활성) 6월 출시 안내", imageUrl: "", linkUrl: "", active: false, order: 3,
    createdAt: ts("2026-05-10T09:00:00+09:00") },
};

const MOCK_APP_VERSIONS = {
  android: { platform: "android", latestVersion: "1.4.2", minVersion: "1.3.0", forceUpdate: false,
    releaseNote: "매칭 속도 개선 및 버그 수정", updatedAt: ts("2026-07-20T10:00:00+09:00") },
  ios: { platform: "ios", latestVersion: "1.4.1", minVersion: "1.3.0", forceUpdate: false,
    releaseNote: "구장 예약 결제 지원", updatedAt: ts("2026-07-18T10:00:00+09:00") },
};

const DB_FIXTURES = {
  // 관리자 화면 (10-xx)
  adminCommunityRaw: MOCK_COMMUNITY_RAW,
  adminCommunityComments: MOCK_COMMUNITY_COMMENTS_RAW,
  adminChatRooms: MOCK_ADMIN_CHAT_ROOMS,
  adminChatMessages: MOCK_ADMIN_CHAT_MESSAGES,
  inquiries: MOCK_INQUIRIES,
  blockedUsers: MOCK_BLOCKED_USERS,
  blockedTeams: MOCK_BLOCKED_TEAMS,
  adminAccounts: MOCK_ADMIN_ACCOUNTS,
  banners: MOCK_BANNERS,
  appVersions: MOCK_APP_VERSIONS,
  // 매치룸 상세(3-07·3-08)의 기본 상태 = 조율중. 이게 없으면 "매칭 정보를 찾을 수 없습니다"가 뜬다.
  matchRequestDoc: matchDoc({ status: "accepted" }),
  matchReviews: [],
  chatMessages: CHAT_COORDINATING,
  chatRoom: CHAT_ROOM,
  matchReservation: null,
  // 종료 경기 6건 중 4건은 이미 리뷰를 남긴 상태 → "리뷰 남길 경기 / 완료된 경기" 가 둘 다 채워진다
  reviewedMatchIds: ["mock_f3", "mock_f4", "mock_f5", "mock_f6"],
  myReports: MOCK_MY_REPORTS,
  myTeamReports: MOCK_MY_TEAM_REPORTS,
  blockList: MOCK_BLOCK_LIST,
  myMatchDocs: MY_MATCH_DOCS,
  matchRequestDocs: MY_MATCH_DOCS,
  communityPosts: MOCK_POSTS,
  communityPostDetail: MOCK_POST_DETAIL,
  notifications: MOCK_NOTIFICATIONS,
  notices: MOCK_NOTICES,
  chatRooms: [], // 실제 앱 상태 — DM 을 만드는 진입점이 없어 항상 빈 목록
  playerRankRows: MOCK_PLAYER_RANK_ROWS,
  venueDocs: MOCK_VENUE_DOCS,
  venueReservationDocs: MOCK_RESERVATION_DOCS,
  paymentDocs: MOCK_PAYMENT_DOCS,
  venueBlocks: [],
  tossOrder: MOCK_TOSS_ORDER,
  clubDocs: MOCK_CLUB_DOCS,
  userDocs: MOCK_USER_DOCS,
  clubMemberRefs: MOCK_CLUB_MEMBER_REFS,
  clubSnapshots: MOCK_CLUB_SNAPSHOTS,
  clubMemberCounts: MOCK_MEMBER_COUNTS,
  joinRequests: MOCK_JOIN_REQUESTS,
  invites: MOCK_INVITES,
  eventPopups: { mock_event: MOCK_EVENT },
};

// 구장주 OwnerContext value — 승인 상태만 시나리오별로 갈아끼운다
const OWNER_IDENTITY = {
  uid: "mock_uid_owner",
  firebaseUser: { uid: "mock_uid_owner", email: "owner@hallaemallae.com" },
  userDoc: {
    uid: "mock_uid_owner",
    id: "mock_uid_owner",
    name: "박구장",
    phone: "010-9876-5432",
    email: "owner@hallaemallae.com",
    // OwnerLayout.hasOwnerConsent — 없으면 전 화면이 "서비스 이용 동의" 게이트로 덮인다
    ownerTermsConsent: true,
    ownerPrivacyConsent: true,
    ownerAdultConsent: true,
    // OwnerLayout.needsOwnerType — 구장이 없는(venues: []) 시나리오에서 이 값이 없으면
    // 온보딩·등록 프레임이 전부 "운영 주체 선택" 게이트로 덮여 다 똑같이 보인다.
    ownerType: "business",
  },
  isLoggedIn: true,
  authLoading: false,
  loading: false,
  activeVenueId: MOCK_VENUE.id,
  setActiveVenue: () => {},
  refresh: () => {},
};

// 로그인한 팀장 세션 — 모든 사용자앱 프레임의 기본값
const IDENTITY_LEADER = {
  ...DB_FIXTURES,
  auth: {
    firebaseUser: { uid: MY_UID, email: MOCK_USER_DOC.email, displayName: MOCK_USER_DOC.nickname },
    userDoc: MOCK_USER_DOC,
    loading: false,
    isLoggedIn: true,
  },
  club: {
    club: MOCK_CLUB_DOC,
    members: MOCK_MEMBERS,
    loading: false,
    isTeamLeader: true,
    activeTeamId: MY_CLUB,
  },
  clubTeamSummaries: {
    [MY_CLUB]: { id: MY_CLUB, clubId: MY_CLUB, ...MY_TEAM_SNAP },
    [OPP_CLUB]: { id: OPP_CLUB, clubId: OPP_CLUB, ...OPP_TEAM_SNAP },
  },
  // 실제 서비스가 Map 을 돌려주므로 목업도 Map 이어야 한다(소비처가 .get() 을 쓴다).
  teamRankMap: new Map([[MY_CLUB, 7], [OPP_CLUB, 15]]),
  playerRankMap: new Map([...MY_PLAYERS, ...OPP_PLAYERS].map((p, i) => [p.userId, i + 11])),
};

/* ========================= 매칭 인박스(매칭 관리) ========================= */

// 인박스는 raw match_requests 문서를 주면 서비스의 normalizeInboxRow 가 direction 을 계산한다.
// 받은 제의 = 상대가 actor / 보낸 제의 = 내가 actor.
const INBOX_RECEIVED = [
  {
    id: "mock_inbox_1",
    ...matchDoc({ status: "pending", actorClubId: OPP_CLUB, targetClubId: MY_CLUB, fromTeamSnapshot: OPP_TEAM_SNAP, toTeamSnapshot: MY_TEAM_SNAP }),
  },
];

const INBOX_SENT = [
  {
    id: "mock_inbox_2",
    ...matchDoc({ status: "pending" }),
  },
];

const INBOX_MIXED = [...INBOX_RECEIVED, ...INBOX_SENT];

/* ========================= 시나리오 ========================= */

const RAW = {
  /* ── 기준: 로그인된 팀장 (다른 시나리오가 전부 상속) ── */
  "base-leader": {
    label: "로그인(팀장)",
    data: { ...IDENTITY_LEADER },
  },

  /* ── 관리자 세션 (10-xx 프레임) ── */
  "base-admin": {
    label: "로그인(관리자)",
    extends: "base-leader",
    data: {
      auth: {
        firebaseUser: { uid: "mock_uid_admin", email: "admin@hallaemallae.com", displayName: "관리자" },
        userDoc: { ...MOCK_USER_DOC, uid: "mock_uid_admin", id: "mock_uid_admin", nickname: "관리자", isAdmin: true, adminClaim: true },
        loading: false,
        isLoggedIn: true,
      },
    },
  },

  /* ── 구장주 세션 (9-xx 프레임) ── */
  "base-owner": {
    label: "로그인(구장주)",
    data: {
      // 구장주 화면도 예약·구장 목업 DB 가 필요하다(예약관리·매출·구장정보).
      ...DB_FIXTURES,
      ownerAuth: {
        firebaseUser: { uid: "mock_uid_owner", email: "owner@hallaemallae.com" },
        uid: "mock_uid_owner",
        isLoggedIn: true,
        loading: false,
      },
      owner: {
        ...OWNER_IDENTITY,
        // OwnerGate — venue 가 없으면 전 화면이 /owner/onboarding 으로 튕긴다
        venue: MOCK_VENUE,
        venues: [MOCK_VENUE],
        status: "approved",
      },
    },
  },

  /* ── 구장주: 심사 진행 상태 (승인 전) ── */
  "owner-pending": {
    label: "구장주 · 심사 대기",
    extends: "base-owner",
    data: {
      owner: {
        ...OWNER_IDENTITY,
        venue: { ...MOCK_VENUE, status: "pending" },
        venues: [{ ...MOCK_VENUE, status: "pending" }],
        status: "pending",
      },
    },
  },
  "owner-rejected": {
    label: "구장주 · 심사 반려",
    extends: "base-owner",
    data: {
      owner: {
        ...OWNER_IDENTITY,
        venue: { ...MOCK_VENUE, status: "rejected", rejectReason: "사업자등록증 사진이 흐려 확인이 어렵습니다. 다시 등록해 주세요." },
        venues: [{ ...MOCK_VENUE, status: "rejected" }],
        status: "rejected",
      },
    },
  },
  /* ── 구장주: 인증·정산계좌·통신판매업 신고까지 다 채운 상태 ──
   * base-owner 의 구장에는 이 값들이 비어 있어 내정보·정산 화면이 늘 "미등록"으로만 보인다.
   * 등록완료 배지·확인완료 표시·정산 안내를 보려면 이 시나리오로 띄운다. */
  "owner-verified": {
    label: "구장주 · 인증·계좌 등록완료",
    extends: "base-owner",
    data: {
      owner: {
        ...OWNER_IDENTITY,
        venue: VERIFIED_VENUE,
        venues: [VERIFIED_VENUE],
        status: "approved",
      },
    },
  },
  "owner-noven": {
    label: "구장주 · 구장 미등록",
    extends: "base-owner",
    data: {
      owner: { ...OWNER_IDENTITY, venue: null, venues: [], activeVenueId: "", status: "none" },
    },
  },
  // 운영 주체별 등록 흐름 — 묻는 정보와 문구가 주체에 따라 갈린다(constants/ownerType.js).
  // 계정의 ownerType 만 다르고 나머지는 owner-noven 과 동일.
  "owner-noven-school": {
    label: "구장주 · 구장 미등록(학교)",
    extends: "owner-noven",
    data: {
      owner: {
        ...OWNER_IDENTITY,
        userDoc: { ...OWNER_IDENTITY.userDoc, name: "김선생", ownerType: "school" },
        venue: null, venues: [], activeVenueId: "", status: "none",
      },
    },
  },
  "owner-noven-org": {
    label: "구장주 · 구장 미등록(기관·단체)",
    extends: "owner-noven",
    data: {
      owner: {
        ...OWNER_IDENTITY,
        userDoc: { ...OWNER_IDENTITY.userDoc, name: "이담당", ownerType: "org" },
        venue: null, venues: [], activeVenueId: "", status: "none",
      },
    },
  },

  /* ── 로그인만 되고 팀이 없는 상태 ── */
  "base-noteam": {
    label: "로그인(팀 없음)",
    extends: "base-leader",
    data: {
      auth: {
        firebaseUser: { uid: MY_UID, email: MOCK_USER_DOC.email, displayName: "새싹" },
        userDoc: { ...MOCK_USER_DOC, nickname: "새싹", clubId: "", activeTeamId: "", activeTeamName: "", teamName: "" },
        loading: false,
        isLoggedIn: true,
      },
      club: { club: null, members: [], loading: false, isTeamLeader: false, activeTeamId: "" },
      // 서비스들이 users 문서를 다시 읽으므로 목업 DB 쪽 내 문서도 무소속으로 덮는다
      userDocs: {
        ...MOCK_USER_DOCS,
        [MY_UID]: { ...MOCK_USER_DOC, nickname: "새싹", clubId: "", activeTeamId: "", activeTeamName: "", teamName: "" },
      },
    },
  },

  /* ── 인증·가입 게이트: 신규 가입자가 단계마다 보는 화면 ──
   * 로그인은 됐지만 users 플래그가 없으면 라우트 게이트가 그 화면을 띄운다.
   * /home 으로 들어가면 각 단계 게이트가 그대로 보인다. */
  "gate-consent": {
    label: "게이트 · 약관 미동의",
    extends: "base-leader",
    data: {
      auth: {
        firebaseUser: { uid: MY_UID, email: MOCK_USER_DOC.email, displayName: "신규" },
        userDoc: { ...MOCK_USER_DOC, nickname: "신규", termsConsent: false, privacyConsent: false, ageOver14Consent: false },
        loading: false,
        isLoggedIn: true,
      },
    },
  },
  "gate-phone": {
    label: "게이트 · 전화인증 전",
    extends: "base-leader",
    data: {
      auth: {
        firebaseUser: { uid: MY_UID, email: MOCK_USER_DOC.email, displayName: "신규" },
        userDoc: { ...MOCK_USER_DOC, nickname: "신규", phoneVerified: false, basicInfoDone: false, welcomeSeen: false },
        loading: false,
        isLoggedIn: true,
      },
    },
  },
  "gate-basicinfo": {
    label: "게이트 · 기본정보 미입력",
    extends: "base-leader",
    data: {
      auth: {
        firebaseUser: { uid: MY_UID, email: MOCK_USER_DOC.email, displayName: "신규" },
        userDoc: { ...MOCK_USER_DOC, nickname: "신규", basicInfoDone: false, welcomeSeen: false },
        loading: false,
        isLoggedIn: true,
      },
    },
  },
  "gate-welcome": {
    label: "게이트 · 가입완료 안내",
    extends: "base-leader",
    data: {
      auth: {
        firebaseUser: { uid: MY_UID, email: MOCK_USER_DOC.email, displayName: "신규" },
        userDoc: { ...MOCK_USER_DOC, nickname: "신규", welcomeSeen: false },
        loading: false,
        isLoggedIn: true,
      },
    },
  },

  /* ── MY: 보는 사람의 지위에 따라 메뉴가 달라진다 ── */
  "me-member": {
    label: "일반 팀원(팀장 아님)",
    extends: "base-leader",
    data: {
      auth: {
        firebaseUser: { uid: "mock_p_m2", email: "junseo@example.com", displayName: "이준서" },
        userDoc: { ...MOCK_USER_DOC, uid: "mock_p_m2", id: "mock_p_m2", nickname: "이준서", name: "이준서", mainPosition: "SG", heightCm: 183, weightKg: 76 },
        loading: false,
        isLoggedIn: true,
      },
      club: { club: MOCK_CLUB_DOC, members: MOCK_MEMBERS, loading: false, isTeamLeader: false, activeTeamId: MY_CLUB },
    },
  },
  "me-empty-profile": {
    label: "프로필 미완성",
    extends: "base-leader",
    data: {
      auth: {
        firebaseUser: { uid: MY_UID, email: MOCK_USER_DOC.email, displayName: "리뷰데모" },
        userDoc: {
          ...MOCK_USER_DOC,
          mainPosition: "", skillLevel: "", heightCm: null, weightKg: null,
          intro: "", careers: [], media: [], avatarUrl: "",
        },
        loading: false,
        isLoggedIn: true,
      },
      userDocs: {
        ...MOCK_USER_DOCS,
        [MY_UID]: { ...MOCK_USER_DOC, mainPosition: "", skillLevel: "", heightCm: null, weightKg: null, intro: "", careers: [], media: [], avatarUrl: "" },
      },
    },
  },
  "me-nothing": {
    label: "MY · 활동 기록 없음",
    extends: "base-leader",
    data: {
      communityPosts: [],
      myMatchDocs: [],
      matchRequestDocs: [],
      myReports: [],
      myTeamReports: [],
      blockList: { blockedUids: [], hiddenPostIds: [] },
      venueReservationDocs: {},
      invites: [],
      joinRequests: {},
    },
  },

  /* ── 커뮤니티 ── */
  "community-empty": {
    label: "커뮤니티 · 글 없음",
    extends: "base-leader",
    data: { communityPosts: [] },
  },
  "post-others": {
    label: "글 상세 · 남의 글",
    extends: "base-leader",
    data: {
      communityPostDetail: {
        post: {
          ...MOCK_POSTS[5], // 배건우(남) 글
          images: [],
          updatedAt: "",
          likedByMe: false,
          isMine: false,
          canEdit: false,
          canDelete: false,
          canChat: true,
        },
        comments: [
          { ...MOCK_POST_DETAIL.comments[0], postId: "mock_post_5", isMine: false, canEdit: false, canDelete: false },
        ],
      },
    },
  },
  "post-no-comment": {
    label: "글 상세 · 댓글 없음",
    extends: "base-leader",
    data: {
      communityPostDetail: { post: { ...MOCK_POST_DETAIL.post, commentsCount: 0, likes: 0, likedByMe: false }, comments: [] },
    },
  },

  /* ── 알림 ── */
  "noti-empty": {
    label: "알림함 · 비어있음",
    extends: "base-leader",
    data: { notifications: [], notices: [] },
  },
  "noti-all-read": {
    label: "알림함 · 전부 읽음",
    extends: "base-leader",
    data: {
      notifications: MOCK_NOTIFICATIONS.map((n) => ({ ...n, readBy: { [MY_UID]: n.createdAt } })),
    },
  },

  /* ── 팀 ── */
  "team-empty": {
    label: "팀 · 신청·초대 없음",
    extends: "base-leader",
    data: { joinRequests: {}, invites: [] },
  },
  "team-solo": {
    label: "팀 · 팀원 나 혼자",
    extends: "base-leader",
    data: {
      club: {
        club: { ...MOCK_CLUB_DOC, memberCount: 1 },
        members: [MOCK_MEMBERS[0]],
        loading: false,
        isTeamLeader: true,
        activeTeamId: MY_CLUB,
      },
      clubMemberRefs: { ...MOCK_CLUB_MEMBER_REFS, [MY_CLUB]: [MOCK_CLUB_MEMBER_REFS[MY_CLUB][0]] },
    },
  },

  /* ── 구장주 ── */
  "owner-busy": {
    label: "구장주 · 승인 대기 3건",
    extends: "base-owner",
    data: {
      venueReservationDocs: {
        ...MOCK_RESERVATION_DOCS,
        mock_resv_req2: resvRaw({ reservationCode: "HM-260801-021", status: "requested", date: "2026-08-01", startTime: "18:00", endTime: "20:00", userName: "이준서", userNote: "" }),
        mock_resv_req3: resvRaw({ reservationCode: "HM-260803-022", status: "requested", date: "2026-08-03", startTime: "20:00", endTime: "22:00", courtId: "court_b", courtName: "B코트", price: 70000, userName: "송지호", userNote: "샤워실 이용 가능한가요?" }),
      },
    },
  },
  "owner-quiet": {
    label: "구장주 · 예약 없음",
    extends: "base-owner",
    data: { venueReservationDocs: {} },
  },

  /* ── 관리자 ── */
  "admin-empty": {
    label: "관리자 · 데이터 없음",
    extends: "base-admin",
    data: {
      userDocs: {},
      clubDocs: {},
      clubSnapshots: [],
      myMatchDocs: [],
      matchRequestDocs: [],
      adminCommunityRaw: {},
      adminCommunityComments: [],
      adminChatRooms: {},
      inquiries: {},
      blockedUsers: {},
      blockedTeams: {},
      notices: [],
      banners: {},
      eventPopups: {},
      venueDocs: {},
      venueReservationDocs: {},
    },
  },
  "admin-pending": {
    label: "관리자 · 처리 대기 많음",
    extends: "base-admin",
    data: {
      inquiries: {
        ...MOCK_INQUIRIES,
        mock_inq_4: { uid: "mock_p_m2", nickname: "이준서", category: "신고/이용제재", title: "상대팀 매너 신고",
          content: "경기 중 계속 시비를 걸었습니다.", status: "pending", answer: "", createdAt: ts("2026-07-28T18:00:00+09:00") },
        mock_inq_5: { uid: "mock_p_o3", nickname: "송지호", category: "구장/예약", title: "예약 취소가 안 됩니다",
          content: "취소 버튼을 눌러도 반응이 없습니다.", status: "pending", answer: "", createdAt: ts("2026-07-28T11:30:00+09:00") },
      },
      venueDocs: {
        ...MOCK_VENUE_DOCS,
        mock_venue_pending: { ...VENUE_RAW, name: "성수 하프코트", displayName: "성수 하프코트", status: "pending",
          address: "서울 성동구 아차산로 100", region: "서울 성동구", ownerUid: "mock_uid_owner3" },
      },
    },
  },

  /* ── 매치룸 상세: 경우의 수 ── */
  "match-lineup-wait": {
    label: "매치룸 · 라인업 대기",
    extends: "base-leader",
    data: {
      matchRequestDoc: matchDoc({
        status: "accepted",
        toLineupSnapshot: lineup(OPP_PLAYERS, OPP_SUBS, false),
      }),
      matchReviews: [],
      chatMessages: CHAT_EMPTY,
      chatRoom: CHAT_ROOM,
      matchReservation: null,
    },
  },

  "match-coordinating": {
    label: "매치룸 · 조율중(채팅)",
    extends: "base-leader",
    data: {
      matchRequestDoc: matchDoc({ status: "accepted" }),
      matchReviews: [],
      chatMessages: CHAT_COORDINATING,
      chatRoom: CHAT_ROOM,
      matchReservation: null,
    },
  },

  "match-proposed-mine": {
    label: "매치룸 · 내가 제의함",
    extends: "base-leader",
    data: {
      matchRequestDoc: matchDoc({
        status: "proposed",
        proposedByClubId: MY_CLUB,
        proposedAt: T.proposedAt,
        scheduledAt: T.scheduledAt,
        field: FIELD,
      }),
      matchReviews: [],
      chatMessages: CHAT_PROPOSED,
      chatRoom: CHAT_ROOM,
      matchReservation: null,
    },
  },

  "match-proposed-theirs": {
    label: "매치룸 · 제의 받음",
    extends: "base-leader",
    data: {
      matchRequestDoc: matchDoc({
        status: "proposed",
        proposedByClubId: OPP_CLUB,
        proposedAt: T.proposedAt,
        scheduledAt: T.scheduledAt,
        field: FIELD,
      }),
      matchReviews: [],
      chatMessages: CHAT_PROPOSED,
      chatRoom: CHAT_ROOM,
      matchReservation: null,
    },
  },

  "match-confirmed": {
    label: "매치룸 · 일정 확정",
    extends: "base-leader",
    data: {
      matchRequestDoc: matchDoc({
        status: "confirmed",
        proposedByClubId: MY_CLUB,
        confirmedByClubId: OPP_CLUB,
        proposedAt: T.proposedAt,
        confirmedAt: T.confirmedAt,
        scheduledAt: T.scheduledAt,
        field: FIELD,
      }),
      matchReviews: [],
      chatMessages: CHAT_CONFIRMED,
      chatRoom: CHAT_ROOM,
      matchReservation: null,
    },
  },

  "match-pay-wait": {
    label: "매치룸 · 분담결제 대기",
    extends: "base-leader",
    data: {
      matchRequestDoc: matchDoc({
        status: "confirmed",
        proposedByClubId: MY_CLUB,
        confirmedByClubId: OPP_CLUB,
        proposedAt: T.proposedAt,
        confirmedAt: T.confirmedAt,
        scheduledAt: T.scheduledAt,
        field: FIELD,
        partnerBooking: {
          accepted: true,
          approvalState: "approved",
          payState: "waiting",
          finalized: false,
          paidByA: true,
          paidByB: false,
          venueName: "용산 더베이스 농구장",
          courtName: "A코트",
          totalPrice: 80000,
        },
      }),
      matchReviews: [],
      chatMessages: CHAT_CONFIRMED,
      chatRoom: CHAT_ROOM,
      matchReservation: {
        accepted: true,
        approvalState: "approved",
        payState: "waiting",
        paidByA: true,
        paidByB: false,
        venueName: "용산 더베이스 농구장",
        courtName: "A코트",
        totalPrice: 80000,
        myShare: 40000,
      },
    },
  },

  "match-venue-approval": {
    label: "매치룸 · 구장 승인 대기",
    extends: "base-leader",
    data: {
      matchRequestDoc: matchDoc({
        status: "awaiting_venue_approval",
        proposedByClubId: MY_CLUB,
        proposedAt: T.proposedAt,
        scheduledAt: T.scheduledAt,
        field: FIELD,
        partnerBooking: {
          accepted: false,
          approvalState: "requested",
          payState: "none",
          finalized: false,
          paidByA: false,
          paidByB: false,
          venueName: "용산 더베이스 농구장",
          courtName: "A코트",
          totalPrice: 80000,
        },
      }),
      matchReviews: [],
      chatMessages: CHAT_PROPOSED,
      chatRoom: CHAT_ROOM,
      matchReservation: {
        accepted: false,
        approvalState: "requested",
        payState: "none",
        venueName: "용산 더베이스 농구장",
        courtName: "A코트",
        totalPrice: 80000,
      },
    },
  },

  "match-result-input": {
    label: "매치룸 · 경기 후 결과입력",
    extends: "base-leader",
    data: {
      matchRequestDoc: matchDoc({
        status: "confirmed",
        proposedByClubId: MY_CLUB,
        confirmedByClubId: OPP_CLUB,
        proposedAt: T.proposedAt,
        confirmedAt: T.confirmedAt,
        scheduledAt: T.pastScheduledAt,
        field: FIELD,
        resultState: null,
      }),
      matchReviews: [],
      chatMessages: CHAT_CONFIRMED,
      chatRoom: CHAT_ROOM,
      matchReservation: null,
    },
  },

  "match-result-wait-accept": {
    label: "매치룸 · 결과 승인 대기",
    extends: "base-leader",
    data: {
      matchRequestDoc: matchDoc({
        status: "confirmed",
        proposedByClubId: MY_CLUB,
        confirmedByClubId: OPP_CLUB,
        scheduledAt: T.pastScheduledAt,
        field: FIELD,
        myScore: 68,
        oppScore: 61,
        resultState: "waiting_accept",
        result: { submittedByClubId: OPP_CLUB, myScore: 68, oppScore: 61, photos: [], comments: [] },
      }),
      matchReviews: [],
      chatMessages: CHAT_CONFIRMED,
      chatRoom: CHAT_ROOM,
      matchReservation: null,
    },
  },

  "match-finished": {
    label: "매치룸 · 종료(결과 확정)",
    extends: "base-leader",
    data: {
      matchRequestDoc: matchDoc({
        status: "finished",
        proposedByClubId: MY_CLUB,
        confirmedByClubId: OPP_CLUB,
        scheduledAt: T.pastScheduledAt,
        field: FIELD,
        myScore: 68,
        oppScore: 61,
        resultState: "confirmed",
        statsAppliedAt: ts("2026-07-13T10:00:00+09:00"),
        result: {
          submittedByClubId: MY_CLUB,
          myScore: 68,
          oppScore: 61,
          photos: [],
          comments: [{ uid: OPP_LEADER_UID, text: "좋은 경기였습니다!", createdAt: ts("2026-07-13T11:00:00+09:00") }],
        },
      }),
      matchReviews: [
        { id: "r1", raterUid: MY_UID, targetUserId: "mock_p_o1", stars: 5, comment: "매너 최고" },
        { id: "r2", raterUid: MY_UID, targetUserId: "mock_p_o3", stars: 4, comment: "" },
      ],
      chatMessages: CHAT_CONFIRMED,
      chatRoom: { ...CHAT_ROOM, locked: true },
      matchReservation: null,
    },
  },

  "match-cancelled": {
    label: "매치룸 · 취소됨",
    extends: "base-leader",
    data: {
      matchRequestDoc: matchDoc({
        status: "cancelled",
        proposedByClubId: MY_CLUB,
        confirmedByClubId: OPP_CLUB,
        scheduledAt: T.scheduledAt,
        field: FIELD,
        cancelledByClubId: OPP_CLUB,
        cancelReasonKey: "team_issue",
        cancelReason: "팀 사정으로 경기 진행이 어려워졌습니다.",
        cancelReasonText: "팀 사정으로 경기 진행이 어려워졌습니다.",
        cancelledAt: T.cancelledAt,
        refund: { amount: 40000, rate: 100, state: "done" },
      }),
      matchReviews: [],
      chatMessages: CHAT_CONFIRMED,
      chatRoom: { ...CHAT_ROOM, locked: true },
      matchReservation: null,
    },
  },

  /* ── 구장 정하기 분기 (매치룸 상세 → 구장 정하기 탭) ──
   * 흐름: 방식 선택 게이트(제휴구장 / 직접입력)
   *        → 제휴구장: /venues?match=<roomId> 로 이동해 구장 목록에서 고른다
   *        → 직접입력: 지도에서 위치 선택 → 날짜·시간 입력
   * 아래는 "위치는 이미 정해졌고 날짜·시간을 입력하는 단계" (지도 피커가 안 뜨는 상태) */
  "match-direct-form": {
    label: "구장 정하기 · 직접입력(날짜·시간)",
    extends: "base-leader",
    data: {
      matchRequestDoc: matchDoc({ status: "accepted", field: FIELD }),
      matchReviews: [],
      chatMessages: CHAT_COORDINATING,
      chatRoom: CHAT_ROOM,
      matchReservation: null,
    },
  },

  /* ── 매치룸 목록 ──
   * 앱의 탭(?tab=adjusting|confirmed|past|cancelled, 없으면 전체)마다 내용이 있어야
   * 탭별 화면을 실제와 같게 볼 수 있다 → 상태별로 2건씩 깔아둔다. */
  "roomlist-full": {
    label: "매치룸 목록 · 여러 상태",
    extends: "base-leader",
    data: { matchRequestDocs: MY_MATCH_DOCS },
  },

  "roomlist-empty": {
    label: "매치룸 목록 · 비어있음",
    extends: "base-leader",
    data: { matchRequestDocs: [] },
  },

  /* ── 채팅: DM 진입점을 만들었을 때 (지금 앱에서는 도달 불가) ── */
  "chat-dm": {
    label: "채팅 목록 · DM 있음(미구현 상태 가정)",
    extends: "base-leader",
    data: { chatRooms: MOCK_CHAT_ROOMS },
  },

  /* ── 구장 예약 흐름 ── */
  // 흐름: 구장 목록 → 구장 상세 → 코트·시간 선택 → 결제(토스 위젯) → 결과 → 내 예약
  "venue-flow": {
    label: "구장 예약 흐름(기본)",
    extends: "base-leader",
  },
  // 분담결제(매칭 제휴구장)에서 우리 팀만 먼저 결제한 상태.
  // 결제 완료 화면은 reservationStatus 로 갈린다 — confirmed 면 "예약 확정",
  // pending 이면 "상대 팀이 남은 몫을 결제하면 확정" 안내가 뜬다.
  // side="A" 라 결제액은 총액이 아니라 우리 팀 몫(shareA)이다.
  "pay-share-waiting": {
    label: "결제 성공 · 상대 팀 결제 대기",
    extends: "base-leader",
    data: {
      tossOrder: {
        ...MOCK_TOSS_ORDER,
        orderName: "용산 더베이스 농구장 A코트 (8/2 19:00~21:00) · 우리 팀 몫",
        side: "A",
        venueAmount: 40000,
        platformFee: 2000,
        amount: 42000,
        reservationStatus: "pending",
        matchId: "mock_room",
      },
    },
  },
  "resv-requested": {
    label: "내 예약 · 승인 대기",
    extends: "base-leader",
    data: {
      venueReservationDocs: { mock_reservation: MOCK_RESERVATION_DOCS.mock_reservation },
    },
  },
  "resv-confirmed": {
    label: "내 예약 · 확정",
    extends: "base-leader",
    data: {
      venueReservationDocs: { mock_resv_confirmed: MOCK_RESERVATION_DOCS.mock_resv_confirmed },
    },
  },
  "resv-empty": {
    label: "내 예약 · 비어있음",
    extends: "base-leader",
    data: { venueReservationDocs: {} },
  },
  "venues-empty": {
    label: "구장 목록 · 비어있음",
    extends: "base-leader",
    data: { venueDocs: {} },
  },

  /* ── 매칭 관리(인박스) ── */
  "inbox-received": {
    label: "매칭 관리 · 받은 제의",
    extends: "base-leader",
    data: { matchInboxDocs: INBOX_RECEIVED },
  },
  "inbox-sent": {
    label: "매칭 관리 · 보낸 제의",
    extends: "base-leader",
    data: { matchInboxDocs: INBOX_SENT },
  },
  "inbox-mixed": {
    label: "매칭 관리 · 주고받음",
    extends: "base-leader",
    data: { matchInboxDocs: INBOX_MIXED },
  },
  "inbox-empty": {
    label: "매칭 관리 · 비어있음",
    extends: "base-leader",
    data: { matchInboxDocs: [] },
  },
};

/* ========================= extends 해석 ========================= */

function resolve(id, seen) {
  const s = RAW[id];
  if (!s) return null;
  if (seen.has(id)) {
    console.warn("[mockScenarios] circular extends:", id);
    return { label: s.label, data: s.data || {} };
  }
  seen.add(id);
  const parent = s.extends ? resolve(s.extends, seen) : null;
  return {
    label: s.label,
    data: { ...(parent ? parent.data : {}), ...(s.data || {}) },
  };
}

export const SCENARIOS = Object.keys(RAW).reduce((acc, id) => {
  acc[id] = resolve(id, new Set());
  return acc;
}, {});

// 보드가 목록을 그릴 때 쓰는 메타
export const SCENARIO_LIST = Object.keys(RAW).map((id) => ({ id, label: RAW[id].label }));

export const MOCK_IDS = { MY_UID, MY_CLUB, OPP_CLUB, OPP_LEADER_UID };
