// scripts/build-landing-data.mjs
// Firestore(clubs/users) -> web/data/landing.json 을 빌드 시점에 구워둔다.
//
// 왜 빌드 시점인가:
//   랜딩(web/)은 Firebase SDK가 없는 순수 정적 HTML이다. SDK를 실으면 번들 용량,
//   공개 읽기 보안규칙, 방문자당 Firestore 읽기 비용이 모두 새로 생긴다.
//   정적 JSON으로 구우면 셋 다 0이고 크롤러도 그대로 읽는다. 갱신은 배포 때 일어난다.
//
// 실패해도 빌드를 막지 않는다: 기존 landing.json 이 있으면 그대로 두고 넘어간다.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = resolve(root, "web", "data");
const outFile = resolve(outDir, "landing.json");

// 전적이 있는 팀이 이 수보다 적으면 랭킹을 "개막 전" 상태로 표시한다.
// 0점 팀으로 도배된 명예의 전당은 신뢰를 만들기는커녕 서비스가 비어 있음을 증명한다.
const MIN_RANKED_TEAMS = 3;

// 앱이 자동 생성하는 자리표시 닉네임(사용자1234). 명예의 전당에 올릴 실명이 아니다.
const PLACEHOLDER_NICK = /^사용자\d+$/;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const points = (s) => num(s?.wins) * 5 + num(s?.draws) * 2 + num(s?.losses) * 1;
const total = (s) => num(s?.totalMatches) || num(s?.wins) + num(s?.losses) + num(s?.draws);
const winRate = (s) => (total(s) > 0 ? Math.round((num(s.wins) / total(s)) * 100) : 0);

// 랭킹 정렬은 앱(teamRankingService/rankingService)과 동일하게: 점수 → 승률 → 경기수
const byRank = (a, b) => b.points - a.points || b.winRate - a.winRate || b.total - a.total;

async function main() {
  const app = initializeApp({
    apiKey: "AIzaSyDuU-SYy0dNSNiRzcdpO6wqDi7LG-uXSEU",
    authDomain: "halle-bf789.firebaseapp.com",
    projectId: "halle-bf789",
    storageBucket: "halle-bf789.firebasestorage.app",
    messagingSenderId: "939913723928",
    appId: "1:939913723928:web:7c25c0cf712f266d1cc36d",
  });
  const db = getFirestore(app);

  const clubSnap = await getDocs(collection(db, "clubs"));
  const clubs = [];
  clubSnap.forEach((d) => {
    const c = d.data();
    const s = c.stats || {};
    const name = String(c.name || "").trim();
    if (!name) return;
    clubs.push({
      name,
      region: String(c.region || "").trim(),
      logoUrl: c.logoUrl || c.imageUrl || "",
      wins: num(s.wins),
      draws: num(s.draws),
      losses: num(s.losses),
      total: total(s),
      points: points(s),
      winRate: winRate(s),
    });
  });

  const userSnap = await getDocs(collection(db, "users"));
  const players = [];
  userSnap.forEach((d) => {
    const u = d.data();
    const s = u.stats || {};
    const name = String(u.nickname || u.name || "").trim();
    if (!name || PLACEHOLDER_NICK.test(name)) return;
    if (total(s) === 0) return;
    players.push({
      name,
      clubName: String(u.clubName || "").trim(),
      wins: num(s.wins),
      draws: num(s.draws),
      losses: num(s.losses),
      total: total(s),
      points: points(s),
      winRate: winRate(s),
    });
  });

  const ranked = clubs.filter((c) => c.total > 0).sort(byRank);
  const regions = new Set(clubs.map((c) => c.region.split(" ")[0]).filter(Boolean));

  const data = {
    generatedAt: new Date().toISOString(),
    counts: {
      teams: clubs.length,
      members: userSnap.size,
      regions: regions.size,
    },
    // 흐르는 마퀴: 로고 있는 팀만 (빈 네모가 섞이면 벽의 밀도가 떨어진다)
    wall: clubs.filter((c) => c.logoUrl).map(({ name, region, logoUrl }) => ({ name, region, logoUrl })),
    // 아래 그리드: 로고 없는 팀도 이니셜로 채워 전체를 보여준다
    all: clubs.map(({ name, region, logoUrl }) => ({ name, region, logoUrl })),
    seasonOpen: ranked.length >= MIN_RANKED_TEAMS,
    teamRanking: ranked.slice(0, 10),
    playerRanking: players.sort(byRank).slice(0, 10),
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, JSON.stringify(data, null, 2));
  console.log(
    `[build-landing-data] 팀 ${data.counts.teams} · 로고 ${data.wall.length} · 전적보유팀 ${ranked.length} · 개인 ${data.playerRanking.length} -> ${outFile}`
  );
  process.exit(0);
}

main().catch((e) => {
  const msg = e?.code || e?.message || e;
  if (existsSync(outFile)) {
    console.warn(`[build-landing-data] Firestore 읽기 실패(${msg}) — 기존 landing.json 유지`);
    process.exit(0);
  }
  console.warn(`[build-landing-data] Firestore 읽기 실패(${msg}) — 빈 데이터로 진행(해당 섹션은 숨겨짐)`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    outFile,
    JSON.stringify({ generatedAt: null, counts: { teams: 0, members: 0, regions: 0 }, wall: [], seasonOpen: false, teamRanking: [], playerRanking: [] }, null, 2)
  );
  process.exit(0);
});
