/* eslint-disable */
// functions/alimtalk.js
// 루나소프트(Lunasoft) 카카오 알림톡 발송 모듈.
// 참고 구현: classmanage(일등급) functions/alimtalk.js
//
// 인증: userid + api_key + template_id 로 바로 발송 (토큰/senderkey 불필요). 바디는 JSON.
//
// 인증값:
//   - userid  = 루나m 회원(로그인) 아이디 "hallaemallae". 민감정보 아니라 코드 기본값.
//               (환경변수 LUNA_USERID 로 덮어쓰기 가능)
//   - api_key = 시크릿 → Firebase Secret Manager (하드코딩·.env 커밋 금지):
//               firebase functions:secrets:set LUNA_API_KEY
const { defineSecret } = require("firebase-functions/params");

const LUNA_USERID = process.env.LUNA_USERID || "hallaemallae";
const LUNA_API_KEY = defineSecret("LUNA_API_KEY");

// ⚠️ 발송 엔드포인트 — 계정 발송 API 문서로 최종 확인 필요(호스팅사 전용 콘솔).
//    classmanage 검증 엔드포인트는 jupiter. 계정 API가 다르면 여기만 교체.
const ENDPOINT = "https://jupiter.lunasoft.co.kr/api/alimtalk/message/send";

// 버튼 웹링크 도메인 — 실제 할래말래 웹 도메인으로 교체(미확정: 파이어베이스 기본).
//   앱 출시 후 이 도메인에 유니버설/앱링크를 걸면 같은 URL이 앱을 연다(템플릿 재심사 불필요).
const APP_WEB_BASE = process.env.APP_WEB_BASE || "https://halle-bf789.web.app";
const matchDeepLink = (matchId) => `${APP_WEB_BASE}/match-roomdetail/${matchId}`;

// 승인된 template_id 를 채운다. 미설정(빈값)이면 발송 단계에서 명시적 에러로 막힘.
//   ③④(직접입력) = 검수 요청됨 → 승인되면 id 입력.
//   ①②(제휴구장·결제) = PG 실연동 후 등록 예정.
const TEMPLATES = {
  matchConfirmedDirect: { id: "", name: "경기확정(직접입력)" }, // ⏳ 검수중 2026-07-23
  matchCanceledDirect: { id: "", name: "경기취소(직접입력)" }, // ⏳ 검수중 2026-07-23
  matchConfirmed: { id: "", name: "경기확정(제휴구장)" }, // 미등록(결제 연동 후)
  matchCanceled: { id: "", name: "경기취소(제휴구장)" }, // 미등록(결제 연동 후)
};

// 승인 템플릿 본문과 100% 일치해야 발송됨(변수 자리만 실제값 치환).
// ⚠️ 콘솔 최종 등록본과 1글자도 안 틀리게 유지할 것. (예: "(#{인원} 명)" 의 띄어쓰기)
const BODY = {
  matchConfirmedDirect: (v) =>
`[할래말래] 경기 확정 안내

안녕하세요.
상대팀과 경기가 확정되었습니다.
아래 경기 정보를 확인해 주세요.

- 구장 : ${v.구장명}
- 경기일시 : ${v.일시}
- 상대팀 : ${v.상대팀} (${v.인원} 명)

즐거운 경기 되세요.`,

  matchCanceledDirect: (v) =>
`[할래말래] 경기 취소 안내

안녕하세요.
아래 경기가 취소되었습니다.

- 구장 : ${v.구장명}
- 경기일시 : ${v.일시}
- 상대팀 : ${v.상대팀}
- 취소사유 : ${v.사유}

다음 경기에서 다시 만나요.`,

  // ①② 제휴구장(결제/환불) — PG 실연동 후 콘솔 등록·심사. 아래는 등록 전 초안이므로
  //    콘솔 등록 확정본과 1:1 대조 후 확정할 것.
  matchConfirmed: (v) =>
`[할래말래] 경기 확정 안내

안녕하세요.
신청하신 경기가 확정되었습니다.
아래 예약 정보를 확인해 주세요.

- 예약번호 : ${v.예약번호}
- 구장 : ${v.구장명} ${v.코트}
- 주소 : ${v.주소}
- 경기일시 : ${v.일시}
- 상대팀 : ${v.상대팀} (${v.인원} 명)
- 결제금액 : ${v.금액}원 (결제완료)

즐거운 경기 되세요.

※ 원활한 예약 진행을 위해 예약자 연락처가 해당 구장에 전달됩니다.`,

  matchCanceled: (v) =>
`[할래말래] 경기 취소 안내

안녕하세요.
아래 경기가 취소되어 환불이 진행됩니다.

- 예약번호 : ${v.예약번호}
- 구장 : ${v.구장명} ${v.코트}
- 경기일시 : ${v.일시}
- 취소사유 : ${v.사유}
- 결제금액 : ${v.금액}원
- 환불예정금액 : ${v.환불금액}원

환불은 확인일로부터 3영업일 이내 개시되며,
카드 결제는 카드사 정책에 따라 통상 3~7영업일 소요됩니다.

자세한 내용은 앱에서 확인하실 수 있습니다.`,
};

