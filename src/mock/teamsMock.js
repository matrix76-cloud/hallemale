// src/mock/teamsMock.js
/* eslint-disable */

/**
 * DB 스키마 정렬 버전
 *
 * clubs 컬렉션과 users 컬렉션 구조에 최대한 맞춘 Team/Player 뷰 모델
 *
 * TeamView {
 *   clubId: string;                  // = clubs 문서 ID
 *   name: string;                    // clubs.name
 *   region: string;                  // clubs.region
 *   description?: string;            // clubs.description
 *   photoUrl?: string | null;        // clubs.photoUrl
 *   logoKey?: string;                // 프론트 전용(이미지 매핑용)
 *   stats: {
 *     totalMatches: number;          // clubs.stats.totalMatches
 *     wins: number;                  // clubs.stats.wins
 *     losses: number;                // clubs.stats.losses
 *     draws: number;                 // clubs.stats.draws
 *     winRate: number;               // clubs.stats.winRate
 *   };
 *   streak?: {
 *     type: "WIN" | "LOSE";          // 연승/연패 종류 (UI용)
 *     count: number;                 // 연승/연패 수
 *   };
 *   tags: string[];                  // UI 태그
 *   players: PlayerView[];           // users + clubMembers 조합 뷰
 * }
 *
 * PlayerView {
 *   userId: string;                  // users 문서 ID
 *   nickname: string;                // users.nickname
 *   photoUrl?: string | null;        // users.photoUrl
 *   birthYear?: number | null;       // users.birthYear
 *   heightCm?: number | null;        // users.heightCm
 *   weightKg?: number | null;        // users.weightKg
 *   mainPosition?: "guard" | "forward" | "center" | null; // users.mainPosition
 *   skillLevel?:
 *     | "beginner"
 *     | "amateur"
 *     | "intermediate"
 *     | "advanced"
 *     | "pro"
 *     | null;                       // users.skillLevel
 *   careerText?: string | null;      // users.careerText
 * }
 */

