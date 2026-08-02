/* eslint-disable */
// src/dev/mockBus.js — 개발 전용 목업 주입 버스.
//
// /review/board 의 프레임이 화면을 ?mock=<시나리오id> 로 띄우면, 그 시나리오가 정의한
// 데이터를 서비스·컨텍스트가 Firestore 대신 돌려준다 → 화면이 언제 열어도 똑같이 고정된다.
// (실데이터는 계속 변하므로 "경우의 수"를 고정 전시하려면 이 방식이 필요하다)
//
// 안전장치
//  · process.env.NODE_ENV === "development" 일 때만 활성 → 배포본에서는 절대 켜지지 않는다.
//  · 시나리오 데이터(mockScenarios.js)는 아래 가드 안의 require 로만 불러서
//    프로덕션 번들에 포함되지 않는다(웹팩이 false 분기를 제거).
//  · 주입은 "읽기"만 한다. 쓰기 함수(전송/수락/취소 등)는 목업일 때 no-op 으로 막는다.

const DEV = process.env.NODE_ENV === "development";

let SCENARIOS = {};
if (DEV) {
  try {
    SCENARIOS = require("./mockScenarios").SCENARIOS || {};
  } catch (e) {
    // 시나리오 파일이 깨져도 앱은 정상 동작해야 한다
    console.warn("[mockBus] mockScenarios load failed:", e && e.message);
    SCENARIOS = {};
  }
}

// URL 은 모듈 로드 시점에 한 번만 읽는다.
// 프레임 안에서 사용자가 다른 화면으로 이동해도 목업이 유지되도록(쿼리가 사라져도) 의도된 동작.
function readActive() {
  if (!DEV || typeof window === "undefined") return null;
  try {
    const id = new URLSearchParams(window.location.search).get("mock");
    if (!id) return null;
    const s = SCENARIOS[id];
    if (!s) {
      console.warn("[mockBus] unknown scenario:", id);
      return null;
    }
    return { id, ...s };
  } catch (e) {
    return null;
  }
}

const ACTIVE = readActive();

export const mockOn = !!ACTIVE;
export const mockId = ACTIVE ? ACTIVE.id : "";

// ?freeze=1 — 렌더되는 라우트를 진입 시점 위치로 고정한다.
// 스플래시의 setTimeout(navigate("/home")) 처럼 화면이 스스로 다음 화면으로 넘어가는
// 경우가 많아서, 보드 프레임에서는 이걸 막아야 "그 화면"이 계속 보인다.
// (URL 은 바뀌어도 <Routes location={고정}> 이라 렌더 트리는 그대로)
export const freezeRoute = (() => {
  if (!DEV || typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("freeze") === "1";
  } catch (e) {
    return false;
  }
})();

export function hasMock(key) {
  return !!(ACTIVE && ACTIVE.data && Object.prototype.hasOwnProperty.call(ACTIVE.data, key));
}

export function mockData(key) {
  return ACTIVE && ACTIVE.data ? ACTIVE.data[key] : undefined;
}

// Firestore QuerySnapshot 흉내 — 관리자 서비스들이 전부
//   const snap = await getDocs(q); snap.forEach((d) => rows.push(map(d)));
// 형태라, 스냅샷만 갈아끼우면 그 뒤 가공(정규화·메타 조립·정렬)은 실제 코드가 그대로 돈다.
// map 은 { id: data } 객체 또는 id 를 가진 배열 둘 다 받는다.
export function mockQuerySnap(src) {
  const list = Array.isArray(src)
    ? src.map((r) => ({ id: String(r?.id || ""), data: r }))
    : Object.keys(src || {}).map((id) => ({ id, data: src[id] }));
  const docs = list.map(({ id, data }) => ({
    id,
    exists: () => true,
    data: () => data,
    ref: { path: `mock/${id}`, id },
  }));
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (fn) => docs.forEach(fn),
  };
}

// 컨텍스트 value 오버라이드 — 실제 value 위에 시나리오가 정의한 키만 덮어쓴다.
export function mockMerge(key, real) {
  if (!hasMock(key)) return real;
  return { ...real, ...mockData(key) };
}

if (ACTIVE) {
  console.info(`[mockBus] scenario "${ACTIVE.id}" 활성 — 이 화면은 목업 데이터로 고정됩니다.`);
}
