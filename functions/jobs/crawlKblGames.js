/* eslint-disable */
// functions/jobs/crawlKblGames.js
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { ENV } = require("../env");
const { info, warn } = require("../utils/logger");
const { fetchNaverGamesRaw } = require("../crawlers/naver/fetchGames");
const { parseNaverGames } = require("../crawlers/naver/parseGames");
const { upsertGames } = require("../repos/gamesRepo");
const { getAdmin } = require("../firebaseAdmin");
const { cacheLogoToStorage } = require("../utils/logoCache");
const { acquireOnceLock } = require("../repos/systemRepo");

function dateAddDays(dateKey, days) {
  const [y, m, d] = String(dateKey).split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function todayKstDateKey() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

const BASKETBALL_LEAGUES = ["kbl", "nba"]; // ✅ 여기서 리그 확장 가능 (wkbl 등)

function buildNaverApiUrlBasketball({ categoryId, fromDate, toDate, size = 500 }) {
  const base = "https://api-gw.sports.naver.com/schedule/games";
  const params = new URLSearchParams({
    fields: "basic,schedule,conference,manualRelayUrl",
    superCategoryId: "basketball",
    categoryId: String(categoryId || "").trim(), // kbl | nba
    fromDate: String(fromDate || "").trim(),
    toDate: String(toDate || "").trim(),
    size: String(size || 500),
  });
  return `${base}?${params.toString()}`;
}

function allowBasketballLeagues(g) {
  const sport = String(g?.sport || "").toLowerCase().trim();
  const league = String(g?.league || "").toLowerCase().trim();
  if (sport !== "basketball") return false;
  return BASKETBALL_LEAGUES.includes(league);
}

function safeStr(v) {
  return String(v || "").trim();
}

async function applyLogoCacheForGame(g) {
  const league = safeStr(g?.league).toLowerCase();
  const homeUrl = safeStr(g?.home?.emblemUrl);
  const awayUrl = safeStr(g?.away?.emblemUrl);

  let homeCached = "";
  let awayCached = "";

  if (homeUrl) {
    try {
      const out = await cacheLogoToStorage(homeUrl, {
        league,
        teamCode: safeStr(g?.home?.code) || safeStr(g?.home?.name),
      });
      if (out?.ok && out.publicUrl) homeCached = out.publicUrl;
      else if (out?.reason) {
        info("basketball", "logo_cache_skip", {
          league,
          side: "home",
          team: safeStr(g?.home?.code) || safeStr(g?.home?.name),
          reason: out.reason,
        });
      }
    } catch (e) {
      warn("basketball", "logo_cache_failed", {
        league,
        side: "home",
        team: safeStr(g?.home?.code) || safeStr(g?.home?.name),
        message: String(e?.message || e),
      });
    }
  }

  if (awayUrl) {
    try {
      const out = await cacheLogoToStorage(awayUrl, {
        league,
        teamCode: safeStr(g?.away?.code) || safeStr(g?.away?.name),
      });
      if (out?.ok && out.publicUrl) awayCached = out.publicUrl;
      else if (out?.reason) {
        info("basketball", "logo_cache_skip", {
          league,
          side: "away",
          team: safeStr(g?.away?.code) || safeStr(g?.away?.name),
          reason: out.reason,
        });
      }
    } catch (e) {
      warn("basketball", "logo_cache_failed", {
        league,
        side: "away",
        team: safeStr(g?.away?.code) || safeStr(g?.away?.name),
        message: String(e?.message || e),
      });
    }
  }

  return {
    ...g,
    home: {
      ...(g.home || {}),
      emblemUrl: homeCached || homeUrl || "",
      emblemRawUrl: homeUrl || "",
    },
    away: {
      ...(g.away || {}),
      emblemUrl: awayCached || awayUrl || "",
      emblemRawUrl: awayUrl || "",
    },
  };
}

async function runCrawlRange({ daysAhead }) {
  const startedAt = Date.now();
  const base = todayKstDateKey();

  let totalSaved = 0;
  const newGames = []; // 신규 게임 누적 (공지용)
  const fetchedAt = getAdmin().firestore.FieldValue.serverTimestamp();

  for (let i = 0; i <= daysAhead; i += 1) {
    const date = dateAddDays(base, i);

    for (const league of BASKETBALL_LEAGUES) {
      const url = buildNaverApiUrlBasketball({
        categoryId: league,
        fromDate: date,
        toDate: date,
        size: 500,
      });

      info("basketball", "fetch", { date, league, url });

      try {
        const raw = await fetchNaverGamesRaw({ url });

        const parsedBase = parseNaverGames({
          json: raw.json,
          sport: "basketball",
          league,
          date,
          sourceUrl: url,
        })
          .filter(allowBasketballLeagues)
          .map((g) => ({
            ...g,
            source: { ...(g.source || {}), fetchedAt },
          }));

        const parsed = [];
        for (const g of parsedBase) {
          const patched = await applyLogoCacheForGame(g);
          parsed.push(patched);
        }

        const saved = await upsertGames(parsed);
        totalSaved += Number(saved?.count || 0);

        const newIds = Array.isArray(saved?.newGameIds) ? saved.newGameIds : [];
        if (newIds.length > 0) {
          const newSet = new Set(newIds);
          for (const g of parsed) {
            if (newSet.has(String(g.gameId))) newGames.push(g);
          }
        }

        info("basketball", "done", {
          date,
          league,
          parsed: parsed.length,
          saved: saved.count,
        });
      } catch (e) {
        warn("basketball", "failed", { date, league, message: String(e?.message || e) });
      }
    }
  }

  const ms = Date.now() - startedAt;
  return { ok: true, totalSaved, ms, newGames };
}

/**
 * 신규 KBL/NBA 경기 공지 알림 생성
 * - notifications 컬렉션에 push.queued 상태로 등록
 * - targetIds: [] = 전체 사용자 브로드캐스트 (sendPushTick에서 처리)
 */
async function enqueueNewGameNotices(newGames = []) {
  if (!Array.isArray(newGames) || newGames.length === 0) return 0;

  const db = getAdmin().firestore();
  const col = db.collection("notifications");
  const FieldValue = getAdmin().firestore.FieldValue;

  let added = 0;
  for (const g of newGames) {
    const league = String(g?.league || "").toUpperCase();
    const home = String(g?.home?.name || g?.home?.code || "").trim();
    const away = String(g?.away?.name || g?.away?.code || "").trim();
    const date = String(g?.date || "").trim();

    if (!home || !away) continue;

    const title = `[${league}] 새 경기 일정`;
    const body = `${date} ${away} vs ${home}`;

    try {
      await col.add({
        prefsCategory: "notice",
        kind: "game_added",
        type: "notice",
        targetIds: [],
        title,
        body,
        meta: {
          gameId: String(g?.gameId || ""),
          league,
          date,
          deepLink: "/",
        },
        push: { enabled: true, status: "queued" },
        createdAt: FieldValue.serverTimestamp(),
      });
      added += 1;
    } catch (e) {
      warn("basketball", "notice_enqueue_failed", {
        gameId: g?.gameId,
        message: String(e?.message || e),
      });
    }
  }
  return added;
}

/**
 * ✅ 배포 직후 1회만 즉시 실행 트리거 (수동 호출)
 * - 호출: 브라우저/포스트맨/터미널에서 1번만 hit
 * - 중복 방지: Firestore _system 문서 락으로 1회만 실행
 */
const crawlKblInitOnce = onRequest(
  {
    region: ENV.REGION,
    timeoutSeconds: 540,
    cors: true,
  },
  async (req, res) => {
    try {
      const lockKey = "crawlKblInitOnce";
      const lock = await acquireOnceLock(lockKey);

      if (!lock.acquired) {
        info("basketball", "init_once_skip", { lockKey });
        res.status(200).json({ ok: true, skipped: true, reason: "already_done" });
        return;
      }

      const daysAhead = Number.isFinite(ENV.CRAWL_DAYS_AHEAD) ? ENV.CRAWL_DAYS_AHEAD : 7;

      info("basketball", "init_once_start", { daysAhead, leagues: BASKETBALL_LEAGUES });
      const out = await runCrawlRange({ daysAhead });
      info("basketball", "init_once_end", out);

      res.status(200).json({ ok: true, ...out });
    } catch (e) {
      warn("basketball", "init_once_failed", { message: String(e?.message || e) });
      res.status(500).json({ ok: false, message: String(e?.message || e) });
    }
  }
);

const crawlKblDaily = onSchedule(
  {
    region: ENV.REGION,
    schedule: "0 5 * * *",
    timeZone: ENV.TZ,
    retryCount: 0,
  },
  async () => {
    const daysAhead = Number.isFinite(ENV.CRAWL_DAYS_AHEAD) ? ENV.CRAWL_DAYS_AHEAD : 7;
    info("basketball", "daily start", { daysAhead, leagues: BASKETBALL_LEAGUES });
    const out = await runCrawlRange({ daysAhead });
    const noticed = await enqueueNewGameNotices(out.newGames || []);
    info("basketball", "daily end", { ...out, noticed });
    return null;
  }
);

const crawlKblTick = onSchedule(
  {
    region: ENV.REGION,
    schedule: "*/15 * * * *",
    timeZone: ENV.TZ,
    retryCount: 0,
  },
  async () => {
    info("basketball", "tick start", { leagues: BASKETBALL_LEAGUES });
    const out = await runCrawlRange({ daysAhead: 0 });
    info("basketball", "tick end", out);
    return null;
  }
);

module.exports = { crawlKblInitOnce, crawlKblDaily, crawlKblTick };
