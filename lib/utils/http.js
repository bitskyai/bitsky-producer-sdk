const axios = require("axios");
const _ = require("lodash");
const uuid = require('uuid');
const constants = require("./constants");
const { HTTPError } = require("./HTTPError");

function http(config, context) {
  return new Promise((resolve, reject) => {
    let defaultHeader = {};
    const agent = _.get(context, 'agent');
    let configs = {};
    if(_.isFunction(agent.getConfigs)){
      configs = agent.getConfigs() || {};
    }

    defaultHeader[constants.X_REQUESTED_WITH] = constants.AGENT_TYPE;
    defaultHeader[constants.X_SERIAL_ID] = configs.AGENT_SERIAL_ID;
    defaultHeader[constants.X_JOB_ID] = uuid.v4();
    config.headers = _.merge({}, defaultHeader, config.headers || {});
    if (!config.timeout) {
      // _.get(agent, 'agentConfiguration().timeout')*1000 ||
      config.timeout = constants.REQUEST_TIMEOUT; // timeout value: 20s, because pollingInterval is 30s
    }

    axios
      .request(config)
      .then((response) => {
        let res = {
          status: response.status,
          data: response.data,
          headers: response.headers,
        };
        resolve(res);
      })
      .catch((err) => {
        let statusCode = _.get(err, "response.status") || 500;
        let data = {
          body: _.get(err, "response.data"),
          request: _.get(err, "config"),
        };
        let error = new HTTPError(
          statusCode,
          {
            message: _.get(err, "message"),
          },
          data
        );

        const logger = _.get(context, "logger") || console;
        logger.error(
          `http send request fail. Error: ${_.get(err, "message")}`,
          {
            statusCode: statusCode,
            error: err,
          }
        );
        reject(error);
      });
  });
}

module.exports = http;
