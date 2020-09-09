class Context{
  constructor(){
    this.initedTime = Date.now();
    this.producer= undefined;
    this.logger = console;
    this.baseservice = undefined;
  }
}

module.exports = Context;
