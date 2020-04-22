const _ = require("lodash");
const constants = require('./constants');
let runtime = {
  browser: undefined, // puppeteer browser
  currentAgentConfig: undefined, // Current Agent Configuration
  watchIntelligencesIntervalHandler: undefined, // setInterval handler for watch intelligences
  watchAgentIntervalHandler: undefined, // setInterval handler for get agent configuration
  lastRunJobTime: undefined,
  runningJob: { // current running job
    totalIntelligences: [],
    collectedIntelligencesDict: {}, // collected intelligences
    collectedIntelligencesNumber: 0,
    jobId: undefined,
    startTime: 0,
    jobTimeoutHandler: undefined,
    lockJob: false // whether in the middle of ending coleect
  },
};

/* eslint-disable no-process-env */
// Env vars should be casted to correct types

// Get Analyst Service Configuration
function getConfigs() {
  // get config from process env
  let config = {
    HEADLESS: !!process.env.HEADLESS,
    MUNEW_BASE_URL: process.env.MUNEW_BASE_URL,
    MUNEW_SECURITY_KEY: process.env.MUNEW_SECURITY_KEY,
    GLOBAL_ID: process.env.GLOBAL_ID,
    PORT: Number(process.env.PORT) || 8090, // server port number
    SERVICE_NAME: process.env.SERVICE_NAME || constants.SERVICE_NAME,

    // Defualt you don't need change it, only change when you know how,
    // otherwise, keep it as default
    X_SECURITY_KEY_HEADER:
      process.env.X_SECURITY_KEY_HEADER || "x-munew-security-key",
    NODE_ENV: process.env.NODE_ENV || constants.NODE_ENV,
    LOG_FILES_PATH:
      process.env.LOG_FILES_PATH || constants.LOG_FILES_PATH,
    LOG_LEVEL: process.env.LOG_LEVEL || constants.LOG_LEVEL,
    DEBUG_MODE: process.env.DEBUG_MODE,
  };

  if (!config.MUNEW_BASE_URL) {
    throw new Error(
      "You must set `MUNEW_BASE_URL` by `process.env.MUNEW_BASE_URL`. "
    );
  }

  if (!config.GLOBAL_ID) {
    throw new Error(
      "You must set `GLOBAL_ID` by `process.env.GLOBAL_ID`. You can find detail in https://docs.munew.io/how-tos/how-to-set-an-analyst-service-global_id. "
    );
  }

  return config;
}

function getConfigByKey(key){
  let config = getConfigs();
  if(!key){
    return config;
  }else{
    return config[key];
  }
}

module.exports = {
  runtime,
  getConfigs,
  getConfigByKey
};
