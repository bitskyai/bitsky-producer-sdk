/**
 * Created by Shaoke Xu on 5/5/18.
 */

// =================================================
// WARNING: This function must be called in the top
// =================================================
const { addNodeModuleFromConfigJSON } = require("./utils/nodeModules");
addNodeModuleFromConfigJSON();
const enableDestroy = require("server-destroy");
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");

const { getConfigs } = require("./utils/config");
const indexRouter = require("./routes/index");
const healthRouter = require("./routes/health");
const agent = require("./routes/agent");
// const { type, worker, start } = require("./agent");
const agentService = require('./agent');

/**
 * Application prototype.
 */
let baseService = (exports = module.exports = {});

baseService.type = agentService.type;
baseService.worker = agentService.worker;

baseService.init = function init() {
  try {
    if(this.app){
      return;
    }
    this.app = express();

    // view engine setup
    this.app.set("views", path.join(__dirname, "views"));
    this.app.set("view engine", "jade");

    this.app.use(logger("dev"));
    this.app.use(
      express.json({
        limit: "100mb",
      })
    );
    this.app.use(express.urlencoded({ extended: false }));
    this.app.use(cookieParser());
    this.app.use(express.static(path.join(__dirname, "public")));

    this.app.use("/", indexRouter);
    this.app.use("/health", healthRouter);
    this.app.use("/agent", agent);

    // catch 404 and forward to error handler
    this.app.use(function (req, res, next) {
      next(createError(404));
    });

    // error handler
    this.app.use(function (err, req, res, next) {
      // set locals, only providing error in development
      res.locals.message = err.message;
      res.locals.error = req.app.get("env") === "development" ? err : {};

      // render the error page
      res.status(err.status || 500);
      res.render("error");
    });

    return this.app;
  } catch (err) {
    throw err;
  }
};

baseService.listen = async function listen(port) {
  return await new Promise((resolve, reject) => {
    try {
      this.init();
      const configs = getConfigs();
      const app = this.app;
      if (!port) {
        port = configs["PORT"];
      }

      agentService.start();

      const server = app.listen(port, function () {
        console.info(
          "Agent server listening on http://localhost:%d/ in %s mode",
          port,
          app.get("env")
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
      reject (err);
    }
  });
};
