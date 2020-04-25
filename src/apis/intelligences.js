const _ = require("lodash");

const http = require("../utils/http");
const constants = require("../utils/constants");
const { getConfigs } = require("../utils/config");
const logger = require("../utils/logger");

function joinURL(url, base) {
  let urlInstance = new URL(url, base);
  return urlInstance.toString();
}

/**
 * Get Intelligences that need to collect from DIA Server
 * @returns [] - Intelligences
 */
async function getIntelligencesAPI() {
  // get latest configurations
  const configs = getConfigs();
  return new Promise((resolve, reject) => {
    logger.debug("getIntelligencesAPI()");
    try {
      let headers = {};
      // Add security key
      if (configs.MUNEW_SECURITY_KEY) {
        headers[constants.X_SECURITY_KEY_HEADER] = configs.MUNEW_SECURITY_KEY;
      }
      let url = joinURL(constants.DIA_METADATA_PATH, configs.MUNEW_BASE_URL);
      logger.debug(`getIntelligences->url: `, url);
      // send request
      http({
        method: constants.DIA_METADATA_METHOD,
        url: url,
        headers,
        params: {
          gid: configs.GLOBAL_ID,
        },
      })
        .then((res) => {
          logger.debug(
            "[getIntelligences][Finish] intelligences number: ",
            _.get(res, "data.length")
          );

          resolve(res.data);
        })
        .catch((err) => {
          logger.debug("[getIntelligences][Fail]. Error: ", err);

          // the reason of return [] is because, normally agent is automatically start and close, no human monitor it
          // to make sure work flow isn't stopped, so resolve it as []
          resolve([]);
        });
    } catch (err) {
      logger.debug("[getIntelligences][Fail]. Error: ", err);

      // the reason of return [] is because, normally agent is automatically start and close, no human monitor it
      // to make sure work flow isn't stopped, so resolve it as []
      resolve([]);
    }
  });
}

function filterIntelligencesSendToDIA(intelligences) {
  let filterIntelligences = [];
  let length = intelligences && intelligences.length;
  for (let i = 0; i < length; i++) {
    // let intelligence = _.cloneDeep(intelligences[i]);
    let intelligence = {};
    intelligence.globalId = intelligences[i].globalId;
    intelligence.system = intelligences[i].system;
    filterIntelligences.push(intelligence);
  }

  return filterIntelligences;
}

async function updateIntelligencesAPI(intelligences) {
  // Get configurations
  const configs = getConfigs();
  return new Promise((resolve, reject) => {
    let headers = {};
    // Add security key
    if (configs.MUNEW_SECURITY_KEY) {
      headers[constants.X_SECURITY_KEY_HEADER] = configs.MUNEW_SECURITY_KEY;
    }
    // RESTFul API url that for update intelligences
    let url = joinURL(constants.DIA_METADATA_PATH, configs.MUNEW_BASE_URL);
    http({
      method: constants.DIA_UPDATE_INTELLIGENCES_METHOD,
      url,
      headers,
      data: filterIntelligencesSendToDIA(intelligences),
    })
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
  getIntelligencesAPI,
  updateIntelligencesAPI,
};
