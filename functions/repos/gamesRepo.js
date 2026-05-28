/* eslint-disable */
// functions/repos/gamesRepo.js
const { getDb, getAdmin } = require("../firebaseAdmin");

function gamesCol() {
  return getDb().collection("games");
}

function nowTs() {
  return getAdmin().firestore.FieldValue.serverTimestamp();
}

function toFsTimestampFromMs(ms) {
  const n = Number(ms || 0);
  if (!n || !Number.isFinite(n)) return null;
  return getAdmin().firestore.Timestamp.fromMillis(n);
}

async function upsertGames(games = []) {
  if (!Array.isArray(games) || games.length === 0) {
    return { ok: true, count: 0, newGameIds: [] };
  }

  const db = getDb();

  // 신규 여부 판별: 사전 존재 확인
  const ids = games
    .map((g) => String(g?.gameId || "").trim())
    .filter(Boolean);
  const uniqueIds = [...new Set(ids)];

  const existing = new Set();
  const CHUNK = 100;
  for (let i = 0; i < uniqueIds.length; i += CHUNK) {
    const slice = uniqueIds.slice(i, i + CHUNK);
    const refs = slice.map((id) => gamesCol().doc(id));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) if (s.exists) existing.add(s.id);
  }

  const batch = db.batch();
  const newGameIds = [];
  let count = 0;

  for (const g of games) {
    const gameId = String(g?.gameId || "").trim();
    if (!gameId) continue;

    const ref = gamesCol().doc(gameId);
    const startAt = toFsTimestampFromMs(g?.startAtMs);

    const payload = {
      ...g,
      startAt: startAt || null,
      updatedAt: nowTs(),
    };

    payload.createdAt = payload.createdAt || nowTs();

    batch.set(ref, payload, { merge: true });
    count += 1;

    if (!existing.has(gameId)) newGameIds.push(gameId);
  }

  if (count > 0) await batch.commit();
  return { ok: true, count, newGameIds };
}

module.exports = { upsertGames };
