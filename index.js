const moment = require('moment');
const { AsyncLocalStorage } = require('async_hooks');
const winston = require('winston');
const { format, createLogger, transport } = require('winston');
const { v4: uuidv4 } = require('uuid');

/**
 * Executor for retrying tasks.
 * @param {*} options
 */
class TaskRetryExecutor {
  constructor(options) {
    const defaults = {
      startIntervalMs: 1000,
      intervalMs: 1000,
      maxIntervalMs: 1000 * 60 * 60,
      maxRetries: 3,
      handler: new TaskHandler(),
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
    const task = new ScheduleTask(this, options);
    task.start();
    return task;
  }

  /**
   * Execute a task.
   * @param {*} originalMessage
   * @returns
   */
  async execute(originalMessage) {
    const task = new Task({
      maxRetries: this.maxRetries,
      originalMessage,
    });
    try {
      this.logger.info(task, 'Parsing message');
      task.setMessage(this.parser.parse(this, originalMessage));
    } catch (error) {
      task.setCompletedAsError(new ParsingError(error.message));
      this.logger.error(task, error);
      return task;
    }
    task.setLocalStorage(this.localStorage);
    try {
      await this.retryPromise(task, this.calculateInterval(task));
    } catch (error) {
      this.logger.error(task, error);
    }
    return task;
  }

  /**
   * Schedule a task.
   * @param {*} task
   * @returns
   */
  async retryPromise(task, interval) {
    this.stats.totalPending++;
    return new Promise((resolve, reject) => {
      this.localStorage.run(task, () =>
        this.retry(task, interval, resolve, reject)
      );
    });
  }

  retry(task, interval, resolve, reject) {
    setTimeout(() => this.handleTask(task, resolve, reject), interval);
  }

  handleTask(task, resolve, reject) {
    try {
      task.increaseRetries();
      this.logger.info(task, `Handle task ${task.uuid}`);
      const result = this.handler.handle(task);
      task.setCompletedAsSuccess(result);
      this.stats.totalExecuted++;
      this.logger.info(task, 'Executed successfully');
      return resolve(task);
    } catch (error) {
      if (
        error instanceof FatalError ||
        task.getRetries() >= task.getMaxRetries()
      ) {
        task.setCompletedAsError(error);
      }

      if (task.status == 'error') {
        this.stats.totalExecuted++;
        this.stats.totalErrors++;
        return reject(error);
      }

      this.logger.error(task, error);
      task.setLastError(error);
      this.retry(task, this.calculateInterval(task), resolve, reject);
    }
  }

  /**
   * Calculate the interval for the next execution.
   * @param {*} task
   * @returns
   */
  calculateInterval(task) {
    const interval = this.intervalMs * Math.pow(2, task.retries);
    return Math.min(interval, this.maxIntervalMs);
  }

  handleFatalError(task, error) {
    this.handler.handleFatalError(task, error);
  }

  getLocalStorage() {
    return this.localStorage;
  }

  getMaxRetries() {
    return this.maxRetries;
  }
};

class TaskScheduler {
  constructor(options) {
    const defaults = {
      promise: new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
      }),
      maxLoops: -1,
      stopped: false,
      cronTask: new CronTask(options.cronExpression),
      messageFetcher: new MessageFetcher(),
      executor: new TaskRetryExecutor(),
      logger: new ConsoleLogger(),
    };

    options = Object.assign({}, defaults, options);

    this.promise = options.promise;
    this.maxLoops = options.maxLoops;
    this.cronTask = options.cronTask;
    this.messageFetcher = options.messageFetcher;
    this.executor = options.executor;
    this.logger = options.logger;
    this.started = false;
    this.stopped = false;
  }

  /**
   * Start the task.
   * @param {*} funcTask
   */
  start() {
    this.timeoutId = setTimeout(async () => {
      try {
        this.logger.info({}, `executing task at ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
        const messages = await this.messageFetcher.fetchMessages();
        if (Array.isArray(messages)) {
          this.logger.info({}, `Found ${messages.length} messages`);
          const tasks = await Promise.allSettled(
            messages.map((message) => this.executor.execute(message))
          );
          const totalErrors = tasks.reduce((acc, task) => task.status === 'rejected' ? acc + 1 : acc, 0);
          this.logger.info({}, `Executed ${tasks.length} tasks and ${totalErrors} failed`);
        }
      } catch (error) {
        this.logger.error({}, error);
      }

      if (this.maxLoops > 0) {
        this.maxLoops--;
      }

      if (this.maxLoops > 0 || this.maxLoops == -1) {
        this.start();
      } else {
        this.stop();
      }
    }, this.cronTask.calculateInterval());
  }

  stop() {
    clearTimeout(this.timeoutId);
    this.resolve();
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

  getPromise() {
    return this.promise;
  }
}

class TaskHandler {
  constructor(options) {}

  handle(task) {
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
  handle(task) {
    return { message: 'not implemented' };
  }
}

class HandlerFatalError {
  handle(task, error) {
    return { message: 'not implemented' };
  }
}

class Parser {
  constructor(options) {}

  parse(originalMessage) {
    return { message: 'not implemented' };
  }
}

class Task {
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

  createMessageLog(task, message) {
    return {
      ...{
        uuid: task.uuid,
        retry: `${task.getRetries()}/${task.getMaxRetries()}`,
      },
      ...{ message },
    };
  }

  info(task, message) {
    if (this.isTaskClass(task)) {
      const log = this.createMessageLog(task, message);
      this.logger.info(log);
      return;
    }
    this.logger.info(message);
  }

  error(task, error) {
    if (this.isTaskClass(task)) {
      const log = this.createMessageLog(task, error?.message);
      this.logger.error(log);
      return;
    }
    this.logger.error(error.message);
  }

  isTaskClass(task) {
    return task instanceof Task;
  }
};

module.exports = {
  TaskRetryExecutor,
  TaskScheduler,
  TaskHandler,
  Task,
  MessageFetcher,  
  ConsoleLogger,
  ParsingError,
  CronTask
};
