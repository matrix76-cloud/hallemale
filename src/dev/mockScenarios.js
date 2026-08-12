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

/* ── 날짜 축 ────────────────────────────────────────────────────────
 * 픽스처에 날짜를 박아 두면 그 날이 지나는 순간 화면이 조용히 틀어진다.
 * (확정 경기가 "지난 경기"로, 다가오는 예약이 목록에서 사라지고, 결제 화면의 취소 규정이
 *  늘 "환불 불가" 단계로 굳는다 — 실제로 그렇게 썩어 있었다.)
 * 그래서 날짜를 세 축으로 나눠 전부 오늘 기준으로 잡는다.
 *
 *  1) GAME_*        — 이야기의 중심인 "확정된 다음 경기". 매치룸·채팅·알림·예약·결제가 모두 이 날을 가리킨다.
 *  2) monthPastYmd  — 구장주 매출·정산 화면이 "이번 달"로 집계한다. 끝난 예약은 이번 달의 지난 날이어야 한다.
 *  3) STORY_SHIFT   — 커뮤니티 글·채팅 이력처럼 "며칠 전"으로만 읽히는 시각. 원래 기준일과의
 *                     간격만큼 통째로 당긴다. 7의 배수로 당겨 요일은 보존한다
 *                     (요일이 바뀌면 요일별 요금·주말 슬롯·본문의 "(일)" 표기가 어긋난다).
 */
const DAY_MS = 86400000;
const WEEK_KO = ["일", "월", "화", "수", "목", "금", "토"];
const pad2 = (n) => String(n).padStart(2, "0");
const ymdOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// 이 파일의 날짜 리터럴은 이 날을 "오늘"이라 보고 쓰였다.
const STORY_ANCHOR_MS = new Date("2026-07-28T00:00:00+09:00").getTime();
const STORY_SHIFT_DAYS = Math.max(0, Math.floor(Math.floor((Date.now() - STORY_ANCHOR_MS) / DAY_MS) / 7) * 7);
/** 리터럴 날짜를 오늘 근처로 당긴 Date */
const shifted = (v) => new Date(new Date(v).getTime() + STORY_SHIFT_DAYS * DAY_MS);

// Firestore Timestamp 대신 Date 를 쓴다. 앱의 tsMs/fmtDate 유틸이 Date 도 처리하도록
// toDate() 를 흉내 내는 얇은 래퍼를 준다(실제 Timestamp 와 같은 인터페이스).
// ⚠️ ts() 는 리터럴 전용이다(자동으로 당겨진다). 이미 오늘 기준으로 계산한 값
//    (dayOffsetAt 등)에 쓰면 두 번 당겨진다 — 그때는 tsAbs() 를 쓸 것.
function tsAbs(v) {
  const d = new Date(v);
  return { toDate: () => d, seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 };
}
function ts(iso) {
  return tsAbs(shifted(iso));
}

// scheduledAt 은 실데이터에서 ISO 문자열이다(matchRoomService.proposeMatchSchedule).
// Timestamp 흉내 객체로 주면 `new Date(v)` 를 쓰는 화면에서 Invalid Date 가 된다.
const iso = (v) => shifted(v).toISOString();

// 경기 일시만은 고정값으로 박을 수 없다 — 화면이 "확정(경기 전)"인지 "지난 경기"인지를
// scheduledAt 과 현재 시각의 비교로 가르기 때문에, 박아둔 날짜가 지나면 "일정 확정" 시나리오가
// 어느 날부터 조용히 "경기 종료" 화면으로 바뀐다(실제로 그렇게 썩어 있었다).
// 그래서 경기 일시만 오늘 기준 상대일로 잡고, 나머지 이력 시각은 고정값을 유지한다.
// 날짜 경계로 정렬해서 같은 날 안에서는 항상 같은 화면이 나온다.
function dayOffsetAt(days, hour) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

// 예약 date 는 "YYYY-MM-DD" 문자열이다. 고정 날짜로 박으면 그 날이 지나는 순간
// "다가오는 예약"에서 빠져 상세 시트를 열 수 없다(실제로 그렇게 썩어 있었다).
function dayOffsetYmd(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return ymdOf(d);
}

/**
 * 이번 달의 지난 날 — 구장주 매출·가동률은 "이번 달"(now 기준)만 집계하므로 끝난 예약이
 * 지난달로 넘어가면 매출이 0으로 보인다. 원하는 일자를 주되 달을 넘기지 않고 오늘 이전으로 눌러 담는다.
 */
function monthPastYmd(day) {
  const now = new Date();
  const latest = Math.max(1, now.getDate() - 1);
  return ymdOf(new Date(now.getFullYear(), now.getMonth(), Math.min(Math.max(1, day), latest)));
}

/* 이야기의 중심 — 조율이 끝나 확정된 다음 경기(닷새 뒤 19:00).
   매치룸 일정·채팅 본문·알림 문구·구장 예약·결제가 전부 이 하나를 가리켜야 앞뒤가 맞는다. */
