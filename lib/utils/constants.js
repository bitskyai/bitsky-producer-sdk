"use strict";
const path = require("path");
const packageJson = require("../../package.json");

module.exports = {
  DEBUG: false,
  LOG_LEVEL: "info",
  AGENT_TYPE: "munew-agents-baseservice",
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
    maxRetry: 1, // Max retry time that agent will try to execute an intelligence
  },
  SERVICE_NAME: packageJson.name,
  LOG_FILES_PATH: path.join(__dirname, "../public/log"),
  ERROR_LOG_FILE_NAME: "error.log",
  COMBINED_LOG_FILE_NAME: "combined.log",
  HEADLESS_AGENT_TYPE: "HEADLESSBROWSER",
  SERVICE_AGENT_TYPE: "SERVICE",
  // DIA Server Configuration
  DIA_METADATA_PATH: "/apis/intelligences",
  DIA_METADATA_METHOD: "GET",
  DIA_UPDATE_INTELLIGENCES_METHOD: "PUT",
  DIA_METADATA_HEALTH_PATH: "/health",
  DIA_METADATA_HEALTH_METHOD: "GET",
  DIA_METADATA_API_KEY: undefined,
  DIA_SECURITY_KEY_PATH: "/apis/securitykey",
  COLLECT_JOB_TIMEOUT: 3 * 60 * 1000, // A collect job's max time
  CUSTOM_FUNCTION_TIMEOUT: 1 * 60 * 1000, // Timeout value for a customFun call
  REQUEST_TIMEOUT: 30 * 1000, // Request timeout, include send to SOI or DIA

  // unconfigurable from option
  POLLING_INTERVAL_CHECK_SERVER_STATUS: 60 * 1000,
  POLLING_INTERVAL_WATCH_AGENT: 30 * 1000, // How frequently to check agent configuration change
  X_SECURITY_KEY_HEADER: "x-munew-security-key",
  X_REQUESTED_WITH: "x-munew-requested-with", // who send this request
  X_SERIAL_ID: "x-munew-serial-id", // request serial id
  X_JOB_ID: "x-munew-job-id", // each request is a job
  AGENT_STATE: {
    draft: "DRAFT",
    configured: "CONFIGURED",
    active: "ACTIVE",
    deleted: "DELETED",
  },
  PREFERENCES_FILE: path.join(__dirname, "../public/preferences.json"),
};
