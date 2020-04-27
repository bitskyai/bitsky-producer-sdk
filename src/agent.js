const _ = require("lodash");
const uuid = require("uuid");
const { runtime, getConfigs } = require("./utils/config");
const logger = require("./utils/logger");
const constants = require("./utils/constants");
const {
  getIntelligencesAPI,
  updateIntelligencesAPI,
} = require("./apis/intelligences");
const { sendIntelligencesToSOI } = require("./apis/soi");
const { getAgentAPI } = require("./apis/agents");
const { headlessCrawler } = require("./crawlers/headlessCrawler");
const { serviceCrawler } = require('./crawlers/serviceCrawler');
const { joinURL } = require('./utils');

/**
 * Get an Agent's configuration
 * @returns {object|undefined} - Agent Configuration, **undefined** means cannot get any configuration
 */
async function getAgentConfiguration() {
  logger.debug("getAgentConfiguration()");
  try {
    // Get stored agent configuration information, normally need to get DIA Base URL and Agent Global Id
    const configs = getConfigs();
    logger.debug("getAgentConfiguration->configs: ", { configs });
    // If Agent Global ID or DIA Base URL is empty, then return empty agent configuration
    if (!configs.MUNEW_BASE_URL || !configs.GLOBAL_ID) {
      logger.debug(
        `Agent GlobalId or Munew BaseURL is empty, return Agent Config: ${configs}`
      );
      return undefined;
    } else {
      // Get Agent Configuration from server side
      logger.debug(
        `Get Agent Config from server. Munew MetadData URL: ${configs.MUNEW_BASE_URL}, Agent Global ID: ${configs.GLOBAL_ID}, Security Key: ${configs.MUNEW_SECURITY_KEY}`
      );
      let agent = await getAgentAPI(
        configs.MUNEW_BASE_URL,
        configs.GLOBAL_ID,
        configs.MUNEW_SECURITY_KEY
      );
      agent = _.merge({}, constants.DEFAULT_AGENT_CONFIGURATION, agent);
      logger.debug("getAgentConfiguration->agent: ", { agent });
      return agent;
    }
  } catch (err) {
    logger.error(`Fail getAgentConfiguration. Error: ${err.message}`);
    return undefined;
  }
}

/**
 * compare current Agent Config with remote agent config
 * @param {object} config - Agent config get from Remote
 */
async function compareAgentConfiguration() {
  logger.debug("compareAgentConfiguration");
  try {
    // Get Agent Config from remote server
    let config = await getAgentConfiguration();
    // Get current Agent Config

    logger.info(
      `From remote: globalId ${_.get(config, "globalId")}, version: ${_.get(
        config,
        "system.version"
      )} `
    );
    logger.info(
      `From local: globalId ${_.get(
        runtime,
        "currentAgentConfig.globalId"
      )}, version: ${_.get(runtime, "currentAgentConfig.system.version")} `
    );

    // compare agent global id and version, if same then don't need to initJob, otherwise means agent was changed, then need to re-initJob
    // 1. globalId changed means change agent
    // 2. if globalId is same, then if version isn't same, then means this agent was changed
    // if it is first time, then currentAgentConfig should be undefined
    if (
      _.get(config, "globalId") !==
        _.get(runtime, "currentAgentConfig.globalId") ||
      _.get(config, "system.version") !==
        _.get(runtime, "currentAgentConfig.system.version")
    ) {
      logger.debug("Agent Configuration was changed, need to re-watchJob");
      const configs = getConfigs();
      runtime.currentAgentConfig = config;
      // if type or globalId doesn't exist, then means get agent config fail
      // if get agent config, but type isn't same, then also fail
      if (
        !configs.MUNEW_BASE_URL ||
        !_.get(config, "type") ||
        !_.get(config, "globalId") ||
        _.toUpper(_.get(config, "type")) !== _.toUpper(configs.AGENT_TYPE) ||
        _.toUpper(_.get(config, "system.state")) !=
          _.toUpper(constants.AGENT_STATE.active)
      ) {
        logger.warn(
          "Didn't get agent config from server or get agent type is different with current agent type or current agent isn't active state"
        );
        await endPollingGetIntelligences();
      } else {
        await startPollingGetIntelligences();
      }
    } else {
      logger.info(
        `Agent Configuration is same, don't need to re-watchJob. Agent Global Id: ${_.get(
          runtime,
          "currentAgentConfig.globalId"
        )}`,
        { jobId: _.get(runtime, "runningJob.jobId") }
      );
    }
  } catch (err) {
    logger.error(`compareAgentConfiguration error: ${_.get(err, "message")}`, {
      jobId: _.get(runtime, "runningJob.jobId"),
    });
    // await endPollingGetIntelligences();
  }
}