const GAME_AHEAD = 5;
const GAME_YMD = dayOffsetYmd(GAME_AHEAD);
const GAME_ISO = dayOffsetAt(GAME_AHEAD, 19);
const GAME_AT = new Date(GAME_ISO);
const GAME_SHORT = `${GAME_AT.getMonth() + 1}/${GAME_AT.getDate()}`;                              // "8/17"
const GAME_LONG = `${GAME_AT.getMonth() + 1}월 ${GAME_AT.getDate()}일 (${WEEK_KO[GAME_AT.getDay()]})`; // "8월 17일 (월)"
/** 예약번호는 예약일에서 뽑힌다(genReservationCode) — 날짜가 바뀌면 번호도 같이 바뀌어야 한다. */
const resvCode = (ymd, seq) => `HM-${String(ymd).slice(2).replace(/-/g, "")}-${seq}`;

const T = {
  createdAt: ts("2026-07-20T10:00:00+09:00"),
  acceptedAt: ts("2026-07-21T14:30:00+09:00"),
  proposedAt: ts("2026-07-22T09:10:00+09:00"),
  confirmedAt: ts("2026-07-22T18:40:00+09:00"),
  scheduledAt: GAME_ISO, // 확정(경기 전) 시나리오용 — 닷새 뒤 19:00
  pastScheduledAt: dayOffsetAt(-5, 19), // 지난 경기 시나리오용 — 닷새 전 19:00
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
  // 사진 없는 구장은 목록·상세가 "No image" 판으로만 보여서 레이아웃 확인이 안 된다.
  // 랜딩에 이미 들어있는 코트 사진을 재사용한다(개발 서버에서 /landing/ 으로 서빙됨).
  photos: ["/landing/assets/story-venue.jpg"],
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
  // 구장주 계정 — 어드민 "소유 계정" 박스가 현재 소유자를 이 문서로 표시하고,
  // 이메일로 이관 대상을 찾을 때도 여기서 찾는다.
  mock_uid_owner: {
    id: "mock_uid_owner", uid: "mock_uid_owner",
    email: "owner@hallaemallae.com", ownerManagerName: "박구장", ownerManagerPhone: "01012345678",
  },
  mock_uid_owner2: {
    id: "mock_uid_owner2", uid: "mock_uid_owner2",
    email: "owner2@hallaemallae.com", ownerManagerName: "이관장", ownerManagerPhone: "01098765432",
  },
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
  title: "3x3 토너먼트",
  // 진행 중인 이벤트로 보여야 하므로 기간을 달 이름으로 못 박지 않는다(달이 바뀌면 지난 이벤트가 된다).
  body: "이번 달 열리는 길거리 3x3 토너먼트에 참가하세요. 우승팀에게는 유니폼 풀세트를 드립니다.",
  imageUrl: "",
  linkUrl: "",
  active: true,
  startAt: T.createdAt,
  endAt: tsAbs(dayOffsetAt(19, 23)),
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
  // 사진 없는 구장은 목록·상세가 "No image" 판으로만 보여서 레이아웃 확인이 안 된다.
  // 랜딩에 이미 들어있는 코트 사진을 재사용한다(개발 서버에서 /landing/ 으로 서빙됨).
  photos: ["/landing/assets/story-venue.jpg", "/landing/assets/story-match.jpg"],
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
  // 구장주가 코트에 등록할 수 있는 항목을 빠짐없이 채운 코트다 —
  // 소개·사진·바닥재·요일별 시간대 요금·고정 공지·주의사항까지.
  // (운영 DB 의 코트는 대부분 이름·요금만 채워져 있어, 다 채웠을 때의 상세를 여기서만 볼 수 있다)
  courts: [
    // priceBands: 상세의 "요금·코트 정보"에서 요일별 시간대 요금표가 그려지는지 보기 위한 값
    {
      id: "court_a", name: "A코트", type: "indoor", surface: "우레탄",
      description: "정규 규격 풀코트. 우레탄 바닥에 백보드 유리판, 전광판까지 있어 시합용으로 씁니다.",
      pricePerHour: 40000, slotMinutes: 60, hours: courtHours(),
      photos: ["/landing/assets/story-venue.jpg", "/landing/assets/story-match.jpg"],
      priceBands: {
        mon: [{ start: "18:00", end: "22:00", price: 50000 }],
        tue: [{ start: "18:00", end: "22:00", price: 50000 }],
        wed: [{ start: "18:00", end: "22:00", price: 50000 }],
        thu: [{ start: "18:00", end: "22:00", price: 50000 }],
        fri: [{ start: "18:00", end: "22:00", price: 50000 }],
        sat: [{ start: "09:00", end: "21:00", price: 55000 }],
        sun: [{ start: "09:00", end: "21:00", price: 55000 }],
      },
      notices: [
        // 공지 본문에도 날짜를 박지 않는다 — 픽스처가 썩는 자리는 예약일만이 아니다.
        { id: "nt_a1", pinned: true, title: "정기 휴관일 안내", body: "매월 첫째 주 월요일은 시설 점검으로 종일 휴관합니다. 해당일 예약은 받지 않습니다." },
        { id: "nt_a2", title: "샤워실 온수 사용 시간", body: "온수는 오전 9시부터 오후 10시까지 나옵니다. 그 외 시간에는 냉수만 사용할 수 있어요." },
        { id: "nt_a3", title: "전광판·조끼 대여", body: "전광판과 팀 조끼(10벌)는 무료로 빌려드립니다. 입장 시 데스크에 말씀해 주세요." },
      ],
      cautions: [
        "실내 전용 농구화만 착용할 수 있습니다. 외부용 신발은 입장이 제한돼요.",
        "코트 안에서는 물 외의 음료·음식을 드실 수 없습니다.",
        "예약 시간 10분 전부터 입장할 수 있고, 종료 시간까지 정리를 마쳐주세요.",
      ],
    },
    {
      id: "court_b", name: "B코트", type: "indoor", surface: "마루",
      description: "3대3 하프코트 2면. 마루 바닥이라 무릎 부담이 적고, 소규모 연습에 알맞습니다.",
      pricePerHour: 35000, slotMinutes: 60, hours: courtHours(),
      photos: ["/landing/assets/story-level.jpg"],
      notices: [
        { id: "nt_b1", title: "하프코트 분할 대관", body: "2면을 나눠 쓰는 코트라 같은 시간대에 다른 팀이 옆면을 사용할 수 있습니다." },
      ],
      cautions: ["덩크·림 매달리기는 금지입니다. 백보드 파손 시 수리비가 청구돼요."],
    },
  ],
  // 리뷰 집계값 — 상세 상단 평점 배지와 리뷰 섹션 요약이 이 값을 읽는다.
  // 아래 MOCK_VENUE_REVIEWS 의 이 구장 리뷰(3건)와 평균·개수를 맞춰 둔다.
  rating: 4.7,
  reviewCount: 3,
  // 어드민 심사 화면에서 볼 값 — 사업자 인증은 끝났지만 계좌는 아직 대조 전(verified:false)이라
  // "계좌 확인 처리" 버튼이 뜬다. 확인완료 쪽은 VENUE2_RAW 에서 본다.
  // 번호·계좌는 형식만 맞춘 가짜값 — 실존 사업자 정보를 넣지 말 것.
  business: {
    bizName: "더베이스스포츠", ownerName: "박구장", bizNo: "123-45-67890",
    openDate: "2021-03-02", taxType: "general", licenseUrl: "",
    status: "verified", ntsChecked: true, rejectReason: "",
  },
  settlement: {
    bank: "국민", account: "12345601234567", holder: "박구장",
    taxEmail: "tax@example.com", verified: false,
  },
  salesReport: { number: "2026-서울용산-01234", certUrl: "", exempt: false, status: "submitted" },
};

