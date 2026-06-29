/* eslint-disable */
// src/utils/matchAnalysis.js
// ✅ 실데이터 기반 매칭 분석 유틸 (해시/랜덤 승률 mockWinProb 대체)
// - 두 팀의 stats(승/패/무, 경기수)와 members(인원/평균키/포지션)를 가중 계산
// - 데이터가 부족하면 "데이터 부족"으로 명시적 폴백
//
// 사용처:
//  - MatchAnalysisPage: estimateWinProbability(myTeam, oppTeam) (members까지 보유)
//  - AiRecommendedTeamsSection: estimateWinProbability(myTeam, oppTeam) (opp은 stats만 보유)

function toNum(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

/**
 * 팀의 전적 요약 (stats SSOT 우선, 루트 필드 폴백)
 */
export function readRecord(team) {
  const s = team?.stats || {};
  const wins = toNum(s.wins ?? team?.wins, 0);
  const losses = toNum(s.losses ?? team?.losses, 0);
  const draws = toNum(s.draws ?? team?.draws, 0);
  const totalFromParts = wins + losses + draws;
  const total = toNum(s.totalMatches, 0) || totalFromParts;
  const winRate =
    total > 0
      ? wins / total
      : typeof s.winRate === "number"
      ? s.winRate
      : 0;
  return { wins, losses, draws, total, winRate };
}

/**
 * 멤버 평균 키 (cm). 데이터 없으면 null.
 */
export function readAvgHeightCm(team) {
  const list = Array.isArray(team?.members) ? team.members : [];
  const nums = list
    .map((m) => toNum(m?.heightCm, 0))
    .filter((x) => x > 0);
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/**
 * 멤버 수. members 없으면 stats.memberCount 등 폴백, 그래도 없으면 0.
 */
export function readMemberCount(team) {
  const list = Array.isArray(team?.members) ? team.members : null;
  if (list) return list.length;
  return toNum(team?.memberCount ?? team?.stats?.memberCount, 0);
}

/**
 * recentResults 정규화 → ["W"|"L"|"D", ...] (최신이 index 0).
 * 쓰기 경로(matchRoomService.computeNextStats)가 [nextResult, ...recent] 이므로
 * 배열 앞쪽이 최신이다.
 */
export function normalizeRecent(team) {
  const src = Array.isArray(team?.stats?.recentResults)
    ? team.stats.recentResults
    : Array.isArray(team?.recentResults)
    ? team.recentResults
    : [];
  return src
    .map((x) => String(x || "").toUpperCase().trim())
    .map((x) => (x === "WIN" ? "W" : x === "LOSE" ? "L" : x === "DRAW" ? "D" : x))
    .filter((x) => x === "W" || x === "L" || x === "D");
}

/**
 * 최근폼 점수(-1 ~ +1). 최신 경기에 가중치를 더 준다(index 0 = 최신).
 * W=+1, D=0, L=-1, 가중치는 1/(rank+1).
 */
export function readRecentForm(team) {
  const recent = normalizeRecent(team).slice(0, 5);
  if (recent.length === 0) return { form: 0, count: 0 };
  let num = 0;
  let den = 0;
  recent.forEach((r, i) => {
    const w = 1 / (i + 1); // 최신일수록 큰 가중치
    const v = r === "W" ? 1 : r === "L" ? -1 : 0;
    num += v * w;
    den += w;
  });
  return { form: den > 0 ? num / den : 0, count: recent.length };
}

/**
 * 포지션 분포 {guard, forward, center}. members 기준.
 */
export function readPositions(team) {
  const list = Array.isArray(team?.members) ? team.members : [];
  const map = { guard: 0, forward: 0, center: 0 };
  list.forEach((m) => {
    const p = String(m?.mainPosition || "").trim().toLowerCase();
    if (p === "guard") map.guard += 1;
    else if (p === "forward") map.forward += 1;
    else if (p === "center") map.center += 1;
  });
  return map;
}

/**
 * 포지션 밸런스 점수 0~1. 가드/포워드/센터가 고르게 있을수록 1에 가깝다.
 * (한 포지션에 몰릴수록 0에 가까움) — 라인업 운영 안정성 지표.
 */
function positionBalance(pos) {
  const total = pos.guard + pos.forward + pos.center;
  if (total <= 0) return null;
  const ideal = total / 3;
  const dev =
    Math.abs(pos.guard - ideal) +
    Math.abs(pos.forward - ideal) +
    Math.abs(pos.center - ideal);
  // 최악(전원 한 포지션)의 편차 = 2 * ideal * (1 - 1/3)*3 근사 → 2*total*2/3
  const maxDev = (4 / 3) * total;
  return clamp(1 - dev / (maxDev || 1), 0, 1);
}

/**
 * 실데이터 기반 승률 추정 (0~100 정수) + 신뢰도 + 폴백 플래그
 *
 * 공식 (로지스틱 스타일, 50%를 중심으로 양 팀 강점 차이를 반영):
 *   score = 0.55 * (myWinRate - oppWinRate)          // 전적(승률) 차이 — 가장 큰 비중
 *         + 0.20 * normDiff(myAvgScore, oppAvgScore) // 평균 득점력 차이(있으면)
 *         + 0.15 * heightAdv                          // 평균 키 우위(있으면)
 *         + 0.10 * memberAdv                          // 인원 우위(있으면)
 *   prob  = 50 + score * 50  → 5~95% clamp
 *
 * 각 항목은 데이터가 있을 때만 가중치를 사용하고, 없으면 그 비중을 전적 항목으로 흡수한다.
 */
export function estimateWinProbability(myTeam, oppTeam, opts = {}) {
  const myRec = readRecord(myTeam);
  const oppRec = readRecord(oppTeam);

  const hasMyRecord = myRec.total > 0;
  const hasOppRecord = oppRec.total > 0;

  // 상대전적(H2H) — opts.h2h = { wins, losses, draws } (내 팀 관점). 두 팀의 가장 강한 신호.
  const h2h = opts && opts.h2h ? opts.h2h : null;
  const h2hGames = h2h ? toNum(h2h.wins, 0) + toNum(h2h.losses, 0) + toNum(h2h.draws, 0) : 0;
  const hasH2H = h2hGames > 0;
  // H2H도 소표본 셰이드(가상 4판 0.5). diff = (보정승률 - 0.5)*2 → -1~+1
  const h2hDiff = hasH2H
    ? clamp(((toNum(h2h.wins, 0) + 2) / (h2hGames + 4) - 0.5) * 2, -1, 1)
    : 0;

  // 양쪽 다 전적이 전혀 없으면 추정 불가 → 데이터 부족
  if (!hasMyRecord && !hasOppRecord && !hasH2H) {
    return {
      prob: 50,
      confidence: "데이터 부족",
      insufficient: true,
      reasons: ["양 팀 모두 경기 기록이 없어 균형(50%)으로 추정해요."],
    };
  }

  // --- 항목별 정규화된 우위값(-1 ~ +1, 내 팀 기준) ---
  // 소표본 보정(베이지안 셰이드): 가상 경기 PSEUDO판(무승부 가정)을 더해
  // 표본이 적을수록 승률을 50%로 끌어당긴다. (1승 0패가 100%로 들어와 prob이
  // 크게 흔들리는 과잉반응을 막는다. 표본이 쌓이면 자동으로 실제값에 수렴.)
  const PSEUDO = 4;
  const shrunkWinRate = (rec) => (rec.wins + PSEUDO * 0.5) / (rec.total + PSEUDO);
  const winRateDiff = shrunkWinRate(myRec) - shrunkWinRate(oppRec); // -1 ~ +1 (보정됨)

  // 평균 득점력 (stats.avgScore 또는 avgPointsFor 가 있을 때만)
  const myAvgScore = toNum(myTeam?.stats?.avgScore ?? myTeam?.stats?.avgPointsFor, NaN);
  const oppAvgScore = toNum(oppTeam?.stats?.avgScore ?? oppTeam?.stats?.avgPointsFor, NaN);
  const hasScore = Number.isFinite(myAvgScore) && Number.isFinite(oppAvgScore);
  const scoreDiff = hasScore
    ? clamp((myAvgScore - oppAvgScore) / 20, -1, 1) // 20점 차이를 최대 우위로 본다
    : 0;

  // 평균 키 우위
  const myH = readAvgHeightCm(myTeam);
  const oppH = readAvgHeightCm(oppTeam);
  const hasHeight = myH != null && oppH != null;
  const heightDiff = hasHeight
    ? clamp((myH - oppH) / 15, -1, 1) // 15cm 차이를 최대 우위로 본다
    : 0;

  // 인원 우위 (가용 로테이션)
  const myCount = readMemberCount(myTeam);
  const oppCount = readMemberCount(oppTeam);
  const hasCount = myCount > 0 && oppCount > 0;
  const countDiff = hasCount
    ? clamp((myCount - oppCount) / 6, -1, 1) // 6명 차이를 최대 우위로 본다
    : 0;

  // 최근폼 우위 (최신 경기 가중). 한쪽이라도 최근 기록 있으면 사용.
  const myForm = readRecentForm(myTeam);
  const oppForm = readRecentForm(oppTeam);
  const hasForm = myForm.count > 0 || oppForm.count > 0;
  const formDiff = hasForm ? clamp(myForm.form - oppForm.form, -1, 1) : 0;

  // 포지션 밸런스 우위
  const myBal = positionBalance(readPositions(myTeam));
  const oppBal = positionBalance(readPositions(oppTeam));
  const hasBalance = myBal != null && oppBal != null;
  const balanceDiff = hasBalance ? clamp(myBal - oppBal, -1, 1) : 0;

  // 리그 랭킹(전역 등수) 우위 — opts.myRank/oppRank(1=최상위), opts.totalRanked(전체 팀 수).
  // 등수는 절대값보다 "백분위"로 정규화(1위 vs 100위 = 큰 격차, 1위 vs 3위 = 작은 격차).
  const myRank = toNum(opts?.myRank, 0);
  const oppRank = toNum(opts?.oppRank, 0);
  const totalRanked = toNum(opts?.totalRanked, 0);
  const hasRank = myRank > 0 && oppRank > 0 && totalRanked >= 5;
  const rankPct = (r) => (totalRanked > 1 ? (totalRanked - r) / (totalRanked - 1) : 0.5);
  const rankDiff = hasRank ? clamp(rankPct(myRank) - rankPct(oppRank), -1, 1) : 0;

  // --- 가중치: 데이터 없는 항목 비중은 전적으로 흡수 ---
  // H2H는 경기 수가 쌓일수록 비중↑(3전 이상 0.22, 1~2전 0.12).
  let wH2H = hasH2H ? (h2hGames >= 3 ? 0.22 : 0.12) : 0;
  let wRank = hasRank ? 0.15 : 0; // 리그 등수(전역 강함 지표)
  let wForm = hasForm ? 0.18 : 0;
  let wScore = hasScore ? 0.14 : 0;
  let wHeight = hasHeight ? 0.12 : 0;
  let wCount = hasCount ? 0.07 : 0;
  let wBalance = hasBalance ? 0.04 : 0;
  let wWin = 1 - (wH2H + wRank + wForm + wScore + wHeight + wCount + wBalance); // 나머지 전부 전적에

  const score =
    wWin * winRateDiff +
    wH2H * h2hDiff +
    wRank * rankDiff +
    wForm * formDiff +
    wScore * scoreDiff +
    wHeight * heightDiff +
    wCount * countDiff +
    wBalance * balanceDiff;

  let prob = Math.round(50 + score * 50);
  prob = clamp(prob, 5, 95);

  // --- 신뢰도: 한쪽만 기록 있거나 표본이 적으면 낮춤 ---
  const minTotal = Math.min(hasMyRecord ? myRec.total : 0, hasOppRecord ? oppRec.total : 0);
  let confidence;
  if (!hasMyRecord || !hasOppRecord || minTotal < 3) confidence = "낮음";
  else if (minTotal < 8) confidence = "중간";
  else confidence = "높음";

  // 직접 맞대결 기록은 두 팀에 특화된 강한 근거 → 신뢰도를 한 단계 보정
  if (hasH2H && h2hGames >= 3 && confidence === "중간") confidence = "높음";
  else if (hasH2H && h2hGames >= 2 && confidence === "낮음") confidence = "중간";

  // --- 불확실성 폭(margin): 신뢰도가 낮을수록 넓게. 단일 숫자의 과신을 범위로 누른다. ---
  const margin = confidence === "낮음" ? 12 : confidence === "중간" ? 7 : 4;

  return {
    prob,
    confidence,
    margin,
    probLow: clamp(prob - margin, 5, 95),
    probHigh: clamp(prob + margin, 5, 95),
    insufficient: false,
    // ✅ 표본이 얇으면(신뢰도 낮음) 확률을 앞세우지 말고 "분석 제한적"으로 안내
    limited: confidence === "낮음",
    sample: { my: myRec.total, opp: oppRec.total, h2h: h2hGames },
    reasons: buildReasons({
      winRateDiff,
      hasH2H,
      h2h,
      h2hGames,
      h2hDiff,
      hasRank,
      myRank,
      oppRank,
      rankDiff,
      hasForm,
      formDiff,
      hasScore,
      scoreDiff,
      hasHeight,
      heightDiff,
      hasCount,
      countDiff,
      myRec,
      oppRec,
    }),
  };
}

/**
 * ✅ 전적(stats)만으로 즉석 승부 예측 — 결과 검증(예측 적중률)용.
 * estimateWinProbability와 같은 가족(소표본 셰이드 + 최근폼)이되, 키/포지션 없이
 * stats만 쓴다(결과 확정 트랜잭션에는 club stats만 있으므로). actor 관점 prob 반환.
 *
 * 반환 { prob(0~100), favored: "actor"|"target"|"even", confident }
 * - confident=false: 표본 부족 또는 50%에 너무 가까워 "찍을 수 없는" 경기 → 적중률 집계 제외(push)
 */
export function predictFromStats(aStats, tStats) {
  const rec = (s) => {
    const wins = toNum(s?.wins, 0);
    const losses = toNum(s?.losses, 0);
    const draws = toNum(s?.draws, 0);
    const total = toNum(s?.totalMatches, 0) || wins + losses + draws;
    return { wins, total };
  };
  const a = rec(aStats);
  const t = rec(tStats);
  const hasA = a.total > 0;
  const hasT = t.total > 0;

  const PSEUDO = 4;
  const shrink = (r) => (r.wins + PSEUDO * 0.5) / (r.total + PSEUDO);

  const formScore = (s) => {
    const recent = normalizeRecent({ stats: s }).slice(0, 5);
    if (!recent.length) return 0;
    let num = 0;
    let den = 0;
    recent.forEach((rr, i) => {
      const w = 1 / (i + 1);
      num += (rr === "W" ? 1 : rr === "L" ? -1 : 0) * w;
      den += w;
    });
    return den > 0 ? num / den : 0;
  };

  const winDiff = shrink(a) - shrink(t); // -1 ~ +1
  const formDiff = clamp(formScore(aStats) - formScore(tStats), -1, 1);
  const score = 0.8 * winDiff + 0.2 * formDiff;
  const prob = clamp(Math.round(50 + score * 50), 5, 95);

  // 양쪽 다 기록 있고(최소 2경기) + 50%에서 충분히 벗어날 때만 "찍었다"고 본다
  const minTotal = Math.min(hasA ? a.total : 0, hasT ? t.total : 0);
  const confident = hasA && hasT && minTotal >= 2 && Math.abs(prob - 50) >= 6;
  const favored = !confident ? "even" : prob > 50 ? "actor" : "target";

  return { prob, favored, confident };
}

/**
 * 추천 정렬 점수: 내 팀과 "해볼만한"(승률 비슷~약우세) + 활동성(경기수 많은) 팀 우선.
 * 같은 지역 가산점. 데이터 없는 팀은 후순위.
 */
export function recommendationScore(myTeam, oppTeam) {
  const est = estimateWinProbability(myTeam, oppTeam);

  // 50%에 가까울수록(=박빙일수록) 매칭 재미 ↑ → competitiveness 0~1
  const competitiveness = 1 - Math.abs(est.prob - 50) / 50;

  const oppRec = readRecord(oppTeam);
  // 경기 기록 있는 팀에 가산(활동성/데이터 신뢰)
  const activity = oppRec.total > 0 ? Math.min(oppRec.total, 10) / 10 : 0;

  // 같은 시/도 가산점
  const mySido = String(myTeam?.regionSido || "").trim();
  const oppSido = String(oppTeam?.regionSido || "").trim();
  const sameRegion = mySido && oppSido && mySido === oppSido ? 1 : 0;

  // 데이터 부족 팀은 강한 페널티(추천 후순위)
  const dataPenalty = est.insufficient ? -0.5 : 0;

  return (
    competitiveness * 0.5 +
    activity * 0.25 +
    sameRegion * 0.25 +
    dataPenalty
  );
}

/**
 * 카드용 짧은 동적 문구 (추천 섹션)
 */
export function buildRecommendBlurb(myTeam, oppTeam) {
  const est = estimateWinProbability(myTeam, oppTeam);
  if (est.insufficient) return "경기 기록이 쌓이면 분석이 정교해져요";

  const diff = Math.abs(est.prob - 50);
  if (diff <= 8) return "실력이 비슷한 박빙 매치업";
  if (est.prob > 50) return "해볼 만한 상대예요";
  return "도전해볼 만한 강팀";
}

/* ---------- 내부 helpers ---------- */

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function pct(x) {
  return Math.round(x * 100);
}

function buildReasons({
  winRateDiff,
  hasH2H,
  h2h,
  h2hGames,
  h2hDiff,
  hasRank,
  myRank,
  oppRank,
  rankDiff,
  hasForm,
  formDiff,
  hasScore,
  scoreDiff,
  hasHeight,
  heightDiff,
  hasCount,
  countDiff,
  myRec,
  oppRec,
}) {
  const reasons = [];

  // 상대전적(H2H) — 두 팀에 특화된 가장 강한 근거이므로 최상단에 배치
  if (hasH2H) {
    const w = toNum(h2h?.wins, 0);
    const d = toNum(h2h?.draws, 0);
    const l = toNum(h2h?.losses, 0);
    const tone =
      Math.abs(h2hDiff) < 0.12
        ? "맞대결은 팽팽한 균형으로, 분석의 핵심 변수입니다"
        : h2hDiff > 0
        ? "맞대결에서 내 팀이 앞서 온 흐름이 승률 추정을 끌어올렸습니다"
        : "맞대결에서 상대에게 밀려 온 점이 가장 큰 부담 요인입니다";
    reasons.push(`상대전적 ${h2hGames}전 ${w}승 ${d}무 ${l}패 — ${tone}.`);
  }

  // 리그 랭킹(전역 등수) — 두 팀의 상대적 전력 위치
  if (hasRank) {
    const tone =
      Math.abs(rankDiff) < 0.08
        ? "리그 내 위치가 비슷해 전력 차가 크지 않습니다"
        : rankDiff > 0
        ? "리그 등수에서 앞서 전반적인 전력 우위가 예상됩니다"
        : "리그 등수에서 밀려 전력상 열세를 감안해야 합니다";
    reasons.push(`리그 랭킹 내 팀 ${myRank}위 · 상대 ${oppRank}위 — ${tone}.`);
  }

  // 통산 전적(승률)
  if (myRec.total > 0 || oppRec.total > 0) {
    const myW = pct(myRec.winRate);
    const oppW = pct(oppRec.winRate);
    if (Math.abs(winRateDiff) < 0.05) {
      reasons.push(
        `통산 승률은 내 팀 ${myW}% · 상대 ${oppW}%로 전력 차가 크지 않습니다.`
      );
    } else if (winRateDiff > 0) {
      reasons.push(
        `통산 승률 우위(내 팀 ${myW}% vs 상대 ${oppW}%)가 추정의 기본 축입니다.`
      );
    } else {
      reasons.push(
        `통산 승률에서 상대가 앞섭니다(내 팀 ${myW}% vs 상대 ${oppW}%) — 전력 열세를 감안해야 합니다.`
      );
    }
  }

  // 최근폼(최신 경기 가중)
  if (hasForm && Math.abs(formDiff) > 0.15) {
    reasons.push(
      formDiff > 0
        ? "최근 경기 흐름(폼)이 내 팀 쪽으로 상승세라 기세에서 유리합니다."
        : "상대가 최근 상승세라 초반 기세 싸움이 승부처가 될 수 있습니다."
    );
  }

  // 평균 신장(리바운드/골밑)
  if (hasHeight && Math.abs(heightDiff) > 0.1) {
    reasons.push(
      heightDiff > 0
        ? "평균 신장 우위로 리바운드·골밑 득점에서 이점이 예상됩니다."
        : "상대의 평균 신장이 더 커 골밑 매치업과 리바운드 대비가 필요합니다."
    );
  }

  // 로테이션 인원(체력 운용)
  if (hasCount && Math.abs(countDiff) > 0.15) {
    reasons.push(
      countDiff > 0
        ? "로테이션 인원이 두꺼워 후반 체력 운용에서 우위가 기대됩니다."
        : "상대 로테이션이 두꺼워 후반 체력전에 대비가 필요합니다."
    );
  }

  // 평균 득점력(화력)
  if (hasScore && Math.abs(scoreDiff) > 0.1) {
    reasons.push(
      scoreDiff > 0
        ? "평균 득점력이 높아 공격 화력에서 앞섭니다."
        : "상대의 평균 득점력이 높아 수비 집중도가 관건입니다."
    );
  }

  if (reasons.length === 0) {
    reasons.push("주요 지표가 고르게 맞물려 균형 잡힌 매치업으로 분석됩니다.");
  }
  return reasons;
}
