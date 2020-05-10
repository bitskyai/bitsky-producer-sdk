const _ = require('lodash');

/**
 * @class
 */
class CustomError extends Error {
  constructor(error, ...args) {
    super();
    const data = _.get(error, "response.data");
    const code = _.get(data, "code");
    this.code = code;
    this.data = data;
  }

  toJSON() {
    return {
      data: this.data,
      code: this.code
    };
  }
}

/**
 * @class
 */
class HTTPError extends CustomError {
  /**
   * @constructor HTTPError
   * @param {object} error - Error get from server side
   * @param  {...any} args - Additional Parameters
   */
  constructor(error, ...args) {
    super(error, args);
    this.status = _.get(error, "response.status");
    this.statusText = _.get(error, "response.statusText");
    this.response = {
      headers: _.get(error, "response.headers")
    }
    this.request = {
      baseURL: _.get(error, "config.baseURL"),
      headers: _.get(error, "config.headers"),
      method: _.get(error, "config.method"),
      url: _.get(error, 'config.url')
    };
  }

  toJSON() {
    let jsonData = super.toJSON();
    jsonData.status = this.status;
    jsonData.statusText = this.statusText;
    jsonData.message = this.message;
    jsonData.response = this.response;
    jsonData.request = this.request;
    return jsonData;
  }
}

module.exports = {
  HTTPError,
  CustomError
};