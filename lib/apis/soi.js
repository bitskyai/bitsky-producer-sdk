const http = require("../utils/http");
const _ = require("lodash");

/**
 * Filter out unnecessary data
 * @param {Array} data - intelligences sent to SOI
 */
function filterIntelligencesSendToSOI(data) {
  // Intelligences after filter
  let filterIntelligences = [];
  let length = data && data.length;
  for (let i = 0; i < length; i++) {
    if(_.toUpper(_.get(data[i], "system.state"))==_.toUpper("FAILED")){
      // Don't send FAILED intelligences to SOI
      continue;
    }
    let intelligence = _.cloneDeep(data[i]);
    if (intelligence && intelligence.system) {
      delete intelligence.system;
    }
    if (intelligence && intelligence.soi) {
      let soi = {};
      soi.name = intelligence.soi.name;
      soi.baseURL = intelligence.soi.baseURL;
      soi.globalId = intelligence.soi.globalId;
      intelligence.soi = soi;
    }

    filterIntelligences.push(intelligence);
  }

  return filterIntelligences;
}

async function sendIntelligencesToSOI(baseURL, method, url, headers, data) {
  try {
    data = filterIntelligencesSendToSOI(data);
    if(data.length){
      let result = await http({
        baseURL,
        method,
        url,
        headers,
        data: filterIntelligencesSendToSOI(data),
      });
      return result.data;
    }else{
      return data;
    }
  } catch (err) {
    throw err;
  }
}

module.exports = {
  sendIntelligencesToSOI,
};
