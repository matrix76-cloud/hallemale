/* eslint-disable */
// 이중예약(같은 코트·같은 시간 두 건)이 막히는지 확인한다.
//
// 인메모리 Firestore 대역을 두고 읽기(getDocs/getDoc)에 왕복 지연(OP_MS)을 준다.
// 두 사용자가 같은 슬롯을 "동시에" 누르는 상황 = bookVenue 두 개를 Promise.all 로 띄우는 것.
//
// 예전에는 (1) 겹침 조회 → (2) addDoc 이라 트랜잭션이 아니었고, 두 호출의 조회가 서로의 쓰기보다
// 먼저 끝나면 둘 다 "빈 슬롯"으로 판정해 두 건이 들어갔다. 지금은 코트·날짜별 슬롯 락 문서를
// 트랜잭션으로 읽고 쓰므로 나중 것이 slot_taken 으로 막힌다.
// ⚠️ 이 테스트가 의미를 가지려면 목업 runTransaction 이 "읽은 문서가 바뀌면 재시도"를 흉내내야
//    한다(아래 구현). 그게 없으면 레이스 자체가 재현되지 않아 통과가 무의미해진다.

const OP_MS = 20;

// ── 인메모리 store ── (jest.mock 팩토리에서 참조하려면 이름이 mock* 이어야 한다)
let mockStore = {}; // { [collection]: { [id]: data } }
let mockSeq = 0;
// 문서별 쓰기 횟수 — 트랜잭션 충돌(읽은 뒤 남이 썼는가) 판정에 쓴다.
let mockVersions = {};

jest.mock("../firebase", () => ({ db: { __db: true }, ownerDb: { __db: "owner" }, ownerAuth: {} }));
jest.mock("../fizzService", () => ({ payFizz: jest.fn(async () => ({ ok: true })) }));

jest.mock("firebase/firestore", () => {
  const delay = () => new Promise((r) => setTimeout(r, 20)); // 네트워크 왕복

  const vkey = (ref) => `${ref.__col}/${ref.__id}`;
  const bump = (ref) => { mockVersions[vkey(ref)] = (mockVersions[vkey(ref)] || 0) + 1; };
  const DELETE = { __delete: true };

  // 점(.) 경로 patch 적용 — updateDoc({"ranges.abc": deleteField()}) 지원
  const applyPatch = (target, patch) => {
    const out = { ...(target || {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (!k.includes(".")) {
        if (v === DELETE) delete out[k]; else out[k] = v;
        continue;
      }
      const [head, ...rest] = k.split(".");
      const child = { ...(out[head] || {}) };
      const leaf = rest.join(".");
      if (v === DELETE) delete child[leaf]; else child[leaf] = v;
      out[head] = child;
    }
    return out;
  };

  return {
    collection: (_db, name) => ({ __col: name }),
    // doc(db, col, id) = 지정 문서 / doc(collectionRef) = 새 문서 id 미리 발급
    // 실제 DocumentReference 처럼 .id 를 노출해야 한다(코드가 addDoc 없이 id 를 먼저 쓴다).
    doc: (a, col, id) => {
      const docId = col === undefined ? `d${++mockSeq}` : id;
      return { __col: col === undefined ? a.__col : col, __id: docId, id: docId };
    },
    where: (field, op, value) => ({ __where: { field, op, value } }),
    query: (col, ...clauses) => ({ ...col, __clauses: clauses }),
    serverTimestamp: () => new Date(),
    deleteField: () => DELETE,

    // 실제 Firestore 트랜잭션과 같은 성질만 흉내낸다:
    //  · tx.get 으로 읽은 문서를 커밋 직전에 다시 확인해, 그 사이 남이 썼으면 통째로 재시도
    //  · 쓰기는 커밋 시점에 한꺼번에 반영
    // 이게 없으면 "동시 예약" 테스트가 레이스를 재현하지 못한다.
    runTransaction: jest.fn(async (_db, fn) => {
      for (let attempt = 0; attempt < 6; attempt++) {
        const readAt = {};
        const writes = [];
        const tx = {
          get: async (ref) => {
            await delay();
            readAt[vkey(ref)] = mockVersions[vkey(ref)] || 0;
            const data = (mockStore[ref.__col] || {})[ref.__id];
            return { exists: () => !!data, id: ref.__id, data: () => data };
          },
          set: (ref, data) => writes.push({ ref, data, merge: false }),
          update: (ref, patch) => writes.push({ ref, patch }),
          delete: (ref) => writes.push({ ref, del: true }),
        };
        const result = await fn(tx);
        await delay(); // 커밋 왕복

        const conflicted = Object.entries(readAt).some(([k, v]) => (mockVersions[k] || 0) !== v);
        if (conflicted) continue; // 읽은 문서가 그 사이 바뀌었다 → 처음부터 재시도

        for (const w of writes) {
          mockStore[w.ref.__col] = mockStore[w.ref.__col] || {};
          if (w.del) delete mockStore[w.ref.__col][w.ref.__id];
          else if (w.patch) {
            mockStore[w.ref.__col][w.ref.__id] = applyPatch(mockStore[w.ref.__col][w.ref.__id], w.patch);
          } else {
            mockStore[w.ref.__col][w.ref.__id] = { ...w.data };
          }
          bump(w.ref);
        }
        return result;
      }
      throw new Error("transaction failed after retries");
    }),

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
      bump({ __col: col.__col, __id: id });
      return { id };
    }),

    updateDoc: jest.fn(async (ref, patch) => {
      await delay();
      mockStore[ref.__col] = mockStore[ref.__col] || {};
      mockStore[ref.__col][ref.__id] = applyPatch(mockStore[ref.__col][ref.__id], patch);
      bump(ref);
    }),

    setDoc: jest.fn(async () => { await delay(); }),
    deleteDoc: jest.fn(async () => { await delay(); }),
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
  mockVersions = {};
  mockSeq = 0;
  jest.resetModules();
});

test("★ 같은 코트·같은 시간을 두 사용자가 동시에 예약하면 한 건만 통과한다", async () => {
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

// 락을 도입하면서 생긴 새 위험: 취소했는데 락을 안 비우면 그 시간대가 영구히 예약 불가가 된다.
// 원래 버그(둘 다 들어감)보다 나쁜 실패라 반드시 지켜야 한다.
test("★ 예약을 취소하면 슬롯이 반납돼 같은 시간을 다시 예약할 수 있다", async () => {
  const { bookVenue, cancelMyReservation } = require("../ownerVenueService");

  const first = await bookVenue({ venue: VENUE, court: COURT, date: DATE, ...SLOT, user: { uid: "userA", userName: "A" } });
  await cancelMyReservation(first.reservationId, "userA");

  // 같은 슬롯을 다른 사람이 다시 잡을 수 있어야 한다.
  const second = await bookVenue({ venue: VENUE, court: COURT, date: DATE, ...SLOT, user: { uid: "userB", userName: "B" } });
  expect(second.reservationId).toBeTruthy();
  expect(liveReservations()).toHaveLength(1);
});

test("★ 구장주가 겹치는 예약요청 두 건을 동시에 승인해도 한 건만 확정된다", async () => {
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
