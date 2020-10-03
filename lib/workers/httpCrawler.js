const _ = require("lodash");
const http = require("../utils/http");
const { setTasksToFail } = require("../utils");

/**
 *
 * @param {object} options
 * @param {array} options.tasks - tasks need to collect
 * @param {string} options.jobId - Currently job id
 * @param {object} options.producerConfig - current producer's configuration
 */
async function httpCrawler(options) {
  const jobId = _.get(options, "jobId");
  const logger = _.get(options, "context.logger") || console;
  const tasks = _.get(options, "tasks");
  try {
    const promises = [];
    for (let i = 0; i < tasks.length; i++) {
      promises.push(
        ((task) => {
          return new Promise(async (resolve, reject) => {
            try {
              const res = await http(
                {
                  url: task.url,
                  method: "GET",
                },
                _.get(options, "context")
              );
              task.dataset = {
                url: task.url,
                data: {
                  contentType: "html",
                  content: res.data,
                },
              };
              task.system.state = "FINISHED";
              task.system.producer.endedAt = Date.now();
              resolve(task);
            } catch (err) {
              logger.error(
                `collect task fail. globalId: ${task.globalId}. Error: ${err.message}`,
                { error: err }
              );
              task = setTasksToFail(task, err);
              reject(task);
            }
          });
        })(tasks[i])
      );
    }

    return promises;
  } catch (err) {
    logger.error(`httpCrawler fail, error: ${err.message}`, {
      jobId: jobId,
      error: err,
    });
    return [];
  }
}

module.exports = {
  httpCrawler,
};
