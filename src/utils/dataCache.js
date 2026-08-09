// src/utils/dataCache.js
// 화면 간 이동에서 같은 데이터를 다시 받느라 스피너가 뜨는 걸 막는 세션 캐시.
//
// 문제: 앱의 거의 모든 화면이 `useState(true)` 로 시작해 mount 마다 Firestore 를 한 번 왕복하고,
//       그동안 화면 전체를 스피너로 덮는다. 탭을 왔다 갔다 하기만 해도 매번 로딩이 뜬다.
//       데이터는 조금 전과 같은데도.
//
// 방식(stale-while-revalidate): 캐시가 있으면 **동기적으로** 즉시 돌려줘 스피너 없이 그리고,
//       뒤에서 새로 받아 갱신한다. 캐시가 없을 때만 예전처럼 스피너를 띄운다.
//
// - 메모리에만 둔다. 새로고침하면 사라진다(로그인 세션 단위 캐시). 민감정보를 디스크에
//   남기지 않으려는 의도이기도 하다.
// - TTL 이 지난 값도 버리지 않는다. "낡았지만 즉시 보여줄 수 있는 값"이 빈 화면보다 낫다.
//   대신 stale 이면 호출부가 뒤에서 다시 받는다(peek 의 stale 플래그).

const store = new Map(); // key -> { at: number, data: any }
const inflight = new Map(); // key -> Promise

const DEFAULT_TTL = 60 * 1000;

/**
 * 캐시를 동기적으로 들여다본다. 렌더 중에 호출해 초기 state 를 채우는 용도.
 * @returns {{ data:any, stale:boolean } | null}
 */
export function peekCache(key, ttl = DEFAULT_TTL) {
  if (!key) return null;
  const hit = store.get(key);
  if (!hit) return null;
  return { data: hit.data, stale: Date.now() - hit.at > ttl };
}

export function putCache(key, data) {
  if (!key) return data;
  store.set(key, { at: Date.now(), data });
  return data;
}

/**
 * 키 또는 접두사로 캐시를 비운다. 쓰기 직후(작성·수정·삭제) 호출해
 * 다음 진입에서 낡은 목록이 보이지 않게 한다.
 * @param {string} prefix 빈 문자열이면 전체 삭제
 */
export function invalidateCache(prefix = "") {
  if (!prefix) {
    store.clear();
    inflight.clear();
    return;
  }
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) store.delete(k);
  }
  for (const k of Array.from(inflight.keys())) {
    if (k.startsWith(prefix)) inflight.delete(k);
  }
}

/**
 * loader 를 호출하되 같은 키의 동시 호출은 하나로 합친다(중복 왕복 방지).
 * 결과는 캐시에 넣는다.
 */
export function loadCached(key, loader) {
  if (!key) return Promise.resolve(loader());

  const running = inflight.get(key);
  if (running) return running;

  const p = Promise.resolve()
    .then(loader)
    .then((data) => {
      putCache(key, data);
      return data;
    })
    .finally(() => {
      if (inflight.get(key) === p) inflight.delete(key);
    });

  inflight.set(key, p);
  return p;
}

/**
 * TTL 안이면 네트워크를 아예 타지 않고 캐시를 돌려준다(loadCached 와 다른 점).
 * 전체 컬렉션을 훑는 랭킹 맵처럼 "비싸고 자주 안 변하는" 값에 쓴다.
 * 동시 호출은 하나로 합쳐지므로, 한 화면에서 여러 섹션이 같이 불러도 왕복은 한 번이다.
 */
export function getOrLoad(key, loader, ttl = DEFAULT_TTL) {
  const hit = peekCache(key, ttl);
  if (hit && !hit.stale) return Promise.resolve(hit.data);
  return loadCached(key, loader);
}
