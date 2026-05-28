/* eslint-disable */
// functions/utils/logger.js
function info(scope, action, payload) {
  try {
    console.log(`[${scope}] ${action}`, payload || {});
  } catch (e) {}
}

function warn(scope, action, payload) {
  try {
    console.warn(`[${scope}] ${action}`, payload || {});
  } catch (e) {}
}

function error(scope, action, payload) {
  try {
    console.error(`[${scope}] ${action}`, payload || {});
  } catch (e) {}
}

module.exports = { info, warn, error };
