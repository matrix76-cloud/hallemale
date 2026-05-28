/* eslint-disable */
// functions/utils/ids.js
const {
  normalizeSport,
  normalizeLeague,
  normalizeTeamName,
  toDateKey,
  toTimeHHmm,
} = require("./normalize");

function makeGameId({ sport, league, date, startTime, homeName, awayName }) {
  const s = normalizeSport(sport);
  const l = normalizeLeague(league);
  const d = toDateKey(date);
  const t = toTimeHHmm(startTime);

  const h = normalizeTeamName(homeName);
  const a = normalizeTeamName(awayName);

  const raw = `${s}|${l}|${d}|${t}|${h}|${a}`;
  return raw
    .replace(/\s+/g, "")
    .replace(/[|]/g, "_")
    .replace(/[^a-z0-9가-힣_]/g, "");
}

module.exports = { makeGameId };
