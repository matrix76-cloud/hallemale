/* eslint-disable */
// src/utils/matchmaking.js
// 빠른 매칭 후보 정렬 — "누구를 먼저 보여줄까"를 정하는 단일 출처.
//
// 이전에는 상대 공개 화면이 clubs 최신순 배열을 그대로 cycle % length 로 돌렸다.
// 그래서 (1) 최근 만들어진 팀이 항상 먼저 뜨고 (2) 전력·지역·활동량이 순서에 전혀
// 반영되지 않았다. 화면은 "지역·전력·활동량을 종합하고 있어요"라고 말하는데 실제로는
// 아무것도 종합하지 않았다.
//
// 여기서는 하드 필터(못 붙는 팀 제거) → 점수화(붙을 만한 순서) → 다양성 샘플링
// 순으로 후보 큐를 한 번 만들고, 화면은 그 큐를 순서대로 소비한다.
//
// I/O 없음(순수 함수) — 화면이 이미 들고 있는 데이터만 받는다.

import { estimateWinProbability } from "./matchAnalysis";
import { MIN_TEAM_MEMBERS } from "./constants";

const str = (v) => String(v || "").trim();
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const teamId = (t) => str(t?.clubId || t?.id);

/* 점수 가중치 (합 100). 화면 문구("지역·전력·활동량")와 이 표가 어긋나면 안 된다. */
export const WEIGHTS = {
  balance: 40,   // 전력 균형 — 이길지 질지 모르는 경기가 가장 재미있다
  region: 25,    // 지역 근접 — 이동 거리가 성사율을 가장 크게 가른다
  activity: 15,  // 활동량 — 경기를 실제로 치르는 팀
  size: 10,      // 인원 규모 — 우리 팀과 비슷해야 인원 맞추기가 쉽다
  rank: 10,      // 랭킹 인접 — 리그 체감을 만든다
};

/* 상위 후보 중 몇 팀까지를 "섞어서" 보여줄지.
   1등만 계속 밀면 인기 팀에 요청이 몰려 응답률이 떨어진다(승자독식).
   반대로 전부 섞으면 정렬한 의미가 없다 — 상위 풀 안에서만 점수 비례로 뽑는다. */
const DIVERSITY_POOL = 24;

/** 전력 균형 — 예상 승률이 50%에 가까울수록 1. ±35%p 를 벗어나면 0. */
function balanceScore(myTeam, opp) {
  if (!myTeam || !opp) return 0.5;
  let prob = null;
  try {
    prob = estimateWinProbability(myTeam, opp)?.prob ?? null;
  } catch (e) {
    prob = null;
  }
  if (prob == null) return 0.5; // 전적이 없는 신생팀 — 중립. 배제하지 않는다.
  const p = Number(prob) > 1 ? Number(prob) / 100 : Number(prob); // 0~1 / 0~100 양쪽 방어
  if (!Number.isFinite(p)) return 0.5;
  return clamp01(1 - Math.abs(p - 0.5) / 0.35);
}

/** 지역 근접 — 같은 구 > 같은 시/도 > 그 외. */
function regionScore(opp, { regionGu, regionSido }) {
  if (!regionGu && !regionSido) return 0.6; // 지역을 안 고른 탐색 — 지역으로 줄 세우지 않는다
  const gu = str(opp.regionGu);
  const sido = str(opp.regionSido);
  const free = str(opp.region);
  if (regionGu && (gu === regionGu || (!gu && free.includes(regionGu)))) return 1;
  if (regionSido && (sido === regionSido || (!sido && free.includes(regionSido)))) return 0.55;
  return 0.15;
}

/** 활동량 — 치른 경기 수(10경기에서 포화) + 최근 경기 기록 보유. */
function activityScore(opp) {
  const total = Number(opp?.stats?.totalMatches) || 0;
  const recent = Array.isArray(opp?.stats?.recentResults) ? opp.stats.recentResults.length : 0;
  return clamp01(Math.min(1, total / 10) * 0.7 + Math.min(1, recent / 3) * 0.3);
}

/** 인원 규모 — 우리 팀과 인원 차이가 작을수록 1. 6명 차이면 0. */
function sizeScore(myCount, oppCount) {
  if (!myCount || !oppCount) return 0.5;
  return clamp01(1 - Math.abs(oppCount - myCount) / 6);
}

/** 랭킹 인접 — 순위 차 50위에서 0. 둘 중 하나라도 순위가 없으면 중립. */
function rankScore(myRank, oppRank) {
  if (!myRank || !oppRank) return 0.5;
  return clamp01(1 - Math.abs(myRank - oppRank) / 50);
}

