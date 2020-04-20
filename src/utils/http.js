const axios = require("axios");
const _ = require("lodash");
const constants = require('./constants');
const { HTTPError } = require("./HTTPError");

function http(config) {
  return new Promise((resolve, reject) => {
    let defaultHeader = {};
    defaultHeader[constants.X_REQUESTED_WITH] = constants.AGENT_METADATA_TYPE;
    config.headers = _.merge({}, defaultHeader, config.headers||{});
    config.timeout = 20*1000; // timeout value: 20s, because pollingInterval is 30s

    axios
      .request(config)
      .then(response => {
        let res = {
          status: response.status,
          data: response.data,
          headers: response.headers
        };
        resolve(res);
      })
      .catch(err => {
        let statusCode = _.get(err, "response.status") || 500;
        let data = {
          body: _.get(err, "response.data"),
          request: _.get(err, "config")
        };
        let error = new HTTPError(
          statusCode,
          {
            message: _.get(err, "message")
          },
          data
        );
        reject(error);
      });
  });
}

module.exports = http;
