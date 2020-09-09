const http = require("../utils/http");
const constants = require("../utils/constants");

async function getProducerAPI(baseURL, gid, type, securityKey, context) {
  try {
    let headers = {};
    let url = new URL(`/apis/producers/${gid}`, baseURL).toString();
    if (securityKey) {
      headers[constants.X_SECURITY_KEY_HEADER] = securityKey;
    }
    let result = await http(
      {
        url,
        params: {
          type
        },
        method: "GET",
        headers,
      },
      context
    );
    return result.data;
  } catch (err) {
    throw err;
  }
}

async function updateProducerAPI(baseURL, producer, context) {
  try {
    let url = new URL(`/apis/producers/${producer.globalId}`, baseURL).toString();
    let result = await http(
      {
        url,
        method: "PUT",
        data: producer,
      },
      context
    );
    return result.data;
  } catch (err) {
    throw err;
  }
}

module.exports = {
  getProducerAPI,
  updateProducerAPI,
};
