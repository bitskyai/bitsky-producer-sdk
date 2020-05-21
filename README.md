[BitSpider Agent BaseService](https://munew.io)
===

```js
const baseservice = require('bitspider-agent-baseservice');
baseservice.express();
baseservice.listen();
```

# Installation
This is a [Node.js](https://nodejs.org/en/) module available through the [npm registry](https://www.npmjs.com/).

Before installing, [download and install Node.js](https://nodejs.org/en/download/).
> Node.js 12 or higher is required.

If this is a brand new project, make sure to create a `package.json` first with
the [`npm init` command](https://docs.npmjs.com/creating-a-package-json-file).

Installation is done using the
[`npm install` command](https://docs.npmjs.com/getting-started/installing-npm-packages-locally):

```bash
$ npm install bitspider-agent-baseservice
```

[dia-agents-service](https://github.com/munew/dia-agents-service) is a good example

# Features
1. Implement RESTFul APIs to get and update intelligences to [Munew Engine](https://docs.munew.io/overview#munew-engine)
2. Default [Agent](https://docs.munew.io/overview#agent) is Service Agent

# APIs
## `express`
Create an [ExpressJS](https://expressjs.com/) app, and configure routes, JSON limit, static folder.

```js
const baseservice = require("bitspider-agent-baseservice");
baseservice.express();
```

#### Routes
1. `/`: return index page
2. `/health`: return health status of this server
3. `/agent`: return current agent configuration. If agent don't exist then return empty
4. `/log/combined.log`: All logs for debug purpose
5. `/log/error.log`: Error logs

#### JSON Limit
`100mb`

### Returns
- `Object`: [An Express Application Instance](https://expressjs.com/en/4x/api.html#express). You can use express API to add additional configuration

## `type`
Get or set agent type. Currently support type is `['BROWSEREXTENSION', 'HEADLESSBROSWER', 'SERVICE']`. Default is `SERVICE` type

```js
const baseservice = require("bitspider-agent-baseservice");
baseservice.express();
baseservice.type("HEADLESSBROWSER");
```

### Parameters
- `type:String`
  - Optional

### Returns
- `String|Object`: Type string or BaseService

## `worker`
Get or set worker. Worker responses for collect intelligences. Default it uses `service` worker.

```js
const { headlessWorker } = require("./workers/headlessWorker");
const baseservice = require("bitspider-agent-baseservice");
baseservice.express();
baseservice.type("HEADLESSBROWSER");
baseservice.worker(headlessWorker);
```

### Parameters
- `worker: Object`: worker object
  - Optional

### Returns
- `Object`: Woker object or BaseService

## `getPublic`
Return absolute path to `public` folder, anything you store in `public` folder, you can access by `/<path_to_file>`. 

### Returns
- `String`: Absolute path to `public` folder

## `listen`
Start server, similar with `express.listen`

```js
const baseservice = require('dia-agents-baseservice');
baseservice.express();
baseservice.listen();
```
or
```js
const baseservice = require('dia-agents-baseservice');
baseservice.express();
baseservice.listen(9090);
```

### Parameters
- `port: Number`: Default will get from `process.env.PORT`, otherwise `8090`
  - Optional

### Returns
- `Promise`: Start successful, then `resolve(true)`, otherwise `reject(err)`

## `logger`
Return [winston](https://github.com/winstonjs/winston) logger, you can use this to add your logs, and view by `/log/combined.log` or `/log/error.log`

```js
const baseservice = require('dia-agents-baseservice');
const logger = baseservice.logger;
logger.info('Just for test');
```

### Returns
- `Object`: `winston` logger instance
