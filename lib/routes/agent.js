const express = require("express");

function agentRouter(context){
  function initRouter(context){
    const router = express.Router();

    router.get("/", function (req, res, next) {
      res.json(context.agent.agentConfiguration());
    });

    return router;
  }
  return initRouter(context);
}

module.exports = agentRouter;
