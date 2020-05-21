const express = require("express");
const router = express.Router();
const agent = require('../agent');

/* GET home page. */
router.get("/", function (req, res, next) {
  res.json(agent.agentConfiguration());
});

module.exports = router;