/** 점수가 높은 항목을 사용자 문구로 (상대 카드에 "왜 이 팀인지" 표시). */
function reasonsOf(parts) {
  const labels = {
    balance: "전력이 비슷해요",
    region: "가까운 지역이에요",
    activity: "최근 활동이 활발해요",
    size: "팀 인원이 비슷해요",
    rank: "랭킹이 가까워요",
  };
  return Object.entries(parts)
    .filter(([k, v]) => v >= 0.7)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k]) => labels[k]);
}

/**
 * 후보 팀을 매칭 적합도 순으로 정렬한다.
 *
 * @param {object}   p
 * @param {object}   p.myTeam         내 팀(members 포함 프로필)
 * @param {object[]} p.candidates     상대 후보 (matchingHomeService.opponentTeams)
 * @param {Map}      p.memberCounts   clubId → 멤버 수 (null 이면 인원 필터 생략)
 * @param {string}   p.regionGu       사용자가 고른 구
 * @param {string}   p.regionSido     사용자가 고른 시/도
 * @param {Map}      [p.rankMap]      clubId → 팀 랭킹
 * @param {string[]} [p.excludeIds]   제외할 clubId (이미 매칭 중·최근 거절 등)
 * @returns {{ queue: object[], widened: boolean, total: number }}
 *   queue    — 보여줄 순서대로 정렬된 후보 (score·reasons 가 붙는다)
 *   widened  — 고른 지역에 후보가 없어 범위를 넓혔는지
 */
export function rankOpponents({
  myTeam,
  candidates = [],
  memberCounts = null,
  regionGu = "",
  regionSido = "",
  rankMap = null,
  excludeIds = [],
} = {}) {
  const gu = str(regionGu);
  const sido = str(regionSido);
  const mineId = teamId(myTeam);
  const blocked = new Set(excludeIds.map(str).filter(Boolean));

  // ── 1) 하드 필터 — 여기서 걸리는 팀은 어떤 점수로도 되살아나지 않는다.
  const passesHard = (t) => {
    const id = teamId(t);
    if (!id || id === mineId || blocked.has(id)) return false;
    if (memberCounts) {
      const n = Number(memberCounts.get(id)) || 0;
      if (n < MIN_TEAM_MEMBERS) return false; // 3대3 한 팀을 못 채우는 팀
    }
    return true;
  };
  const eligible = (Array.isArray(candidates) ? candidates : []).filter(passesHard);

  // ── 2) 지역 단계 확장 — 고른 구 → 같은 시/도 → 전국. 데드엔드보다 넓히는 쪽이 낫다.
  let scoped = eligible;
  let widened = false;
  if (gu || sido) {
    const inGu = eligible.filter((t) => regionScore(t, { regionGu: gu, regionSido: "" }) === 1);
    const inSido = eligible.filter((t) => regionScore(t, { regionGu: "", regionSido: sido }) >= 0.55);
    if (inGu.length) scoped = inGu;
    else if (inSido.length) { scoped = inSido; widened = true; }
    else { scoped = eligible; widened = eligible.length > 0; }
  }

  // ── 3) 점수화
  const myCount = memberCounts ? Number(memberCounts.get(mineId)) || 0 : 0;
  const myMembers = Array.isArray(myTeam?.members) ? myTeam.members.length : 0;
  const myN = myCount || myMembers;
  const myRank = rankMap?.get?.(mineId) || null;

  const scored = scoped.map((t) => {
    const id = teamId(t);
    const parts = {
      balance: balanceScore(myTeam, t),
      region: regionScore(t, { regionGu: gu, regionSido: sido }),
      activity: activityScore(t),
      size: sizeScore(myN, memberCounts ? Number(memberCounts.get(id)) || 0 : 0),
      rank: rankScore(myRank, rankMap?.get?.(id) || null),
    };
    const score = Object.entries(parts).reduce((sum, [k, v]) => sum + v * WEIGHTS[k], 0);
    return { ...t, matchScore: Math.round(score), matchParts: parts, matchReasons: reasonsOf(parts) };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);

  // ── 4) 다양성 샘플링 — 상위 풀 안에서 점수에 비례해 뽑는다.
  //     정렬을 그대로 쓰면 매번 같은 1등이 뜨고 요청이 한 팀에 몰린다.
  const head = scored.slice(0, DIVERSITY_POOL);
  const tail = scored.slice(DIVERSITY_POOL);
  const queue = [];
  while (head.length) {
    const totalW = head.reduce((s, t) => s + Math.max(1, t.matchScore), 0);
    let r = Math.random() * totalW;
    let idx = head.length - 1;
    for (let i = 0; i < head.length; i += 1) {
      r -= Math.max(1, head[i].matchScore);
      if (r <= 0) { idx = i; break; }
    }
    queue.push(head.splice(idx, 1)[0]);
  }

  return { queue: queue.concat(tail), widened, total: queue.length + tail.length };
}
