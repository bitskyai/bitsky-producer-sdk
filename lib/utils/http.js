const axios = require("axios");
const _ = require("lodash");
const constants = require('./constants');
const { HTTPError } = require("./HTTPError");
const { runtime, getConfigs } = require('./config');
const logger = require('./logger');
const agent = require('../agent');

function http(config) {
  return new Promise((resolve, reject) => {
    let defaultHeader = {};
    defaultHeader[constants.X_REQUESTED_WITH] = agent.type || constants.AGENT_TYPE;
    config.headers = _.merge({}, defaultHeader, config.headers||{});
    config.timeout = _.get(runtime, 'currentAgentConfig.timeout')*1000 || constants.REQUEST_TIMEOUT; // timeout value: 20s, because pollingInterval is 30s

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
        logger.error(`http send request fail.`, {
          jobId: _.get(runtime, "runningJob.jobId"),
          message: _.get(err, "message"),
          statusCode: statusCode
        });
        reject(error);
      });
  });
}

module.exports = http;
