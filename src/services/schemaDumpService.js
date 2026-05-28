// src/services/schemaDumpService.js
/* eslint-disable */

import { db } from "./firebase";
import { collection, getDocs, limit, query } from "firebase/firestore";

const __PROD_DISABLED__ = process.env.NODE_ENV === "production";

/**
 * =========================================================
 * Value Dump (Front-only) — SUBCOLLECTION MAP 기반
 * =========================================================
 * - Firestore client는 subcollection "목록" 자동열거 불가
 * - 그래서 "어떤 subcollection이 있는지"를 SSOT 맵으로 정의하고,
 *   그 맵을 따라가며 sampleCount 만큼 문서를 읽어서 "실제 값(data)"을 덤프한다.
 *
 * ENV:
 * - REACT_APP_SCHEMA_DUMP=1 일 때만 동작
 */

/** ✅ SSOT: subcollection 구조 맵 */
export const SUBCOL_MAP = {
  chatRooms: ["messages"],
  clubs: ["members", "joinRequests"],
};

/** ✅ 어떤 루트 컬렉션을 덤프할지 기본값 */
export const DEFAULT_ROOT_COLLECTIONS = [
  "chatRooms",
  "clubs",
  "community_posts",
  "games",
  "match_requests",
  "notifications",
  "users",
  "users_by_phone",
  "tasks",
];

function isEnabled() {
  const raw = String(process.env.REACT_APP_SCHEMA_DUMP || "");
  const on = raw === "1";
  console.log("[ValueDump] env REACT_APP_SCHEMA_DUMP =", raw, "=> enabled =", on);
  return on;
}

function safeNum(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

async function readCollectionSample(colPath, sampleCount) {
  try {
    const colRef = collection(db, colPath);
    const q = query(colRef, limit(sampleCount));
    const snap = await getDocs(q);

    const docs = [];
    snap.forEach((d) => docs.push({ id: d.id, data: d.data() || {} }));

    return { ok: true, docs, error: "" };
  } catch (e) {
    return { ok: false, docs: [], error: e?.message || String(e) };
  }
}

async function dumpDocTree({ rootCol, docPath, depth, maxDepth, sampleCount }) {
  const out = {
    docPath,
    subcollections: {},
  };

  if (depth >= maxDepth) return out;

  const subcols = Array.isArray(SUBCOL_MAP[rootCol]) ? SUBCOL_MAP[rootCol] : [];
  if (!subcols.length) return out;

  for (const subName of subcols) {
    const subColPath = `${docPath}/${subName}`;
    const subRes = await readCollectionSample(subColPath, sampleCount);

    out.subcollections[subName] = {
      ok: !!subRes.ok,
      error: subRes.ok ? "" : subRes.error,
      sampled: Array.isArray(subRes.docs) ? subRes.docs.length : 0,
      docs: Array.isArray(subRes.docs) ? subRes.docs : [],
    };
  }

  return out;
}

export async function runSchemaDumpFront({
  rootCollections = DEFAULT_ROOT_COLLECTIONS,
  sampleCount = 4,
  maxDepth = 2,
} = {}) {
  if (process.env.NODE_ENV === "production") return null;
  if (!isEnabled()) {
    console.log("[ValueDump] disabled by env");
    return null;
  }

  const sc = safeNum(sampleCount, 2, 1, 10);
  const md = safeNum(maxDepth, 2, 1, 4);

  const targets =
    Array.isArray(rootCollections) && rootCollections.length
      ? rootCollections
      : DEFAULT_ROOT_COLLECTIONS;

  const snapshot = {
    meta: {
      at: new Date().toISOString(),
      sampleCount: sc,
      maxDepth: md,
      rootCollections: targets,
      subcolMap: SUBCOL_MAP,
      mode: "value_dump",
    },
    collections: {},
  };

  for (const colName of targets) {
    const res = await readCollectionSample(colName, sc);

    const entry = {
      ok: !!res.ok,
      error: res.ok ? "" : res.error,
      sampled: Array.isArray(res.docs) ? res.docs.length : 0,
      docs: Array.isArray(res.docs) ? res.docs : [],
      docTrees: {},
    };

    const hasSub = Array.isArray(SUBCOL_MAP[colName]) && SUBCOL_MAP[colName].length > 0;
    if (hasSub) {
      for (const row of entry.docs) {
        const docPath = `${colName}/${row.id}`;
        entry.docTrees[row.id] = await dumpDocTree({
          rootCol: colName,
          docPath,
          depth: 0,
          maxDepth: md,
          sampleCount: sc,
        });
      }
    }

    snapshot.collections[colName] = entry;
  }

  if (typeof window !== "undefined") {
    window.__SCHEMA_SNAPSHOT__ = snapshot;
  }

  console.groupCollapsed("[VALUE_DUMP_SNAPSHOT]");
  console.log(snapshot);
  console.groupEnd();

  return snapshot;
}
