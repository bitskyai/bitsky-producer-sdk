const http = require("../utils/http");
const _ = require("lodash");

/**
 * Filter out unnecessary data
 * @param {Array} data - intelligences sent to Retailer
 */
function filterIntelligencesSendToRetailer(data) {
  // Intelligences after filter
  let filterIntelligences = [];
  let length = data && data.length;
  for (let i = 0; i < length; i++) {
    if (_.toUpper(_.get(data[i], "system.state")) == _.toUpper("FAILED")) {
      // Don't send FAILED intelligences to Retailer
      continue;
    }
    let intelligence = _.cloneDeep(data[i]);
    if (intelligence && intelligence.system) {
      delete intelligence.system;
    }
    if (intelligence && intelligence.retailer) {
      let retailer = {};
      retailer.name = intelligence.retailer.name;
      retailer.baseURL = intelligence.retailer.baseURL;
      retailer.globalId = intelligence.retailer.globalId;
      intelligence.retailer = retailer;
    }

    filterIntelligences.push(intelligence);
  }

  return filterIntelligences;
}

async function sendIntelligencesToRetailer(
  baseURL,
  method,
  url,
  headers,
  data,
  context
) {
  try {
    data = filterIntelligencesSendToRetailer(data);
    if (data.length) {
      let result = await http(
        {
          baseURL,
          method,
          url,
          headers,
          data: filterIntelligencesSendToRetailer(data),
        },
        context
      );
      return result.data;
    } else {
      return data;
    }
  } catch (err) {
    throw err;
  }
}

module.exports = {
  sendIntelligencesToRetailer,
};
