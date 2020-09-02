/**
 * Created by Shaoke Xu on 5/5/18.
 */

// =================================================
// WARNING: This function must be called in the top
// =================================================
const { addNodeModuleFromConfigJSON } = require("./utils/nodeModules");
addNodeModuleFromConfigJSON();
const fs = require("fs-extra");
const _ = require("lodash");
const enableDestroy = require("server-destroy");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const serveIndex = require("serve-index");
const cors = require("cors");

const Context = require("./utils/context");
const createMyLogger = require("./utils/logger");
const indexRouter = require("./routes/index");
const healthRouter = require("./routes/health");
const agentRouter = require("./routes/agent");
const Agent = require("./agent");
const constants = require("./utils/constants");

const DEFAULT_CONFIGS = {
  PORT: 8090,
  SERVICE_NAME: constants.SERVICE_NAME,
  NODE_ENV: constants.NODE_ENV,
  LOG_FILES_PATH: constants.LOG_FILES_PATH,
  ERROR_LOG_FILE_NAME: constants.ERROR_LOG_FILE_NAME,
  COMBINED_LOG_FILE_NAME: constants.COMBINED_LOG_FILE_NAME,
  LOG_LEVEL: constants.LOG_LEVEL,
};

// whether exist process
let processExit = false;

class BaseService {
  constructor(configs) {
    // Initial
    this.server = null;
    this.app = null;
    this.context = null;
    this.__publicFolders = [];
    this.__manuallySetConfigs = {};
    // initial context for this service
    this.context = new Context();
    this.context.baseservice = this;

    if (configs) {
      this.setConfigs(configs);
    }
    configs = this.getConfigs();
    this.context.logger = createMyLogger(
      configs.LOG_LEVEL,
      configs.LOG_FILES_PATH,
      configs.ERROR_LOG_FILE_NAME,
      configs.COMBINED_LOG_FILE_NAME,
      configs.SERVICE_NAME,
      configs.NODE_ENV
    );

    if (!this.context.agent) {
      this.context.agent = new Agent(this.context, configs);
    }
  }

  getConfigs() {
    // get configs from env
    let configs = {
      PORT: process.env.PORT&&Number(process.env.PORT),   // Only when PORT is existing
      SERVICE_NAME: process.env.SERVICE_NAME,
      NODE_ENV: process.env.NODE_ENV,
      LOG_FILES_PATH: process.env.LOG_FILES_PATH,
      LOG_LEVEL: process.env.LOG_LEVEL,
    };

    let agentConfigs = {};
    if (this.context.agent) {
      agentConfigs = this.context.agent.getConfigs();
    }
    // 1. manually set configs' priority is high than env variables
    // 2. get latest env variables
    configs = _.merge(
      {},
      DEFAULT_CONFIGS,
      configs,
      this.__manuallySetConfigs,
      agentConfigs
    );

    return configs;
  }

  setConfigs(configs) {
    if (configs instanceof Object) {
      this.__manuallySetConfigs = configs;
      if (this.context.agent) {
        this.context.agent.setConfigs(configs);
      }
    }
  }

  type(type) {
    return this.context.agent.type(type);
  }

  worker(worker) {
    return this.context.agent.worker(worker);
  }

  getDefaultPublic() {
    return path.join(__dirname, "public");
  }

  /**
   *
   * @param {object} [options]
   * @param {string} options.limit - Default "100mb". Controls the maximum request body size. If this is a number, then the value specifies the number of bytes; if it is a string, the value is passed to the bytes library for parsing.
   * @param {string|array} options.views - A directory or an array of directories for the application's views. If an array, the views are looked up in the order they occur in the array.
   * @param {string|array} options.static - A directory or an array of directories for the static files. Express looks up the files in the order in which you set the static directories.
   */
  express(options) {
    try {
      // if (this.app) {
      //   return this.app;
      // }

      this.app = express();
      this.app.use(cors());
      // if options isn't passed, set as empty object
      if (!options) {
        options = {};
      }
      // default view
      let views = [path.join(__dirname, "views")];
      if (options.views) {
        if (options.views instanceof Array) {
          views = options.views.concat(views);
        } else if (options.views instanceof String) {
          views = [options.views].concat(views);
        }
      }
      // set the view engine to ejs
      this.app.set("views", views);
      this.app.set("view engine", "ejs");

      this.app.use(morgan("dev"));
      this.app.use(
        express.json({
          limit: options.limit || "100mb",
        })
      );
      this.app.use(express.urlencoded({ extended: false }));
      this.app.use(cookieParser());

      // set static folder
      let staticFolders = [this.getDefaultPublic()];
      if (options.static) {
        if (options.static instanceof Array) {
          staticFolders = options.static.concat(staticFolders);
        } else if (typeof options.static == "string") {
          staticFolders = [options.static].concat(staticFolders);
        }
      }

      this.__publicFolders = staticFolders;
      console.log("staticfolders: ", staticFolders);

      staticFolders.forEach((folder) => {
        this.app.use(express.static(folder));
      });

      return this;
    } catch (err) {
      throw err;
    }
  }

