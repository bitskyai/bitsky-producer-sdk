const _ = require("lodash");
const http = require("../utils/http");
const logger = require("../utils/logger");
const { setIntelligencesToFail } = require("../utils");
const { runtime } = require("../utils/config");

async function serviceCrawler(intelligences) {
  try {
    const promises = [];
    for (let i = 0; i < intelligences.length; i++) {
      promises.push(
        ((intelligence) => {
          return new Promise(async (resolve, reject) => {
            try {
              const data = await http({
                url: intelligence.url,
                method: "GET",
              });
              intelligence.dataset = {
                url: intelligence.url,
                data: {
                  contentType: "html",
                  content: data,
                },
              };
              intelligence.system.state = "FINISHED";
              intelligence.system.agent.endedAt = Date.now();
              runtime.runningJob.collectedIntelligencesDict[
                intelligence.globalId
              ] = intelligence;
              runtime.runningJob.collectedIntelligencesNumber++;
              resolve(intelligence);
            } catch (err) {
              logger.error(
                `collect intelligence fail. globalId: ${intelligence.globalId}. Error: ${err.message}`,
                { jobId: _.get(runtime, "runningJob.jobId") }
              );
              setIntelligencesToFail(intelligence, err);
              runtime.runningJob.collectedIntelligencesDict[
                intelligence.globalId
              ] = intelligence;
              runtime.runningJob.collectedIntelligencesNumber++;
              reject(err);
            }
          });
        })(intelligences[i])
      );
    }
  } catch (err) {
    logger.error(`serviceCrawler fail, error: ${err.message}`, {
      jobId: _.get(runtime, "runningJob.jobId"),
    });
    return [];
  }
}

module.exports = {
  serviceCrawler,
};
