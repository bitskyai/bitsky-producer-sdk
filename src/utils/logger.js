const { createLogger, format, transports } = require("winston");
const _ = require("lodash");
const { getConfigs } = require("./config");
const fs = require("fs-extra");

// Only need one logger instance in whole system
let __logger;

function createMyLogger() {
  try {
    const configs = getConfigs();
    if (__logger) {
      // console.log('logger already created.');
      return __logger;
    }
    fs.ensureDirSync(configs["LOG_FILES_PATH"]);
    // console.log('[createLogger] starting...');
    __logger = createLogger({
      level: configs["LOG_LEVEL"],
      format: format.combine(
        format.ms(),
        format.errors({ stack: true }),
        format.timestamp(),
        format.splat(),
        format.json()
      ),
      defaultMeta: {
        service: configs["SERVICE_NAME"],
      },
      transports: [
        //
        // - Write to all logs with level `info` and below to `combined.log`
        // - Write all logs error (and below) to `error.log`.
        //
        new transports.File({
          filename: `${configs["LOG_FILES_PATH"]}/error.log`,
          level: "error",
        }),
        new transports.File({
          filename: `${configs["LOG_FILES_PATH"]}/combined.log`,
        }),
      ],
    });
    //
    // If we're not in production then log to the `console` with the format:
    // `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
    //
    if (configs["NODE_ENV"] !== "production") {
      __logger.add(
        new transports.Console({
          colorize: configs["NODE_ENV"] === "development",
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

module.exports = createMyLogger();
