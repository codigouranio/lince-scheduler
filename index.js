const AWS = require('aws-sdk');
const moment = require('moment');

module.exports.LinceScheduler = class LinceScheduler {
  constructor(options) {
    const defaults = {
      startIntervalMs: 1000,
      intervalMs: 1000,
      maxIntervalMs: 1000 * 60 * 60,
      maxRetries: 10
    };

    options = Object.assign({}, defaults, options);
  }
} 

module.exports.Job = class Job {
  constructor(options) {
  }
}

module.exports.FatalError = class FatalError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FatalError';
  }
}

module.exports.Logger = class Logger {
}
