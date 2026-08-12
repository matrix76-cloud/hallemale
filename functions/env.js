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
};

module.exports = { ENV };
