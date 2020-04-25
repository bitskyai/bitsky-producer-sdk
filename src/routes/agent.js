const express = require("express");
const router = express.Router();
const { runtime } = require("../utils/config");

/* GET home page. */
router.get("/", function (req, res, next) {
  res.json(runtime.currentAgentConfig);
});

module.exports = router;
