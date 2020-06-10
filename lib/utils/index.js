const _ = require('lodash');

function joinURL(url, base) {
  let urlInstance = new URL(url, base);
  return urlInstance.toString();
}

function setIntelligencesToFail(intelligence, err) {
  _.set(intelligence, "system.state", "FAILED");
  _.set(intelligence, "system.agent.endedAt", Date.now());
  _.set(intelligence, "system.failuresReason", _.get(err, "message"));

  return intelligence;
}

module.exports = {
  joinURL,
  setIntelligencesToFail
}
