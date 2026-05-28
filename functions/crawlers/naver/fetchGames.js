/* eslint-disable */
// functions/crawlers/naver/fetchGames.js
const { httpGetJson } = require("../../utils/httpFetch");

async function fetchNaverGamesRaw({ url }) {
  const u = String(url || "").trim();
  if (!u) throw new Error("missing url");

  const resp = await httpGetJson(u);
  if (!resp.ok) {
    const err = new Error(`naver fetch failed: ${resp.status}`);
    err.status = resp.status;
    throw err;
  }

  return { url: u, json: resp.data };
}

module.exports = { fetchNaverGamesRaw };
