/* eslint-disable */
// functions/env.js
function requireEnv(key, fallback = "") {
  const v = process.env[key];
  if (v === undefined || v === null || String(v).trim() === "") return fallback;
  return String(v).trim();
}

const ENV = {
  REGION: requireEnv("FUNCTIONS_REGION", "asia-northeast3"),
  TZ: requireEnv("TZ", "Asia/Seoul"),

  CRAWL_DAYS_AHEAD: Number(requireEnv("CRAWL_DAYS_AHEAD", "7")),
  USER_AGENT: requireEnv(
    "USER_AGENT",
    "Mozilla/5.0 (compatible; KBL-ScheduleBot/1.0; +https://example.com)"
  ),
};

module.exports = { ENV };
