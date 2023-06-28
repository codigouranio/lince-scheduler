const moment = require("moment");
const { AsyncLocalStorage } = require("async_hooks");
const winston = require("winston");
const { format, createLogger, transport } = require("winston");
const { v4: uuidv4 } = require("uuid");

const LinceScheduler = class LinceScheduler {
  constructor(options) {
    const defaults = {
      startIntervalMs: 1000,
      intervalMs: 1000,
      maxIntervalMs: 1000 * 60 * 60,
      maxRetries: 3,
      handler: new Handler(),
      parser: new Parser(),
      logger: new Logger(),
    };

    options = Object.assign({}, defaults, options);

    this.handler = options.handler;
    this.parser = options.parser;
    this.logger = options.logger;

    this.intervalMs = options.intervalMs;
    this.maxIntervalMs = options.maxIntervalMs;
    this.maxRetries = options.maxRetries;

    this.localStorage = new AsyncLocalStorage();
  }

  async execute(message) {
    const job = this.parser.parse(this, message);
    job.setLocalStorage(this.localStorage);
    await this.scheduleNow(job);
    return job;
  }

  async scheduleNow(job) {
    return new Promise((resolve, reject) => {
      this.localStorage.run(job, () => this.schedule(job, resolve, reject));
    });
  }

  async schedule(job, resolve, reject) {
    setTimeout(
      () => this.handleJob(job, resolve, reject),
      this.calculateInterval(job)
    )
  }

  handleJob(job, resolve, reject) {
    try {
      job.increaseRetries();
      console.log(`HANDLE JOB ${job.getRetries()}/${job.getMaxRetries()}`);
      const result = this.handler.handle(job);
      job.setCompletedAsSuccess(result);
      return resolve(job);
    } catch (error) {
      this.logger.error(error);

      if (error instanceof FatalError) {
        job.setCompletedAsError(error);
        // this.handleFatalError(job, error);
        return job.retries == 1 ? reject(error) : resolve(job);
      }

      if (job.getRetries() >= job.getMaxRetries()) {
        job.setCompletedAsError(error);
        // this.handleMaxRetriesExceeded.handle(job);
        return job.retries == 1 ? reject(error) : resolve(job);
      }

      job.setLastError(error);
      this.schedule(job, resolve, reject);
    }
  }

  calculateInterval(job) {
    const interval = this.intervalMs * Math.pow(2, job.retries);
    return Math.min(interval, this.maxIntervalMs);
  }

  handleFatalError(job, error) {
    this.handler.handleFatalError(job, error);
  }

  getLocalStorage() {
    return this.localStorage;
  }

  getMaxRetries() {
    return this.maxRetries;
  }
};

class Handler {
  constructor(options) {}

  handle(job) {
    return { message: "not implemented" };
  }
}

class HandlerMaxRetriesExceeded {
  handle(job) {
    return { message: "not implemented" };
  }
}

class HandlerFatalError {
  handle(job, error) {
    return { message: "not implemented" };
  }
}

class Parser {
  constructor(options) {}

  parse(scheduler, message) {
    return new Job({
      originalMessage: message,
      maxRetries: scheduler.getMaxRetries(),
    });
  }
}

class Job {
  constructor(options) {
    this.uuid = uuidv4();
    this.startedAt = moment();
    this.completedAt = null;
    this.originalMessage = options.originalMessage;
    this.retries = options.retries || 0;
    this.maxRetries = options.maxRetries || 10;
    this.lastError = null;
    this.result = null;
    this.status = "pending";

    Object.defineProperty(this, "lastError", {
      name: "lastError",
      enumerable: false,
      writable: true,
    });

    Object.defineProperty(this, "originalMessage", {
      name: "originalMessage",
      enumerable: false,
    });

    Object.defineProperty(this, "localStore", {
      name: "localStore",
      enumerable: false,
    });

    this.lastError = null;
  }

  getOriginalMessage() {
    return this.originalMessage;
  }

  increaseRetries() {
    this.retries++;
  }

  getRetries() {
    return this.retries;
  }

  getMaxRetries() {
    return this.maxRetries;
  }

  setLocalStorage(localStorage) {
    this.localStorage = localStorage;
  }

  getLocalStorage() {
    return this.localStorage;
  }

  setLastError(error) {
    this.lastError = error;
  }

  getLastError() {
    return this.lastError;
  }

  setCompletedAsError(error) {
    this.completedAt = moment();
    this.lastError = error;
    this.status = "error";
  }

  setCompletedAsSuccess(result) {
    this.completedAt = moment();
    this.status = "success";
  }

  getResult() {
    return this.result;
  }

  print() {
    console.table([{
      uuid: this.uuid, 
      retries: this.retries,
      status: this.status,
    }]);
  }
}

class FatalError extends Error {
  constructor(message) {
    super(message);
    this.name = "FatalError";
  }
}

const Logger = class Logger {
  constructor() {
    this.logger = createLogger({
      format: format.combine(
        format.timestamp(),
        format.json(),
        format.colorize()
      ),
      transports: [new winston.transports.Console()],
    });
  }

  createMessageLog(job, message) {
    return {
      ...{
        uuid: job.uuid,
      },
      ...{ message },
    };
  }

  info(job, message) {
    const log = this.createMessageLog(job, message);
    this.logger.info(log);
  }

  error(job, message) {
    const log = this.createMessageLog(job, message);
    this.logger.error(log);
  }
};

module.exports = {
  LinceScheduler,
  Job,
  Logger,
  Handler,
};
