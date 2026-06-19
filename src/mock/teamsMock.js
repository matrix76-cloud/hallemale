// src/mock/teamsMock.js
/* eslint-disable */
import { images } from "../utils/imageAssets";

/**
 * DB 스키마 정렬 버전
 *
 * clubs 컬렉션과 users 컬렉션 구조에 최대한 맞춘 Team/Player 뷰 모델
 *
 * TeamView {
 *   id: string;                     // = clubId (프론트 라우팅용)
 *   clubId: string;                 // = clubs 문서 ID
 *   name: string;                   // clubs.name
 *   region: string;                 // clubs.region
 *   description?: string;           // clubs.description
 *   photoUrl?: string | null;       // clubs.photoUrl
 *   logoKey?: string;               // 프론트 전용(이미지 매핑용)
 *   createdAt?: Date | string | number;
 *   updatedAt?: Date | string | number;
 *   stats: {
 *     totalMatches: number;
 *     wins: number;
 *     losses: number;
 *     draws: number;
 *     winRate: number;
 *     updatedAt?: Date | string | number;
 *   };
 *   streak?: {
 *     type: "WIN" | "LOSE";
 *     count: number;
 *   };
 *   // 매칭 화면용: 최근 3경기 결과
 *   recentResults?: ("win" | "lose" | "draw")[];
 *   tags: string[];
 *   players: PlayerView[];
 *   reviews?: TeamReview[];
 *   lineups?: TeamLineupView[];
 * }
 *
 * PlayerView {
 *   userId: string;                  // users 문서 ID
 *   nickname: string;                // users.nickname
 *   photoUrl?: string | null;        // users.photoUrl
 *   birthYear?: number | null;       // users.birthYear
 *   heightCm?: number | null;        // users.heightCm
 *   weightKg?: number | null;        // users.weightKg
 *   mainPosition?: "guard" | "forward" | "center" | null;
 *   skillLevel?:
 *     | "beginner"
 *     | "amateur"
 *     | "intermediate"
 *     | "advanced"
 *     | "pro"
 *     | null;
 *   careerText?: string | null;
 * }
 *
 * TeamReview {
 *   id: string;
 *   fromTeamId: string;
 *   fromTeamName: string;
 *   rating: number;          // 1~5
 *   commentShort?: string;
 *   comment?: string;
 *   createdAt?: string | number | Date;
 * }
 *
 * TeamLineupView {
 *   id: string;
 *   name: string;
 *   matchSizeKey: "3v3" | "4v4" | "5v5";
 *   captainId: string;        // userId
 *   memberIds: string[];      // userId[]
 *   // 매칭 화면 상단 "나의 라인업" 카드에서 사용하는 활동 지역 문구
 *   // 예) "서울시 성북구", "경기도 수원시"
 *   regionLabel?: string;
 * }
 */