/**
 * Check whether need to collect intelligences
 *
 * @returns {boolean}
 */
async function startPollingGetIntelligences() {
  logger.debug("startPollingGetIntelligences()");
  // logger
  try {
    // Before start, make sure we already stop previous job;
    await endPollingGetIntelligences();
    // Agent configuration
    let agentConfigs = runtime.currentAgentConfig;
    // How frequently check whether need to collect intelligence
    // TODO: whether this value allow user to configure???, maybe not
    // Comment: 07/31/2019, to avoid possible performance issue, don't allow user to change the polling interval value
    let pollingValue =
      (agentConfigs.pollingInterval ||
        constants.DEFAULT_AGENT_CONFIGURATION.pollingInterval) * 1000;
    // Comment: 04/17/2020, since we don't provide cloud version to customer, so let customer to decide how frequently they want agent to polling
    // let pollingValue = constants.DEFAULT_AGENT_CONFIGURATION.pollingInterval * 1000;
    logger.debug(`polling every ${pollingValue} ms`);
    clearInterval(runtime.watchIntelligencesIntervalHandler);
    // interval to check new intelligences
    runtime.watchIntelligencesIntervalHandler = setInterval(async function () {
      logger.debug("startPollingGetIntelligences -> interval");
      if (!runtime.runningJob.jobId && !runtime.runningJob.lockJob) {
        logger.info("No running job!, startCollectIntelligencesJob");
        // don't have a in-progress job
        await startCollectIntelligencesJob();
      } else {
        logger.info(
          `waiting job id ${_.get(runtime, "runningJob.jobId")} finish ......`,
          { jobId: _.get(runtime, "runningJob.jobId") }
        );
        // if (
        //   Date.now() - runtime.runningJob.startTime >
        //   constants.COLLECT_JOB_TIMEOUT
        // ) {
        //   logger.warn(
        //     `Currnet running job is timeout. jobId: ${runtime.runningJob.jobId}, startTime: ${runtime.runningJob.startTime}`
        //   );
        //   await endCollectIntelligencesJob();
        // } else {
        //   logger.debug("Continue waiting current job to finish");
        // }
      }
    }, pollingValue);
    //logger.debug('startWatchNewJob -> _intervalHandlerToGetIntelligences: ', _intervalHandlerToGetIntelligences);
  } catch (err) {
    logger.error(`startPollingGetIntelligences fail. Error: ${err.message}`);
    // await endPollingGetIntelligences();
  }
}

/**
 * Stop polling to get intelligences
 */
async function endPollingGetIntelligences() {
  try {
    logger.debug("endPollingGetIntelligences()");
    // Clear intervalHandler
    clearInterval(runtime.watchIntelligencesIntervalHandler);
    runtime.watchIntelligencesIntervalHandler = null;
    // Also need to endCollectIntelligencesJob
    await endCollectIntelligencesJob();
    logger.info(
      `Successfully endPollingGetIntelligences, Agent Global ID: ${_.get(
        runtime,
        "currentAgentConfig.globalId"
      )}`,
      { jobId: _.get(runtime, "runningJob.jobId") }
    );
  } catch (err) {
    logger.error(
      `Fail endPollingGetIntelligences, Agent Global ID: ${_.get(
        runtime,
        "currentAgentConfig.globalId"
      )}, Error: ${_.get(err, "message")}`
    );
  }
}

/**
 * Start collect intelligences
 * @param {array} intelligences - intelligences that need to be collected
 */
