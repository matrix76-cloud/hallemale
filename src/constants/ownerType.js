// src/constants/ownerType.js
// 운영 주체 — 구장주 가입 직후 한 번 고르고, 계정(users/{uid}.ownerType)에 남는다.
// 학교·기관은 사업자등록증이 없고(고유번호증) 담당자가 바뀌므로, 사업자등록번호를
// 필수로 들이대면 등록 자체가 막힌다. 주체에 따라 받을 정보와 문구가 갈린다.
//
// ⚠️ 이 표가 문구의 단일 출처다. 화면마다 조건문으로 문장을 흩뿌리지 말고 여기에 넣는다.

export const OWNER_TYPE_OPTIONS = [
  {
    key: "business",
    label: "개인사업자 · 법인",
    desc: "사업자등록증이 있는 민간 체육관·코트",

    // 온보딩 연락처 단계
    orgLabel: "상호(사업자명)",
    orgPlaceholder: "예: ○○스포츠",
    // personLabel = 자격 확인에 쓰는 이름(국세청 대조 대상). managerLabel = 실제로 연락할 담당자.
    // 법인은 이 둘이 다르다 — 담당 매니저 이름을 대표자명 칸에 적으면 국세청 대조가 실패한다.
    personLabel: "대표자명",
    personPlaceholder: "예: 홍길동",
    managerLabel: "담당자명",
    managerPlaceholder: "예: 홍길동",
    needsBizNo: true,
    contactTitle: "연락받을 곳을 알려주세요",
    // ⚠️ 전자상거래법상 판매자 정보라 상호·대표자명·사업장 주소·구장 연락처는 구장 상세에 표시된다.
    //    "전부 비공개"라고 안내하면 사실과 다르다 — 공개/비공개를 갈라 적는다.
    contactSub: "구장 대표번호는 예약자에게 안내되고, 담당자 정보는 심사 확인용이라 공개되지 않아요.",
    contactHead: "사업자 / 관리자 정보",
    verifySub: "국세청에 등록된 사업자 정보와 바로 대조해 인증해요.",
    sellerNote: "전자상거래법에 따라 상호·대표자명·사업장 주소·구장 대표번호는 판매자 정보로 구장 상세에 표시돼요.",

    // 등록 전 준비물 · 심사 방식 (인트로 순서도)
    prep: [
      "사업자등록번호와 개업일자",
      "사업자등록증 사본 (사진 파일)",
      "구장 사진 3장 이상",
      "코트별 이용요금과 운영시간",
    ],
    reviewDesc: "국세청 진위확인을 거쳐 관리자가 승인해요",

    // 온보딩 기타
    venueNamePlaceholder: "예: 용산 더베이스 농구장",
    introSub: "사진·위치·코트·이용요금을 차근차근 입력해 주세요.",

    // 동의 게이트
    adultConsentText: "만 19세 이상 사업자 본인입니다.",
    consentSub: "구장 관리자 서비스 이용을 위해 아래 약관에 동의해 주세요.",

    // 구장정보 > 인증/정산
    verifyTitle: "사업자 인증",
    adminInfoTitle: "사업자 / 관리자 정보", // 어드민 심사 상세의 섹션명
    docLabel: "사업자등록증 사본",
    accountHint: "앱에서 결제된 구장 이용료를 지급받을 계좌예요. 사업자 대표자 명의 계좌를 등록해주세요.",
  },
  {
    key: "school",
    label: "학교",
    desc: "초·중·고, 대학교 체육관 · 운동장",

    orgLabel: "학교명",
    orgPlaceholder: "예: ○○고등학교",
    personLabel: "담당 선생님",
    personPlaceholder: "예: 홍길동 선생님",
    // 학교·기관은 자격 확인 대상이 곧 담당자 본인이라 이름을 한 번만 받는다.
    managerLabel: "담당 선생님",
    managerPlaceholder: "예: 홍길동 선생님",
    needsBizNo: false,
    contactTitle: "연락받을 곳을 알려주세요",
    contactSub: "구장 대표번호는 예약자에게 안내되고, 담당 선생님 정보는 심사 확인용이라 공개되지 않아요.",
    contactHead: "학교 / 담당자 정보",
    verifySub: "실재하는 학교인지 확인하고, 학교 대표번호로 담당자 확인 연락을 드려요.",
    sellerNote: "학교명·주소·구장 대표번호는 구장 상세에 표시돼요.",

    prep: [
      "학교명 (NEIS에 등록된 이름)",
      "시설 대여 담당 확인 서류 또는 고유번호증",
      "구장 사진 3장 이상",
      "코트별 대여료와 운영시간",
    ],
    reviewDesc: "학교 대표번호로 담당자를 확인한 뒤 승인해요",

    venueNamePlaceholder: "예: ○○고등학교 체육관",
    introSub: "사진·위치·코트·대여료를 차근차근 입력해 주세요.",

    adultConsentText: "만 19세 이상이며, 이 시설의 대여 업무를 담당합니다.",
    consentSub: "학교 시설 대여를 시작하려면 아래 약관에 동의해 주세요.",

    verifyTitle: "학교 확인",
    adminInfoTitle: "학교 / 담당자 정보",
    docLabel: "고유번호증 또는 시설 대여 담당 확인 서류",
    accountHint: "앱에서 결제된 대여료를 지급받을 계좌예요. 학교(또는 학교 회계) 명의 계좌를 등록해주세요.",
  },
  {
    key: "org",
    label: "기관 · 단체",
    desc: "공공체육관, 시설관리공단, 교회·복지관 등",

    orgLabel: "기관·단체명",
    orgPlaceholder: "예: ○○시설관리공단",
    personLabel: "담당자명",
    personPlaceholder: "예: 홍길동",
    managerLabel: "담당자명",
    managerPlaceholder: "예: 홍길동",
    needsBizNo: false,
    contactTitle: "연락받을 곳을 알려주세요",
    contactSub: "구장 대표번호는 예약자에게 안내되고, 담당자 정보는 심사 확인용이라 공개되지 않아요.",
    contactHead: "기관 / 담당자 정보",
    verifySub: "제출하신 서류와 담당자 확인 연락으로 심사해요.",
    sellerNote: "기관·단체명·주소·구장 대표번호는 구장 상세에 표시돼요.",

    prep: [
      "기관·단체명 (고유번호는 선택)",
      "시설 운영 위임 서류 또는 고유번호증",
      "구장 사진 3장 이상",
      "코트별 대여료와 운영시간",
    ],
    reviewDesc: "제출 서류와 담당자 확인 연락을 거쳐 승인해요",

    venueNamePlaceholder: "예: ○○시민체육관",
    introSub: "사진·위치·코트·대여료를 차근차근 입력해 주세요.",

    adultConsentText: "만 19세 이상이며, 이 시설의 대여 업무를 담당합니다.",
    consentSub: "기관 시설 대여를 시작하려면 아래 약관에 동의해 주세요.",

    verifyTitle: "기관 확인",
    adminInfoTitle: "기관 / 담당자 정보",
    docLabel: "고유번호증 또는 시설 운영 위임 서류",
    accountHint: "앱에서 결제된 대여료를 지급받을 계좌예요. 기관·단체 명의 계좌를 등록해주세요.",
  },
];

