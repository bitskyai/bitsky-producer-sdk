const http = require("../utils/http");
const _ = require("lodash");

/**
 * Filter out unnecessary data
 * @param {Array} data - tasks sent to Retailer
 */
function filterTasksSendToRetailer(data) {
  // Tasks after filter
  let filterTasks = [];
  let length = data && data.length;
  for (let i = 0; i < length; i++) {
    if (_.toUpper(_.get(data[i], "system.state")) == _.toUpper("FAILED")) {
      // Don't send FAILED tasks to Retailer
      continue;
    }
    let task = _.cloneDeep(data[i]);
    if (task && task.system) {
      delete task.system;
    }
    if (task && task.retailer) {
      let retailer = {};
      retailer.name = task.retailer.name;
      retailer.baseURL = task.retailer.baseURL;
      retailer.globalId = task.retailer.globalId;
      task.retailer = retailer;
    }

    filterTasks.push(task);
  }

  return filterTasks;
}

async function sendTasksToRetailer(
  baseURL,
  method,
  url,
  headers,
  data,
  context
) {
  try {
    data = filterTasksSendToRetailer(data);
    if (data.length) {
      let result = await http(
        {
          baseURL,
          method,
          url,
          headers,
          data: filterTasksSendToRetailer(data),
        },
        context
      );
      return result.data;
    } else {
      return data;
    }
  } catch (err) {
    throw err;
  }
}

module.exports = {
  sendTasksToRetailer,
};
