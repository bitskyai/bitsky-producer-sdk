const puppeteer = require("puppeteer");
const _ = require("lodash");
const { setIntelligencesToFail } = require("../utils");
const logger = require("../utils/logger");
const constants = require("../utils/constants");
const { runtime, getConfigs } = require("../utils/config");

async function headlessCrawler(intelligences) {
  try {
    const configs = getConfigs();
    if (!runtime.browser) {
      const params = {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        headless: configs["HEADLESS"],
        defaultViewport: null,
      };
      runtime.browser = await puppeteer.launch(params);
    }
    let pages = await runtime.browser.pages();
    const promises = [];
    for (let i = 0; i < intelligences.length; i++) {
      let intelligence = intelligences[i];
      let page = pages[i];
      promises.push(
        (function (page, intelligence) {
          return new Promise(async (resolve, reject) => {
            try {
              if (!page) {
                page = await runtime.browser.newPage();
              }
              await page.goto(intelligence.url);
              let functionBody = "";
              // Check whether this intelligence need to execute custom script
              if (
                intelligence &&
                intelligence.metadata &&
                intelligence.metadata.script
              ) {
                functionBody = intelligence.metadata.script;
              }
              if (functionBody) {
                // if it has custom function, then in custom function will return collected intelligence
                let dataset = await customFun(page, functionBody, intelligence);
                if (dataset instanceof Error) {
                  setIntelligencesToFail(intelligence, err);
                } else {
                  // also update intelligence state
                  intelligence.system.state = "FINISHED";
                  intelligence.system.agent.endedAt = Date.now();
                  intelligence.dataset = dataset;
                }
              } else {
                // otherwise default collect currently page
                const content = await page.$eval("html", (elem) => {
                  return elem && elem.innerHTML;
                });
                intelligence.dataset = {
                  url: page.url(),
                  data: {
                    contentType: "html",
                    content: content,
                  },
                };
                intelligence.system.state = "FINISHED";
                intelligence.system.agent.endedAt = Date.now();
              }
              runtime.runningJob.collectedIntelligencesDict[
                intelligence.globalId
              ] = intelligence;
              runtime.runningJob.collectedIntelligencesNumber++;
              resolve(intelligence);
            } catch (err) {
              logger.error(
                `collect intelligence fail. globalId: ${intelligence.globalId}. Error: ${err.message}`,
                { jobId: _.get(runtime, "runningJob.jobId") }
              );
              setIntelligencesToFail(intelligence, err);
              runtime.runningJob.collectedIntelligencesDict[
                intelligence.globalId
              ] = intelligence;
              runtime.runningJob.collectedIntelligencesNumber++;
              reject(err);
            }
          });
        })(page, intelligence)
      );
    }

    return promises;
  } catch (err) {
    logger.error(`headlessCrawler fail, error: ${err.message}`, {
      jobId: _.get(runtime, "runningJob.jobId"),
    });
    return [];
  }
}

/**
 * Custom function that created by SOI.
 *
 * TODO: Need to improve security
 * @param {string} functionBody - function body
 * @param {object} intelligence - intelligence object
 *
 * @return {object|Error} - return collected intelligences or error
 */
async function customFun(page, functionBody, intelligence) {
  try {
    const dataset = await page.evaluate(
      function (intelligence, functionBody, TIMEOUT) {
        return new Promise((resolve, reject) => {
          try {
            // if passed functionBody contains function () {  }, remove it.
            let match = functionBody
              .toString()
              .match(/function[^{]+\{([\s\S]*)\}$/);
            if (match) {
              functionBody = match[1];
            }
            let fun = new Function(
              "resolve",
              "reject",
              "intelligence",
              functionBody
            );

            // TODO: Need to think about how to avoid custom script run too long
            // https://github.com/munew/dia-agents-browserextensions/issues/16
            fun(resolve, reject, intelligence);
            setTimeout(() => {
              reject(new Error("customFun evaluate timeout"));
            }, TIMEOUT);
          } catch (err) {
            reject(err);
          }
        });
      },
      intelligence,
      functionBody,
      constants.CUSTOM_FUNCTION_TIMEOUT
    );
    if (dataset instanceof Error) {
      throw dataset;
    }
    return dataset;
  } catch (err) {
    // logger.info(
    //   `customFun fail. intelligence globalId: ${intelligence.globalId}. Error: ${err.message}`
    // );
    throw err;
  }
}

module.exports = {
  headlessCrawler,
};