export const OWNER_TYPES = OWNER_TYPE_OPTIONS.map((o) => o.key);

/** 주체 키 → 옵션. 알 수 없는 값은 사업자로 폴백한다. */
export const ownerTypeOption = (key) =>
  OWNER_TYPE_OPTIONS.find((o) => o.key === key) || OWNER_TYPE_OPTIONS[0];

/**
 * 실제로 적용할 주체.
 * 계정 값이 우선이고, 계정 값이 없는 레거시 구장주는 구장 문서에 남은 값으로 폴백한다.
 * (계정 게이트는 구장이 없는 신규 가입자에게만 뜨므로 기존 구장주는 폴백 경로로 들어온다)
 */
/**
 * 구장 등록 전체 절차(순서도). 온보딩 인트로와 심사 현황 화면이 같은 표를 그린다 —
 * 두 화면이 다른 단계 수를 말하면 "지금 어디쯤인지"를 알 수 없다.
 * stage: 신청 전(before) → 심사(review) → 승인 후(after). 화면이 현재 위치를 칠할 때 쓴다.
 */
export const registerFlow = (ownerType) => {
  const opt = ownerTypeOption(ownerType);
  return [
    { stage: "before", title: "구장 정보 입력", desc: "이름·위치·사진·코트와 요금 (약 5분)" },
    { stage: "before", title: `${opt.verifyTitle} 제출`, desc: `${opt.docLabel} 등 자격 확인 자료` },
    { stage: "review", title: "심사", desc: `${opt.reviewDesc} (보통 영업일 1~2일)` },
    { stage: "after", title: "정산 계좌 등록", desc: "승인 후 내정보에서 등록해요" },
    { stage: "after", title: "예약 오픈", desc: "회원 앱에 노출되고 예약을 받아요" },
  ];
};

export const resolveOwnerType = (userDoc, venue) => {
  const fromUser = userDoc?.ownerType;
  if (OWNER_TYPES.includes(fromUser)) return fromUser;
  const fromVenue = venue?.ownerType;
  if (OWNER_TYPES.includes(fromVenue)) return fromVenue;
  return "business";
};