export const TEAMS = [
  {
    id: "cheongcho_tigers",
    clubId: "cheongcho_tigers",
    name: "청춘호랑이",
    region: "서울 강동구",
    description: "친구/동호회 팀 만들어 경기 한판",
    photoUrl: null,
    logoKey: "logo_cheongcho_tigers",
    tags: ["#20대", "#매운", "#주말모임"],
    createdAt: "2025-10-10T10:00:00+09:00",
    updatedAt: "2025-11-01T10:00:00+09:00",

    activity: {
      regionLabel: "서울 강동구",
      daysLabel: "주말 위주",
      timeLabel: "오후 시간대",
    },

    recruiting: {
      isRecruiting: true,
      title: "중급 이상 선호, 누구나 환영",
      tags: ["모집중", "센터", "포워드"],
      description:
        "주말 위주로 함께 즐겁게 뛸 팀원을 찾고 있어요. 성실하게 나와주시는 분이면 실력은 상관없습니다.",
    },

    // 초상권: 실제 인물 경기 사진 제거. 미디어 없음(섹션 자연 숨김).
    media: [],

    stats: {
      totalMatches: 32,
      wins: 24,
      losses: 8,
      draws: 0,
      winRate: 0.75,
      updatedAt: "2025-11-01T10:00:00+09:00",
    },
    streak: {
      type: "WIN",
      count: 2,
    },
    recentResults: ["win", "win", "win", "lose"],

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

    lineups: [
      {
        id: "cheongcho_main",
        name: "청춘호랑이 주전 라인업",
        matchSizeKey: "5v5",
        captainId: "user_cheongcho_han_juseong",
        memberIds: [
          "user_cheongcho_han_juseong",
          "user_cheongcho_moon_gyeongbin",
          "user_cheongcho_kim_minjun",
          "user_cheongcho_kim_giyong",
          "user_cheongcho_lee_seonwoo",
        ],
        regionLabel: "서울시 성북구",
      },
      {
        id: "cheongcho_practice",
        name: "청춘호랑이 연습 라인업",
        matchSizeKey: "4v4",
        captainId: "user_cheongcho_moon_gyeongbin",
        memberIds: [
          "user_cheongcho_moon_gyeongbin",
          "user_cheongcho_kim_minjun",
          "user_cheongcho_kim_giyong",
          "user_cheongcho_lee_seonwoo",
        ],
        regionLabel: "경기도 수원시",
      },
      {
        id: "cheongcho_rookie",
        name: "루키 실험 라인업",
        matchSizeKey: "3v3",
        captainId: "user_cheongcho_kim_minjun",
        memberIds: [
          "user_cheongcho_kim_minjun",
          "user_cheongcho_kim_giyong",
          "user_cheongcho_lee_seonwoo",
        ],
      },
    ],

    reviews: [
      {
        id: "cheongcho_review_1",
        fromTeamId: "deokso_eagles",
        fromTeamName: "덕소독수리",
        rating: 4.8,
        commentShort:
          "속도 빠른 트랜지션 농구, 경기 내내 템포가 높아서 재밌었어요. 매너도 최고.",
        createdAt: "2025-10-20T20:00:00+09:00",
      },
      {
        id: "cheongcho_review_2",
        fromTeamId: "shinchon_sharks",
        fromTeamName: "신촌샤크",
        rating: 4.5,
        commentShort:
          "젊은 팀이라 에너지가 넘치고, 픽앤롤 합이 잘 맞는 팀입니다.",
        createdAt: "2025-11-02T18:30:00+09:00",
      },
    ],
  },
  {
    id: "deokso_eagles",
    clubId: "deokso_eagles",
    name: "덕소독수리",
    region: "경기 남양주 덕소",
    description: "연습은 독하게, 경기는 부드럽게",
    photoUrl: null,
    logoKey: "logo_deokso_eagles",
    tags: ["#경기도", "#20대초반", "#공격농구"],
    createdAt: "2025-09-28T10:00:00+09:00",
    updatedAt: "2025-10-25T10:00:00+09:00",

    activity: {
      regionLabel: "경기 남양주 덕소",
      daysLabel: "주중 저녁",
      timeLabel: "야간 시간대",
    },

    recruiting: {
      isRecruiting: true,
      title: "공격형 가드/포워드 구합니다",
      tags: ["모집중", "가드", "포워드"],
      description:
        "하프코트 세트오펜스를 좋아하시는 분이면 환영입니다. 동호회 대회 경험 있으시면 더 좋아요.",
    },

    // 초상권: 실제 인물 경기 사진 제거. 미디어 없음(섹션 자연 숨김).
    media: [],

    stats: {
      totalMatches: 28,
      wins: 20,
      losses: 8,
      draws: 0,
      winRate: 0.71,
      updatedAt: "2025-10-25T10:00:00+09:00",
    },
    streak: {
      type: "WIN",
      count: 3,
    },
    recentResults: ["win", "win", "lose"],

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

    lineups: [
      {
        id: "deokso_main",
        name: "덕소독수리 주전 라인업",
        matchSizeKey: "5v5",
        captainId: "user_deokso_kim_doyun",
        memberIds: [
          "user_deokso_kim_doyun",
          "user_deokso_kim_dongcheon",
          "user_deokso_jeong_hwan",
          "user_deokso_byun_yumin",
          "user_deokso_kwon_hyeokju",
        ],
      },
      {
        id: "deokso_guard",
        name: "더블 가드 라인업",
        matchSizeKey: "4v4",
        captainId: "user_deokso_kim_dongcheon",
        memberIds: [
          "user_deokso_kim_dongcheon",
          "user_deokso_jeong_hwan",
          "user_deokso_byun_yumin",
          "user_deokso_kim_doyun",
        ],
      },
      {
        id: "deokso_rookie",
        name: "루키+팀장 라인업",
        matchSizeKey: "3v3",
        captainId: "user_deokso_jeong_hwan",
        memberIds: [
          "user_deokso_jeong_hwan",
          "user_deokso_byun_yumin",
          "user_deokso_kwon_hyeokju",
        ],
      },
    ],

    reviews: [
      {
        id: "deokso_review_1",
        fromTeamId: "cheongcho_tigers",
        fromTeamName: "청춘호랑이",
        rating: 4.7,
        commentShort:
          "하프코트 세트오펜스가 탄탄해서 수비하기 까다로운 팀이었어요.",
        createdAt: "2025-10-15T19:00:00+09:00",
      },
      {
        id: "deokso_review_2",
        fromTeamId: "hangang_bulldogs",
        fromTeamName: "한강불독",
        rating: 4.3,
        commentShort:
          "압박 수비가 거세지만 파울 관리도 잘해서 경기 흐름이 깔끔했습니다.",
        createdAt: "2025-10-28T21:10:00+09:00",
      },
    ],
  },
  {
    id: "li_lion",
    clubId: "li_lion",
    name: "LI이언",
    region: "서울 마포구",
    description: "라이언처럼 포효하는 공격 농구",
    photoUrl: null,
    logoKey: "logo_li_lion",
    tags: ["#실업출신", "#강스쿼드"],
    createdAt: "2025-10-01T10:00:00+09:00",
    updatedAt: "2025-11-01T10:00:00+09:00",

    activity: {
      regionLabel: "서울 마포구",
      daysLabel: "주중·주말 모두",
      timeLabel: "야간 위주",
    },

    recruiting: {
      isRecruiting: false,
      title: "현재 정원 충원 완료",
      tags: ["모집마감", "실업출신"],
      description:
        "현재는 내부 스쿼드 위주로만 운영 중입니다. 스파링 매칭은 언제든 환영해요.",
    },

    // 초상권: 실제 인물 경기 사진 제거. 미디어 없음(섹션 자연 숨김).
    media: [],

    stats: {
      totalMatches: 24,
      wins: 19,
      losses: 5,
      draws: 0,
      winRate: 0.79,
      updatedAt: "2025-11-01T10:00:00+09:00",
    },
    streak: {
      type: "WIN",
      count: 4,
    },
    recentResults: ["win", "win", "win", "win"],

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

    lineups: [
      {
        id: "lion_main",
        name: "LI이언 주전 라인업",
        matchSizeKey: "5v5",
        captainId: "user_lion_nam_hyoseung",
        memberIds: [
          "user_lion_nam_hyoseung",
          "user_lion_lee_sangjun",
          "user_lion_seo_jun",
          "user_lion_oh_seungeob",
          "user_lion_shin_jongmin",
        ],
      },
      {
        id: "lion_pro",
        name: "프로 듀오 라인업",
        matchSizeKey: "4v4",
        captainId: "user_lion_lee_sangjun",
        memberIds: [
          "user_lion_nam_hyoseung",
          "user_lion_lee_sangjun",
          "user_lion_shin_jongmin",
          "user_lion_seo_jun",
        ],
      },
      {
        id: "lion_small",
        name: "스몰 스코어러 라인업",
        matchSizeKey: "3v3",
        captainId: "user_lion_seo_jun",
        memberIds: [
          "user_lion_lee_sangjun",
          "user_lion_seo_jun",
          "user_lion_oh_seungeob",
        ],
      },
    ],

    reviews: [
      {
        id: "lion_review_1",
        fromTeamId: "cheongcho_tigers",
        fromTeamName: "청춘호랑이",
        rating: 4.9,
        commentShort:
          "피지컬, 슛, 조직력 다 상위권. 강팀이지만 끝까지 매너 좋았습니다.",
        createdAt: "2025-11-01T21:00:00+09:00",
      },
      {
        id: "lion_review_2",
        fromTeamId: "shinchon_sharks",
        fromTeamName: "신촌샤크",
        rating: 4.6,
        commentShort: "전문 수비수가 있어 에이스 매치업이 재미있었어요.",
        createdAt: "2025-10-10T19:40:00+09:00",
      },
    ],
  },
  {
    id: "shinchon_sharks",
    clubId: "shinchon_sharks",
    name: "신촌샤크",
    region: "서울 서대문구 신촌",
    description: "대학가 감성, 빠른 트랜지션 공격",
    photoUrl: null,
    logoKey: "logo_shinchon_sharks",
    tags: ["#신촌", "#대학생팀", "#하프코트"],
    createdAt: "2025-09-20T10:00:00+09:00",
    updatedAt: "2025-10-18T10:00:00+09:00",

    activity: {
      regionLabel: "서울 서대문구 신촌",
      daysLabel: "평일 저녁",
      timeLabel: "저녁 시간대",
    },

    recruiting: {
      isRecruiting: true,
      title: "대학(원)생 우대, 포지션 무관",
      tags: ["모집중", "대학생", "가드우대"],
      description:
        "신촌 인근에서 자주 모이는 팀입니다. 농구 좋아하는 대학(원)생이면 누구나 지원 가능해요.",
    },

    // 초상권: 실제 인물 경기 사진 제거. 미디어 없음(섹션 자연 숨김).
    media: [],

    stats: {
      totalMatches: 18,
      wins: 11,
      losses: 7,
      draws: 0,
      winRate: 0.61,
      updatedAt: "2025-10-18T10:00:00+09:00",
    },
    streak: {
      type: "WIN",
      count: 1,
    },
    recentResults: ["win", "lose", "win"],

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

    lineups: [
      {
        id: "shinchon_main",
        name: "신촌샤크 주전 라인업",
        matchSizeKey: "5v5",
        captainId: "user_shinchon_park_junyoung",
        memberIds: [
          "user_shinchon_park_junyoung",
          "user_shinchon_lee_jaehun",
          "user_shinchon_kim_hayoung",
          "user_shinchon_choi_minhyuk",
          "user_shinchon_jung_nayeon",
        ],
      },
      {
        id: "shinchon_guard",
        name: "더블 가드 스피드 라인업",
        matchSizeKey: "4v4",
        captainId: "user_shinchon_lee_jaehun",
        memberIds: [
          "user_shinchon_lee_jaehun",
          "user_shinchon_kim_hayoung",
          "user_shinchon_park_junyoung",
          "user_shinchon_choi_minhyuk",
        ],
      },
      {
        id: "shinchon_mix",
        name: "믹스드 스코어러 라인업",
        matchSizeKey: "3v3",
        captainId: "user_shinchon_kim_hayoung",
        memberIds: [
          "user_shinchon_kim_hayoung",
          "user_shinchon_jung_nayeon",
          "user_shinchon_lee_jaehun",
        ],
      },
    ],

    reviews: [
      {
        id: "shinchon_review_1",
        fromTeamId: "li_lion",
        fromTeamName: "LI이언",
        rating: 4.4,
        commentShort:
          "젊은 팀답게 속공 전개가 빠르고, 벤치 분위기도 좋았습니다.",
        createdAt: "2025-10-05T18:20:00+09:00",
      },
      {
        id: "shinchon_review_2",
        fromTeamId: "hangang_bulldogs",
        fromTeamName: "한강불독",
        rating: 4.2,
        commentShort:
          "슛 감 좋은 가드가 있어서 외곽 수비를 더 타이트하게 해야 했어요.",
        createdAt: "2025-10-12T20:30:00+09:00",
      },
    ],
  },
  {
    id: "hangang_bulldogs",
    clubId: "hangang_bulldogs",
    name: "한강불독",
    region: "서울 영등포구 여의도",
    description: "피지컬로 밀어붙이는 빅맨 농구",
    photoUrl: null,
    logoKey: "logo_hangang_bulldogs",
    tags: ["#직장인팀", "#야간연습", "#한강뷰"],
    createdAt: "2025-09-10T10:00:00+09:00",
    updatedAt: "2025-10-05T10:00:00+09:00",

    activity: {
      regionLabel: "서울 영등포구 여의도",
      daysLabel: "주중 야간",
      timeLabel: "퇴근 후 시간대",
    },

    recruiting: {
      isRecruiting: true,
      title: "직장인 빅맨/스윙맨 환영",
      tags: ["모집중", "센터", "포워드"],
      description:
        "한강 인근 직장인 위주 팀입니다. 체력 자신 있는 분, 빅맨 포지션 특히 환영해요.",
    },

    // 초상권: 실제 인물 경기 사진 제거. 미디어 없음(섹션 자연 숨김).
    media: [],

    stats: {
      totalMatches: 20,
      wins: 9,
      losses: 11,
      draws: 0,
      winRate: 0.45,
      updatedAt: "2025-10-05T10:00:00+09:00",
    },
    streak: {
      type: "WIN",
      count: 2,
    },
    recentResults: ["win", "win", "lose"],

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

    lineups: [
      {
        id: "bulldogs_main",
        name: "한강불독 주전 라인업",
        matchSizeKey: "5v5",
        captainId: "user_bulldogs_kang_taehyun",
        memberIds: [
          "user_bulldogs_kang_taehyun",
          "user_bulldogs_yoon_sungmin",
          "user_bulldogs_han_jiyoon",
          "user_bulldogs_song_woojin",
          "user_bulldogs_cho_minseo",
        ],
      },
      {
        id: "bulldogs_big",
        name: "빅맨 위주 라인업",
        matchSizeKey: "4v4",
        captainId: "user_bulldogs_yoon_sungmin",
        memberIds: [
          "user_bulldogs_kang_taehyun",
          "user_bulldogs_yoon_sungmin",
          "user_bulldogs_song_woojin",
          "user_bulldogs_han_jiyoon",
        ],
      },
      {
        id: "bulldogs_night",
        name: "야간 하프코트 라인업",
        matchSizeKey: "3v3",
        captainId: "user_bulldogs_han_jiyoon",
        memberIds: [
          "user_bulldogs_han_jiyoon",
          "user_bulldogs_cho_minseo",
          "user_bulldogs_yoon_sungmin",
        ],
      },
    ],

    reviews: [
      {
        id: "bulldogs_review_1",
        fromTeamId: "deokso_eagles",
        fromTeamName: "덕소독수리",
        rating: 4.1,
        commentShort:
          "인사도 꼼꼼히 해주고, 피지컬 센터와의 매치업이 인상 깊었습니다.",
        createdAt: "2025-09-25T21:00:00+09:00",
      },
      {
        id: "bulldogs_review_2",
        fromTeamId: "shinchon_sharks",
        fromTeamName: "신촌샤크",
        rating: 4.0,
        commentShort:
          "야간 타임이라 체력 부담이 있었는데도 끝까지 페어플레이 해준 팀.",
        createdAt: "2025-10-03T22:00:00+09:00",
      },
    ],
  },
];

