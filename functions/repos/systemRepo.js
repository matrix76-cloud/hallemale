/* eslint-disable */
// functions/repos/systemRepo.js
const { getDb, getAdmin } = require("../firebaseAdmin");

function sysRef(key) {
  return getDb().collection("_system").doc(String(key || "default"));
}

async function acquireOnceLock(lockKey) {
  const ref = sysRef(lockKey);
  const db = getDb();
  const now = getAdmin().firestore.FieldValue.serverTimestamp();

  // 트랜잭션으로 최초 1회만 획득
  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : null;

    if (data?.done === true) {
      return { ok: true, acquired: false, doneAt: data?.doneAt || null };
    }

    tx.set(
      ref,
      {
        key: lockKey,
        done: true,
        doneAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    return { ok: true, acquired: true };
  });
}

module.exports = { acquireOnceLock };
