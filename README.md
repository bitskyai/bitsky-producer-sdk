[BitSky Producer SDK](https://bitsky.ai)
===

```js
const baseservice = require('@bitskyai/producer-sdk');
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
$ npm install @bitskyai/producer-sdk
```

[bitsky-service-producer](https://github.com/bitskyai/bitsky-service-producer) is a good example

# Features
1. Implement RESTFul APIs to get and update intelligences to [BitSky](https://docs.bitsky.ai/overview#bitsky-supplier)
2. Default [Producer](https://docs.bitsky.ai/overview#producer) is **Service Producer**

# APIs
## `express`
Create an [ExpressJS](https://expressjs.com/) app, and configure routes, JSON limit, static folder.

```js
const baseservice = require("@bitskyai/producer-sdk");
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
Get or set producer type. Currently support type is `['HEADLESSBROSWER', 'SERVICE']`. Default is `SERVICE` type

```js
const baseservice = require("@bitskyai/producer-sdk");
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
const baseservice = require("@bitskyai/producer-sdk");
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
const baseservice = require('@bitskyai/producer-sdk');
baseservice.express();
baseservice.listen();
```
or
```js
const baseservice = require('@bitskyai/producer-sdk');
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
const baseservice = require('@bitskyai/producer-sdk');
const logger = baseservice.logger;
logger.info('Just for test');
```

### Returns
- `Object`: `winston` logger instance
