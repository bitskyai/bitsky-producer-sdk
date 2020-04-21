const _ = require("lodash");
const constants = require('./constants');
let runtime = {
  currentAgentConfig: undefined, // Current Agent Configuration
  initedJob: false, // whether this job was inited
  windowId: undefined, // browser window open by this extension, keep a reference, so it can close it later
  collectedIntelligences: [], // collected intelligences
  collectedIntelligenceNumber: 0, // how many intelligences were collected
  // checkCrawlStatusIntervalHandler: undefined,
  getIntelligencesIntervalHandler: undefined, //
  watchAgentIntervalHandler: undefined, //
  // stopJob: false, // stop watch new job
  needCollectIntelligences: [],
  runningJob: {
    // current running job
    jobId: undefined,
    totalIntelligences: 0,
    remainIntelligences: 0,
    startTime: 0,
    jobTimeoutHandler: undefined, // used to make sure Job will be ended
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