/* =========================
 * 플레이어 파생 데이터
 * ========================= */

export const PLAYERS_FLAT = TEAMS.flatMap((team) =>
  team.players.map((p) => ({
    ...p,
    clubId: team.clubId,
    clubName: team.name,
    clubLogoKey: team.logoKey,
  }))
);

export const PLAYERS_BY_ID = PLAYERS_FLAT.reduce((acc, p) => {
  acc[p.userId] = p;
  return acc;
}, {});

// =========================
// 플레이어 프로필 목업
// =========================
// PlayerProfile {
//   userId: string;
//   nickname: string;
//   avatarUrl: string | null;
//   mainPosition: "guard" | "forward" | "center" | null;
//   skillLevel: "beginner" | "amateur" | "intermediate" | "advanced" | "pro" | null;
//   heightCm: number | null;
//   weightKg: number | null;
//   intro: string;
//   careers: string[];
// }

export const PLAYER_PROFILES = PLAYERS_FLAT.map((p) => {
  const avatarUrl = p.photoUrl || images.profileDefault || images.logo;

  const intro = p.careerText
    ? p.careerText.length > 18
      ? p.careerText.slice(0, 18) + "..."
      : p.careerText
    : "아직 자기소개를 작성하지 않았어요.";

  const careers = p.careerText ? [p.careerText] : [];

  return {
    userId: p.userId,
    nickname: p.nickname,
    avatarUrl,
    mainPosition: p.mainPosition || null,
    skillLevel: p.skillLevel || null,
    heightCm: p.heightCm ?? null,
    weightKg: p.weightKg ?? null,
    intro,
    careers,
  };
});

