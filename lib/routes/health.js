const express = require("express");

function producerRouter(context) {
  function initRouter(context) {
    const router = express.Router();

    router.get("/", function (req, res, next) {
      res.json({
        status: 200,
      });
    });

    return router;
  }
  return initRouter(context);
}

module.exports = producerRouter;
