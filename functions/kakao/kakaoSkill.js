/* eslint-disable */
// functions/kakao/kakaoSkill.js
// 카카오톡 채널 챗봇 스킬 서버 — CS 1차 응대(FAQ 자동응답).
//
// 동작 방향에 주의: 우리가 카카오 API 를 호출하는 게 아니라, 사용자가 채널에 말을 걸면
// 카카오가 이 엔드포인트로 POST 를 보내고 우리가 정해진 JSON 을 돌려주는 웹훅 구조다.
//
// 등록: 챗봇 관리자센터 > 스킬 > 스킬 등록에 아래 URL 을 넣고, 폴백 블록에 연결한 뒤 "배포".
//   사용자용 : https://asia-northeast3-halle-bf789.cloudfunctions.net/kakaoSkill
//   구장주용 : https://asia-northeast3-halle-bf789.cloudfunctions.net/kakaoSkill?audience=owner
//   (챗봇은 botUserKey 만 주기 때문에 이 사람이 구장주인지 알 수 없다. 그래서 첫 블록에서
//    "사용자 / 구장주"를 고르게 하고, 구장주 쪽 블록에는 audience=owner 스킬을 연결한다.)
//
// ⚠️ 5초 제한: 카카오는 5초 안에 응답이 없으면 연결을 끊는다. 그래서 이 함수는 Firestore
//    조회 한 번(+ 인메모리 캐시)만 하고 끝낸다. LLM 호출 같은 건 콜백 승인을 받기 전에는 넣지 말 것.
//
// ⚠️ 이 URL 은 인증 헤더가 없는 공개 엔드포인트다. KAKAO_BOT_ID 를 넣어두면 우리 봇이 보낸
//    요청인지 검증한다(응답 내용이 공개 FAQ 라 치명적이진 않지만, 남이 호출해 비용을 태우는 건 막는다).
const { onRequest } = require("firebase-functions/v2/https");
const { getDb } = require("../firebaseAdmin");

const REGION = "asia-northeast3";
const APP_WEB_BASE = process.env.APP_WEB_BASE || "https://hallaemallae.com";
const KAKAO_BOT_ID = String(process.env.KAKAO_BOT_ID || "").trim();

const s = (v) => String(v ?? "").trim();

/* ===================== FAQ 캐시 =====================
 * 문항이 수십 건이라 전량 조회가 싸다. 인스턴스가 살아있는 동안 5분간 재사용해
 * 매 발화마다 Firestore 를 때리지 않게 한다(응답시간 + 읽기 비용).
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
let faqCache = { at: 0, items: [] };

async function loadFaq() {
  const now = Date.now();
  if (faqCache.items.length && now - faqCache.at < CACHE_TTL_MS) return faqCache.items;

  const snap = await getDb().collection("csFaq").get();
  const items = [];
  snap.forEach((d) => {
    const v = d.data() || {};
    if (v.active === false) return;
    const q = s(v.q);
    const a = s(v.a);
    if (!q || !a) return;
    items.push({
      id: d.id,
      audience: s(v.audience) || "user",
      q,
      a,
      keywords: Array.isArray(v.keywords) ? v.keywords.map(s).filter(Boolean) : [],
      order: Number(v.order) || 0,
    });
  });
  items.sort((x, y) => x.order - y.order);

  faqCache = { at: now, items };
  return items;
}

/* ===================== 매칭 ===================== */

// 공백·문장부호를 없애 "매칭 어떻게 신청해요?" 와 "매칭어떻게신청" 이 같게 취급되도록 한다.
const norm = (v) => s(v).toLowerCase().replace(/[\s.,!?~·''""]/g, "");

// 키워드는 통째로 찾지 않고 단어 단위로 쪼개 "전부 들어있는지"를 본다.
// 통째로 찾으면 키워드 "매칭 신청" 이 "매칭 어떻게 신청해요" 에 안 걸린다 — 공백을 지워도
// 두 단어가 붙어 있지 않기 때문이다. 사용자는 저렇게 말하지 저 순서 그대로 붙여 쓰지 않는다.
//
// 단어를 전부 요구하는 이유(일부만 맞으면 통과 시키지 않는 이유):
//   "탈퇴하고싶어요" 는 "팀 탈퇴"(user-09)와 "회원 탈퇴"(user-20) 양쪽의 '탈퇴'에 걸린다.
//   전부 요구해야 '팀' 이 없는 발화가 팀 탈퇴로 잘못 가지 않는다.
function keywordScore(kw, u) {
  const tokens = s(kw)
    .toLowerCase()
    .split(/\s+/)
    .map(norm)
    .filter(Boolean);
  if (!tokens.length) return 0;

  const total = tokens.join("").length;
  if (total < 2) return 0; // 한 글자짜리는 우연 일치가 너무 잦다

  for (const t of tokens) if (!u.includes(t)) return 0;
  return total; // 구체적인(긴) 키워드일수록 높은 점수 → 더 정확한 항목이 위로
}

function scoreItem(item, utterance) {
  const u = norm(utterance);
  if (!u) return 0;

  const nq = norm(item.q);
  // 퀵리플라이를 눌렀을 때는 질문 문구가 그대로 오므로 여기서 바로 확정된다.
  if (u === nq) return 1000;
  if (u.length >= 4 && (nq.includes(u) || u.includes(nq))) return 500;

  let score = 0;
  for (const kw of item.keywords) score += keywordScore(kw, u);
  return score;
}

