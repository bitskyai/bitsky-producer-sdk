const axios = require("axios");
const _ = require("lodash");
const uuid = require('uuid');
const constants = require("./constants");
const { HTTPError } = require("./HTTPError");

function http(config, context) {
  return new Promise((resolve, reject) => {
    let defaultHeader = {};
    const producer = _.get(context, 'producer');
    let configs = {};
    if(_.isFunction(producer.getConfigs)){
      configs = producer.getConfigs() || {};
    }

    defaultHeader[constants.X_REQUESTED_WITH] = constants.RETAILER_TYPE;
    defaultHeader[constants.X_SERIAL_ID] = configs.PRODUCER_SERIAL_ID;
    defaultHeader[constants.X_JOB_ID] = uuid.v4();
    config.headers = _.merge({}, defaultHeader, config.headers || {});
    if (!config.timeout) {
      // _.get(producer, 'producerConfiguration().timeout')*1000 ||
      config.timeout = constants.REQUEST_TIMEOUT; // timeout value: 20s, because pollingInterval is 30s
    }

    // Fix an issue - ERR_FR_MAX_BODY_LENGTH_EXCEEDED
    // set `maxContentLength`, and `maxBodyLength` to Infinity
    config.maxContentLength = Infinity;
    config.maxBodyLength = Infinity;

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
        let error = new HTTPError(err);
        const logger = _.get(context, "logger") || console;
        logger.error(
          `http send request fail. Error: ${_.get(err, "message")}`,
          {
            statusCode: error.status,
            error: err,
          }
        );
        reject(error);
      });
  });
}

module.exports = http;
