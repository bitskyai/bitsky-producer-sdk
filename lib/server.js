/**
 * Created by Shaoke Xu on 5/5/18.
 */

// =================================================
// WARNING: This function must be called in the top
// =================================================
const { addNodeModuleFromConfigJSON } = require("./utils/nodeModules");
addNodeModuleFromConfigJSON();
const enableDestroy = require("server-destroy");
const expressApp = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const serveIndex = require("serve-index");

const { getConfigs } = require("./utils/config");
const logger = require('./utils/logger');
const indexRouter = require("./routes/index");
const healthRouter = require("./routes/health");
const agent = require("./routes/agent");
const agentService = require("./agent");

/**
 * Application prototype.
 */
const baseService = {};

baseService.type = function (type) {
  return agentService.type(type);
};

baseService.worker = function (worker) {
  return agentService.worker(worker);
};

baseService.getPublic = function () {
  return path.join(__dirname, "public");
};

baseService.express = function express() {
  try {
    if (this.app) {
      return this.app;
    }
    this.app = expressApp();
    // set the view engine to ejs
    this.app.set("views", path.join(__dirname, "views"));
    this.app.set("view engine", "ejs");

    this.app.use(morgan("dev"));
    this.app.use(
      expressApp.json({
        limit: "100mb",
      })
    );
    this.app.use(expressApp.urlencoded({ extended: false }));
    this.app.use(cookieParser());
    this.app.use(expressApp.static(this.getPublic()));

    this.app.use("/", indexRouter);
    this.app.use("/health", healthRouter);
    this.app.use("/agent", agent);

    this.app.use(function (req, res, next) {
      const index = serveIndex(path.join(__dirname, "public"), { icons: true });
      index(req, res, next);
    });

    return this.app;
  } catch (err) {
    throw err;
  }
};

baseService.listen = async function listen(port) {
  return await new Promise((resolve, reject) => {
    try {
      const configs = getConfigs();
      if (!port) {
        port = configs["PORT"];
      }

      agentService.start();

      const server = this.app.listen(port, () => {
        console.info(
          "Agent server listening on http://localhost:%d/ in %s mode",
          port,
          this.app.get("env")
        );
        resolve(true);
      });

      enableDestroy(server);

      // Handle signals gracefully. Heroku will send SIGTERM before idle.
      process.on("SIGTERM", () => {
        console.info(`SIGTERM received`);
        console.info("Closing http.Server ..");
        server.destroy();
      });
      process.on("SIGINT", () => {
        console.info(`SIGINT(Ctrl-C) received`);
        console.info("Closing http.Server ..");
        server.destroy();
      });

      server.on("close", () => {
        console.info("Server closed");
        // process.emit("cleanup");

        console.info("Giving 100ms time to cleanup..");
        // Give a small time frame to clean up
        setTimeout(process.exit, 100);
      });
    } catch (err) {
      reject(err);
    }
  });
};


baseService.logger = logger;

module.exports = baseService;
