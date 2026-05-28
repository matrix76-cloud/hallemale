/* eslint-disable */
// functions/crawlers/naver/mapTeams.js
const { trimSpaces } = require("../../utils/normalize");

function mapTeamName(name = "") {
  return trimSpaces(name);
}

module.exports = { mapTeamName };
