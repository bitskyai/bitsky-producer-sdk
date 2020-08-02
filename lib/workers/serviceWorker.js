const _ = require("lodash");
const http = require("../utils/http");
const { setIntelligencesToFail } = require("../utils");

/**
 *
 * @param {object} options
 * @param {array} options.intelligences - intelligences need to collect
 * @param {string} options.jobId - Currently job id
 * @param {object} options.agentConfig - current agent's configuration
 */
async function serviceCrawler(options) {
  const jobId = _.get(options, "jobId");
  const logger = _.get(options, "context.logger") || console;
  const intelligences = _.get(options, "intelligences");
  try {
    const promises = [];
    for (let i = 0; i < intelligences.length; i++) {
      promises.push(
        ((intelligence) => {
          return new Promise(async (resolve, reject) => {
            try {
              const res = await http(
                {
                  url: intelligence.url,
                  method: "GET",
                },
                _.get(options, "context")
              );
              intelligence.dataset = {
                url: intelligence.url,
                data: {
                  contentType: "html",
                  content: res.data,
                },
              };
              intelligence.system.state = "FINISHED";
              intelligence.system.agent.endedAt = Date.now();
              resolve(intelligence);
            } catch (err) {
              logger.error(
                `collect intelligence fail. globalId: ${intelligence.globalId}. Error: ${err.message}`,
                { error: err }
              );
              intelligence = setIntelligencesToFail(intelligence, err);
              reject(intelligence);
            }
          });
        })(intelligences[i])
      );
    }

    return promises;
  } catch (err) {
    logger.error(`serviceCrawler fail, error: ${err.message}`, {
      jobId: jobId,
      error: err,
    });
    return [];
  }
}

module.exports = {
  serviceCrawler,
};
