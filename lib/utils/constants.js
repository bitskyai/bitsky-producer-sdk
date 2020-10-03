"use strict";
const path = require("path");
const packageJson = require("../../package.json");

module.exports = {
  DEBUG: false,
  LOG_LEVEL: "info",
  RETAILER_TYPE: "bitsky-service-producer",
  // Default producer configuration
  DEFAULT_RETAILER_CONFIGURATION: {
    baseURL: "http://bitsky.ai",
    type: "BROWSEREXTENSION",
    private: true,
    concurrent: 1,
    pollingInterval: 30, // (Unit: Second) How frequently to poll whether need to collect tasks
    maxWaitingTime: 5, // (Unit: Second)
    maxCollect: 50, // (Unit: Second) Max crawl times, when reach this time, close browser to release memory
    idelTime: 10, // (Unit: Second) After close browser, idle system for **IDLE_TIME**
    timeout: 90,
    maxRetry: 1, // Max retry time that producer will try to execute an task
  },
  SERVICE_NAME: packageJson.name,
  LOG_FILES_PATH: path.join(__dirname, "../public/log"),
  LOG_MAX_SIZE: 50*1024*1024, // 50MB
  ERROR_LOG_FILE_NAME: "error.log",
  COMBINED_LOG_FILE_NAME: "combined.log",
  HEADLESS_RETAILER_TYPE: "HEADLESSBROWSER",
  HTTP_RETAILER_TYPE: "HTTP",
  // BitSky Server Configuration
  BITSKYMETADATA_PATH: "/apis/tasks",
  BITSKYMETADATA_METHOD: "GET",
  BITSKYUPDATE_TASKS_METHOD: "PUT",
  BITSKYMETADATA_HEALTH_PATH: "/health",
  BITSKYMETADATA_HEALTH_METHOD: "GET",
  BITSKYMETADATA_API_KEY: undefined,
  BITSKYSECURITY_KEY_PATH: "/apis/securitykey",
  COLLECT_JOB_TIMEOUT: 3 * 60 * 1000, // A collect job's max time
  CUSTOM_FUNCTION_TIMEOUT: 1 * 60 * 1000, // Timeout value for a customFun call
  REQUEST_TIMEOUT: 30 * 1000, // Request timeout, include send to Retailer or BitSky

  // unconfigurable from option
  POLLING_INTERVAL_CHECK_SERVER_STATUS: 60 * 1000,
  POLLING_INTERVAL_WATCH_RETAILER: 30 * 1000, // How frequently to check producer configuration change
  X_SECURITY_KEY_HEADER: "x-bitsky-security-key",
  X_REQUESTED_WITH: "x-bitsky-requested-with", // who send this request
  X_SERIAL_ID: "x-bitsky-serial-id", // request serial id
  X_JOB_ID: "x-bitsky-job-id", // each request is a job
  RETAILER_STATE: {
    draft: "DRAFT",
    configured: "CONFIGURED",
    active: "ACTIVE",
    deleted: "DELETED",
  },
  PREFERENCES_FILE: path.join(__dirname, "../public/preferences.json"),
};
