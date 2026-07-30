/* eslint-disable */
// functions/business/searchSchool.js
// NEIS 교육정보 개방포털 학교기본정보 검색 프록시
//
// 왜 프록시인가:
//   1) 서비스키를 클라이언트 번들에 박을 수 없다.
//   2) 학교는 사업자등록번호가 없어 국세청 대조를 못 한다. 대신 "실재하는 학교인가"를
//      NEIS 로 확인하고, 학교명·주소·대표번호를 사용자가 자유 입력하지 못하게 서버가 준 값으로 고정한다.
//      → 심사자가 그 대표번호로 전화해 담당자가 맞는지 확인하는 것이 권한 검증의 실체다.
//      (사용자가 번호를 직접 적게 두면 사칭자가 자기 번호를 적어 검증이 무력화된다)
//
// 🔑 서비스키: open.neis.go.kr 인증키 신청 후 Functions 환경변수 NEIS_API_KEY 에 넣는다.
//    키 미설정이면 { configured:false } → 클라는 학교명 자유 입력 + 서류 심사로 폴백한다.

const { onRequest } = require("firebase-functions/v2/https");
const { getAdmin } = require("../firebaseAdmin");

const NEIS_URL = "https://open.neis.go.kr/hub/schoolInfo";

function s(v) { return String(v ?? "").trim(); }

exports.searchSchool = onRequest(
  { region: "asia-northeast3", cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const name = s(req.body?.name);
    if (name.length < 2) {
      res.status(400).json({ error: "invalid_params" });
      return;
    }

    // 🔒 로그인한 사용자만 — 공개 엔드포인트로 두면 우리 키로 남의 조회 트래픽을 태울 수 있다.
    const admin = getAdmin();
    const m = String(req.headers.authorization || "").match(/^Bearer (.+)$/);
    if (!m) { res.status(401).json({ error: "unauthenticated" }); return; }
    try {
      await admin.auth().verifyIdToken(m[1]);
    } catch (e) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }

    const key = process.env.NEIS_API_KEY || "";
    if (!key) {
      res.status(200).json({ configured: false });
      return;
    }

    try {
      const url = `${NEIS_URL}?KEY=${encodeURIComponent(key)}&Type=json&pIndex=1&pSize=50`
        + `&SCHUL_NM=${encodeURIComponent(name)}`;
      const r = await fetch(url);
      const j = await r.json().catch(() => ({}));

      // NEIS 응답: { schoolInfo: [ {head:[...]}, {row:[...]} ] }  /  결과없음: { RESULT: { CODE: "INFO-200" } }
      const rows = j?.schoolInfo?.[1]?.row;
      if (!Array.isArray(rows)) {
        const code = s(j?.RESULT?.CODE) || s(j?.schoolInfo?.[0]?.head?.[1]?.RESULT?.CODE);
        if (code === "INFO-200") { res.status(200).json({ configured: true, schools: [] }); return; }
        console.error("[searchSchool] unexpected response", JSON.stringify(j).slice(0, 500));
        res.status(200).json({ configured: true, schools: [], error: "조회에 실패했어요. 잠시 후 다시 시도해주세요." });
        return;
      }

      const schools = rows.map((x) => ({
        code: s(x.SD_SCHUL_CODE),        // 표준학교코드 — 동명이교 구분의 유일한 키
        officeCode: s(x.ATPT_OFCDC_SC_CODE),
        name: s(x.SCHUL_NM),
        kind: s(x.SCHUL_KND_SC_NM),      // 초등학교/중학교/고등학교/…
        address: s(x.ORG_RDNMA),         // 도로명주소
        // 사용자가 못 고치는 값 — 심사 담당자가 이 번호로 확인한다.
        tel: s(x.ORG_TELNO),
        homepage: s(x.HMPG_ADRES),
        foundKind: s(x.FOND_SC_NM),      // 공립/사립
      })).filter((x) => x.code && x.name);

      res.status(200).json({ configured: true, schools });
    } catch (err) {
      console.error("[searchSchool] error", err);
      res.status(500).json({ error: err.message || "internal_error" });
    }
  }
);
