const _ = require("lodash");
const http = require("../utils/http");
const logger = require("../utils/logger");
const { setIntelligencesToFail } = require("../utils");

async function serviceCrawler(intelligences, jobId, agentConfiguration) {
  try {
    const promises = [];
    for (let i = 0; i < intelligences.length; i++) {
      promises.push(
        ((intelligence) => {
          return new Promise(async (resolve, reject) => {
            try {
              const res = await http({
                url: intelligence.url,
                method: "GET",
              });
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
                `collect intelligence fail. globalId: ${intelligence.globalId}`,
                err
              );
              setIntelligencesToFail(intelligence, err);
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
    });
    return [];
  }
}

module.exports = {
  serviceCrawler,
};
