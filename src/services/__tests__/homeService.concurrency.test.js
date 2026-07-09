/* eslint-disable */
// loadHomePageData 가 실제로 병렬로 도는지, clubs 전체 스캔이 한 번만 도는지 검증한다.
// Firestore 호출마다 OP_MS 지연을 주고 (a) 총 소요시간 (b) 호출 타임라인을 본다.

const OP_MS = 20;

jest.mock("../firebase", () => ({ db: { __db: true } }));

jest.mock("../rankingService", () => ({
  listPlayerRankingTopApprox: jest.fn(async () => {
    // 랭킹 조회 자체도 왕복 2회짜리라고 가정
    await new Promise((r) => setTimeout(r, OP_MS * 2));
    return [{ userId: "p1" }, { userId: "p2" }];
  }),
}));

const calls = [];
let t0 = 0;
const mark = (name) => calls.push({ name, at: Date.now() - t0 });
const delay = (ms = OP_MS) => new Promise((r) => setTimeout(r, ms));

jest.mock("firebase/firestore", () => ({
  collection: (_db, ...path) => ({ __col: path.join("/") }),
  doc: (_db, col, id) => ({ __doc: `${col}/${id}` }),
  query: (x) => x,
  limit: () => ({}),

  getDoc: jest.fn(async (ref) => {
    mark(`getDoc:${ref.__doc}`);
    await delay();
    if (ref.__doc === "users/me") {
      return {
        exists: () => true,
        id: "me",
        data: () => ({
          activeTeamId: "clubA",
          favoriteTeamIds: ["f1", "f2"],
          favoritePlayerIds: ["fp1"],
        }),
      };
    }
    if (ref.__doc === "rankings/playerTop") {
      return { exists: () => true, data: () => ({ firstSeen: {} }) };
    }
    if (ref.__doc.startsWith("clubs/")) {
      return {
        exists: () => true,
        id: ref.__doc.split("/")[1],
        data: () => ({ name: "T", stats: {} }),
      };
    }
    return { exists: () => true, id: "x", data: () => ({}) };
  }),

  getDocs: jest.fn(async (col) => {
    mark(`getDocs:${col.__col}`);
    await delay();
    if (col.__col === "clubs") {
      return {
        docs: [
          { id: "clubA", data: () => ({ name: "A", stats: {} }) },
          { id: "clubB", data: () => ({ name: "B", stats: {} }) },
        ],
        forEach(fn) { this.docs.forEach(fn); },
      };
    }
    return { size: 3, docs: [], forEach() {} };
  }),

  setDoc: jest.fn(async () => {
    mark("setDoc:rankings/playerTop");
    await delay();
  }),
}));

// ⚠️ resetModules 를 쓰므로 mock 함수 참조는 반드시 테스트 "안에서" 가져와야 한다.
//    (최상단에서 잡아 두면 리셋 이후 새로 만들어진 인스턴스와 다른 객체를 보게 된다)
const firestore = () => require("firebase/firestore");

beforeEach(() => {
  calls.length = 0;
  jest.resetModules();
  t0 = Date.now();
});

test("clubs 전체 스캔은 동시 호출돼도 한 번만 나간다", async () => {
  const { getDocs } = firestore();
  const { getAllClubDocs } = require("../clubsSnapshot");
  const [a, b] = await Promise.all([getAllClubDocs(), getAllClubDocs()]);

  const clubScans = getDocs.mock.calls.filter((c) => c[0].__col === "clubs");
  expect(clubScans).toHaveLength(1);
  expect(a).toBe(b);

  // 요청이 끝난 뒤에는 캐시가 비워져 다음 호출은 새로 읽는다 (staleness 없음)
  await getAllClubDocs();
  expect(getDocs.mock.calls.filter((c) => c[0].__col === "clubs")).toHaveLength(2);
});

test("loadHomePageData 는 독립 조회를 병렬로 돌린다", async () => {
  const { loadHomePageData } = require("../homeService");

  const started = Date.now();
  const res = await loadHomePageData({ uid: "me" });
  const elapsed = Date.now() - started;

  // 결과가 이전과 같은 모양인지
  expect(res.myTeam).toMatchObject({ clubId: "clubA", memberCount: 3 });
  expect(res.myTeamRank).toBeGreaterThan(0);
  expect(res.playerRankingTop5).toHaveLength(2);
  expect(res.favoriteTeams).toHaveLength(2);
  expect(res.favoritePlayers).toHaveLength(1);

  // 타임라인: users/me 가 아직 진행 중일 때 clubs 스캔이 이미 시작돼야 한다
  const meAt = calls.find((c) => c.name === "getDoc:users/me").at;
  const clubsAt = calls.find((c) => c.name === "getDocs:clubs").at;
  expect(clubsAt).toBeLessThan(meAt + OP_MS);

  // 임계 경로: me(1) → 내 팀(1) → 멤버수(1) = 3홉.
  // 직렬이었다면 8홉 = 160ms+. 여유를 둬도 5홉(100ms) 미만이어야 한다.
  expect(elapsed).toBeLessThan(OP_MS * 5);
});

test("랭킹 NEW 스냅샷 쓰기는 읽기 경로를 막지 않는다", async () => {
  const { setDoc } = firestore();

  // 쓰기를 아주 느리게 만든다. 읽기 경로가 이걸 await 한다면 홈 로딩도 같이 느려질 것이다.
  const SLOW_WRITE = 500;
  let writeFinished = false;
  setDoc.mockImplementation(async () => {
    mark("setDoc:rankings/playerTop");
    await delay(SLOW_WRITE);
    writeFinished = true;
  });

  const { loadHomePageData } = require("../homeService");

  const started = Date.now();
  await loadHomePageData({ uid: "me" });
  const elapsed = Date.now() - started;

  expect(setDoc).toHaveBeenCalledTimes(1);   // 쓰기는 분명히 발생했고
  expect(writeFinished).toBe(false);          // 아직 안 끝났는데
  expect(elapsed).toBeLessThan(SLOW_WRITE);   // 홈 로딩은 이미 끝났다
});
