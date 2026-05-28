/* eslint-disable */
// functions/utils/httpFetch.js
const { ENV } = require("../env");

async function withTimeout(promise, ms) {
  let timer = null;
  const t = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  try {
    return await Promise.race([promise, t]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function httpGetJson(url, { headers = {}, timeoutMs = 12000 } = {}) {
  const res = await withTimeout(
    fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": ENV.USER_AGENT,
        Accept: "application/json,*/*;q=0.8",
        ...headers,
      },
    }),
    timeoutMs
  );

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

module.exports = { httpGetJson };
