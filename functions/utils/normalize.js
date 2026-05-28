/* eslint-disable */
// functions/utils/normalize.js
function trimSpaces(s = "") {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function safeLower(s = "") {
  return trimSpaces(s).toLowerCase();
}

function normalizeTeamName(name = "") {
  const v = trimSpaces(name)
    .replace(/[·•]/g, " ")
    .replace(/[()［］\[\]{}]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return safeLower(v);
}

function normalizeLeague(league = "") {
  return safeLower(league);
}

function normalizeSport(sport = "") {
  return safeLower(sport);
}

function toDateKey(dateLike = "") {
  const v = trimSpaces(dateLike).replace(/\./g, "-").replace(/\//g, "-");
  const m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return "";
  const y = m[1];
  const mm = String(m[2]).padStart(2, "0");
  const dd = String(m[3]).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function toTimeHHmm(timeLike = "") {
  const v = trimSpaces(timeLike);
  const m1 = v.match(/^(\d{1,2}):(\d{2})$/);
  if (m1) return `${String(m1[1]).padStart(2, "0")}:${m1[2]}`;

  const m2 = v.match(/^(\d{1,2})\s*시\s*(\d{1,2})\s*분?$/);
  if (m2) return `${String(m2[1]).padStart(2, "0")}:${String(m2[2]).padStart(2, "0")}`;

  return "";
}

module.exports = {
  trimSpaces,
  safeLower,
  normalizeTeamName,
  normalizeLeague,
  normalizeSport,
  toDateKey,
  toTimeHHmm,
};
