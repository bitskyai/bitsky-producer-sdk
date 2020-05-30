const express = require("express");
const _ = require("lodash");

function indexRouter(context, indexOptions) {
  function initRouter(context, indexOptions) {
    const router = express.Router();
    router.get("/", function (req, res, next) {
      let type = context.agent.type();
      let githubURL = "https://github.com/munew/dia";
      let screenshots = false;
      if (type === "SERVICE") {
        githubURL = "https://github.com/munew/dia-agents-service";
      } else if (type === "HEADLESSBROWSER") {
        githubURL = "https://github.com/munew/dia-agents-headless";
        screenshots = true;
      }

      // default index data
      let indexData = {
        type,
        githubURL,
        homeURL: "https://munew.io",
        docBaseURL: "https://docs.munew.io",
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
      };

      // custom index data
      console.log("------------>");
      console.log(indexOptions);
      let data = _.merge({}, indexData, indexOptions||{});

      res.render("index", data);
    });

    return router;
  }
  return initRouter(context, indexOptions);
}

module.exports = indexRouter;
