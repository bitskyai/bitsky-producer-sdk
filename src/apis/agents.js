const http = require('../utils/http');
const constants = require('../utils/constants');

async function getAgentAPI(baseURL, gid, securityKey) {
  try {
    let headers = {};
    let url = new URL(`/apis/agents/${gid}`, baseURL).toString();
    if(securityKey){
      headers[constants.X_SECURITY_KEY_HEADER] = securityKey;
    }
    let result = await http({
      url,
      method: 'GET',
      headers
    });
    return result.data;
  } catch (err) {
    throw err;
  }
}

async function updateAgentAPI(baseURL, agent) {
  try {
    let url = new URL(`/apis/agents/${agent.globalId}`, baseURL).toString();
    let result = await http({
      url,
      method: 'PUT',
      data: agent
    });
    return result.data;
  } catch (err) {
    throw err;
  }
}

module.exports = {
  getAgentAPI,
  updateAgentAPI
}