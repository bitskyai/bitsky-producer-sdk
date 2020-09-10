const express = require("express");
const _ = require("lodash");

function indexRouter(context, indexOptions) {
  function initRouter(context, indexOptions) {
    const router = express.Router();
    router.get("/", function (req, res, next) {
      let type = context.producer.type();
      let githubURL = "https://github.com/bitskyai";
      let screenshots = false;
      if (type === "SERVICE") {
        githubURL = "https://github.com/bitskyai/bitsky-service-producer";
      } else if (type === "HEADLESSBROWSER") {
        githubURL = "https://github.com/bitskyai/bitsky-headless-producer";
        screenshots = true;
      }
      const configs = context.baseservice.getConfigs() || {};
      let producerFieldData = context.producer.producerConfiguration();
      let getProducerFail = false;
      console.log("context.producer.producerError(): ", context.producer.producerError());

      if(!producerFieldData){
        producerFieldData = context.producer.producerError();
        if(producerFieldData&&producerFieldData.error){
          getProducerFail = true;
        }

        if(!producerFieldData){
          producerFieldData = "Try to get connected producer configuration, please wait a mins ...";
        }
      }

      // default index data
      let indexData = {
        type,
        githubURL,
        homeURL: "https://bitsky.ai",
        docBaseURL: "https://docs.bitsky.ai",
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
              "Error events of considerable importance that will prevent Producer execution",
          }
        ],
        configuration: JSON.stringify(configs, null, 2),
        producerFieldData: JSON.stringify(producerFieldData, null, 2),
        getProducerFail: getProducerFail
      };

      // custom index data
      let data = _.merge({}, indexData, indexOptions||{});
      // filter out invalid data
      let validItems = [];
      for(let i=0; i<data.items.length; i++){
        if(data.items[i]&&data.items[i].title){
          validItems.push(data.items[i]);
        }
      }
      data.items = validItems;
      res.render("index", data);
    });

    return router;
  }
  return initRouter(context, indexOptions);
}

module.exports = indexRouter;