async function startCollectIntelligencesJob() {
  try {
    // if runningJob.jobId isn't undefined, then means previous job isn't finish
    if (
      runtime.runningJob.jobId ||
      runtime.runningJob.lockJob ||
      runtime.runningJob.endingCollectIntelligencesJob
    ) {
      logger.info(
        `Call startCollectIntelligences but previous job ${_.get(
          runtime,
          "runningJob.jobId"
        )} is still running`,
        { jobId: _.get(runtime, "runningJob.jobId") }
      );
      return true;
    }

    // start collectIntelligencesJob lockJob need to excute ASAP
    initRunningJob();
    logger.info(`<<<<<<Start job: ${runtime.runningJob.jobId}`, {
      jobId: _.get(runtime, "runningJob.jobId"),
    });

    let intelligences = await getIntelligencesAPI();
    logger.info(`intelligences: ${intelligences.length}`, {
      jobId: _.get(runtime, "runningJob.jobId"),
    });
    if (intelligences && !intelligences.length) {
      // no intelligences need to be collected
      // close browser if it still opens
      if (runtime.browser) {
        await runtime.browser.close();
        runtime.browser = undefined;
      }
      // don't need to crawl, resetRunningJob
      logger.info(
        `>>>>>> End job: ${runtime.runningJob.jobId} because not intelligences`,
        { jobId: _.get(runtime, "runningJob.jobId") }
      );
      resetRunningJob();
      return true;
    }
    runtime.ranJobNumber++;
    logger.info(`[[[[[[ Job Number: ${runtime.ranJobNumber} ]]]]]]`, {
      jobId: _.get(runtime, "runningJob.jobId"),
    });
    const configs = getConfigs();
    // set total intelligences that need to collect
    runtime.runningJob.totalIntelligences = intelligences;
    let promises = [];
    if(_.upperCase(configs.AGENT_TYPE) === _.upperCase(constants.SERVICE_AGENT_TYPE)){
      promises = await serviceCrawler(intelligences);
    }else{
      promises = await headlessCrawler(intelligences);
    }
    // whether currently job timeout
    let timeout = false;
    clearTimeout(runtime.runningJob.jobTimeoutHandler);
    runtime.runningJob.jobTimeoutHandler = setTimeout(() => {
      logger.info(`job id ${runtime.runningJob.jobId} timeout.`, {
        jobId: _.get(runtime, "runningJob.jobId"),
      });
      runtime.runningJob.jobTimeoutHandler = undefined;
      timeout = true;
      endCollectIntelligencesJob();
    }, constants.COLLECT_JOB_TIMEOUT);

    await Promise.all(promises)
      .then(() => {
        if (timeout) {
          return;
        }
        logger.info(`${runtime.runningJob.jobId} collect data successful.`, {
          jobId: _.get(runtime, "runningJob.jobId"),
        });
        clearTimeout(runtime.runningJob.jobTimeoutHandler);
        runtime.runningJob.jobTimeoutHandler = undefined;
        endCollectIntelligencesJob();
      })
      .catch((err) => {
        if (timeout) {
          return;
        }
        logger.error(
          `${runtime.runningJob.jobId} collect data fail. Error: ${err.message}`,
          { jobId: _.get(runtime, "runningJob.jobId") }
        );
        clearTimeout(runtime.runningJob.jobTimeoutHandler);
        runtime.runningJob.jobTimeoutHandler = undefined;
        endCollectIntelligencesJob();
      });
  } catch (err) {
    logger.error(
      `Start job fail: ${runtime.runningJob.jobId}, intelligences: ${
        runtime.runningJob.totalIntelligences.length
      }, error: ${_.get(err, "message")}`,
      { jobId: _.get(runtime, "runningJob.jobId") }
    );
    clearTimeout(runtime.runningJob.jobTimeoutHandler);
    runtime.runningJob.jobTimeoutHandler = undefined;
    endCollectIntelligencesJob();
  }
}

/**
 * Update the intelligences status
 *
 * Known enhancement:
 * - https://github.com/munew/dia-agents-browserextensions/issues/17
 * @param {array} intelligences -
 */