const VENUE2_RAW = {
  ...VENUE_RAW,
  ownerUid: "mock_uid_owner2",
  // 계좌 대조까지 끝난 구장 — "확인 해제" 버튼과 확인완료 표시를 본다.
  business: { ...VENUE_RAW.business, bizName: "슛포인트", bizNo: "222-33-44444", taxType: "simple" },
  settlement: { bank: "카카오뱅크", account: "3333012345678", holder: "이관장", taxEmail: "tax2@example.com", verified: true },
  salesReport: { number: "", certUrl: "", exempt: true, status: "none" },
  // 즉시예약(승인 없이 바로 확정) 구장 — 상세의 "즉시 예약" 배지·안내문 검수용
  autoApprove: true,
  name: "마포 슛포인트 체육관",
  displayName: "마포 슛포인트 체육관",
  address: "서울 마포구 월드컵로 200",
  // VENUE_RAW 를 펼쳐 만든 구장이라, 덮어쓰지 않으면 용산 구장의 상세주소·찾아오는 길·
  // 대표키워드가 그대로 따라온다(마포 구장인데 "신용산역에서 도보 5분"이 붙는다).
  addressDetail: "",
  region: "서울 마포구",
  lat: 37.5563,
  lng: 126.9236,
  type: "outdoor",
  description: "야외 하프코트 2면. 무료 개방 시간대 있음.",
  directions: "6호선 월드컵경기장역 1번 출구에서 도보 8분",
  keywords: ["마포", "야외농구장", "즉시예약"],
  facilities: ["주차장", "화장실", "정수기"],
  parking: { available: true, fee: "paid", info: "구장 앞 공영주차장 · 시간당 1,000원" },
  rules: "야외 코트 · 우천 시 이용 불가 · 쓰레기 되가져가기",
  refundPolicy: "우천 예보 시 시작 2시간 전까지 연락 주시면 전액 환불",
  // 코트마다 사진·소개가 다른 구장 — 사용자 상세에서 "A와 B가 뭐가 다른지" 카드로 비교되는지 본다.
  // (운영 DB의 코트 26개는 전부 사진 0장이라, 이 경우의 수는 목업으로만 볼 수 있다)
  courts: [
    {
      id: "court_a", name: "1번 코트", type: "outdoor", surface: "아스팔트",
      description: "정규 코트 1면. 야간 조명이 밝아 밤 경기에 좋아요.",
      pricePerHour: 25000, slotMinutes: 60, openTime: "06:00", closeTime: "22:00",
      photos: ["/landing/assets/story-match.jpg", "/landing/assets/story-level.jpg"],
      notices: [
        { id: "nt_v2a1", pinned: true, title: "우천 시 취소 안내", body: "야외 코트라 비가 오면 이용이 어렵습니다. 강우 예보 시 시작 2시간 전까지 연락 주시면 전액 환불해 드려요." },
        { id: "nt_v2a2", title: "야간 조명", body: "일몰 후에는 조명이 자동으로 켜집니다. 별도 요금은 없어요." },
      ],
      cautions: ["코트 옆이 주택가입니다. 오후 10시 이후 큰 소리는 삼가주세요."],
    },
    {
      id: "court_b", name: "2번 코트", type: "outdoor", surface: "우레탄",
      description: "3대3 하프코트. 바닥이 새로 깔려 무릎 부담이 적어요.",
      pricePerHour: 18000, slotMinutes: 60, openTime: "06:00", closeTime: "22:00",
      photos: ["/landing/assets/story-record.jpg"],
      cautions: ["하프코트라 5대5 경기는 어렵습니다."],
    },
    // 1인 요금제 코트 — 인원 스테퍼·"최소 인원" 안내처럼 코트 대관에는 없는 화면이 나온다.
    {
      id: "court_c", name: "3번 코트 (개인 참가)", type: "outdoor", surface: "우레탄",
      description: "혼자 와도 뛸 수 있는 개방 코트. 인원수만큼만 내고 참여합니다.",
      priceMode: "perPerson", pricePerPerson: 6000, minHeadcount: 4, maxHeadcount: 12,
      slotMinutes: 60, openTime: "06:00", closeTime: "22:00",
      photos: ["/landing/assets/story-venue.jpg"],
      notices: [{ id: "nt_v2c1", title: "개인 참가 방식", body: "현장에서 팀을 나눠 진행합니다. 최소 4명이 모여야 진행돼요." }],
      cautions: ["최소 인원(4명)에 미달해도 4명 요금이 부과됩니다."],
    },
  ],
  rating: 4.0,
  reviewCount: 1,
};

