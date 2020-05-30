const _ = require("lodash");
const uuid = require("uuid");
const Context = require("./utils/context");
const constants = require("./utils/constants");
const {
  getIntelligencesAPI,
  updateIntelligencesAPI,
} = require("./apis/intelligences");
const { sendIntelligencesToSOI } = require("./apis/soi");
const { getAgentAPI } = require("./apis/agents");
const { serviceCrawler } = require("./workers/serviceWorker");
const { joinURL } = require("./utils");

const DEFAULT_CONFIGS = {
  MUNEW_BASE_URL: undefined,
  MUNEW_SECURITY_KEY: undefined,
  GLOBAL_ID: undefined,
};

class Agent {
  constructor(context, configs) {
    //================================================================================
    // Agent configurations
    this.__type = constants.SERVICE_AGENT_TYPE; // default type is "service agent"
    this.__worker = serviceCrawler; // default worker for this agent is service crawler
    // how many job ran
    this.__ranJobNumber = 0;
    this.__currentAgentConfig = undefined;
    this.__watchIntelligencesIntervalHandler = undefined;
    this.__watchAgentIntervalHandler = undefined;
    this.__runningJob = {
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
    this.__manuallySetConfigs = {
      MUNEW_BASE_URL: undefined,
      MUNEW_SECURITY_KEY: undefined,
      GLOBAL_ID: undefined,
    };
    if (context instanceof Context) {
      this.context = context;
    } else {
      this.context = new Context();
    }

    this.context.agent = this;
    this.setConfigs(configs);
  }

  getConfigs() {
    // get configs from env
    let configs = {
      MUNEW_BASE_URL: process.env.MUNEW_BASE_URL,
      MUNEW_SECURITY_KEY: process.env.MUNEW_SECURITY_KEY,
      GLOBAL_ID: process.env.GLOBAL_ID,
    };

    if (process.env.HEADLESS === undefined || process.env.HEADLESS === null) {
      configs.HEADLESS = true;
    } else {
      configs.HEADLESS = process.env.HEADLESS;
    }

    // 1. manually set configs' priority is high than env variables
    // 2. get latest env variables
    configs = _.merge({}, DEFAULT_CONFIGS, configs, this.__manuallySetConfigs);

    if (!configs.MUNEW_BASE_URL) {
      console.warn(
        "You must set `MUNEW_BASE_URL` by `process.env.MUNEW_BASE_URL`. "
      );
    }

    if (!configs.GLOBAL_ID) {
      console.warn("You must set `GLOBAL_ID` by `process.env.GLOBAL_ID` ");
    }

    return configs;
  }

  setConfigs(configs) {
    if(configs instanceof Object){
      this.__manuallySetConfigs = configs;
    }
  }

  /**
   * Get an Agent's configuration
   * @returns {object|undefined} - Agent Configuration, **undefined** means cannot get any configuration
   */
  async getAgentConfiguration() {
    this.context.logger.debug("getAgentConfiguration()");
    try {
      // Get stored agent configuration information, normally need to get DIA Base URL and Agent Global Id
      const configs = this.getConfigs();
      this.context.logger.debug("getAgentConfiguration->configs: ", {
        configs,
      });
      // If Agent Global ID or DIA Base URL is empty, then return empty agent configuration
      if (!configs.MUNEW_BASE_URL || !configs.GLOBAL_ID) {
        this.context.logger.debug(
          `Agent GlobalId or Munew BaseURL is empty, return Agent Config: ${configs}`
        );
        return undefined;
      } else {
        // Get Agent Configuration from server side
        this.context.logger.debug(
          `Get Agent Config from server. Munew MetadData URL: ${configs.MUNEW_BASE_URL}, Agent Global ID: ${configs.GLOBAL_ID}, Security Key: ${configs.MUNEW_SECURITY_KEY}`
        );
        let agent = await getAgentAPI(
          configs.MUNEW_BASE_URL,
          configs.GLOBAL_ID,
          configs.MUNEW_SECURITY_KEY,
          this.context
        );
        agent = _.merge({}, constants.DEFAULT_AGENT_CONFIGURATION, agent);
        this.context.logger.debug("getAgentConfiguration->agent: ", { agent });
        return agent;
      }
    } catch (err) {
      this.context.logger.error(
        `Fail getAgentConfiguration. Error: ${err.message}`
      );
      return undefined;
    }
  }

  /**
   * compare current Agent Config with remote agent config
   * @param {object} config - Agent config get from Remote
   */
  async compareAgentConfiguration() {
    this.context.logger.debug("compareAgentConfiguration");
    try {
      // Get Agent Config from remote server
      let config = await this.getAgentConfiguration();
      // Get current Agent Config

      this.context.logger.info(
        `From remote: globalId ${_.get(config, "globalId")}, version: ${_.get(
          config,
          "system.version"
        )} `
      );
      this.context.logger.info(
        `From local: globalId ${_.get(
          this.__currentAgentConfig,
          "globalId"
        )}, version: ${_.get(this.__currentAgentConfig, "system.version")} `
      );

      // compare agent global id and version, if same then don't need to initJob, otherwise means agent was changed, then need to re-initJob
      // 1. globalId changed means change agent
      // 2. if globalId is same, then if version isn't same, then means this agent was changed
      // if it is first time, then currentAgentConfig should be undefined
      if (
        _.get(config, "globalId") !==
          _.get(this.__currentAgentConfig, "globalId") ||
        _.get(config, "system.version") !==
          _.get(this.__currentAgentConfig, "system.version")
      ) {
        this.context.logger.debug(
          "Agent Configuration was changed, need to re-watchJob"
        );
        const configs = this.getConfigs();
        this.__currentAgentConfig = config;
        // if type or globalId doesn't exist, then means get agent config fail
        // if get agent config, but type isn't same, then also fail
        if (
          !configs.MUNEW_BASE_URL ||
          !_.get(config, "type") ||
          !_.get(config, "globalId") ||
          _.toUpper(_.get(config, "type")) !== _.toUpper(this.__type) ||
          _.toUpper(_.get(config, "system.state")) !=
            _.toUpper(constants.AGENT_STATE.active)
        ) {
          this.context.logger.warn(
            "Didn't get agent config from server or get agent type is different with current agent type or current agent isn't active state"
          );
          await this.endPollingGetIntelligences();
        } else {
          await this.startPollingGetIntelligences();
        }
      } else {
        this.context.logger.info(
          `Agent Configuration is same, don't need to re-watchJob. Agent Global Id: ${_.get(
            this.__currentAgentConfig,
            "globalId"
          )}`,
          { jobId: _.get(this.__runningJob, "jobId") }
        );
      }
    } catch (err) {
      this.context.logger.error(
        `compareAgentConfiguration error: ${_.get(err, "message")}`,
        {
          jobId: _.get(this.__runningJob, "jobId"),
        }
      );
    }
  }

  /**
   * Check whether need to collect intelligences
   *
   * @returns {boolean}
   */
  async startPollingGetIntelligences() {
    this.context.logger.debug("startPollingGetIntelligences()");
    // this.context.logger
    try {
      // Before start, make sure we already stop previous job;
      await this.endPollingGetIntelligences();
      // Agent configuration
      let agentConfigs = this.__currentAgentConfig;
      // How frequently check whether need to collect intelligence
      // TODO: whether this value allow user to configure???, maybe not
      // Comment: 07/31/2019, to avoid possible performance issue, don't allow user to change the polling interval value
      let pollingValue =
        (agentConfigs.pollingInterval ||
          constants.DEFAULT_AGENT_CONFIGURATION.pollingInterval) * 1000;
      // Comment: 04/17/2020, since we don't provide cloud version to customer, so let customer to decide how frequently they want agent to polling
      // let pollingValue = constants.DEFAULT_AGENT_CONFIGURATION.pollingInterval * 1000;
      this.context.logger.debug(`polling every ${pollingValue} ms`);
      clearInterval(this.__watchIntelligencesIntervalHandler);
      // interval to check new intelligences
      this.__watchIntelligencesIntervalHandler = setInterval(async () => {
        this.context.logger.debug("startPollingGetIntelligences -> interval");
        if (!this.__runningJob.jobId && !this.__runningJob.lockJob) {
          this.context.logger.info(
            "No running job!, startCollectIntelligencesJob"
          );
          // don't have a in-progress job
          await this.startCollectIntelligencesJob();
        } else {
          this.context.logger.info(
            `waiting job id ${_.get(this.__runningJob, "jobId")} finish ......`,
            { jobId: _.get(this.__runningJob, "jobId") }
          );
          // if (
          //   Date.now() - runningJob.startTime >
          //   constants.COLLECT_JOB_TIMEOUT
          // ) {
          //   this.context.logger.warn(
          //     `Currnet running job is timeout. jobId: ${runningJob.jobId}, startTime: ${runningJob.startTime}`
          //   );
          //   await this.endCollectIntelligencesJob();
          // } else {
          //   this.context.logger.debug("Continue waiting current job to finish");
          // }
        }
      }, pollingValue);
      //this.context.logger.debug('startWatchNewJob -> _intervalHandlerToGetIntelligences: ', _intervalHandlerToGetIntelligences);
    } catch (err) {
      this.context.logger.error(
        `startPollingGetIntelligences fail. Error: ${err.message}`
      );
      // await endPollingGetIntelligences();
    }
  }

  /**
   * Stop polling to get intelligences
   */
  async endPollingGetIntelligences() {
    try {
      this.context.logger.debug("endPollingGetIntelligences()");
      // Clear intervalHandler
      clearInterval(this.__watchIntelligencesIntervalHandler);
      this.__watchIntelligencesIntervalHandler = null;
      // Also need to endCollectIntelligencesJob
      await this.endCollectIntelligencesJob();
      this.context.logger.info(
        `Successfully endPollingGetIntelligences, Agent Global ID: ${_.get(
          this.__currentAgentConfig,
          "globalId"
        )}`,
        { jobId: _.get(this.__runningJob, "jobId") }
      );
    } catch (err) {
      this.context.logger.error(
        `Fail endPollingGetIntelligences, Agent Global ID: ${_.get(
          this.__currentAgentConfig,
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
  setIntelligenceState(intelligence, state, reason) {
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
  async startCollectIntelligencesJob() {
    try {
      // if this.__runningJob.jobId isn't undefined, then means previous job isn't finish
      if (
        this.__runningJob.jobId ||
        this.__runningJob.lockJob ||
        this.__runningJob.endingCollectIntelligencesJob
      ) {
        this.context.logger.info(
          `Call startCollectIntelligences but previous job ${_.get(
            this.__runningJob,
            "jobId"
          )} is still running`,
          { jobId: this.__runningJob.jobId }
        );
        return true;
      }

      // start collectIntelligencesJob lockJob need to excute ASAP
      this.initRunningJob();
      this.context.logger.info(`<<<<<<Start job: ${this.__runningJob.jobId}`, {
        jobId: this.__runningJob.jobId,
      });
      const configs = this.getConfigs();
      let intelligences = await getIntelligencesAPI(
        configs.MUNEW_BASE_URL,
        configs.GLOBAL_ID,
        configs.MUNEW_SECURITY_KEY,
        this.context
      );
      this.context.logger.info(`intelligences: ${intelligences.length}`, {
        jobId: this.__runningJob.jobId,
      });
      if (intelligences && !intelligences.length) {
        // no intelligences need to be collected
        // don't need to crawl, resetRunningJob
        this.context.logger.info(
          `>>>>>> End job: ${this.__runningJob.jobId} because not intelligences`,
          { jobId: this.__runningJob.jobId }
        );
        await this.__worker(
          {
            intelligences: [],
            jobId: this.__runningJob.jobId,
            agentConfig: this.__currentAgentConfig,
            context: this.context
          }
        );
        this.resetRunningJob();
        return true;
      }
      this.__ranJobNumber++;
      this.context.logger.info(
        `[[[[[[ Job Number: ${this.__ranJobNumber} ]]]]]]`,
        {
          jobId: this.__runningJob.jobId,
        }
      );

      // set total intelligences that need to collect
      this.__runningJob.totalIntelligences = intelligences;

      // Make sure you set worker before
      let promises = await this.__worker(
        {
          intelligences,
          jobId: this.__runningJob.jobId,
          agentConfig: this.__currentAgentConfig,
          context: this.context
        }
      );
      // whether currently job timeout
      clearTimeout(this.__runningJob.jobTimeoutHandler);
      this.__runningJob.jobTimeoutHandler = setTimeout(() => {
        // job timeout
        this.__runningJob.jobTimeout = true;
        // when timeout, all intelligences will timeout
        this.context.logger.info(
          `job id ${this.__runningJob.jobId} timeout, startTime is ${this.__runningJob.startTime}`,
          {
            jobId: this.__runningJob.jobId,
          }
        );
        this.__runningJob.jobTimeoutHandler = undefined;
        // set all intelligences to timeout
        this.__runningJob.totalIntelligences.forEach((intelligence) => {
          // set intelligence to "FAILED"
          this.__runningJob.collectedIntelligencesDict[
            intelligence.globalId
          ] = this.setIntelligenceState(
            intelligence,
            "TIMEOUT",
            "collect intelligences timeout"
          );
          // increase collected intelligences
          this.__runningJob.collectedIntelligencesNumber++;
        });
        this.endCollectIntelligencesJob();

        // TODO: COLLECT_JOB_TIMEOUT should be configurable in agent
      }, constants.COLLECT_JOB_TIMEOUT);

      await Promise.allSettled(promises)
        .then((results) => {
          if (this.__runningJob.jobTimeout) {
            // currently job is timeout, don't need to continue
            return;
          }
          this.context.logger.info(
            `${this.__runningJob.jobId} collect data successful.`,
            {
              jobId: this.__runningJob.jobId,
            }
          );
          clearTimeout(this.__runningJob.jobTimeoutHandler);
          this.__runningJob.jobTimeoutHandler = undefined;

          // Update coolected intelligences to runningJob
          results.forEach((result) => {
            if (
              _.toLower(result.status) === "fulfilled" &&
              _.get(result, "value.globalId")
            ) {
              let intelligence = result.value;
              // means successful and return intelligence
              this.__runningJob.collectedIntelligencesDict[
                intelligence.globalId
              ] = this.setIntelligenceState(intelligence, "FINISHED");
              // increase collected intelligences
              this.__runningJob.collectedIntelligencesNumber++;
            } else if (
              _.toLower(result.status) === "rejected" &&
              _.get(result, "reason.globalId")
            ) {
              let intelligence = result.reason;
              // 2. result.status is 'rejected', then collect intelligence fail
              this.__runningJob.collectedIntelligencesDict[
                intelligence.globalId
              ] = this.setIntelligenceState(intelligence, "FAILED");
              // increase collected intelligences
              this.__runningJob.collectedIntelligencesNumber++;
            } else {
              // if didn't return globalId, then skip it
              this.context.logger.debug(
                "Skip this intelligence. You need to resolve(intelligence) or reject(intelligen), return the intelligence back"
              );
            }
          });
          this.endCollectIntelligencesJob();
        })
        .catch((err) => {
          if (this.__runningJob.jobTimeout) {
            return;
          }
          this.context.logger.error(
            `${this.__runningJob.jobId} collect data fail. Error: ${err.message}`,
            { jobId: this.__runningJob.jobId }
          );
          clearTimeout(this.__runningJob.jobTimeoutHandler);
          this.__runningJob.jobTimeoutHandler = undefined;
          this.endCollectIntelligencesJob();
        });
    } catch (err) {
      this.context.logger.error(
        `Start job fail: ${this.__runningJob.jobId}, intelligences: ${
          this.__runningJob.totalIntelligences.length
        }, error: ${_.get(err, "message")}`,
        { jobId: _.get(this.__runningJob, "jobId") }
      );
      clearTimeout(this.__runningJob.jobTimeoutHandler);
      this.__runningJob.jobTimeoutHandler = undefined;
      this.endCollectIntelligencesJob();
    }
  }

  /**
   *
   * Known enhancement:
   * - https://github.com/munew/dia-agents-browserextensions/issues/17
   * @param {array} intelligences
   */
  async sendToSOIAndDIA(intelligences) {
    // make sure send intelligences to correct SOI, in case, it contains multiple SOIs, so first category them
    this.context.logger.debug("[sendToSOIAndDIA][Start]");
    let sois = {};
    const configs = this.getConfigs();
    // Separate SOI based on url and method, so it can send to correct SOI
    // The reason is because it maybe contains multiple SOI's intelligences
    for (let i = 0; i < intelligences.length; i++) {
      let baseUrl = _.get(intelligences[i], "soi.baseURL");
      let method = _.get(intelligences[i], "soi.callback.method");
      let callbackPath = _.get(intelligences[i], "soi.callback.path");
      // any of those intelligences don't exist, then skip this item
      if (!baseUrl || !method || !callbackPath) {
        this.context.logger.debug(
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
                  intelligences,
                  this.context
                );
              } catch (err) {
                this.context.logger.debug(
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
                await updateIntelligencesAPI(
                  configs.MUNEW_BASE_URL,
                  configs.MUNEW_SECURITY_KEY,
                  _.get(sois[key], "intelligences"),
                  this.context
                );
              } catch (err) {
                // if error, also will resolve as successful. The reason is to reduce complex for agent. Normally when updateIntelligencesAPI fail, also cannot get intelligences
                // This maybe caused intelligences are collected multiple time.
                this.context.logger.debug(
                  "[updateIntelligencesAPI][Fail], error: ",
                  err
                );
              }
              resolve([]);
            } catch (err) {
              this.context.logger.error(
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

  async endCollectIntelligencesJob() {
    try {
      // if not running job, then don't need to process endCollectIntelligencesJob
      // only process during lockJob time
      if (
        !this.__runningJob.jobId ||
        !this.__runningJob.lockJob ||
        this.__runningJob.endingCollectIntelligencesJob
      ) {
        this.context.logger.debug(
          "endCollectIntelligencesJob: no running job or it is in the middle for ending job"
        );
        return;
      }
      this.__runningJob.endingCollectIntelligencesJob = true;
      this.context.logger.info(
        `start end job: ${this.__runningJob.jobId}, intelligences: ${this.__runningJob.totalIntelligences.length}`,
        { jobId: _.get(this.__runningJob, "jobId") }
      );
      let temp = [];
      for (let i = 0; i < this.__runningJob.totalIntelligences.length; i++) {
        let tmp = this.__runningJob.totalIntelligences[i];
        let intelligence = this.__runningJob.collectedIntelligencesDict[
          _.get(tmp, "globalId")
        ];
        if (!intelligence) {
          intelligence = tmp;
          // this means timeout, so set it fail.
          intelligence = this.setIntelligenceState(
            intelligence,
            "FAILED",
            "Intelligence failed caused by timeout or you didn't resolve(intelligence) or reject(intelligence) in your agent"
          );
        } else {
          if (!_.get(intelligence, "system.state")) {
            if (_.get(intelligence, "dataset")) {
              // if dataset isn't empty, then sucessfully collect but possible user forget to set system.state
              intelligence = this.setIntelligenceState(
                intelligence,
                "FINISHED"
              );
            } else {
              // else, it should be failed
              intelligence = this.setIntelligenceState(intelligence, "FAILED");
            }
          }
        }

        temp.push(intelligence);
      }

      this.__runningJob.totalIntelligences = temp;
      try {
        await this.sendToSOIAndDIA(this.__runningJob.totalIntelligences);
      } catch (err) {
        this.context.logger.error(
          `[endCollectIntelligencesJob->sendToSOIAndDIA] shouldn't fail, something really bad happened! error: ${err.message}`,
          { jobId: _.get(this.__runningJob, "jobId") }
        );
      }
      this.context.logger.info(
        `Total time: ${Date.now() - this.__runningJob.startTime} ms`
      );
      this.context.logger.info(
        `>>>>>>>>> Successfuly end job ${_.get(this.__runningJob, "jobId")}`,
        {
          jobId: _.get(this.__runningJob, "jobId"),
        }
      );
      this.resetRunningJob();
      this.startCollectIntelligencesJob();
    } catch (err) {
      this.context.logger.error(
        `Fail end job: ${this.__runningJob.jobId}, intelligences: ${this.__runningJob.totalIntelligences.length}, error: ${err.message}`
      );
      // if cannot successfully end collect intelligence job, then intelligence will keep running state until timeout
      this.resetRunningJob();
      this.startCollectIntelligencesJob();
    }
  }

