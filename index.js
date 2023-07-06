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
   * Schedule a message fetcher with a cron expression.
   * @param {*} cronExpression 
   * @param {*} messageFetcher 
   * @returns 
   */
  schedule(options) {
    const task = new ScheduleTask(options);
    task.start(() => {
      console.log(`test ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
    });
    return task;
    // return new Promise((resolve, reject) => {
    //   const defaults = {
    //     cronExpression: '* * * * *',
    //     messageFetcher: new MessageFetcher(),
    //     maxLoops: -1
    //   }
    //   options = Object.assign({}, defaults, options);
    //   const cronTask = new CronTask(options.cronExpression);

    // });
  }

  // async scheduleCronTask(options, resolve, reject) {
  //   setTimeout(async () => {
  //     try {
  //       const messages = await options.messageFetcher.fetchMessages();
  //       if (Array.isArray(messages)) {
  //         this.logger.info({}, `Found ${messages.length} messages`);
  //         await Promise.allSettled(messages.map((message) => this.execute(message)));
  //       }
  //     } catch (error) {
  //       this.logger.error({}, error);
  //       return reject(error);
  //     }
  //     return resolve();
  //   }, cronTask.calculateInterval());
  // }

  /**
   * Execute a job.
   * @param {*} originalMessage
   * @returns
   */
  async execute(originalMessage) {
    const job = new Job({
      maxRetries: this.maxRetries,
      originalMessage,
    });
    try {
      this.logger.info(job, 'Parsing message');
      job.setMessage(this.parser.parse(this, originalMessage));
    } catch (error) {
      job.setCompletedAsError(new ParsingError(error.message));
      this.logger.error(job, error);
      return job;
    }
    job.setLocalStorage(this.localStorage);
    try {
      await this.retryPromise(job, this.calculateInterval(job));
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
  async retryPromise(job, interval) {
    this.stats.totalPending++;
    return new Promise((resolve, reject) => {
      this.localStorage.run(job, () =>
        this.retry(job, interval, resolve, reject)
      );
    });
  }

  retry(job, interval, resolve, reject) {
    setTimeout(() => this.handleJob(job, resolve, reject), interval);
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
        return reject(error);
      }

      this.logger.error(job, error);
      job.setLastError(error);
      this.retry(job, this.calculateInterval(job), resolve, reject);
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

class ScheduleTask {
  constructor(options) {
    const defaults = {
      promise: new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      }),
      maxLoops: 3,
      stopped: false, 
      cronTask: new CronTask(options.cronExpression),
    };

    options = Object.assign({}, defaults, options);

    this.promise = options.promise;
    this.maxLoops = options.maxLoops;
    this.cronTask = options.cronTask;
    this.started = false;
    this.stopped = false;
  }

  /**
   * Start the task.
   * @param {*} funcTask 
   */
  start(funcTask) {
    this.timeoutId = setTimeout(() => {
      funcTask();
      if (this.maxLoops > 0) {
        this.maxLoops--;
        this.start(funcTask);
      }
      if (this.maxLoops == 0) {
        this.stop();
      }
    }, this.cronTask.calculateInterval());
  }

  stop() {
    clearTimeout(this.timeoutId);
    this.resolve();
  }

  setInterval(interval) {
    this.interval = interval;
  }

  setResolve(resolve) {
    this.resolve = resolve;
  }

  getResolve() {
    return this.resolve;
  }

  setReject(reject) {
    this.reject = reject;
  }

  getReject(reject) {
    return this.reject;
  }

  getMaxLoops() {
    return this.maxLoops;
  }

  setIntervalId(intervalId) {
    this.intervalId = intervalId;
  }

  getIntervalId() {
    return this.intervalId;
  }

  getPromise() {
    return this.promise;
  }
}

class Handler {
  constructor(options) {}

  handle(job) {
    return { message: 'not implemented' };
  }
}

class MessageFetcher {
  constructor(options) {}

  async fetchMessages(options) {
    console.log('fetchMessages');
    return [{}, {}];
  }
}

class CronTask {
  constructor(cronExpression) {
    this.cronExpression = cronExpression;

    Object.defineProperty(this, 'cronExpression', {
      name: 'cronExpression',
      enumerable: false,
    });
  }

  calculateInterval() {
    const cronParts = this.cronExpression.split(' ');
    const [minute, hour, dayOfMonth, month, dayOfWeek] = cronParts;
    const now = moment();
    let nextExecution = now.clone();

    if (minute.startsWith('*/')) {
      const seconds = this.getSecondsfromCronExpression(minute);
      nextExecution = nextExecution.add(seconds, 'second');
    }
    if (minute !== '*') {
      nextExecution.set('minute', minute);
      if (now.minute() > nextExecution.minute()) {
        nextExecution = nextExecution.add(1, 'hour');
      }
    }
    if (hour !== '*') {
      nextExecution.set('hour', hour);
      if (now.hour() > nextExecution.hour()) {
        nextExecution = nextExecution.add(1, 'day');
      }
    }
    if (dayOfMonth !== '*') {
      nextExecution.set('date', dayOfMonth);
      if (now.date() > dayOfMonth) {
        nextExecution = nextExecution.add(1, 'month');
      }
    }
    if (month !== '*') {
      nextExecution.set('month', month - 1);
      if (now.month() > month - 1) {
        nextExecution = nextExecution.add(1, 'year');
      }
    }
    if (dayOfWeek !== '*') {
      nextExecution.set('day', dayOfWeek);
      if (now.day() < dayOfWeek) {
        nextExecution = nextExecution.add(1, 'week');
      }
    }
    var duration = moment.duration(nextExecution.diff(now));
    return duration.asMilliseconds();
  }

  getSecondsfromCronExpression(expression) {
    const regex = /\/(\d+)/g;
    const matches = [];
    let match;
    while ((match = regex.exec(expression)) !== null) {
      const number = parseInt(match[1]);
      matches.push(number);
    }
    if (matches.length > 0) {
      return matches[0];
    }
    return 0;
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

    Object.defineProperty(this, 'message', {
      name: 'message',
      enumerable: false,
      writable: true,
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

  getMessage() {
    return this.message;
  }

  setMessage(message) {
    this.message = message;
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

  getOriginalMessage() {
    return this.originalMessage;
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

class Queue {
  constructor() {
    this.items = [];
  }

  enqueue(item) {
    this.items.push(item);
  }

  dequeue() {
    if (this.isEmpty()) return null;
    return this.items.shift();
  }

  front() {
    if (this.isEmpty()) return null;
    return this.items[0];
  }

  isEmpty() {
    return this.items.length == 0;
  }

  size() {
    return this.items.length;
  }
}

class FatalError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FatalError';
  }
}

class ParsingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ParsingError';
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
    if (this.isJobClass(job)) {
      const log = this.createMessageLog(job, message);
      this.logger.info(log);
      return;
    }
    this.logger.info(message);
  }

  error(job, error) {
    if (this.isJobClass(job)) {
      const log = this.createMessageLog(job, error?.message);
      this.logger.error(log);
      return;
    }
    this.logger.error(error.message);
  }

  isJobClass(job) {
    return job instanceof Job;
  }
};

module.exports = {
  LinceScheduler,
  Job,
  ConsoleLogger,
  Handler,
  ParsingError,
  CronTask,
  MessageFetcher,
};