export const PLAYER_PROFILES_BY_ID = PLAYER_PROFILES.reduce((acc, prof) => {
  acc[prof.userId] = prof;
  return acc;
}, {});

/* =========================
 * 팀 관련 파생 데이터
 * ========================= */

// 연승팀 대결 신청하기 섹션
export const WINNING_TEAMS = TEAMS.filter(
  (t) => t.streak && t.streak.type === "WIN" && t.streak.count >= 2
).map((t) => ({
  id: t.id,
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
    id: t.id,
    clubId: t.clubId,
    name: t.name,
    logoKey: t.logoKey,
    region: t.region,
    winRate: t.stats.winRate,
    totalMatches: t.stats.totalMatches,
    wins: t.stats.wins,
    losses: t.stats.losses,
    recentResults: t.recentResults || [],
  }));

// 팀 id/clubId로 빠르게 찾는 맵 (팀 상세용)
export const TEAMS_BY_ID = TEAMS.reduce((acc, t) => {
  acc[t.id] = t;
  acc[t.clubId] = t;
  return acc;
}, {});

/* =========================
 * 내 즐겨찾기 목업 데이터
 * ========================= */

export const FAVORITE_TEAM_IDS = [
  "cheongcho_tigers",
  "li_lion",
  "shinchon_sharks",
];