const MOCK_VENUE_DOCS = { mock_venue: VENUE_RAW, mock_venue2: VENUE2_RAW };

// 구장 리뷰(venueReviews) — 상세 하단 리뷰 섹션이 비어 보이면 "리뷰가 붙는 자리"를 검수할 수 없다.
// listVenueReviews 가 venueId 로 거르므로 두 구장 것을 한 배열에 같이 둔다.
const MOCK_VENUE_REVIEWS = [
  { id: "rv1", venueId: "mock_venue", uid: "mock_uid_1", userName: "한강슬램 김민준", rating: 5,
    text: "바닥이랑 조명 상태가 정말 좋아요. 전광판까지 빌려줘서 시합처럼 뛰었습니다. 주차도 편했어요.", createdAt: ts("2026-07-25T21:10:00+09:00") },
  { id: "rv2", venueId: "mock_venue", uid: "mock_uid_2", userName: "이도현", rating: 4,
    text: "샤워실이 깨끗합니다. 다만 주말 저녁은 예약이 금방 차서 일찍 잡아야 해요.", createdAt: ts("2026-07-28T20:02:00+09:00") },
  { id: "rv3", venueId: "mock_venue", uid: "mock_uid_3", userName: "회원", rating: 5,
    text: "사장님이 친절하시고 시간 여유 있게 쓰게 해주셨어요.", createdAt: ts("2026-07-19T19:40:00+09:00") },
  { id: "rv4", venueId: "mock_venue2", uid: "mock_uid_4", userName: "박서준", rating: 4,
    text: "야외라 날씨 영향은 있지만 조명이 밝아서 밤에도 잘 보입니다.", createdAt: ts("2026-07-22T22:15:00+09:00") },
];

const resvRaw = (over) => ({
  venueId: "mock_venue",
  courtId: "court_a",
  ownerUid: "mock_uid_owner",
  courtName: "A코트",
  venueName: "용산 더베이스 농구장",
  venuePhone: "02-1234-5678",
  reservationCode: resvCode(GAME_YMD, "001"),
  date: GAME_YMD,
  startTime: "19:00",
  endTime: "21:00",
  userId: MY_UID,
  userName: "리뷰데모",
  teamName: "팀청춘",
  phone: "010-1234-5678",
  price: 80000,
  // 결제 화면이 "40,000원 × 2시간" 내역을 그리는 근거 — 예약 시 실제로 저장하는 필드다(bookVenue).
  unitPrice: 40000,
  priceMode: "hourly",
  headcount: 0,
  status: "requested",
  source: "app",
  userNote: "농구공 2개 대여 가능할까요?",
  createdAt: T.createdAt,
  ...over,
});

