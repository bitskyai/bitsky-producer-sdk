"use strict";
const path = require('path');
const packageJson = require("../../package.json");

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
  SERVICE_NAME: packageJson.name,
  LOG_FILES_PATH: path.join(__dirname, '../public/log'),
  AGENT_METADATA_TYPE: "HEADLESS_AGENT",
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
  AGENT_STATE: {
    draft: "DRAFT",
    configured: "CONFIGURED",
    active: "ACTIVE",
    deleted: "DELETED"
  },
  PREFERENCES_FILE: path.join(__dirname, '../public/preferences.json')
};
