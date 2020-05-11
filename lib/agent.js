const _ = require("lodash");
const uuid = require("uuid");
const { getConfigs } = require("./utils/config");
const logger = require("./utils/logger");
const constants = require("./utils/constants");
const {
  getIntelligencesAPI,
  updateIntelligencesAPI,
} = require("./apis/intelligences");
const { sendIntelligencesToSOI } = require("./apis/soi");
const { getAgentAPI } = require("./apis/agents");
const { serviceCrawler } = require("./crawlers/serviceCrawler");
const { joinURL } = require("./utils");

const agent = (exports = module.exports = {});

//================================================================================
// Agent configurations
let __type = constants.SERVICE_AGENT_TYPE; // default type is "service agent"
let __worker = serviceCrawler; // default worker for this agent is service crawler
// how many job ran
let __ranJobNumber = 0;
let __currentAgentConfig = undefined;
let __watchIntelligencesIntervalHandler = undefined;
let __watchAgentIntervalHandler = undefined;
const __runningJob = {
  // current running job
  totalIntelligences: [], // total intelligences that need to collect
  collectedIntelligencesDict: {}, // collected intelligences
  collectedIntelligencesNumber: 0,
  jobId: undefined,
  startTime: 0,
  jobTimeout: false,
  endingCollectIntelligencesJob: false,
  jobTimeoutHandler: undefined,
  lockJob: false,
};

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
        __currentAgentConfig,
        "globalId"
      )}, version: ${_.get(__currentAgentConfig, "system.version")} `
    );

    // compare agent global id and version, if same then don't need to initJob, otherwise means agent was changed, then need to re-initJob
    // 1. globalId changed means change agent
    // 2. if globalId is same, then if version isn't same, then means this agent was changed
    // if it is first time, then currentAgentConfig should be undefined
    if (
      _.get(config, "globalId") !== _.get(__currentAgentConfig, "globalId") ||
      _.get(config, "system.version") !==
        _.get(__currentAgentConfig, "system.version")
    ) {
      logger.debug("Agent Configuration was changed, need to re-watchJob");
      const configs = getConfigs();
      __currentAgentConfig = config;
      // if type or globalId doesn't exist, then means get agent config fail
      // if get agent config, but type isn't same, then also fail
      if (
        !configs.MUNEW_BASE_URL ||
        !_.get(config, "type") ||
        !_.get(config, "globalId") ||
        _.toUpper(_.get(config, "type")) !== _.toUpper(__type) ||
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
          __currentAgentConfig,
          "globalId"
        )}`,
        { jobId: _.get(__runningJob, "jobId") }
      );
    }
  } catch (err) {
    logger.error(`compareAgentConfiguration error: ${_.get(err, "message")}`, {
      jobId: _.get(__runningJob, "jobId"),
    });
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
    let agentConfigs = __currentAgentConfig;
    // How frequently check whether need to collect intelligence
    // TODO: whether this value allow user to configure???, maybe not
    // Comment: 07/31/2019, to avoid possible performance issue, don't allow user to change the polling interval value
    let pollingValue =
      (agentConfigs.pollingInterval ||
        constants.DEFAULT_AGENT_CONFIGURATION.pollingInterval) * 1000;
    // Comment: 04/17/2020, since we don't provide cloud version to customer, so let customer to decide how frequently they want agent to polling
    // let pollingValue = constants.DEFAULT_AGENT_CONFIGURATION.pollingInterval * 1000;
    logger.debug(`polling every ${pollingValue} ms`);
    clearInterval(__watchIntelligencesIntervalHandler);
    // interval to check new intelligences
    __watchIntelligencesIntervalHandler = setInterval(async function () {
      logger.debug("startPollingGetIntelligences -> interval");
      if (!__runningJob.jobId && !__runningJob.lockJob) {
        logger.info("No running job!, startCollectIntelligencesJob");
        // don't have a in-progress job
        await startCollectIntelligencesJob();
      } else {
        logger.info(
          `waiting job id ${_.get(__runningJob, "jobId")} finish ......`,
          { jobId: _.get(__runningJob, "jobId") }
        );
        // if (
        //   Date.now() - runningJob.startTime >
        //   constants.COLLECT_JOB_TIMEOUT
        // ) {
        //   logger.warn(
        //     `Currnet running job is timeout. jobId: ${runningJob.jobId}, startTime: ${runningJob.startTime}`
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
    clearInterval(__watchIntelligencesIntervalHandler);
    watchIntelligencesIntervalHandler = null;
    // Also need to endCollectIntelligencesJob
    await endCollectIntelligencesJob();
    logger.info(
      `Successfully endPollingGetIntelligences, Agent Global ID: ${_.get(
        __currentAgentConfig,
        "globalId"
      )}`,
      { jobId: _.get(__runningJob, "jobId") }
    );
  } catch (err) {
    logger.error(
      `Fail endPollingGetIntelligences, Agent Global ID: ${_.get(
        __currentAgentConfig,
        "globalId"
      )}, Error: ${_.get(err, "message")}`
    );
  }
}

/**
 * Update intelligence's state and endAt time
 * @param {object} intelligence - intellignece you want to update
 * @param {string} state - what is state you want to set. ["FAILED", "FINISHED"]
 * @param {*} reason - if state is "FAILED", then the reason why it is fail. It will transfer reason to string
 */
function setIntelligenceState(intelligence, state, reason) {
  _.set(intelligence, "system.state", _.toUpper(state));
  if (_.get(intelligence, "system.agent.endedAt")) {
    // if agent didn't set endedAt, then set to current timestamp
    _.set(intelligence, "system.agent.endedAt", Date.now());
  }
  if (reason) {
    let reasonStr = "";
    if (reason instanceof Error) {
      reasonStr = reason.message;
    } else if (typeof reason === "object") {
      reasonStr = JSON.stringify(reason);
    } else {
      reasonStr = _.toString(reason);
    }
    _.set(intelligence, "system.failuresReason", reasonStr);
  }

  return intelligence;
}

/**
 * Start collect intelligences
 * @param {array} intelligences - intelligences that need to be collected
 */
async function startCollectIntelligencesJob() {
  try {
    // if __runningJob.jobId isn't undefined, then means previous job isn't finish
    if (
      __runningJob.jobId ||
      __runningJob.lockJob ||
      __runningJob.endingCollectIntelligencesJob
    ) {
      logger.info(
        `Call startCollectIntelligences but previous job ${_.get(
          __runningJob,
          "jobId"
        )} is still running`,
        { jobId: _.get(__runningJob, "jobId") }
      );
      return true;
    }

    // start collectIntelligencesJob lockJob need to excute ASAP
    initRunningJob();
    logger.info(`<<<<<<Start job: ${__runningJob.jobId}`, {
      jobId: _.get(__runningJob, "jobId"),
    });

    let intelligences = await getIntelligencesAPI();
    logger.info(`intelligences: ${intelligences.length}`, {
      jobId: _.get(__runningJob, "jobId"),
    });
    if (intelligences && !intelligences.length) {
      // no intelligences need to be collected
      // don't need to crawl, resetRunningJob
      logger.info(
        `>>>>>> End job: ${__runningJob.jobId} because not intelligences`,
        { jobId: _.get(__runningJob, "jobId") }
      );
      resetRunningJob();
      return true;
    }
    __ranJobNumber++;
    logger.info(`[[[[[[ Job Number: ${__ranJobNumber} ]]]]]]`, {
      jobId: _.get(__runningJob, "jobId"),
    });
    const configs = getConfigs();
    // set total intelligences that need to collect
    __runningJob.totalIntelligences = intelligences;

    // Make sure you set worker before
    let promises = await __worker(intelligences, __currentAgentConfig);
    // whether currently job timeout
    clearTimeout(__runningJob.jobTimeoutHandler);
    __runningJob.jobTimeoutHandler = setTimeout(() => {
      // job timeout
      __runningJob.jobTimeout = true;
      // when timeout, all intelligences will timeout
      logger.info(
        `job id ${__runningJob.jobId} timeout, startTime is ${__runningJob.startTime}`,
        {
          jobId: _.get(__runningJob, "jobId"),
        }
      );
      __runningJob.jobTimeoutHandler = undefined;
      // set all intelligences to timeout
      __runningJob.totalIntelligences.forEach((intelligence) => {
        // set intelligence to "FAILED"
        __runningJob.collectedIntelligencesDict[
          intelligence.globalId
        ] = setIntelligenceState(
          intelligence,
          "TIMEOUT",
          "collect intelligences timeout"
        );
        // increase collected intelligences
        __runningJob.collectedIntelligencesNumber++;
      });
      endCollectIntelligencesJob();

      // TODO: COLLECT_JOB_TIMEOUT should be configurable in agent
    }, constants.COLLECT_JOB_TIMEOUT);

    await Promise.allSettled(promises)
      .then((results) => {
        if (__runningJob.jobTimeout) {
          // currently job is timeout, don't need to continue
          return;
        }
        logger.info(`${__runningJob.jobId} collect data successful.`, {
          jobId: _.get(__runningJob, "jobId"),
        });
        clearTimeout(__runningJob.jobTimeoutHandler);
        __runningJob.jobTimeoutHandler = undefined;

        // Update coolected intelligences to runningJob
        results.forEach((result) => {
          if (
            _.toLower(result.status) === "fulfilled" &&
            _.get(result, "value.globalId")
          ) {
            let intelligence = result.value;
            // means successful and return intelligence
            __runningJob.collectedIntelligencesDict[
              intelligence.globalId
            ] = setIntelligenceState(intelligence, "FINISHED");
            // increase collected intelligences
            __runningJob.collectedIntelligencesNumber++;
          } else if (
            _.toLower(result.status) === "rejected" &&
            _.get(result, "reason.globalId")
          ) {
            let intelligence = result.reason;
            // 2. result.status is 'rejected', then collect intelligence fail
            __runningJob.collectedIntelligencesDict[
              intelligence.globalId
            ] = setIntelligenceState(intelligence, "FAILED");
            // increase collected intelligences
            __runningJob.collectedIntelligencesNumber++;
          } else {
            // if didn't return globalId, then skip it
            logger.debug(
              "Skip this intelligence. You need to resolve(intelligence) or reject(intelligen), return the intelligence back"
            );
          }
        });
        endCollectIntelligencesJob();
      })
      .catch((err) => {
        if (__runningJob.jobTimeout) {
          return;
        }
        logger.error(
          `${__runningJob.jobId} collect data fail. Error: ${err.message}`,
          { jobId: _.get(__runningJob, "jobId") }
        );
        clearTimeout(__runningJob.jobTimeoutHandler);
        __runningJob.jobTimeoutHandler = undefined;
        endCollectIntelligencesJob();
      });
  } catch (err) {
    logger.error(
      `Start job fail: ${__runningJob.jobId}, intelligences: ${
        __runningJob.totalIntelligences.length
      }, error: ${_.get(err, "message")}`,
      { jobId: _.get(__runningJob, "jobId") }
    );
    clearTimeout(__runningJob.jobTimeoutHandler);
    __runningJob.jobTimeoutHandler = undefined;
    endCollectIntelligencesJob();
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
              await updateIntelligencesAPI(_.get(sois[key], "intelligences"));
            } catch (err) {
              // if error, also will resolve as successful. The reason is to reduce complex for agent. Normally when updateIntelligencesAPI fail, also cannot get intelligences
              // This maybe caused intelligences are collected multiple time.
              logger.debug("[updateIntelligencesAPI][Fail], error: ", err);
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

  await Promise.allSettled(promises);
}

async function endCollectIntelligencesJob() {
  try {
    // if not running job, then don't need to process endCollectIntelligencesJob
    // only process during lockJob time
    if (
      !__runningJob.jobId ||
      !__runningJob.lockJob ||
      __runningJob.endingCollectIntelligencesJob
    ) {
      logger.debug(
        "endCollectIntelligencesJob: no running job or it is in the middle for ending job"
      );
      return;
    }
    __runningJob.endingCollectIntelligencesJob = true;
    logger.info(
      `start end job: ${__runningJob.jobId}, intelligences: ${__runningJob.totalIntelligences.length}`,
      { jobId: _.get(__runningJob, "jobId") }
    );
    let temp = [];
    for (let i = 0; i < __runningJob.totalIntelligences.length; i++) {
      let tmp = __runningJob.totalIntelligences[i];
      let intelligence =
        __runningJob.collectedIntelligencesDict[_.get(tmp, "globalId")];
      if (!intelligence) {
        intelligence = tmp;
        // this means timeout, so set it fail.
        intelligence = setIntelligenceState(
          intelligence,
          "FAILED",
          "Intelligence failed caused by timeout or you didn't resolve(intelligence) or reject(intelligence) in your agent"
        );
      } else {
        if (!_.get(intelligence, "system.state")) {
          if (_.get(intelligence, "dataset")) {
            // if dataset isn't empty, then sucessfully collect but possible user forget to set system.state
            intelligence = setIntelligenceState(intelligence, "FINISHED");
          } else {
            // else, it should be failed
            intelligence = setIntelligenceState(intelligence, "FAILED");
          }
        }
      }

      temp.push(intelligence);
    }

    __runningJob.totalIntelligences = temp;
    try {
      await sendToSOIAndDIA(__runningJob.totalIntelligences);
    } catch (err) {
      logger.error(
        `[endCollectIntelligencesJob->sendToSOIAndDIA] shouldn't fail, something really bad happened! error: ${err.message}`,
        { jobId: _.get(__runningJob, "jobId") }
      );
    }
    logger.info(`Total time: ${Date.now() - __runningJob.startTime} ms`);
    logger.info(
      `>>>>>>>>> Successfuly end job ${_.get(__runningJob, "jobId")}`,
      {
        jobId: _.get(__runningJob, "jobId"),
      }
    );
    resetRunningJob();
    startCollectIntelligencesJob();
  } catch (err) {
    logger.error(
      `Fail end job: ${__runningJob.jobId}, intelligences: ${__runningJob.totalIntelligences.length}, error: ${err.message}`
    );
    // if cannot successfully end collect intelligence job, then intelligence will keep running state until timeout
    resetRunningJob();
    startCollectIntelligencesJob();
  }
}

function resetRuntime() {
  clearInterval(__watchIntelligencesIntervalHandler);
  clearInterval(__watchAgentIntervalHandler);
  __ranJobNumber = 0;
  __currentAgentConfig = undefined;
  __watchIntelligencesIntervalHandler = undefined;
  __watchAgentIntervalHandler = undefined;
  resetRunningJob();
  return this;
}

function resetRunningJob() {
  clearTimeout(__runningJob.jobTimeoutHandler);
  __runningJob.totalIntelligences = [];
  __runningJob.collectedIntelligencesDict = {};
  __runningJob.collectedIntelligencesNumber = 0;
  __runningJob.jobId = undefined;
  __runningJob.startTime = 0;
  __runningJob.jobTimeout = false;
  __runningJob.endingCollectIntelligencesJob = false;
  __runningJob.jobTimeoutHandler = undefined;
  __runningJob.lockJob = false;
  return this;
}

function initRunningJob(intelligences) {
  resetRunningJob();
  __runningJob.totalIntelligences = intelligences || [];
  __runningJob.jobId = uuid.v4();
  __runningJob.startTime = Date.now();
  __runningJob.lockJob = true;
  return this;
}

/**
 * Watch whether agent configuration changed remote
 */
agent.start = async function start() {
  logger.debug("start");
  // Clear previous interval handler
  resetRuntime();
  if (!__type) {
    __type = constants.SERVICE_AGENT_TYPE; // default type is "service agent"
  }
  if (!__worker) {
    __worker = serviceCrawler; // default worker for this agent is service crawler
  }
  __watchAgentIntervalHandler = setInterval(() => {
    // compare agent configuration with server side, if need, then initJob
    compareAgentConfiguration();
  }, constants.POLLING_INTERVAL_WATCH_AGENT);
};

/**
 * Get or Set Agent Type
 * @param {string|undefined|null} type - agent type string
 *
 * @throws {Error} if type isn't a none-empty string, throw error
 * @returns {Agent}
 */
agent.type = function type(type) {
  if (!type) {
    return __type;
  }

  // type must be a string
  if (!(type instanceof String) && !type) {
    throw new Error(`${type} isn't valid, you must pass a not empty string`);
  }
  __type = type;

  return this;
};

/**
 * Get or Set worker used for this agent. Worker response for really run each job
 * Default worker is `serviceCrawler`
 *
 * @param {Function|undefined} worker - worker must be a function
 *
 * @throws {Error} if worker isn't a function, throw error
 * @returns {Agent}
 */
agent.worker = function worker(worker) {
  if (!worker) {
    return __worker;
  }

  if (!(worker instanceof Function)) {
    throw new Error(
      `${worker} isn't valid, you must pass a not empty function`
    );
  }
  __worker = worker;

  return this;
};

/**
 * Get currently agent configuration
 */
agent.agentConfiguration = function agentConfiguration(){
  return __currentAgentConfig;
}

agent.jobId = function jobId(){
  return _.get(__runningJob, 'jobId');
}
