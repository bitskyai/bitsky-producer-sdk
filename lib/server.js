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
const expressApp = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

const logger = require('./utils/logger');
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

baseService.type = function(type){
  if(!type){
    return agentService.type(type);
  }

  agentService.type(type);
  return baseService;
}

baseService.worker = function(worker){
  if(!worker){
    return agentService.worker(worker);
  }

  agentService.worker(worker);
  return baseService;
}

baseService.getPublic = function(){
  return path.join(__dirname, "public");
}

baseService.express = function express() {
  try {
    if(this.app){
      return this.app;
    }
    this.app = expressApp();

    // view engine setup
    this.app.set("views", path.join(__dirname, "views"));
    this.app.set("view engine", "jade");

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

    // catch 404 and forward to error handler
    this.app.use(function (req, res, next) {
      next(createError(404));
    });

    // error handler
    this.app.use(function (err, req, res, next) {
      // set locals, only providing error in development
      res.locals.message = err.message;
      // res.locals.error = this.app.get("env") === "development" ? err : {};
      res.locals.error = err;

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
      const configs = getConfigs();
      if (!port) {
        port = configs["PORT"];
      }

      agentService.start();

      const server = this.app.listen(port, ()=> {
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
      reject (err);
    }
  });
};

baseService.logger = logger;