async function sendToDIA(intelligences) {
  logger.debug("sendToDIA");
  try {
    logger.debug("intelligences: ", intelligences);
    await updateIntelligencesAPI(intelligences);
  } catch (err) {
    //TODO: Need to improve this, if it has error, need to store intelligences and retry
    logger.error(`sendToDIA fail.`, err);
    // If cannot update to DIA, then seems something wrong happened, shouldn't sent this to SOI
    throw err;
  }
}

/**
 *
 * Known enhancement:
 * - https://github.com/munew/dia-agents-browserextensions/issues/17
 * @param {array} intelligences
 */
async function sendToSOIAndDIA(intelligences) {
  // make sure send intelligences to correct SOI, in case, it contains multiple SOIs, so first category them
  logger.debug("[sendToSOIAndDIA][Start]");
  let sois = {};
  // Separate SOI based on url and method, so it can send to correct SOI
  // The reason is because it maybe contains multiple SOI's intelligences
  for (let i = 0; i < intelligences.length; i++) {
    let baseUrl = _.get(intelligences[i], "soi.baseURL");
    let method = _.get(intelligences[i], "soi.callback.method");
    let callbackPath = _.get(intelligences[i], "soi.callback.path");
    // any of those intelligences don't exist, then skip this item
    if (!baseUrl || !method || !callbackPath) {
      logger.debug(
        "sendToSOIAndDIA->invalid intelligences, miss baseUrl, method or callbackPath. Skip this item.",
        intelligences[i]
      );
      continue;
    }
    let url = joinURL(callbackPath, baseUrl);
    let key = `${_.toLower(method)}:${_.toLower(url)}`;
    if (!sois[key]) {
      sois[key] = {
        soi: intelligences[i].soi,
        intelligences: [],
      };
    }
    sois[key].intelligences.push(intelligences[i]);
  }

  let promises = [];
  // TODO: need to support parallel send request
  for (let key in sois) {
    if (sois.hasOwnProperty(key)) {
      promises.push(
        new Promise(async (resolve) => {
          try {
            let baseURL = _.get(sois[key], "soi.baseURL");
            let method = _.get(sois[key], "soi.callback.method");
            let callbackPath = _.get(sois[key], "soi.callback.path");

            // TODO: apiKey need to improve, this should be support custom http header
            let apiKey = _.get(sois[key], "soi.apiKey");
            let headers = {};
            if (apiKey) {
              headers[constants.API_KEY_HEADER] = apiKey;
            }

            try {
              await sendIntelligencesToSOI(
                baseURL,
                method,
                callbackPath,
                headers,
                intelligences
              );
            } catch (err) {
              logger.debug(
                `[sendIntelligencesToSOI][Fail]. Key: ${key}. Error: `,
                err
              );
              let intelligences = _.get(sois[key], "intelligences");
              // if send to SOI fail, then change intelligences state to `FAILED`
              intelligences.forEach((intelligence) => {
                intelligence.system.state = "FAILED";
                intelligence.system.failuresReason = JSON.stringify(
                  err && err.toJSON()
                );
              });
            }

            try {
              await sendToDIA(_.get(sois[key], "intelligences"));
            } catch (err) {
              // if error, also will resolve as successful. The reason is to reduce complex for agent. Normally when sendToDIA fail, also cannot get intelligences
              // This maybe caused intelligences are collected multiple time.
              logger.debug("[sendToDIA][Fail], error: ", err);
            }
            resolve([]);
          } catch (err) {
            logger.error(
              `[sendToSOIAndDIA][Fail]. Key: ${key}. Error: ${err.message}`
            );
            // the reason of return [] is because, normally agent is automatically start and close, no human monitor it
            // to make sure work flow isn't stopped, so resolve it as []
            resolve([]);
          }
        })
      );
    }
  }

  await Promise.all(promises);
}

