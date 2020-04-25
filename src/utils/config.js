const _ = require("lodash");
const constants = require("./constants");
const fs = require("fs-extra");
const logger = require("./logger");
// Stores all the information used for runtime
let runtime = {
  browser: undefined, // puppeteer browser
  currentAgentConfig: undefined, // Current Agent Configuration
  watchIntelligencesIntervalHandler: undefined, // setInterval handler for watch intelligences
  watchAgentIntervalHandler: undefined, // setInterval handler for get agent configuration
  lastRunJobTime: undefined,
  runningJob: {
    // current running job
    totalIntelligences: [],
    collectedIntelligencesDict: {}, // collected intelligences
    collectedIntelligencesNumber: 0,
    jobId: undefined,
    startTime: 0,
    jobTimeoutHandler: undefined,
    lockJob: false, // whether in the middle of ending coleect
  },
};

/* eslint-disable no-process-env */
// Env vars should be casted to correct types

// Get Analyst Service Configuration
function getConfigs() {
  try {
    let preferences = {};
    // Get preferences.json
    try {
      preferences = fs.readJSONSync(constants.PREFERENCES_FILE) || {};
    } catch (err) {
      logger.error(
        `Read ${constants.PREFERENCES_FILE} fail. Error: ${err.message}`
      );
    }
    // get configs from process env
    let configs = {
      MUNEW_BASE_URL: process.env.MUNEW_BASE_URL,
      MUNEW_SECURITY_KEY: process.env.MUNEW_SECURITY_KEY,
      GLOBAL_ID: process.env.GLOBAL_ID,
      PORT: Number(process.env.PORT) || 8090, // server port number
      SERVICE_NAME: process.env.SERVICE_NAME || constants.SERVICE_NAME,

      // Defualt you don't need change it, only change when you know how,
      // otherwise, keep it as default
      NODE_ENV: process.env.NODE_ENV || constants.NODE_ENV,
      LOG_FILES_PATH: process.env.LOG_FILES_PATH || constants.LOG_FILES_PATH,
      LOG_LEVEL: process.env.LOG_LEVEL || constants.LOG_LEVEL,
    };

    if (process.env.HEADLESS === undefined || process.env.HEADLESS === null) {
      configs.HEADLESS = true;
    } else {
      configs.HEADLESS = process.env.HEADLESS;
    }

    // Environment value's priority higher than preferences.json
    configs = _.merge(preferences, configs);

    if (!configs.MUNEW_BASE_URL) {
      logger.warn(
        "You must set `MUNEW_BASE_URL` by `process.env.MUNEW_BASE_URL`. "
      );
    }

    if (!configs.GLOBAL_ID) {
      logger.warn("You must set `GLOBAL_ID` by `process.env.GLOBAL_ID` ");
    }

    return configs;
  } catch (err) {}
}

module.exports = {
  runtime,
  getConfigs,
};
