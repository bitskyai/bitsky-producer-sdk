class Context{
  constructor(){
    this.initedTime = Date.now();
    this.agent= undefined;
    this.logger = console;
    this.baseservice = undefined;
  }
}

module.exports = Context;