export const TEAMS = [
  {
    clubId: "cheongcho_tigers",
    name: "청춘호랑이",
    region: "서울 강동구",
    description: "친구/동호회 팀 만들어 경기 한판",
    photoUrl: null, // 실제 연동 시 clubs.photoUrl
    logoKey: "logo_cheongcho_tigers",
    tags: ["#20대", "#매운", "#주말모임"],
    stats: {
      totalMatches: 32,
      wins: 24,
      losses: 8,
      draws: 0,
      winRate: 0.75,
    },
    streak: {
      type: "LOSE",
      count: 2,
    },
    players: [
      {
        userId: "user_cheongcho_han_juseong",
        nickname: "한주성",
        photoUrl: null,
        birthYear: 2002,
        heightCm: 185,
        weightKg: 73,
        mainPosition: "center",
        skillLevel: "pro",
        careerText: "KBL 1군 대회 1등 프로선수 출신",
      },
      {
        userId: "user_cheongcho_moon_gyeongbin",
        nickname: "문경빈",
        photoUrl: null,
        birthYear: 2002,
        heightCm: 178,
        weightKg: 71,
        mainPosition: "guard",
        skillLevel: "intermediate",
        careerText: "대학 농구 동아리팀 출신",
      },
      {
        userId: "user_cheongcho_kim_minjun",
        nickname: "김민준",
        photoUrl: null,
        birthYear: 2002,
        heightCm: 175,
        weightKg: 73,
        mainPosition: "guard",
        skillLevel: "beginner",
        careerText: "경력 없음",
      },
      {
        userId: "user_cheongcho_kim_giyong",
        nickname: "김기용",
        photoUrl: null,
        birthYear: 2002,
        heightCm: 180,
        weightKg: 75,
        mainPosition: "forward",
        skillLevel: "amateur",
        careerText: "경력 없음",
      },
      {
        userId: "user_cheongcho_lee_seonwoo",
        nickname: "이선우",
        photoUrl: null,
        birthYear: 2002,
        heightCm: 184,
        weightKg: 76,
        mainPosition: "forward",
        skillLevel: "intermediate",
        careerText: "농구 동호회 대회 및 각종 대회 경험",
      },
    ],
  },
  {
    clubId: "deokso_eagles",
    name: "덕소독수리",
    region: "경기 남양주 덕소",
    description: "연습은 독하게, 경기는 부드럽게",
    photoUrl: null,
    logoKey: "logo_deokso_eagles",
    tags: ["#경기도", "#20대초반", "#공격농구"],
    stats: {
      totalMatches: 28,
      wins: 20,
      losses: 8,
      draws: 0,
      winRate: 0.71,
    },
    streak: {
      type: "WIN",
      count: 3,
    },
    players: [
      {
        userId: "user_deokso_kim_doyun",
        nickname: "김도윤",
        photoUrl: null,
        birthYear: 2003,
        heightCm: 185,
        weightKg: 78,
        mainPosition: "center",
        skillLevel: "intermediate",
        careerText: "농구 동호회 대회 및 각종 대회 경험",
      },
      {
        userId: "user_deokso_kim_dongcheon",
        nickname: "김동천",
        photoUrl: null,
        birthYear: 2003,
        heightCm: 175,
        weightKg: 77,
        mainPosition: "guard",
        skillLevel: "advanced",
        careerText: "농구 동호회 대회 및 각종 대회 우승 경험",
      },
      {
        userId: "user_deokso_jeong_hwan",
        nickname: "정환",
        photoUrl: null,
        birthYear: 2003,
        heightCm: 175,
        weightKg: 73,
        mainPosition: "guard",
        skillLevel: "pro",
        careerText: "KBL 2군 출신",
      },
      {
        userId: "user_deokso_byun_yumin",
        nickname: "변유민",
        photoUrl: null,
        birthYear: 2003,
        heightCm: 182,
        weightKg: 79,
        mainPosition: "forward",
        skillLevel: "amateur",
        careerText: "경력 없음",
      },
      {
        userId: "user_deokso_kwon_hyeokju",
        nickname: "권혁주",
        photoUrl: null,
        birthYear: 2003,
        heightCm: 181,
        weightKg: 79,
        mainPosition: "forward",
        skillLevel: "beginner",
        careerText: "경력 없음",
      },
    ],
  },
  {
    clubId: "li_lion",
    name: "LI이언",
    region: "서울 마포구",
    description: "라이언처럼 포효하는 공격 농구",
    photoUrl: null,
    logoKey: "logo_li_lion",
    tags: ["#실업출신", "#강스쿼드"],
    stats: {
      totalMatches: 24,
      wins: 19,
      losses: 5,
      draws: 0,
      winRate: 0.79,
    },
    streak: {
      type: "WIN",
      count: 4,
    },
    players: [
      {
        userId: "user_lion_nam_hyoseung",
        nickname: "남효승",
        photoUrl: null,
        birthYear: 2000,
        heightCm: 183,
        weightKg: 83,
        mainPosition: "center",
        skillLevel: "pro",
        careerText: "실업팀 출신",
      },
      {
        userId: "user_lion_lee_sangjun",
        nickname: "이상준",
        photoUrl: null,
        birthYear: 2000,
        heightCm: 181,
        weightKg: 73,
        mainPosition: "guard",
        skillLevel: "pro",
        careerText: "해외 트라이아웃 경험",
      },
      {
        userId: "user_lion_seo_jun",
        nickname: "서준",
        photoUrl: null,
        birthYear: 2000,
        heightCm: 175,
        weightKg: 81,
        mainPosition: "guard",
        skillLevel: "amateur",
        careerText: "경력 없음",
      },
      {
        userId: "user_lion_oh_seungeob",
        nickname: "오승엽",
        photoUrl: null,
        birthYear: 2000,
        heightCm: 173,
        weightKg: 73,
        mainPosition: "forward",
        skillLevel: "amateur",
        careerText: "경력 없음",
      },
      {
        userId: "user_lion_shin_jongmin",
        nickname: "신종민",
        photoUrl: null,
        birthYear: 2000,
        heightCm: 175,
        weightKg: 79,
        mainPosition: "forward",
        skillLevel: "intermediate",
        careerText: "농구 동호회 대회 및 각종 대회 경험",
      },
    ],
  },
  {
    clubId: "shinchon_sharks",
    name: "신촌샤크",
    region: "서울 서대문구 신촌",
    description: "대학가 감성, 빠른 트랜지션 공격",
    photoUrl: null,
    logoKey: "logo_shinchon_sharks",
    tags: ["#신촌", "#대학생팀", "#하프코트"],
    stats: {
      totalMatches: 18,
      wins: 11,
      losses: 7,
      draws: 0,
      winRate: 0.61,
    },
    streak: {
      type: "WIN",
      count: 1,
    },
    players: [
      {
        userId: "user_shinchon_park_junyoung",
        nickname: "박준영",
        photoUrl: null,
        birthYear: 2003,
        heightCm: 182,
        weightKg: 78,
        mainPosition: "center",
        skillLevel: "intermediate",
        careerText: "대학 농구 동아리",
      },
      {
        userId: "user_shinchon_lee_jaehun",
        nickname: "이재훈",
        photoUrl: null,
        birthYear: 2003,
        heightCm: 177,
        weightKg: 70,
        mainPosition: "guard",
        skillLevel: "advanced",
        careerText: "대학 리그 경험",
      },
      {
        userId: "user_shinchon_kim_hayoung",
        nickname: "김하영",
        photoUrl: null,
        birthYear: 2004,
        heightCm: 173,
        weightKg: 66,
        mainPosition: "guard",
        skillLevel: "intermediate",
        careerText: "아마추어 대회 출전 경험",
      },
      {
        userId: "user_shinchon_choi_minhyuk",
        nickname: "최민혁",
        photoUrl: null,
        birthYear: 2002,
        heightCm: 185,
        weightKg: 82,
        mainPosition: "forward",
        skillLevel: "amateur",
        careerText: "경력 없음",
      },
      {
        userId: "user_shinchon_jung_nayeon",
        nickname: "정나연",
        photoUrl: null,
        birthYear: 2004,
        heightCm: 170,
        weightKg: 60,
        mainPosition: "forward",
        skillLevel: "beginner",
        careerText: "학교 코트에서 취미 경기",
      },
    ],
  },
  {
    clubId: "hangang_bulldogs",
    name: "한강불독",
    region: "서울 영등포구 여의도",
    description: "피지컬로 밀어붙이는 빅맨 농구",
    photoUrl: null,
    logoKey: "logo_hangang_bulldogs",
    tags: ["#직장인팀", "#야간연습", "#한강뷰"],
    stats: {
      totalMatches: 20,
      wins: 9,
      losses: 11,
      draws: 0,
      winRate: 0.45,
    },
    streak: {
      type: "WIN",
      count: 2,
    },
    players: [
      {
        userId: "user_bulldogs_kang_taehyun",
        nickname: "강태현",
        photoUrl: null,
        birthYear: 1996,
        heightCm: 190,
        weightKg: 92,
        mainPosition: "center",
        skillLevel: "intermediate",
        careerText: "직장인 리그 경험",
      },
      {
        userId: "user_bulldogs_yoon_sungmin",
        nickname: "윤성민",
        photoUrl: null,
        birthYear: 1997,
        heightCm: 183,
        weightKg: 80,
        mainPosition: "forward",
        skillLevel: "advanced",
        careerText: "동호회 상위 리그",
      },
      {
        userId: "user_bulldogs_han_jiyoon",
        nickname: "한지윤",
        photoUrl: null,
        birthYear: 1998,
        heightCm: 176,
        weightKg: 68,
        mainPosition: "guard",
        skillLevel: "intermediate",
        careerText: "동호회 대회 출전 경험",
      },
      {
        userId: "user_bulldogs_song_woojin",
        nickname: "송우진",
        photoUrl: null,
        birthYear: 1995,
        heightCm: 181,
        weightKg: 85,
        mainPosition: "forward",
        skillLevel: "amateur",
        careerText: "경력 없음",
      },
      {
        userId: "user_bulldogs_cho_minseo",
        nickname: "조민서",
        photoUrl: null,
        birthYear: 1999,
        heightCm: 174,
        weightKg: 67,
        mainPosition: "guard",
        skillLevel: "beginner",
        careerText: "친구들과 픽업 게임",
      },
    ],
  },
];

/* =========================
 * 연승 섹션 / 랭킹 섹션용 파생 데이터
 * ========================= */

// 연승팀 대결 신청하기 섹션
export const WINNING_TEAMS = TEAMS.filter(
  (t) => t.streak && t.streak.type === "WIN" && t.streak.count >= 2
).map((t) => ({
  clubId: t.clubId,
  name: t.name,
  logoKey: t.logoKey,
  region: t.region,
  streakLabel: `${t.streak.count}연승 중`,
  winRate: t.stats.winRate,
}));

// 전체 팀 랭킹 (승률 기준)
export const TEAM_RANKING = [...TEAMS]
  .sort((a, b) => b.stats.winRate - a.stats.winRate)
  .map((t, idx) => ({
    rank: idx + 1,
    clubId: t.clubId,
    name: t.name,
    logoKey: t.logoKey,
    region: t.region,
    winRate: t.stats.winRate,
    totalMatches: t.stats.totalMatches,
    wins: t.stats.wins,
    losses: t.stats.losses,
  }));
