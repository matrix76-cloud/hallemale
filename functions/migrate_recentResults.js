/* eslint-disable */
// functions/migrate_recentResults.js
// clubs.stats.recentResults 를 "경기 날짜순"으로 재생성하는 일회성 마이그레이션.
//
// 배경: recentResults 는 결과 '반영(수락) 순서'로 prepend 되어, 시드/오래된 경기가
//       나중에 반영되면 날짜순(경기기록)과 어긋남 → 최근전적/연승 표시가 경기기록과 불일치.
//
// 동작: 각 클럽의 finished 경기를 날짜(scheduledAt→confirmedAt→…→createdAt)순으로 정렬해
//       클럽 관점 W/L/D 를 계산, recentResults(최신이 index 0) 최대 5개로 재생성.
//       --full 지정 시 wins/losses/draws/totalMatches/winRate 도 finished 경기로 재집계.
//
// 사용법 (functions 디렉터리에서):
//   node migrate_recentResults.js           # dry-run (변경 미리보기만, 쓰기 없음)
//   node migrate_recentResults.js --apply    # recentResults 만 실제 반영
//   node migrate_recentResults.js --apply --full   # 집계(wins/losses/…)까지 재계산 반영

const admin = require("firebase-admin");
const keyPath = "C:/Users/hdl48/OneDrive/바탕 화면/ilsaeng/halle-bf789-firebase-adminsdk-fbsvc-54ff45a1b0.json";
admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
const db = admin.firestore();
const FV = admin.firestore.FieldValue;

const APPLY = process.argv.includes("--apply");
const FULL = process.argv.includes("--full");

const toStr = (v) => String(v ?? "").trim();
const tsMs = (v) => {
  if (!v) return 0;
  if (v.toMillis) return v.toMillis();
  if (v.toDate) return v.toDate().getTime();
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
};
const matchTime = (m) =>
  tsMs(m.scheduledAt) || tsMs(m.confirmedAt) || tsMs(m.finishedAt) || tsMs(m.updatedAt) || tsMs(m.createdAt);

(async () => {
  console.log(`\n=== recentResults 마이그레이션 (${APPLY ? "APPLY" : "DRY-RUN"}${FULL ? " +FULL집계" : ""}) ===\n`);

  // 1) 모든 finished 경기 로드
  const msnap = await db.collection("match_requests").get();
  const finished = [];
  msnap.forEach((d) => {
    const m = { id: d.id, ...(d.data() || {}) };
    if (toStr(m.status) !== "finished") return;
    if (!Number.isFinite(Number(m.myScore)) || !Number.isFinite(Number(m.oppScore))) return;
    finished.push(m);
  });

  // 2) 클럽별로 모으기
  const byClub = {}; // clubId -> [{outcome, time, id}]
  const push = (clubId, outcome, m) => {
    const cid = toStr(clubId);
    if (!cid) return;
    (byClub[cid] = byClub[cid] || []).push({ outcome, time: matchTime(m), id: m.id });
  };
  finished.forEach((m) => {
    const a = toStr(m.actorClubId);
    const t = toStr(m.targetClubId);
    const aScore = Number(m.myScore); // 문서 규약: myScore=actor, oppScore=target
    const tScore = Number(m.oppScore);
    const aRes = aScore > tScore ? "W" : aScore < tScore ? "L" : "D";
    const tRes = aScore > tScore ? "L" : aScore < tScore ? "W" : "D";
    push(a, aRes, m);
    push(t, tRes, m);
  });

  // 3) 클럽 stats 갱신
  const clubs = await db.collection("clubs").get();
  let changed = 0;
  for (const d of clubs.docs) {
    const c = d.data() || {};
    const cur = c.stats || {};
    const list = (byClub[d.id] || []).sort((x, y) => {
      const dt = y.time - x.time;
      if (dt !== 0) return dt;
      return y.id > x.id ? 1 : y.id < x.id ? -1 : 0; // 동일 시각 id 내림차순 (앱 경기기록과 동일)
    });

    const recentResults = list.map((x) => x.outcome).slice(0, 5);

    // 집계(--full)
    const wins = list.filter((x) => x.outcome === "W").length;
    const losses = list.filter((x) => x.outcome === "L").length;
    const draws = list.filter((x) => x.outcome === "D").length;
    const totalMatches = list.length;
    const winRate = totalMatches > 0 ? wins / totalMatches : 0;

    const curRecent = Array.isArray(cur.recentResults) ? cur.recentResults : [];
    const recentChanged = JSON.stringify(curRecent) !== JSON.stringify(recentResults);
    const aggChanged =
      FULL &&
      (Number(cur.wins || 0) !== wins ||
        Number(cur.losses || 0) !== losses ||
        Number(cur.draws || 0) !== draws ||
        Number(cur.totalMatches || 0) !== totalMatches);

    if (!recentChanged && !aggChanged) continue;
    changed += 1;

    console.log(`[${c.name || d.id}] (${d.id})`);
    if (recentChanged) console.log(`  recentResults: ${JSON.stringify(curRecent)} -> ${JSON.stringify(recentResults)}`);
    if (aggChanged) {
      console.log(`  집계: ${cur.wins||0}승 ${cur.losses||0}패 ${cur.draws||0}무 (${cur.totalMatches||0}전) -> ${wins}승 ${losses}패 ${draws}무 (${totalMatches}전)`);
    }

    if (APPLY) {
      const patch = { recentResults, updatedAt: FV.serverTimestamp() };
      if (FULL) {
        patch.wins = wins; patch.losses = losses; patch.draws = draws;
        patch.totalMatches = totalMatches; patch.winRate = winRate;
      }
      await d.ref.set({ stats: { ...cur, ...patch } }, { merge: true });
      console.log(`  ✅ 반영됨`);
    }
  }

  console.log(`\n총 ${changed}개 클럽 ${APPLY ? "반영" : "변경 예정"}.${APPLY ? "" : " (--apply 로 실제 반영)"}\n`);
  process.exit(0);
})().catch((e) => { console.error("ERROR:", e); process.exit(1); });
