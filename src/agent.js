const { getAgentAPI } = require('./apis/agents');
const getConfig = require('./utils/config');
async function agent(){
  const config = getConfig();
  const agentConfig = await getAgentAPI(config.MUNEW_BASE_URL, config.GLOBAL_ID);
  console.log("Agent: ", agentConfig);
}

module.exports = agent;