  /**
   *
   * @param {object} [indexOptions]
   * @param {object} indexOptions.data - Data you want to overwrite default index data
   * Default Data:
   *  {
        type,
        githubURL: "https://github.com/bitskyai/bitsky-service-producer", // or "https://github.com/bitskyai/bitsky-headless-producer", depend on your agent type
        homeURL: "https://bitsky.ai",
        docBaseURL: "https://docs.bitsky.ai",
        home: "",
        items: [
          {
            url: "/agent",
            title: "Agent",
            description: "Currently Agent Configuration",
          },
          {
            url: "/log/combined.log",
            title: "Information Logs",
            description: "Informational messages that can help you to debug",
          },
          {
            url: "/log/error.log",
            title: "Error Log",
            description:
              "Error events of considerable importance that will prevent Agent execution",
          },
        ],
      }
   */
  routers(indexOptions) {
    try {
      this.app.use("/", indexRouter(this.context, indexOptions));
      this.app.use("/health", healthRouter(this.context));
      this.app.use("/agent", agentRouter(this.context));
      this.app.use((req, res, next) => {
        let folder = path.join(__dirname, "public");
        if (indexOptions.home) {
          folder = indexOptions.home;
        }
        serveIndex(folder, {
          icons: true,
        })(req, res, next);
      });

      return this;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Start http server and listen to port, also agent start to watch intelligences
   * @param {number} [port] - port number
   */
  async listen(port) {
    return await new Promise((resolve, reject) => {
      try {
        const configs = this.getConfigs();
        if (!port) {
          port = configs["PORT"];
        }

        this.context.agent.start();

        this.server = this.app.listen(port, () => {
          console.info(
            "Agent server listening on http://localhost:%d/ in %s mode",
            port,
            this.app.get("env")
          );
          resolve(this.server);
        });

        enableDestroy(this.server);

        // Handle signals gracefully. Heroku will send SIGTERM before idle.
        process.on("SIGTERM", () => {
          // maybe server was already destory, so need to make sure server still exist
          if (this.server) {
            const type = this.type ? this.type() : "Unknown";
            console.info(`SIGTERM received. Closing Server - {{ ${type} }}" ..`);
            processExit = true;
            this.server.destroy();
          }
        });
        process.on("SIGINT", () => {
          if (this.server) {
            const type = this.type ? this.type() : "Unknown";
            console.info(`SIGINT(Ctrl-C) received. Closing Server - {{ ${type} }} ..`);
            processExit = true;
            this.server.destroy();
          }
        });

        this.server.on("close", () => {
          const type = this.type ? this.type() : "Unknown";
          console.info(
            `Close server - {{ ${type} }}, Giving 100ms time to cleanup..`
          );
          // Give a small time frame to clean up
          if (processExit) {
            setTimeout(process.exit, 100);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Destory this agent
   */
  async stop() {
    try {
      // stop agent
      if (this.context.agent) {
        await this.context.agent.stop();
      }
      await new Promise((resolve) => {
        this.server.destroy(() => {
          resolve(true);
        });
      });

      // to release all memory
      this.server = undefined;
      this.app = undefined;
      if(this.context){
        this.context.agent = undefined;
        this.context.logger = undefined;
      }
      this.context = undefined;
    } catch (err) {
      console.error("Stop base server fail", err);
    }
  }
}

module.exports = BaseService;
