const _ = require("lodash");

function joinURL(url, base) {
  let urlInstance = new URL(url, base);
  return urlInstance.toString();
}

function setIntelligencesToFail(intelligence, err) {
  let failuresReason = err;
  if (err && err.toJSON) {
    failuresReason = err.toJSON();
  }
  _.set(intelligence, "system.state", "FAILED");
  _.set(intelligence, "system.agent.endedAt", Date.now());
  _.set(intelligence, "system.failuresReason", failuresReason);

  return intelligence;
}

module.exports = {
  joinURL,
  setIntelligencesToFail,
};
