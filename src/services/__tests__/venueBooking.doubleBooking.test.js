/* eslint-disable */
// 이중예약(같은 코트·같은 시간 두 건) 이 실제로 뚫리는지 확인한다.
//
// 인메모리 Firestore 대역을 두고 읽기(getDocs/getDoc)에 왕복 지연(OP_MS)을 준다.
// 두 사용자가 같은 슬롯을 "동시에" 누르는 상황 = bookVenue 두 개를 Promise.all 로 띄우는 것.
// bookVenue 는 (1) 겹침 조회 → (2) addDoc 이 트랜잭션이 아니라서, 두 호출의 조회가
// 서로의 쓰기보다 먼저 끝나면 둘 다 "빈 슬롯"으로 판정한다.

const OP_MS = 20;

// ── 인메모리 store ── (jest.mock 팩토리에서 참조하려면 이름이 mock* 이어야 한다)
let mockStore = {}; // { [collection]: { [id]: data } }
let mockSeq = 0;

jest.mock("../firebase", () => ({ db: { __db: true }, ownerAuth: {} }));
jest.mock("../fizzService", () => ({ payFizz: jest.fn(async () => ({ ok: true })) }));

jest.mock("firebase/firestore", () => {
  const delay = () => new Promise((r) => setTimeout(r, 20)); // 네트워크 왕복

  return {
    collection: (_db, name) => ({ __col: name }),
    doc: (_db, col, id) => ({ __col: col, __id: id }),
    where: (field, op, value) => ({ __where: { field, op, value } }),
    query: (col, ...clauses) => ({ ...col, __clauses: clauses }),
    serverTimestamp: () => new Date(),

    getDocs: jest.fn(async (q) => {
      await delay();
      const col = mockStore[q.__col] || {};
      const wheres = (q.__clauses || []).map((c) => c.__where).filter(Boolean);
      const docs = Object.entries(col)
        .filter(([, data]) => wheres.every((w) => data[w.field] === w.value))
        .map(([id, data]) => ({ id, data: () => data, exists: () => true }));
      return { docs, forEach: (fn) => docs.forEach(fn), size: docs.length };
    }),

    getDoc: jest.fn(async (ref) => {
      await delay();
      const data = (mockStore[ref.__col] || {})[ref.__id];
      return { exists: () => !!data, id: ref.__id, data: () => data };
    }),

    addDoc: jest.fn(async (col, data) => {
      await delay();
      const id = `d${++mockSeq}`;
      mockStore[col.__col] = mockStore[col.__col] || {};
      mockStore[col.__col][id] = { ...data };
      return { id };
    }),

    updateDoc: jest.fn(async (ref, patch) => {
      await delay();
      mockStore[ref.__col] = mockStore[ref.__col] || {};
      mockStore[ref.__col][ref.__id] = { ...(mockStore[ref.__col][ref.__id] || {}), ...patch };
    }),

    setDoc: jest.fn(async () => { await delay(); }),
    deleteDoc: jest.fn(async () => { await delay(); }),
    runTransaction: jest.fn(),
  };
});

// 오늘+3일 (예약 가능 창구 21일 안)
function bookableDate() {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const VENUE = { id: "v1", ownerUid: "owner1", name: "테스트구장", phone: "02-000-0000" };
const COURT = { id: "c1", name: "A코트", pricePerHour: 40000 };
const DATE = bookableDate();
const SLOT = { startTime: "19:00", endTime: "21:00" };

const liveReservations = () =>
  Object.entries(mockStore.venueReservations || {})
    .map(([id, d]) => ({ id, ...d }))
    .filter((r) => ["requested", "pending", "confirmed"].includes(r.status));

beforeEach(() => {
  mockStore = {};
  mockSeq = 0;
  jest.resetModules();
});

test("★ 같은 코트·같은 시간을 두 사용자가 동시에 예약하면 두 건 다 들어간다(이중예약)", async () => {
  const { bookVenue } = require("../ownerVenueService");

  const results = await Promise.allSettled([
    bookVenue({ venue: VENUE, court: COURT, date: DATE, ...SLOT, user: { uid: "userA", userName: "A" } }),
    bookVenue({ venue: VENUE, court: COURT, date: DATE, ...SLOT, user: { uid: "userB", userName: "B" } }),
  ]);

  const ok = results.filter((r) => r.status === "fulfilled");
  const rejectedAsTaken = results.filter(
    (r) => r.status === "rejected" && r.reason?.code === "slot_taken"
  );

  // 기대(정상 동작): 한 건만 성공하고 나머지는 slot_taken 으로 막힌다.
  expect(ok).toHaveLength(1);
  expect(rejectedAsTaken).toHaveLength(1);
  expect(liveReservations()).toHaveLength(1);
});

test("순차 예약(한 건 끝난 뒤 시도)은 정상적으로 막힌다 — 가드 자체는 동작함", async () => {
  const { bookVenue } = require("../ownerVenueService");

  await bookVenue({ venue: VENUE, court: COURT, date: DATE, ...SLOT, user: { uid: "userA", userName: "A" } });

  await expect(
    bookVenue({ venue: VENUE, court: COURT, date: DATE, ...SLOT, user: { uid: "userB", userName: "B" } })
  ).rejects.toMatchObject({ code: "slot_taken" });

  expect(liveReservations()).toHaveLength(1);
});

test("★ 구장주가 겹치는 예약요청 두 건을 동시에 승인하면 둘 다 confirmed 가 된다", async () => {
  const { bookVenue, setReservationStatus } = require("../ownerVenueService");

  // 위 레이스로 이미 두 건의 requested 가 들어간 상태를 재현
  const a = await bookVenue({ venue: VENUE, court: COURT, date: DATE, ...SLOT, user: { uid: "userA", userName: "A" } });
  mockStore.venueReservations.forced = {
    venueId: "v1", courtId: "c1", ownerUid: "owner1",
    date: DATE, startTime: SLOT.startTime, endTime: SLOT.endTime,
    userId: "userB", userName: "B", status: "requested",
  };

  await Promise.allSettled([
    setReservationStatus(a.reservationId, "confirmed"),
    setReservationStatus("forced", "confirmed"),
  ]);

  const confirmed = Object.values(mockStore.venueReservations).filter((r) => r.status === "confirmed");
  // 기대(정상 동작): 승인은 한 건만 통과해야 한다.
  expect(confirmed).toHaveLength(1);
});
