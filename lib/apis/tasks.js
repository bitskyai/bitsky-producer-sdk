const _ = require("lodash");

const http = require("../utils/http");
const constants = require("../utils/constants");
const { joinURL } = require("../utils");

/**
 * Get Tasks that need to collect from BitSky Server
 * @returns [] - Tasks
 */
async function getTasksAPI(baseURL, globalId, securityKey, context) {
  let logger = console;
  if (context && context.logger) {
    logger = context.logger;
  }

  return new Promise((resolve) => {
    logger.debug("getTasksAPI()");
    try {
      let headers = {};
      // Add security key
      if (securityKey) {
        headers[constants.X_SECURITY_KEY_HEADER] = securityKey;
      }
      let url = joinURL(constants.BITSKYMETADATA_PATH, baseURL);
      logger.debug(`getTasks->url: ${url}`);
      // send request
      http(
        {
          method: constants.BITSKYMETADATA_METHOD,
          url: url,
          headers,
          params: {
            gid: globalId,
          },
        },
        context
      )
        .then((res) => {
          logger.debug(
            `[getTasks][Finish] tasks number: ${_.get(
              res,
              "data.length"
            )}`
          );

          resolve(res.data);
        })
        .catch((err) => {
          logger.error(`[getTasks][Fail]. Error: ${err.message}`, {
            error: err,
          });

          // the reason of return [] is because, normally producer is automatically start and close, no human monitor it
          // to make sure work flow isn't stopped, so resolve it as []
          resolve([]);
        });
    } catch (err) {
      logger.error(`[getTasks][Fail]. Error: ${err.message}`, {
        error: err,
      });

      // the reason of return [] is because, normally producer is automatically start and close, no human monitor it
      // to make sure work flow isn't stopped, so resolve it as []
      resolve([]);
    }
  });
}

function filterTasksSendToBitSky(tasks) {
  let filterTasks = [];
  let length = tasks && tasks.length;
  for (let i = 0; i < length; i++) {
    // let task = _.cloneDeep(tasks[i]);
    let task = {};
    task.globalId = tasks[i].globalId;
    task.system = tasks[i].system;
    filterTasks.push(task);
  }

  return filterTasks;
}

async function updateTasksAPI(
  baseURL,
  securityKey,
  tasks,
  context
) {
  // Get configurations
  return new Promise((resolve, reject) => {
    let headers = {};
    // Add security key
    if (securityKey) {
      headers[constants.X_SECURITY_KEY_HEADER] = securityKey;
    }
    // RESTFul API url that for update tasks
    let url = joinURL(constants.BITSKYMETADATA_PATH, baseURL);
    http(
      {
        method: constants.BITSKYUPDATE_TASKS_METHOD,
        url,
        headers,
        data: filterTasksSendToBitSky(tasks),
      },
      context
    )
      .then((res) => {
        resolve(res.data);
      })
      .catch((err) => {
        //TODO: Need to improve this, if it has error, need to store data and retry
        reject(err);
      });
  });
}

module.exports = {
  getTasksAPI,
  updateTasksAPI,
};