// 사용자 관점(내 구장 예약) + 구장주 관점(예약관리·매출) 공용.
// 끝난 예약은 monthPastYmd 로 "이번 달의 지난 날"에 둔다 — 구장주 매출/가동률이 이번 달만 집계한다.
// 앞으로의 예약은 오늘 기준 상대일이다(고정 날짜는 그 날이 지나면 목록에서 사라진다).
const R_DONE = [2, 4, 6, 8, 10].map(monthPastYmd);
const R_CANCELLED = monthPastYmd(9);
const R_NOSHOW = monthPastYmd(3);
const R_UPCOMING = dayOffsetYmd(2);
const MOCK_RESERVATION_DOCS = {
  // 다가오는 예약 (승인 대기 / 확정) — 확정된 그 경기와 같은 날이다
  mock_reservation: resvRaw({ status: "requested" }),
  mock_resv_confirmed: resvRaw({ reservationCode: resvCode(GAME_YMD, "002"), status: "confirmed", startTime: "21:00", endTime: "23:00", ownerNote: "주차는 지하 1층을 이용해 주세요." }),
  // 이번 달 이용 완료 — 매출·가동률 집계 대상
  mock_resv_done1: resvRaw({ reservationCode: resvCode(R_DONE[0], "011"), status: "done", date: R_DONE[0], startTime: "19:00", endTime: "21:00" }),
  mock_resv_done2: resvRaw({ reservationCode: resvCode(R_DONE[1], "012"), status: "done", date: R_DONE[1], startTime: "20:00", endTime: "22:00", courtId: "court_b", courtName: "B코트", price: 70000 }),
  mock_resv_done3: resvRaw({ reservationCode: resvCode(R_DONE[2], "013"), status: "done", date: R_DONE[2], startTime: "19:00", endTime: "21:00" }),
  mock_resv_done4: resvRaw({ reservationCode: resvCode(R_DONE[3], "014"), status: "done", date: R_DONE[3], startTime: "18:00", endTime: "20:00", userName: "이준서", teamName: "팀청춘" }),
  mock_resv_done5: resvRaw({ reservationCode: resvCode(R_DONE[4], "015"), status: "done", date: R_DONE[4], startTime: "21:00", endTime: "23:00", courtId: "court_b", courtName: "B코트", price: 70000 }),
  mock_resv_conf6: resvRaw({ reservationCode: resvCode(R_UPCOMING, "016"), status: "confirmed", date: R_UPCOMING, startTime: "20:00", endTime: "22:00" }),
  // 취소 / 노쇼 — 취소·노쇼 카운터 확인용
  mock_resv_cancelled: resvRaw({ reservationCode: resvCode(R_CANCELLED, "003"), status: "cancelled", date: R_CANCELLED }),
  mock_resv_noshow: resvRaw({ reservationCode: resvCode(R_NOSHOW, "017"), status: "noshow", date: R_NOSHOW, startTime: "19:00", endTime: "21:00" }),
};

// 결제 원장(payments) — 어드민 정산·구장주 매출 화면이 집계하는 단일 진실.
// functions/payments/toss.js 의 resolveShare()·computeRefundLedger() 와 같은 식이어야 한다.
//   amount(결제액) = 예약가 그대로 · platformFee = round(amount × 요율) · venueAmount = amount - platformFee
//   refundedVenueAmount = 구장 몫을 환불 비율만큼 깎은 값 (전액취소면 구장 몫 전부)
//   netVenueAmount = venueAmount - refundedVenueAmount ← 정산은 항상 이 값을 더한다
//
// ⚠️ 예전 픽스처는 venueAmount 를 기준으로 잡고 amount = venueAmount + fee 로 얹었다
//    (2026-08-02 이전의 "사용자 가산" 모델). 그대로 두면 매출·정산 화면의 결제액이
//    실제보다 5% 부풀고, venueAmount + platformFee = amount 항등식도 깨진다.
const PLATFORM_FEE_RATE = 0.05;
const payRaw = (over = {}) => {
  const { amount: amt, refundedAmount: refunded, ...rest } = over;
  const amount = amt ?? 80000; // 실제 결제액 = 예약 문서의 price(또는 분담결제의 shareA/B)
  const platformFee = amount > 0 ? Math.round(amount * PLATFORM_FEE_RATE) : 0;
  const venueAmount = amount - platformFee; // 뺄셈으로 구한다 — 항등식이 1원도 안 어긋나게
  const refundedAmount = refunded ?? 0;     // 사용자에게 돌려준 결제액
  const fullyCancelled = amount > 0 && refundedAmount >= amount;
  const refundedVenueAmount = refundedAmount <= 0
    ? 0
    : fullyCancelled
      ? venueAmount
      : Math.round((venueAmount * refundedAmount) / amount);
  return {
    venueId: "mock_venue",
    venueName: "용산 더베이스 농구장",
    ownerUid: "mock_uid_owner",
    uid: MY_UID,
    side: "SINGLE",
    matchId: "",
    status: "DONE",
    method: "카드",
    feeRate: PLATFORM_FEE_RATE,
    amount,
    platformFee,
    venueAmount,
    refundedAmount,
    refundedVenueAmount,
    netVenueAmount: Math.max(0, venueAmount - refundedVenueAmount),
    cancelled: fullyCancelled,
    payoutId: "",
    settled: false,
    ...rest,
  };
};

