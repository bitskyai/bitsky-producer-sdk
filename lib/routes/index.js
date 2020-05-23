const express = require("express");
const router = express.Router();
const agent = require("../agent");

/* GET home page. */
router.get("/", function (req, res, next) {
  let type = agent.type();
  let githubURL = "https://github.com/munew/dia";
  let screenshots = false;
  if (type === "SERVICE") {
    githubURL = "https://github.com/munew/dia-agents-service";
  } else if (type === "HEADLESSBROWSER") {
    githubURL = "https://github.com/munew/dia-agents-headless";
    screenshots = true;
  }
  res.render("index", {
    type: type,
    githubURL: githubURL,
    homeURL: "https://munew.io",
    docBaseURL: "https://docs.munew.io",
    screenshots: screenshots,
  });
});

module.exports = router;
