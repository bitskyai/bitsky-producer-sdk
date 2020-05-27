const express = require("express");

function agentRouter(agent) {
  function initRouter(agent) {
    const router = express.Router();

    router.get("/", function (req, res, next) {
      res.json({
        status: 200,
      });
    });

    return router;
  }
  return initRouter(agent);
}

module.exports = agentRouter;