async function endCollectIntelligencesJob() {
  try {
    // if not running job, then don't need to process endCollectIntelligencesJob
    // only process during lockJob time
    if (
      !runtime.runningJob.jobId ||
      !runtime.runningJob.lockJob ||
      runtime.runningJob.endingCollectIntelligencesJob
    ) {
      logger.debug(
        "endCollectIntelligencesJob: no running job or it is in the middle for ending job"
      );
      return;
    }
    runtime.runningJob.endingCollectIntelligencesJob = true;
    logger.info(
      `start end job: ${runtime.runningJob.jobId}, intelligences: ${runtime.runningJob.totalIntelligences.length}`,
      { jobId: _.get(runtime, "runningJob.jobId") }
    );
    let temp = [];
    for (let i = 0; i < runtime.runningJob.totalIntelligences.length; i++) {
      let tmp = runtime.runningJob.totalIntelligences[i];
      let intelligence =
        runtime.runningJob.collectedIntelligencesDict[_.get(tmp, "globalId")];
      if (!intelligence) {
        intelligence = tmp;
        // this means timeout, so set it fail.
        _.set(intelligence, "system.state", "FAILED");
        _.set(
          intelligence,
          "system.failuresReason",
          "Intelligence failed caused by timeout"
        );
      }
      if (!_.get(intelligence, "system.state")) {
        _.set(intelligence, "system.state", "FAILED");
      }
      if (!_.get(intelligence, "system.endedAt")) {
        _.set(intelligence, "system.endedAt", Date.now());
      }
      if (!_.get(intelligence, "system.agent")) {
        _.set(intelligence, "system.agent.endedAt", Date.now());
      }
      temp.push(intelligence);
    }

    runtime.runningJob.totalIntelligences = temp;
    try {
      await sendToSOIAndDIA(runtime.runningJob.totalIntelligences);
    } catch (err) {
      logger.error(
        `[endCollectIntelligencesJob->sendToSOIAndDIA] shouldn't fail, something really bad happened! error: ${err.message}`,
        { jobId: _.get(runtime, "runningJob.jobId") }
      );
    }
    logger.debug(`Total time: ${Date.now() - runtime.runningJob.startTime} ms`);
    logger.info(
      `>>>>>>>>> Successfuly end job ${_.get(runtime, "runningJob.jobId")}`,
      {
        jobId: _.get(runtime, "runningJob.jobId"),
      }
    );
    resetRunningJob();
    startCollectIntelligencesJob();
  } catch (err) {
    logger.error(
      `Fail end job: ${runtime.runningJob.jobId}, intelligences: ${runtime.runningJob.totalIntelligences.length}, error: ${err.message}`
    );
    // if cannot successfully end collect intelligence job, then intelligence will keep running state until timeout
    resetRunningJob();
    startCollectIntelligencesJob();
  }
}

function resetRunningJob() {
  clearTimeout(runtime.runningJob.jobTimeoutHandler);
  runtime.runningJob = {
    // current running job
    totalIntelligences: [], // total intelligences that need to collect
    collectedIntelligencesDict: {}, // collected intelligences
    collectedIntelligencesNumber: 0,
    jobId: undefined,
    startTime: 0,
    endingCollectIntelligencesJob: false,
    jobTimeoutHandler: undefined,
    lockJob: false,
  };
}

function initRunningJob(intelligences) {
  runtime.runningJob = {
    totalIntelligences: intelligences || [], // total intelligences that need to collect
    collectedIntelligencesDict: {}, // collected intelligences
    collectedIntelligencesNumber: 0,
    jobId: uuid.v4(),
    startTime: Date.now(),
    endingCollectIntelligencesJob: false,
    jobTimeoutHandler: undefined,
    lockJob: true,
  };
  return runtime.runningJob;
}

/**
 * Watch whether agent configuration changed remote
 */
async function startPollingGetAgent() {
  logger.debug("startPollingGetAgent");
  // Clear previous interval handler
  clearInterval(runtime.watchAgentIntervalHandler);
  runtime.watchAgentIntervalHandler = setInterval(() => {
    // compare agent configuration with server side, if need, then initJob
    compareAgentConfiguration();
  }, constants.POLLING_INTERVAL_WATCH_AGENT);
}

module.exports = startPollingGetAgent;
