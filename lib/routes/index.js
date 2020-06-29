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
      const configs = context.baseservice.getConfigs() || {};
      let agentFieldData = context.agent.agentConfiguration();
      let getAgentFail = false;
      console.log("context.agent.agentError(): ", context.agent.agentError());

      if(!agentFieldData){
        agentFieldData = context.agent.agentError();
        if(agentFieldData&&agentFieldData.error){
          getAgentFail = true;
        }

        if(!agentFieldData){
          agentFieldData = "Try to get connected agent configuration, please wait a mins ...";
        }
      }

      // default index data
      let indexData = {
        type,
        githubURL,
        homeURL: "https://munew.io",
        docBaseURL: "https://docs.munew.io",
        items: [
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
          }
        ],
        configuration: JSON.stringify(configs, null, 2),
        agentFieldData: JSON.stringify(agentFieldData, null, 2),
        getAgentFail: getAgentFail
      };

      // custom index data
      let data = _.merge({}, indexData, indexOptions||{});

      res.render("index", data);
    });

    return router;
  }
  return initRouter(context, indexOptions);
}

module.exports = indexRouter;