const MOCK_PAYMENT_DOCS = {
  // 이용 완료 · 미지급 — "미지급액"에 잡힌다
  mock_pay_1: payRaw({ reservationId: "mock_resv_done1", reservationDate: R_DONE[0] }),
  mock_pay_2: payRaw({ reservationId: "mock_resv_done2", reservationDate: R_DONE[1], amount: 70000 }),
  // 부분환불 — 결제 80,000 중 30,000 환불 → 구장 몫도 같은 비율로 깎여 정산은 47,500
  mock_pay_3: payRaw({ reservationId: "mock_resv_done3", reservationDate: R_DONE[2], refundedAmount: 30000 }),
  // 분담결제 — 한 예약에 결제 2건(A/B). 각자 총액의 절반을 낸다
  mock_pay_4a: payRaw({ reservationId: "mock_resv_done4", reservationDate: R_DONE[3], side: "A", matchId: "mock_room", amount: 40000 }),
  mock_pay_4b: payRaw({ reservationId: "mock_resv_done4", reservationDate: R_DONE[3], side: "B", matchId: "mock_room", amount: 40000 }),
  // 지급 완료
  mock_pay_5: payRaw({ reservationId: "mock_resv_done5", reservationDate: R_DONE[4], amount: 70000, settled: true }),
  // 전액 환불 — 구장 몫이 0 이 되어 지급 대상에서 아예 빠진다
  mock_pay_6: payRaw({ reservationId: "mock_resv_cancelled", reservationDate: R_CANCELLED, refundedAmount: 80000 }),
  // 아직 이용 전 — 구장주 화면에서 "정산 예정"
  mock_pay_7: payRaw({ reservationId: "mock_resv_confirmed", reservationDate: GAME_YMD }),
};

// 토스 위젯 주문 — 서버(createTossOrder)가 확정하는 값을 그 형태 그대로 준다.
// 규약: amount = venueAmount + platformFee (platformFee = venueAmount * PLATFORM_FEE_RATE 0.05)
// 이 필드를 안 채우면 결제화면 내역이 "구장 이용료 0원 / 플랫폼 이용료 0원 / 결제 80,000원" 으로 어긋난다.
// 서버(functions/payments/toss.js)의 계산과 같은 식이어야 한다:
//   amount(결제액) = 예약가 그대로 · platformFee = 결제액 × 요율 · venueAmount = amount - platformFee
// 예전 픽스처는 amount 를 venueAmount + platformFee 로 잡아, 예약가 80,000원짜리 예약의
// 결제 화면에 84,000원이 찍혔다(사용자에게 수수료를 얹어 받는 것처럼 보인다).
const MOCK_TOSS_ORDER = (() => {
  const amount = 80000; // 예약 문서의 price 와 같아야 한다
  const feeRate = 0.05;
  const platformFee = Math.round(amount * feeRate);
  return {
    orderId: "mock_order_20260802_001",
    orderName: `용산 더베이스 농구장 A코트 (${GAME_SHORT} 19:00~21:00)`,
    side: "SINGLE",
    venueAmount: amount - platformFee,
    platformFee,
    amount,
    feeRate,
    customerName: "리뷰데모",
  };
})();

/* ── 커뮤니티 ──────────────────────────────────────────────
 * loadCommunityList / loadCommunityPostDetail 은 작성자 메타·차단목록까지 조립하므로
 * 최종 뷰모델을 그대로 준다(형태는 위 서비스 반환부와 1:1). */