  resetRuntime() {
    clearInterval(this.__watchIntelligencesIntervalHandler);
    clearInterval(this.__watchAgentIntervalHandler);
    this.__ranJobNumber = 0;
    this.__currentAgentConfig = undefined;
    this.__watchIntelligencesIntervalHandler = undefined;
    this.__watchAgentIntervalHandler = undefined;
    this.resetRunningJob();
    return this;
  }

  resetRunningJob() {
    clearTimeout(this.__runningJob.jobTimeoutHandler);
    this.__runningJob.totalIntelligences = [];
    this.__runningJob.collectedIntelligencesDict = {};
    this.__runningJob.collectedIntelligencesNumber = 0;
    this.__runningJob.jobId = undefined;
    this.__runningJob.startTime = 0;
    this.__runningJob.jobTimeout = false;
    this.__runningJob.endingCollectIntelligencesJob = false;
    this.__runningJob.jobTimeoutHandler = undefined;
    this.__runningJob.lockJob = false;
    return this;
  }

  initRunningJob(intelligences) {
    this.resetRunningJob();
    this.__runningJob.totalIntelligences = intelligences || [];
    this.__runningJob.jobId = uuid.v4();
    this.__runningJob.startTime = Date.now();
    this.__runningJob.lockJob = true;
    return this;
  }

