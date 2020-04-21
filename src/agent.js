const _ = require('lodash');
const { getAgentAPI } = require("./apis/agents");
const { runtime, getConfigs } = require("./utils/config");
const logger = require("./utils/logger");
const constants = require("./utils/constants");

/**
 * Get an Agent's configuration
 * @returns {object|undefined} - Agent Configuration, **undefined** means cannot get any configuration
 */
async function getAgentConfiguration() {
  logger.info("getAgentConfiguration()");
  // Get stored agent configuration information, normally need to get DIA Base URL and Agent Global Id
  let configs = getConfigs();
  try {
    logger.info("getAgentConfiguration->configs: ", configs);
    // If Agent Global ID or DIA Base URL is empty, then return empty agent configuration
    if (!configs.MUNEW_BASE_URL || !configs.GLOBAL_ID) {
      logger.info(
        `Agent GlobalId or Munew BaseURL is empty, return Agent Config: ${configs}`
      );
      return {};
    } else {
      // Get Agent Configuration from server side
      logger.info(
        `Get Agent Config from server. Munew MetadData URL: ${configs.MUNEW_BASE_URL}, Agent Global ID: ${configs.GLOBAL_ID}, Security Key: ${configs.MUNEW_SECURITY_KEY}`
      );
      const agent = await getAgentAPI(
        configs.MUNEW_BASE_URL,
        configs.GLOBAL_ID,
        configs.MUNEW_SECURITY_KEY
      );
      logger.info("background->getAgentConfiguration, agent: ", agent);
      return agent;
    }
  } catch (err) {
    logger.error("background->getAgentConfiguration, error:", err);
    return {};
  }
}

/**
 * compare current Agent Config with remote agent config
 * @param {object} config - Agent config get from Remote
 */
async function compareAgentConfiguration() {
  logger.info("compareAgentConfiguration");
  let munew = runtime;
  try {
    // Get Agent Config from remote server
    let config = await getAgentConfiguration();
    // Get current Agent Config
    let currentConfig = munew.currentAgentConfig;
    logger.info("Current Agent config: ", currentConfig);

    // compare agent global id and version, if same then don't need to initJob, otherwise means agent was changed, then need to re-initJob
    // 1. globalId changed means change agent
    // 2. if globalId is same, then if version isn't same, then means this agent was changed
    // 3. if never initedJob, then start watchJob
    if (
      _.get(config, "agent.globalId") !==
        _.get(currentConfig, "agent.globalId") ||
      _.get(config, "agent.system.version") !==
        _.get(currentConfig, "agent.system.version")
    ) {
      logger.warn("Agent Configuration was changed, need to re-watchJob");
      munew.currentAgentConfig = config;
      // watchIntelligences(config);
    } else {
      logger.info("Agent Configuration is same, don't need to re-watchJob");
    }
  } catch (err) {
    logger.error("watchAgent error: ", err);
    // stopWatchJob();
  }
}

/**
 * Check whether need to collect intelligences
 * @param {object} munew - munew object that contains configurations for munew
 *
 * @returns {boolean}
 */
