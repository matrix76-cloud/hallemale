/* eslint-disable */
// functions/scripts/send-test-alimtalk.mjs
// 승인된 알림톡 템플릿을 실제로 한 통씩 쏴 보는 검증 스크립트.
//
// 왜 필요한가: 루나는 등록본과 본문이 한 글자라도 다르면 발송을 거부하고, 버튼을
//   가변링크(#{URL})로 등록했는데 btn_url 로 보내면(또는 그 반대) 역시 거부한다.
//   실제 발송 경로(결제 → 확정/취소)는 PG 심사 대기라 탈 수 없으므로,
//   개통 전에 본문·버튼 정합을 확인할 방법은 이 직접 발송뿐이다.
//
// 사용법 (functions/ 에서):
//   LUNA_API_KEY=<키> node scripts/send-test-alimtalk.mjs 01012345678
//   LUNA_API_KEY=<키> node scripts/send-test-alimtalk.mjs 01012345678 soloConfirmed
//
// ⚠️ 실제로 카카오톡이 발송된다(건당 과금). 본인 번호로만 쓸 것.

import { BODY, TEMPLATES } from "../alimtalk.js";

const ENDPOINT = "https://jupiter.lunasoft.co.kr/api/alimtalk/message/send";
const USERID = process.env.LUNA_USERID || "hallaemallae";
const API_KEY = process.env.LUNA_API_KEY || "";

// 템플릿별 더미 변수 — 자리만 채우면 되지만, 빈 값이면 루나가 거부하므로 전부 넣는다.
const SAMPLE = {
  matchConfirmed: {
    예약번호: "TEST-0001", 구장명: "테스트구장", 코트: "A코트", 주소: "서울시 테스트구 테스트로 1",
    일시: "8/10(월) 19:00~21:00", 상대팀: "테스트FC", 인원: "5", 금액: "50,000",
  },
  matchCanceled: {
    예약번호: "TEST-0001", 구장명: "테스트구장", 코트: "A코트", 일시: "8/10(월) 19:00~21:00",
    사유: "테스트 취소", 금액: "50,000", 환불금액: "50,000", 환불기준: "이용 2일 전 취소 · 전액 환불",
  },
  paymentReminder: {
    예약번호: "TEST-0001", 구장명: "테스트구장", 코트: "A코트",
    일시: "8/10(월) 19:00~21:00", 금액: "50,000", 마감시각: "8/8(토) 21:30",
  },
  soloConfirmed: {
    예약번호: "TEST-0001", 구장명: "테스트구장", 코트: "A코트", 주소: "서울시 테스트구 테스트로 1",
    일시: "8/10(월) 19:00~21:00", 금액: "50,000", 구장안내: "주차는 건물 뒤편을 이용해 주세요",
  },
  soloCanceled: {
    예약번호: "TEST-0001", 구장명: "테스트구장", 코트: "A코트", 일시: "8/10(월) 19:00~21:00",
    사유: "예약자 취소", 금액: "50,000", 환불금액: "25,000", 환불기준: "이용 1일 전 취소 · 50% 공제",
  },
};

const [, , rawPhone, onlyKey] = process.argv;

if (!API_KEY) {
  console.error("LUNA_API_KEY 환경변수가 없습니다.");
  process.exit(1);
}
if (!rawPhone) {
  console.error("수신 전화번호를 인자로 넘기세요. 예: node scripts/send-test-alimtalk.mjs 01012345678");
  process.exit(1);
}

const digits = String(rawPhone).replace(/\D/g, "");
const to = digits.startsWith("82") ? `0${digits.slice(2)}` : digits;

const keys = onlyKey ? [onlyKey] : Object.keys(SAMPLE);

for (const key of keys) {
  const tpl = TEMPLATES[key];
  const build = BODY[key];
  if (!tpl?.id || !build || !SAMPLE[key]) {
    console.log(`- ${key}: 건너뜀 (template_id·본문·샘플 중 없는 것이 있음)`);
    continue;
  }

  const content = build(SAMPLE[key]);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      userid: USERID,
      api_key: API_KEY,
      template_id: tpl.id,
      messages: [{ no: "0", tel_num: to, msg_content: content, sms_content: content, use_sms: "0" }],
    }),
  });
  const json = await res.json().catch(() => ({}));

  // 최상위 code 와 개별 메시지 result_code 를 둘 다 본다 — code:0 이어도 개별 실패가 있다.
  const perMsg = json?.msg?.messages;
  const failed = Array.isArray(perMsg) ? perMsg.filter((m) => Number(m.result_code) !== 0) : [];
  const ok = res.ok && Number(json.code ?? 0) === 0 && !failed.length;

  console.log(
    `${ok ? "OK  " : "FAIL"} ${tpl.id} ${key.padEnd(16)} ${
      ok ? "" : JSON.stringify(failed.length ? failed : json)
    }`
  );
}
