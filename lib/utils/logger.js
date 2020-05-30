const { createLogger, format, transports } = require("winston");
const constants = require("./constants");
const path = require("path");
const _ = require("lodash");
const fs = require("fs-extra");

/**
 * Create a winston logger. https://github.com/winstonjs/winston
 * @param {string} logLevel - Default is `info`. Winston log level ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']. https://github.com/winstonjs/winston#logging
 * @param {string} logFilePath - Path to log file folder. Default to `public/log`
 * @param {string} errorLogFileName - File name for error logs. Default `error.log`
 * @param {*} combinedLogFileName - File name for combined logs. Default `combined.log`
 * @param {*} serviceName - Service Name. Default `name` inside `package.json`
 * @param {*} nodeEnv - NodeJS Mode. Default `development`. You also can set to `production`
 *
 * @returns {object} - winston logger
 */
function createMyLogger(
  logLevel,
  logFilePath,
  errorLogFileName,
  combinedLogFileName,
  serviceName,
  nodeEnv
) {
  try {
    if (!logFilePath) {
      logFilePath = constants.LOG_FILES_PATH;
    }
    fs.ensureDirSync(logFilePath);
    // console.log('[createLogger] starting...');
    const __logger = createLogger({
      level: logLevel || constants.LOG_LEVEL,
      format: format.combine(
        format.ms(),
        format.errors({ stack: true }),
        format.timestamp(),
        format.splat(),
        format.json()
      ),
      defaultMeta: {
        service: serviceName || constants.SERVICE_NAME,
      },
      transports: [
        //
        // - Write to all logs with level `info` and below to `combined.log`
        // - Write all logs error (and below) to `error.log`.
        //
        new transports.File({
          filename: path.join(
            logFilePath,
            errorLogFileName || constants.ERROR_LOG_FILE_NAME
          ),
          level: "error",
        }),
        new transports.File({
          filename: path.join(
            logFilePath,
            combinedLogFileName || constants.COMBINED_LOG_FILE_NAME
          ),
        }),
      ],
    });
    //
    // If we're not in production then log to the `console` with the format:
    // `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
    //
    if (nodeEnv !== "production") {
      __logger.add(
        new transports.Console({
          colorize: nodeEnv !== "production",
          timestamp: true,
        })
      );
    }

    // console.log('[createLogger] end');
    return __logger;
  } catch (err) {
    console.error("error: ", err);
    return console;
  }
}

module.exports = createMyLogger;
