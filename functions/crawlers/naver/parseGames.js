/* eslint-disable */
// functions/crawlers/naver/parseGames.js
const { makeGameId } = require("../../utils/ids");
const { trimSpaces, toDateKey } = require("../../utils/normalize");
const { mapTeamName } = require("./mapTeams");

function mapStatus(statusCode = "") {
  const s = String(statusCode || "").toUpperCase().trim();
  if (s === "BEFORE") return "scheduled";
  if (s === "PLAYING" || s === "INPLAY" || s === "LIVE") return "live";
  if (s === "END" || s === "FINISHED" || s === "FINAL") return "final";
  if (s === "CANCEL" || s === "CANCELED" || s === "POSTPONE") return "cancelled";
  return "scheduled";
}

function toStartAtMsFromGameDateTime(gameDateTime) {
  const v = String(gameDateTime || "").trim();
  if (!v) return 0;

  const hasTz = /[zZ]$/.test(v) || /[+-]\d{2}:\d{2}$/.test(v);
  const iso = hasTz ? v : `${v}+09:00`;

  const dt = new Date(iso);
  const ms = dt.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function parseNaverGames({ json, sport, league, date, sourceUrl }) {
  const d = toDateKey(date) || toDateKey(json?.result?.games?.[0]?.gameDate || "");
  const list = Array.isArray(json?.result?.games) ? json.result.games : [];
  if (!d || list.length === 0) return [];

  const games = list
    .map((g) => {
      const homeName = mapTeamName(g?.homeTeamName || "");
      const awayName = mapTeamName(g?.awayTeamName || "");

      const startAtMs = toStartAtMsFromGameDateTime(g?.gameDateTime);
      const startTime = startAtMs
        ? new Date(startAtMs).toLocaleTimeString("ko-KR", {
            timeZone: "Asia/Seoul",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "";

      const status = mapStatus(g?.statusCode);

      const gameId = makeGameId({
        sport,
        league: g?.categoryId || league,
        date: g?.gameDate || d,
        startTime,
        homeName,
        awayName,
      });

      return {
        gameId,

        sport: trimSpaces(g?.superCategoryId || sport),
        league: trimSpaces(g?.categoryId || league),
        leagueName: trimSpaces(g?.categoryName || ""),

        date: toDateKey(g?.gameDate || d),
        startTime,
        startAtMs,

        stadium: trimSpaces(g?.stadium || ""),
        home: {
          code: trimSpaces(g?.homeTeamCode || ""),
          name: homeName,
          score: Number(g?.homeTeamScore || 0),
          emblemUrl: String(g?.homeTeamEmblemUrl || ""),
        },
        away: {
          code: trimSpaces(g?.awayTeamCode || ""),
          name: awayName,
          score: Number(g?.awayTeamScore || 0),
          emblemUrl: String(g?.awayTeamEmblemUrl || ""),
        },

        status,
        statusCode: String(g?.statusCode || ""),
        statusInfo: trimSpaces(g?.statusInfo || ""),
        cancel: !!g?.cancel,
        suspended: !!g?.suspended,

        source: {
          provider: "naver",
          url: String(sourceUrl || ""),
          fetchedAt: null,
          rawGameId: String(g?.gameId || ""),
        },
      };
    })
    .filter((x) => !!x.gameId);

  return games;
}

module.exports = { parseNaverGames };