  /**
   * Watch whether agent configuration changed remote
   */
  async start() {
    this.context.logger.debug("start");
    // Clear previous interval handler
    this.resetRuntime();
    if (!this.__type) {
      this.__type = constants.SERVICE_AGENT_TYPE; // default type is "service agent"
    }
    if (!this.__worker) {
      this.__worker = serviceCrawler; // default worker for this agent is service crawler
    }
    this.__watchAgentIntervalHandler = setInterval(() => {
      // compare agent configuration with server side, if need, then initJob
      this.compareAgentConfiguration();
    }, constants.POLLING_INTERVAL_WATCH_AGENT);
  }

  /**
   * Get or Set Agent Type
   * @param {string|undefined|null} type - agent type string
   *
   * @throws {Error} if type isn't a none-empty string, throw error
   * @returns {Agent}
   */
  type(type) {
    if (!type) {
      return this.__type;
    }

    // type must be a string
    if (!(type instanceof String) && !type) {
      throw new Error(`${type} isn't valid, you must pass a not empty string`);
    }
    this.__type = type;

    return this;
  }

  /**
   * Get or Set worker used for this agent. Worker response for really run each job
   * Default worker is `serviceCrawler`
   *
   * @param {Function|undefined} worker - worker must be a function
   *
   * @throws {Error} if worker isn't a function, throw error
   * @returns {Agent}
   */
  worker(worker) {
    if (!worker) {
      return this.__worker;
    }

    if (!(worker instanceof Function)) {
      throw new Error(
        `${worker} isn't valid, you must pass a not empty function`
      );
    }
    this.__worker = worker;

    return this;
  }

  /**
   * Get currently agent configuration
   */
  agentConfiguration() {
    return this.__currentAgentConfig;
  }

  jobId() {
    return _.get(this.__runningJob, "jobId");
  }
}

module.exports = Agent;
