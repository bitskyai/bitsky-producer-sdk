const _ = require("lodash");

function joinURL(url, base) {
  let urlInstance = new URL(url, base);
  return urlInstance.toString();
}

function setTasksToFail(task, err) {
  let failuresReason = err;
  if (err && err.toJSON) {
    failuresReason = err.toJSON();
  }
  _.set(task, "system.state", "FAILED");
  _.set(task, "system.producer.endedAt", Date.now());
  _.set(task, "system.failuresReason", failuresReason);

  return task;
}

module.exports = {
  joinURL,
  setTasksToFail,
};
