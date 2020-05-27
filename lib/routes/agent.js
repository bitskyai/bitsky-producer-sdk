const express = require("express");

function agentRouter(agent){
  function initRouter(agent){
    const router = express.Router();

    router.get("/", function (req, res, next) {
      res.json(agent.agentConfiguration());
    });

    return router;
  }
  return initRouter(agent);
}

module.exports = agentRouter;