// 커뮤니티 뷰모델의 표시용 시각 — ts()/iso() 와 같은 축으로 당겨야 글 목록만 과거에 남지 않는다.
const kst = (iso) => {
  const d = shifted(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const kstMs = (iso) => shifted(iso).getTime();

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
    body: `한강 슬램이 ${GAME_LONG} 오후 7:00 · 용산 더베이스 농구장을 제안했어요. 확인하고 수락해 주세요.`,
    linkType: "match", linkTargetId: "mock_room", meta: { matchId: "mock_room", deepLink: "/match-roomdetail/mock_room" },
    at: "2026-07-22T09:10:00+09:00", read: false }),
  notiDoc({ id: "mock_noti_2", kind: "match", subType: "match_accepted", title: "매칭이 성사됐어요",
    body: "한강 슬램이 매칭 요청을 수락했어요. 이제 구장과 일정을 정해보세요.",
    linkType: "match", linkTargetId: "mock_room", meta: { matchId: "mock_room" },
    at: "2026-07-21T14:30:00+09:00", read: false }),
  notiDoc({ id: "mock_noti_3", kind: "reservation", subType: "reservation_requested", title: "예약 신청이 접수됐어요",
    body: `용산 더베이스 농구장 A코트 · ${GAME_SHORT} 19:00~21:00 · 구장 승인을 기다리고 있어요.`,
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
      confirmedAt: T.confirmedAt, scheduledAt: dayOffsetAt(12, 20), field: FIELD,
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
      scheduledAt: dayOffsetAt(-9, 19), field: FIELD,
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
  msg("c4", OPP_LEADER_UID, "혹시 편하신 날짜 있으실까요?", "2026-07-21T14:36:00+09:00"),
  msg("c5", MY_UID, `${GAME_LONG} 저녁 7시 어떠세요? 용산 더베이스 잡아볼게요.`, "2026-07-21T14:40:00+09:00"),
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
  msg("c8", "system", `경기 일정이 확정되었어요. ${GAME_LONG} 오후 7:00 · 용산 더베이스 농구장`, "2026-07-22T18:40:00+09:00", { kind: "system" }),
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
    reason: "경기 중 욕설", status: "reviewing", createdAt: shifted("2026-07-24T20:10:00+09:00") },
  { id: "mock_rep_2", type: "player", targetId: "mock_p_o4", targetName: "한동윤",
    reason: "노쇼", status: "resolved", createdAt: shifted("2026-07-14T09:00:00+09:00") },
];
const MOCK_MY_TEAM_REPORTS = [
  { id: "mock_trep_1", type: "team", targetId: "mock_club_d", targetName: "노원 덩커스",
    reason: "확정 경기 반복 취소", status: "pending", createdAt: shifted("2026-07-26T13:20:00+09:00") },
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
  m4: { chatId: "match_mock_room", fromUid: MY_UID, kind: "text", text: `${GAME_LONG} 저녁 7시 어떠세요?`, images: [], createdAt: ts("2026-07-21T14:40:00+09:00") },
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
  venueReviewDocs: MOCK_VENUE_REVIEWS,
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
  // 계정 찾기로 임시 비밀번호를 받은 상태 — 서버가 mustChangePassword 를 세운다.
  // 다른 게이트보다 앞이라(RequireAuth 안) /home 으로 들어가면 비밀번호 변경 화면이 뜬다.
  "gate-password": {
    label: "게이트 · 임시 비밀번호(변경 강제)",
    extends: "base-leader",
    data: {
      auth: {
        firebaseUser: { uid: MY_UID, email: MOCK_USER_DOC.email, displayName: "신규" },
        userDoc: { ...MOCK_USER_DOC, mustChangePassword: true },
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
        mock_resv_req2: resvRaw({ reservationCode: resvCode(dayOffsetYmd(1), "021"), status: "requested", date: dayOffsetYmd(1), startTime: "18:00", endTime: "20:00", userName: "이준서", userNote: "" }),
        mock_resv_req3: resvRaw({ reservationCode: resvCode(dayOffsetYmd(3), "022"), status: "requested", date: dayOffsetYmd(3), startTime: "20:00", endTime: "22:00", courtId: "court_b", courtName: "B코트", price: 70000, userName: "송지호", userNote: "샤워실 이용 가능한가요?" }),
      },
    },
  },
  "owner-quiet": {
    label: "구장주 · 예약 없음",
    extends: "base-owner",
    data: { venueReservationDocs: {} },
  },

  /* 예약 상세 시트를 열어보기 위한 시나리오 — 확정 1건 + 승인대기 1건을 앞으로 다가올 날짜로 둔다.
     기본 픽스처의 확정 건은 날짜가 고정이라 지나가면 목록에서 빠져 시트를 열 수 없다. */
  "owner-resv-detail": {
    label: "구장주 · 예약 상세(확정)",
    extends: "base-owner",
    data: {
      venueReservationDocs: {
        mock_resv_up1: resvRaw({
          reservationCode: "HM-UP-0031",
          status: "confirmed",
          // 오늘자로 둬야 예약관리 첫 화면("오늘")에서 바로 눌러 상세를 열 수 있다
          date: dayOffsetYmd(0),
          startTime: "19:00",
          endTime: "21:00",
          ownerNote: "주차는 지하 1층을 이용해 주세요.",
          userNote: "농구공 2개 대여 가능할까요?",
        }),
        mock_resv_up2: resvRaw({
          reservationCode: "HM-UP-0032",
          status: "requested",
          date: dayOffsetYmd(4),
          startTime: "20:00",
          endTime: "22:00",
          courtId: "court_b",
          courtName: "B코트",
          price: 70000,
          userName: "송지호",
          userNote: "샤워실 이용 가능한가요?",
        }),
      },
    },
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
        // 실제 문서의 result 모양 — submitMatchResultWithMedia 가 쓰는 필드와 같아야
        // 화면의 "결과 입력(작성자·시각)" 표시가 실제와 같이 나온다.
        result: {
          submittedByClubId: OPP_CLUB,
          authorUid: OPP_LEADER_UID,
          authorName: OPP_TEAM_SNAP.name,
          authorRole: "owner",
          comment: "",
          photoUrls: [],
          submittedAt: tsAbs(dayOffsetAt(-4, 22)),
        },
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
        statsAppliedAt: tsAbs(dayOffsetAt(-4, 10)),
        result: {
          submittedByClubId: MY_CLUB,
          authorUid: MY_UID,
          authorName: MY_TEAM_SNAP.name,
          authorRole: "owner",
          comment: "좋은 경기였습니다!",
          photoUrls: [],
          submittedAt: tsAbs(dayOffsetAt(-5, 21)),
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
        acceptedAt: T.acceptedAt,
        confirmedAt: T.confirmedAt,
        scheduledAt: T.scheduledAt,
        field: FIELD,
        cancelledByClubId: OPP_CLUB,
        // 실제 문서와 같은 키를 써야 한다 — MATCH_CANCEL_REASONS 밖의 키를 넣으면
        // 라벨 조회가 빗나가 화면에서만 사유가 다르게 보인다.
        cancelReasonKey: "shortage",
        cancelReasonText: "부상자가 겹쳐 5명을 못 채웠어요. 다음에 꼭 다시 붙어요!",
        cancelReason: "팀원이 부족해요 · 부상자가 겹쳐 5명을 못 채웠어요. 다음에 꼭 다시 붙어요!",
        cancelledAt: tsAbs(dayOffsetAt(-1, 11)), // 경기 6일 전에 취소 → 전액 환불 구간

        // releasePartnerReservationOnCancel 이 남기는 실제 모양
        refund: {
          status: "pending",
          amount: 80000,
          breakdown: [
            { team: "A", uid: MY_UID, amount: 40000 },
            { team: "B", uid: "mock_u_opp_leader", amount: 40000 },
          ],
        },
        partnerBooking: {
          venueId: "mock_venue_1",
          venueName: "용산 더베이스 농구장",
          courtName: "A코트",
          date: GAME_YMD,
          startTime: "19:00",
          endTime: "21:00",
          totalPrice: 80000,
          shareA: 40000,
          shareB: 40000,
          proposerClubId: MY_CLUB,
          proposerTeamName: MY_TEAM_SNAP.name,
          opponentClubId: OPP_CLUB,
          opponentTeamName: OPP_TEAM_SNAP.name,
          reservationCode: "HM-260802-011",
          finalized: true,
        },
      }),
      matchReviews: [],
      chatMessages: CHAT_CONFIRMED,
      chatRoom: { ...CHAT_ROOM, locked: true },
      matchReservation: null,
    },
  },

  /* 같은 취소 화면의 반대편 — 우리 팀이 임박해서 취소한 경우.
   * 취소 시점(하루 전)에 따라 위약금이 공제되고 규정 표에서 해당 줄이 강조된다. */
  "match-cancelled-mine": {
    label: "매치룸 · 취소됨(우리팀·위약금)",
    extends: "base-leader",
    data: {
      matchRequestDoc: matchDoc({
        status: "cancelled",
        proposedByClubId: MY_CLUB,
        confirmedByClubId: OPP_CLUB,
        acceptedAt: T.acceptedAt,
        confirmedAt: T.confirmedAt,
        scheduledAt: dayOffsetAt(-2, 19), // 이틀 전에 열릴 예정이던 경기
        field: FIELD,
        cancelledByClubId: MY_CLUB,
        cancelReasonKey: "etc",
        cancelReasonText: "주장이 갑자기 출장을 가게 됐어요. 죄송합니다.",
        cancelReason: "기타(직접 입력) · 주장이 갑자기 출장을 가게 됐어요. 죄송합니다.",
        cancelledAt: tsAbs(dayOffsetAt(-3, 20)), // 경기 하루 전 취소 → 50% 환불 구간
        refund: {
          status: "pending",
          amount: 80000,
          breakdown: [
            { team: "A", uid: MY_UID, amount: 40000 },
            { team: "B", uid: "mock_u_opp_leader", amount: 40000 },
          ],
        },
        partnerBooking: {
          venueId: "mock_venue_1",
          venueName: "용산 더베이스 농구장",
          courtName: "A코트",
          date: GAME_YMD,
          startTime: "19:00",
          endTime: "21:00",
          totalPrice: 80000,
          shareA: 40000,
          shareB: 40000,
          proposerClubId: MY_CLUB,
          proposerTeamName: MY_TEAM_SNAP.name,
          opponentClubId: OPP_CLUB,
          opponentTeamName: OPP_TEAM_SNAP.name,
          reservationCode: "HM-260802-011",
          finalized: true,
        },
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
        orderName: `용산 더베이스 농구장 A코트 (${GAME_SHORT} 19:00~21:00) · 우리 팀 몫`,
        side: "A",
        // 총액 80,000원의 절반이 우리 팀 몫 → 결제액 40,000원, 이용료는 그 안에서 뗀다
        amount: 40000,
        platformFee: 2000,
        venueAmount: 38000,
        reservationStatus: "pending",
        matchId: "mock_room",
      },
      // 분담결제 화면은 예약 문서에서 총액·두 팀 이름을 읽는다 — 없으면 "구장 총 이용료 0원"·"vs" 만 남는다.
      venueReservationDocs: {
        ...MOCK_RESERVATION_DOCS,
        mock_reservation: {
          ...MOCK_RESERVATION_DOCS.mock_reservation,
          matchId: "mock_room",
          splitTotal: 80000,
          teamAName: "팀청춘",
          teamBName: "한강슬램",
          // 결제 결과 화면이 "상대 팀 결제 마감 · 8월 12일 (수) 19:29" 로 읽어간다.
          // 서버가 먼저 낸 팀 기준으로 2시간을 거는 값(PARTNER_PAY_WINDOW_MS)과 같은 성격이라
          // 고정 날짜가 아니라 지금 기준이어야 한다.
          paymentDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        },
      },
    },
  },
  // 매칭 제휴구장 예약이 승인돼 결제만 남은 상태. 팀장이 내는 돈은 총 대관료(8만)가 아니라
  // 우리 팀 몫(4만)이다 — 목록이 총액만 보여주면 결제 화면에서 금액이 달라져 보인다.
  "resv-match-pending": {
    label: "내 예약 · 매칭 분담(결제 대기)",
    extends: "base-leader",
    data: {
      venueReservationDocs: {
        mock_resv_match: {
          ...MOCK_RESERVATION_DOCS.mock_reservation,
          status: "pending",
          matchId: "mock_room",
          splitTotal: 80000,
          shareA: 40000,
          shareB: 40000,
          teamAName: "팀청춘",
          teamBName: "한강슬램",
          teamALeaderUid: MY_UID,
          teamBLeaderUid: "mock_u_opp_leader",
        },
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
