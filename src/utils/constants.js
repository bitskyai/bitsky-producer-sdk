"use strict";

module.exports = {
  DEBUG: false,
  // Default agent configuration
  DEFAULT_AGENT_CONFIGURATION: {
    baseURL: "http://munew.io",
    type: "BROWSEREXTENSION",
    private: true,
    concurrent: 1,
    pollingInterval: 30, // (Unit: Second) How frequently to poll whether need to collect intelligences
    maxWaitingTime: 5, // (Unit: Second)
    maxCollect: 50, // (Unit: Second) Max crawl times, when reach this time, close browser to release memory
    idelTime: 10, // (Unit: Second) After close browser, idle system for **IDLE_TIME**
    timeout: 90,
    maxRetry: 1 // Max retry time that agent will try to execute an intelligence
  },
  AGENT_METADATA_TYPE: "BROWSEREXTENSION",
  // DIA Server Configuration
  DIA_METADATA_PATH: "/apis/intelligences",
  DIA_METADATA_METHOD: "GET",
  DIA_UPDATE_INTELLIGENCES_METHOD: "PUT",
  DIA_METADATA_HEALTH_PATH: "/health",
  DIA_METADATA_HEALTH_METHOD: "GET",
  DIA_METADATA_API_KEY: undefined,
  DIA_SECURITY_KEY_PATH: "/apis/securitykey",
  TIMEOUT_VALUE_FOR_INTELLIGENCE: 5*60*1000,    // timeout value for intelligences stored in localstorage
  COLLECT_JOB_TIMEOUT: 3*60*1000,               // A collect job's max time

  // unconfigurable from option
  POLLING_INTERVAL_CHECK_SERVER_STATUS: 60 * 1000,
  POLLING_INTERVAL_WATCH_AGENT: 30 * 1000, // How frequently to check agent configuration change
  API_KEY_HEADER: "x-munew-security-key",
  X_SECURITY_KEY_HEADER: "x-munew-security-key",
  X_REQUESTED_WITH: "x-munew-requested-with", // who send this request
  AGENT_ID_HEADER: "x-munew-agent-id",
  OPTIONS_KEY: {
    // keys that used in local storage
    AGENT: "agent",
    SECURITY_KEY: "security_key",
    WORKING_INTELLIGENCES: "working_intelligences",
    AGENT_GLOBAL_ID: "agent_global_id",
    DIA_METADATA_URL: "dia_metadata_url",
    DIA_METADATA_PATH: "dia_metadata_path",
    DIA_METADATA_METHOD: "dia_metadata_method",
    DIA_METADATA_HEALTH_PATH: "dia_metadata_health_path",
    DIA_METADATA_HEALTH_METHOD: "dia_metadata_health_method",
    DIA_METADATA_API_KEY: "dia_metadata_api_key",
    POLLING_INTERVAL: "polling_interval",
    MAX_WAITING_TIME: "max_waiting_time",
    MAX_CRAWL_TIMES: "max_crawl_times",
    IDLE_TIME: "idle_time",
    STOP_WATCHING_NEW_JOB: "stop_watching_new_job",
    PRIVATE_MODE: "PRIVATE_MODE",
    EACH_TIME_INTELLIGENCES_LIMIT: "each_time_intelligences_limit",
    INTELLIGENCE_TIMEOUT: "intelligence_timeout",
    MAX_RETRY_TIME: "max_retry_time"
  },
  AGENT_STATE: {
    draft: "DRAFT",
    configured: "CONFIGURED",
    active: "ACTIVE",
    deleted: "DELETED"
  }
};