export const FAVORITE_TEAMS = FAVORITE_TEAM_IDS.map((id) => TEAMS_BY_ID[id])
  .filter(Boolean)
  .map((t) => ({
    id: t.id,
    clubId: t.clubId,
    name: t.name,
    logoKey: t.logoKey,
    region: t.region,
    winRate: t.stats.winRate,
  }));

export const FAVORITE_PLAYER_IDS = [
  "user_deokso_kim_doyun",       // 김도윤 — 덕소독수리
  "user_lion_nam_hyoseung",      // 남효승 — LI이언
  "user_shinchon_lee_jaehun",    // 이재훈 — 신촌샤크
];

export const FAVORITE_PLAYERS = FAVORITE_PLAYER_IDS.map(
  (uid) => PLAYERS_BY_ID[uid]
).filter(Boolean);

/* =========================
 * 팀 가입 신청(Join Request) 목업
 * =========================
//
// JoinRequest {
//   id: string;
//   clubId: string;
//   playerUserId: string;
//   playerSnapshot: PlayerProfile;
//   status: "pending" | "accepted" | "rejected";
//   message?: string;
//   createdAt: string;
//   handledAt?: string;
//   handledBy?: string;
// }
*/

export const JOIN_REQUESTS = [
  {
    id: "jr_001",
    clubId: "cheongcho_tigers",
    playerUserId: "user_deokso_kim_doyun",
    playerSnapshot: PLAYER_PROFILES_BY_ID["user_deokso_kim_doyun"],
    status: "pending",
    message: "센터 자리가 필요하시면 한 번 불러주세요! 주말 경기 가능해요 🙌",
    createdAt: "2025-12-01T20:10:00+09:00",
  },
  {
    id: "jr_002",
    clubId: "li_lion",
    playerUserId: "user_shinchon_lee_jaehun",
    playerSnapshot: PLAYER_PROFILES_BY_ID["user_shinchon_lee_jaehun"],
    status: "accepted",
    message: "연습경기 위주로 같이 뛰어보고 싶습니다.",
    createdAt: "2025-11-25T18:30:00+09:00",
    handledAt: "2025-11-26T21:00:00+09:00",
    handledBy: "user_lion_nam_hyoseung",
  },
  {
    id: "jr_003",
    clubId: "hangang_bulldogs",
    playerUserId: "user_cheongcho_han_juseong",
    playerSnapshot: PLAYER_PROFILES_BY_ID["user_cheongcho_han_juseong"],
    status: "rejected",
    message: "야간 경기 위주로만 가능해요.",
    createdAt: "2025-11-20T19:00:00+09:00",
    handledAt: "2025-11-21T09:20:00+09:00",
    handledBy: "user_bulldogs_kang_taehyun",
  },
];

export const JOIN_REQUESTS_BY_CLUB = JOIN_REQUESTS.reduce((acc, jr) => {
  if (!acc[jr.clubId]) acc[jr.clubId] = [];
  acc[jr.clubId].push(jr);
  return acc;
}, {});