async function startWatchNewJob(munew, config) {
  logger.group("startWatchNewJob()");
  // logger
  try {
    // Before start, make sure we already stop previous job;
    stopWatchNewJob(munew);
    // Get configuration
    if (!config) {
      config = await getAgentConfiguration();
    }
    // Verify configuration
    let watchJob = await verifyConfigAndUpdateBadge(config);
    logger.info("After verify agent config, watchJob: ", watchJob);
    if (!watchJob) {
      // Comment: 10/05/2019, since already stopWatchNewJob before, don't do this again
      // stop watch new job
      // stopWatchNewJob(munew);
      return munew;
    }
    // Agent configuration
    let agentConfigs = config[constants.OPTIONS_KEY.AGENT];
    // How frequently check whether need to collect intelligence
    // TODO: whether this value allow user to configure???, maybe not
    // Comment: 07/31/2019, to avoid possible performance issue, don't allow user to change the polling interval value
    let pollingValue =
      (agentConfigs.pollingInterval ||
        constants.DEFAULT_AGENT_CONFIGURATION.pollingInterval) * 1000;
    // Comment: 04/17/2020, since we don't provide cloud version to customer, so let customer to decide how frequently they want agent to polling
    // let pollingValue = constants.DEFAULT_AGENT_CONFIGURATION.pollingInterval * 1000;
    logger.info(`polling every ${pollingValue} ms`);
    clearInterval(munew.getIntelligencesIntervalHandler);
    // interval to check new intelligences
    munew.getIntelligencesIntervalHandler = setInterval(function () {
      logger.info("=======startWatchNewJob interval");
      if (!munew.runningJob.jobId) {
        logger.info("No running job!");
        // don't have a in-progress job
        collectIntelligences(munew);
      } else {
        if (
          Date.now() - munew.runningJob.startTime >
          constants.COLLECT_JOB_TIMEOUT
        ) {
          logger.warn(
            `Currnet running job is timeout. jobId: ${munew.runningJob.jobId}, startTime: ${munew.runningJob.startTime}`
          );
          finishCurrentJob(munew);
        } else {
          logger.info("Continue waiting current job to finish");
        }
      }
    }, pollingValue);
    //logger.info('startWatchNewJob -> _intervalHandlerToGetIntelligences: ', _intervalHandlerToGetIntelligences);
    logger.groupEnd();
    return munew;
  } catch (err) {
    logger.error("startWatchNewJob fail. Error: ", err);
    updateBadge("ERR", "red");
    stopWatchNewJob(munew);
    logger.groupEnd();
    return munew;
  }
}

async function stopWatchJob() {
  try {
    let munew = runtime;
    logger.group("stopWatchNewJob()");
    //logger.info('stopWatchNewJob -> _intervalHandlerToGetIntelligences: ', _intervalHandlerToGetIntelligences);
    clearInterval(munew.getIntelligencesIntervalHandler);
    // clearInterval(munew.checkCrawlStatusIntervalHandler);
    munew.getIntelligencesIntervalHandler = null;
    // munew.checkCrawlStatusIntervalHandler = null;
    logger.info("Successfully clear getIntelligencesInterval");
    endCrawlJob();
  } catch (err) {
    logger.error();
  }
}

/**
 * Get stored dia server metadata configuration and get agent configuration from server side, then initial job
 * @param {object} - Agent Configuration
 */
async function watchIntelligences(config) {
  let munew = runtime;
  logger.info("watchJob()");
  try {
    // save config in memory
    // if doesn't pass agent configuratioon, then get it from serve side
    if (!config) {
      // after get agent configuration, will save to storage
      logger.info("get agent config");
      config = await getAgentConfiguration();
    } else {
      logger.info("save agent config to storage: ", config);
      await setConfigs(config);
    }

    let stopJob = !(await verifyConfigAndUpdateBadge(config));
    logger.info("stopJob: ", stopJob);
    if (!stopJob) {
      startWatchNewJob(munew, config);
    } else {
      stopWatchJob(munew);
    }
    // initied job
    munew.initedJob = true;
    logger.info("Successfuly init job ");
  } catch (err) {
    logger.error("initJob fail: ", err);
    // Stop job
    stopWatchJob(munew);
  }
}

/**
 * Watch whether agent configuration changed remote
 */
async function watchAgent() {
  logger.info("watchAgent");
  let munew = runtime;
  // Clear previous interval handler
  clearInterval(munew.watchAgentIntervalHandler);
  munew.watchAgentIntervalHandler = setInterval(() => {
    // compare agent configuration with server side, if need, then initJob
    compareAgentConfiguration();
  }, constants.POLLING_INTERVAL_WATCH_AGENT);
}

module.exports = watchAgent;