// 키워드 1개만 걸려도 통과시킨다.
// 한국어 CS 용어는 정산·탈퇴·예약·환불처럼 2글자가 대부분이라, 2글자 하나로는 부족하다고
// 보면 정작 제일 흔한 문의("정산 언제 되나요")가 통째로 누락된다.
// 대신 1글자 키워드는 무시하고(우연 일치가 너무 잦다), 점수는 키워드 길이로 매겨
// 더 구체적인 항목이 위로 오게 한다. 키워드는 어드민이 직접 넣는 값이라 잡음이 적다.
const MIN_SCORE = 2;

function search(items, audience, utterance) {
  return items
    .filter((it) => it.audience === audience)
    .map((it) => ({ it, score: scoreItem(it, utterance) }))
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
}

/* ===================== 카카오 응답 포맷 ===================== */

const BROWSE_LABEL = "다른 질문 보기";

function quickReply(label) {
  // 라벨은 카카오 규격상 14자 제한이라 넘치면 잘린다.
  const short = label.length > 14 ? label.slice(0, 13) + "…" : label;
  return { label: short, action: "message", messageText: label };
}

function reply(outputs, quickReplies) {
  const template = { outputs };
  if (quickReplies && quickReplies.length) template.quickReplies = quickReplies.slice(0, 10);
  return { version: "2.0", template };
}

const text = (t) => ({ simpleText: { text: t } });

/* ===================== 핸들러 ===================== */

exports.kakaoSkill = onRequest({ region: REGION, cors: false }, async (req, res) => {
  if (req.method !== "POST") return void res.status(405).send("method_not_allowed");

  const body = req.body || {};

  // 우리 봇이 보낸 요청인지 확인. KAKAO_BOT_ID 를 안 넣었으면 검증을 건너뛴다.
  if (KAKAO_BOT_ID && s(body?.bot?.id) !== KAKAO_BOT_ID) {
    console.warn("[kakaoSkill] bot.id 불일치:", s(body?.bot?.id));
    return void res.status(403).send("forbidden");
  }

  const audience = s(req.query.audience) === "owner" ? "owner" : "user";
  const utterance = s(body?.userRequest?.utterance);

  try {
    const items = await loadFaq();

    // 시드 전이라 답할 게 아예 없다 — 사람에게 넘긴다.
    if (!items.length) {
      return void res.json(reply([text(handoffText(audience))]));
    }

    // 이 채널의 기본 대상 항목. 구장주 항목이 전부 초안(비노출)이면 비어 있을 수 있으므로,
    // 목록·후보 제시에는 비었을 때 전체로 대체한다(빈 목록을 보여주면 대화가 막힌다).
    const pool = items.filter((it) => it.audience === audience);
    const suggestPool = pool.length ? pool : items;

    // 목록 버튼은 FAQ 검색을 태우면 안 된다(어디에도 안 걸려서 "이해 못했어요"가 나온다).
    if (norm(utterance) === norm(BROWSE_LABEL)) {
      return void res.json(
        reply(
          [text("자주 묻는 질문이에요. 궁금한 항목을 골라주세요.")],
          suggestPool.slice(0, 9).map((it) => quickReply(it.q))
        )
      );
    }

    // 1차는 이 채널의 기본 대상에서 찾고, 못 찾으면 반대편도 뒤진다.
    //
    // 왜 필요한가: 오픈빌더는 발화마다 블록을 새로 매칭해서 "구장주 모드"가 유지되지 않는다.
    // 구장주가 전용 블록에 한 번 들어가도 다음 질문은 다시 폴백(사용자)으로 떨어진다.
    // 채널이 하나뿐이라 폴백 하나가 양쪽을 다 받아야 하고, 그러려면 여기서 넘어가 줘야 한다.
    // 구장주 용어(정산·사업자·입점)와 사용자 용어가 거의 안 겹쳐서 오답 위험은 낮다.
    const other = audience === "owner" ? "user" : "owner";
    let hits = search(items, audience, utterance);
    if (!hits.length) hits = search(items, other, utterance);

    if (!hits.length) {
      const suggestions = suggestPool.slice(0, 5).map((it) => quickReply(it.q));
      return void res.json(
        reply(
          [
            text(
              "죄송해요, 질문을 정확히 이해하지 못했어요.\n아래에서 골라주시거나, 다르게 한 번 더 말씀해 주세요.\n\n" +
                handoffText(audience)
            ),
          ],
          suggestions
        )
      );
    }

    const best = hits[0].it;
    const related = hits
      .slice(1, 4)
      .map((r) => quickReply(r.it.q))
      .concat(quickReply(BROWSE_LABEL));

    return void res.json(reply([text(`${best.q}\n\n${best.a}`)], related));
  } catch (e) {
    // 여기서 에러를 던지면 사용자는 아무 응답도 못 받는다. 항상 사람에게 넘길 길은 열어둔다.
    console.error("[kakaoSkill] 실패:", e?.message || e);
    return void res.json(reply([text(handoffText(audience))]));
  }
});

function handoffText(audience) {
  return audience === "owner"
    ? `더 자세한 안내가 필요하시면 구장주 앱 내정보 > 1:1 문의로 남겨주세요. 담당자가 확인 후 답변드립니다.\n${APP_WEB_BASE}`
    : `더 자세한 안내가 필요하시면 앱 내정보 > 1:1 문의로 남겨주세요. 담당자가 확인 후 답변드립니다.\n${APP_WEB_BASE}`;
}
