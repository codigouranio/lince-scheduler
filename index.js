const moment = require('moment');
const { AsyncLocalStorage } = require('async_hooks');
const winston = require('winston');
const { format, createLogger, transport } = require('winston');
const { v4: uuidv4 } = require('uuid');

/**
 * Scheduler to execute jobs.
 * @param {*} options
 */
const LinceScheduler = class LinceScheduler {
  constructor(options) {
    const defaults = {
      startIntervalMs: 1000,
      intervalMs: 1000,
      maxIntervalMs: 1000 * 60 * 60,
      maxRetries: 3,
      handler: new Handler(),
      parser: new Parser(),
      logger: new ConsoleLogger(),
    };

    options = Object.assign({}, defaults, options);

    this.handler = options.handler;
    this.parser = options.parser;
    this.logger = options.logger;

    this.intervalMs = options.intervalMs;
    this.maxIntervalMs = options.maxIntervalMs;
    this.maxRetries = options.maxRetries;

    this.stats = {
      totalPending: 0,
      totalExecuted: 0,
      totalErrors: 0,
    };

    this.localStorage = new AsyncLocalStorage();
  }

  /**
   * Execute a job.
   * @param {*} originalMessage
   * @returns
   */
  async execute(originalMessage) {
    const job = new Job({
      maxRetries: this.maxRetries,
      originalMessage,
      message: this.parser.parse(this, originalMessage),
    });
    job.setLocalStorage(this.localStorage);
    try {
      await this.scheduleNow(job);
    } catch (error) {
      this.logger.error(job, error);
    }
    return job;
  }

  /**
   * Schedule a job.
   * @param {*} job
   * @returns
   */
  async scheduleNow(job) {
    this.stats.totalPending++;
    return new Promise((resolve, reject) => {
      this.localStorage.run(job, () => this.schedule(job, resolve, reject));
    });
  }

  async schedule(job, resolve, reject) {
    setTimeout(
      () => this.handleJob(job, resolve, reject),
      this.calculateInterval(job)
    );
  }

  handleJob(job, resolve, reject) {
    try {
      job.increaseRetries();
      this.logger.info(job, `Handle job ${job.uuid}`);
      const result = this.handler.handle(job);
      job.setCompletedAsSuccess(result);
      this.stats.totalExecuted++;
      this.logger.info(job, 'Executed successfully');
      return resolve(job);
    } catch (error) {
      if (
        error instanceof FatalError ||
        job.getRetries() >= job.getMaxRetries()
      ) {
        job.setCompletedAsError(error);
      }

      if (job.status == 'error') {
        this.stats.totalExecuted++;
        this.stats.totalErrors++;
        // this.handleMaxRetriesExceeded.handle(job);
        return reject(error);
      }

      this.logger.error(job, error);
      job.setLastError(error);
      this.schedule(job, resolve, reject);
    }
  }

  /**
   * Calculate the interval for the next execution.
   * @param {*} job
   * @returns
   */
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
    return { message: 'not implemented' };
  }
}

class HandlerMaxRetriesExceeded {
  handle(job) {
    return { message: 'not implemented' };
  }
}

class HandlerFatalError {
  handle(job, error) {
    return { message: 'not implemented' };
  }
}

class Parser {
  constructor(options) {}

  parse(originalMessage) {
    return { message: 'not implemented' };
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
    this.status = 'pending';

    Object.defineProperty(this, 'lastError', {
      name: 'lastError',
      enumerable: false,
      writable: true,
    });

    Object.defineProperty(this, 'originalMessage', {
      name: 'originalMessage',
      enumerable: false,
    });

    Object.defineProperty(this, 'localStore', {
      name: 'localStore',
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
    this.status = 'error';
    this.setLastError(error);
  }

  setCompletedAsSuccess(result) {
    this.completedAt = moment();
    this.status = 'success';
  }

  getResult() {
    return this.result;
  }

  wasSuccessful() {
    return this.status == 'success';
  }

  wasError() {
    return this.status == 'error';
  }

  print() {
    console.table([
      {
        uuid: this.uuid,
        retries: this.retries,
        status: this.status,
      },
    ]);
  }
}

class FatalError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FatalError';
  }
}

const ConsoleLogger = class ConsoleLogger {
  constructor() {
    this.logger = createLogger({
      transports: [
        new winston.transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple(),
            format.timestamp(),
            format.ms()
          ),
        }),
      ],
    });
  }

  createMessageLog(job, message) {
    return {
      ...{
        uuid: job.uuid,
        retry: `${job.getRetries()}/${job.getMaxRetries()}`,
      },
      ...{ message },
    };
  }

  info(job, message) {
    const log = this.createMessageLog(job, message);
    this.logger.info(log);
  }

  error(job, error) {
    const log = this.createMessageLog(job, error?.message);
    this.logger.error(log);
  }
};

module.exports = {
  LinceScheduler,
  Job,
  ConsoleLogger,
  Handler,
};