/**
 * 카카오 알림톡 1건 발송.
 * @param {string} tplKey  - TEMPLATES 키
 * @param {string} phone   - 수신 전화번호(하이픈 무관)
 * @param {object} vars    - BODY 빌더 변수
 * @param {object} [opts]
 * @param {string} [opts.matchId]  - 있으면 버튼(가변링크 #{URL})에 경기 상세 URL 주입
 * @param {boolean} [opts.failover] - true면 알림톡 실패 시 SMS 대체(use_sms:'1')
 * @returns {Promise<object>} 루나 응답 JSON
 */
async function sendAlimtalk(tplKey, phone, vars = {}, opts = {}) {
  const tpl = TEMPLATES[tplKey];
  if (!tpl) throw new Error(`알 수 없는 템플릿 키: ${tplKey}`);
  if (!tpl.id) {
    throw new Error(`템플릿 ID 미설정: ${tplKey} — 카카오 승인 후 alimtalk.js TEMPLATES에 template_id 입력 필요`);
  }
  const build = BODY[tplKey];
  if (!build) throw new Error(`본문 빌더 없음: ${tplKey}`);

  const userid = LUNA_USERID;
  const api_key = LUNA_API_KEY.value();
  if (!userid || !api_key) throw new Error("루나소프트 설정값(LUNA_USERID/LUNA_API_KEY) 미입력");

  const to = String(phone || "").replace(/\D/g, "");
  if (!to) throw new Error("수신 전화번호 없음");

  const content = build(vars);
  const message = {
    no: "0",
    tel_num: to,
    msg_content: content,
    sms_content: content, // 매뉴얼상 필수(use_sms=0이어도 요구)
    use_sms: opts.failover ? "1" : "0",
  };
  // 버튼 가변링크(#{URL}) — 발송 시점에 경기 상세 URL 주입.
  // ⚠️ 계정 API가 btn_url 객체가 아닌 변수치환(#{URL})을 쓰면 이 부분만 교체.
  if (opts.matchId) {
    const url = matchDeepLink(opts.matchId);
    message.btn_url = [{ url_pc: url, url_mobile: url }];
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ userid, api_key, template_id: tpl.id, messages: [message] }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(`알림톡 발송 실패(HTTP ${res.status}): ${JSON.stringify(json)}`);
  }
  // [1단계] 최상위 code != 0 → 요청 자체 실패.
  if (json.code !== undefined && Number(json.code) !== 0) {
    throw new Error(`알림톡 발송 실패: ${JSON.stringify(json.msg)} (code ${json.code})`);
  }
  // [2단계] code:0 이어도 개별 메시지가 실패할 수 있음(result_code 확인).
  const perMsg = json && json.msg && Array.isArray(json.msg.messages) ? json.msg.messages : null;
  if (perMsg) {
    const failed = perMsg.filter((m) => Number(m.result_code) !== 0);
    if (failed.length) {
      throw new Error(
        `알림톡 발송 실패: ${failed.map((m) => m.result_msg || `code ${m.result_code}`).join(", ")}`
      );
    }
  }
  return json;
}

module.exports = { sendAlimtalk, TEMPLATES, BODY, LUNA_API_KEY, matchDeepLink };
