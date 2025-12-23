/* eslint-disable */
// src/mock/communityMock.js
// 생활체육 매칭 — 커뮤니티 목업 데이터 모음

// 커뮤니티 리스트용 기본 데이터
export const COMMUNITY_POSTS = [
  {
    id: "post_001",
    authorId: "user_han",
    authorName: "한주성",
    authorAvatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop",
    canChat: true,
    title: "우리팀 21:18 승리! 다음에도 잘 부탁드립니다🙏",
    content:
      "오늘 경기 너무 재밌었습니다! 수비도 잘 맞고 공격도 잘 들어갔네요. 다음에도 파이팅입니다!",
    image:
      "https://images.unsplash.com/photo-1519861531473-9200262188bf?w=800&auto=format&fit=crop",
    createdAt: "2025-12-02 20:55",
    views: 39,
    commentsCount: 12,
    likes: 4,
  },
  {
    id: "post_002",
    authorId: "user_min",
    authorName: "김민수",
    authorAvatar:
      "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=200&h=200&fit=crop",
    canChat: true,
    title: "게스트 구합니다.🙏",
    content:
      "내일 19:00 경기 함께하실 분 모집합니다! 실력 상관없이 즐기실 분 환영!",
    image:
      "https://images.unsplash.com/photo-1519865885898-a54a6f2c7eea?w=800&auto=format&fit=crop",
    createdAt: "2025-12-02 20:40",
    views: 47,
    commentsCount: 9,
    likes: 1,
  },
  {
    id: "post_003",
    authorId: "user_park",
    authorName: "박지훈",
    authorAvatar:
      "https://images.unsplash.com/photo-1525130413817-d45c1d127c42?w=200&h=200&fit=crop",
    canChat: false,
    title: "***농구팀 비매너",
    content:
      "오늘 경기 중 비매너 행동이 조금 있었습니다. 서로 즐기는 분위기가 되었으면 합니다!",
    image: null, // 사진 없음 → 리스트에서 썸네일 안 보이게
    createdAt: "2025-12-02 20:30",
    views: 61,
    commentsCount: 15,
    likes: 7,
  },
  {
    id: "post_004",
    authorId: "user_kim",
    authorName: "김도윤",
    authorAvatar:
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop",
    canChat: false,
    title: "빨리 사용자 많아지면 좋을듯",
    content:
      "매칭 플랫폼 너무 잘 만든 듯! 커뮤니티도 활성화되면 더 좋아질 것 같아요!",
    image: null, // 사진 없음
    createdAt: "2025-12-02 20:10",
    views: 23,
    commentsCount: 3,
    likes: 0,
  },
  {
    id: "post_005",
    authorId: "user_sung",
    authorName: "이성민",
    authorAvatar:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&fit=crop",
    canChat: true,
    title: "매칭 해주는거 개꿀이네 ㅋㅋ",
    content:
      "덕분에 우리팀이랑 다른팀 매칭해서 바로 경기하고 왔습니다 ㅋㅋ 굿!",
    image: null, // 사진 없음
    createdAt: "2025-12-02 19:55",
    views: 52,
    commentsCount: 6,
    likes: 2,
  },
];

// 게시글 상세 전용 확장 데이터
export const COMMUNITY_POST_DETAIL_BY_ID = {
  post_001: {
    id: "post_001",
    authorId: "user_han",
    authorName: "한주성",
    authorAvatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop",
    canChat: true,

    title: "우리팀 21:18 승리! 다음에도 잘 부탁드립니다🙏",
    content:
      "오늘 경기 너무 재밌었습니다! 수비도 잘 맞고 공격도 잘 들어갔네요.\n" +
      "다음 경기에도 다들 부상 없이 즐겁게 했으면 좋겠습니다! 🏀",

    image:
      "https://images.unsplash.com/photo-1519861531473-9200262188bf?w=800&auto=format&fit=crop",

    createdAt: "2025-12-02 20:55",
    updatedAt: "2025-12-02 21:10",

    views: 39,
    likes: 4,
    likedByMe: true,

    commentsCount: 12,

    isMine: true,
    canEdit: true,
    canDelete: true,
  },
};

// 댓글 / 대댓글 목업
export const COMMUNITY_COMMENTS_BY_POST_ID = {
  post_001: [
    {
      id: "cmt_001",
      postId: "post_001",
      parentId: null,
      authorId: "user_min",
      authorName: "김민수",
      authorAvatar:
        "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=200&h=200&fit=crop",
      content: "오늘 경기 진짜 재밌었어요! 수고하셨습니다 🙌",
      createdAt: "2025-12-02 21:00",
      likes: 2,
      likedByMe: false,
      isMine: false,
      canEdit: false,
      canDelete: false,
    },
    {
      id: "cmt_002",
      postId: "post_001",
      parentId: null,
      authorId: "user_park",
      authorName: "박지훈",
      authorAvatar:
        "https://images.unsplash.com/photo-1525130413817-d45c1d127c42?w=200&h=200&fit=crop",
      content: "MVP 한주성 인정합니다 ㅋㅋ 다음에도 같이해요!",
      createdAt: "2025-12-02 21:02",
      likes: 3,
      likedByMe: true,
      isMine: false,
      canEdit: false,
      canDelete: false,
    },
    {
      id: "cmt_003",
      postId: "post_001",
      parentId: "cmt_002",
      authorId: "user_han",
      authorName: "한주성",
      authorAvatar:
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop",
      content: "과찬입니다 ㅎㅎ 다들 덕분이에요 🙏",
      createdAt: "2025-12-02 21:05",
      likes: 1,
      likedByMe: false,
      isMine: true,
      canEdit: true,
      canDelete: true,
    },
    {
      id: "cmt_004",
      postId: "post_001",
      parentId: null,
      authorId: "user_guest",
      authorName: "게스트 신청예정",
      authorAvatar:
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&fit=crop",
      content: "다음 경기 게스트 자리 있으면 불러주세요!",
      createdAt: "2025-12-02 21:08",
      likes: 0,
      likedByMe: false,
      isMine: false,
      canEdit: false,
      canDelete: false,
    },
  ],
};
