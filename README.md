# LinceScheduler

The Lince Scheduler is a JavaScript module that provides a way to schedule
execution of jobs. It allows you to define and schedule jobs execution with 
configurable retry logic and error handling. 

## Installation

You can install `LinceScheduler` module by using npm:
```
npm install lince-scheduler
```

## Usage

To use the Lince Scheduler in your project, follow these steps:

1. Import the necessary classes:

```javascript
const { LinceScheduler, Job, Handler } = require('lince-schedule');
```

2. Create an instance of `LinceScheduler`:

```javascript
const scheduler = new LinceScheduler(options);
```

3. Define a custom job handler by extending the 'Handler' class and implementing the 'handle' method:

```javascript
class MyJobHandler extends Handler {
  handle(job) {
    // Implement your job handling logic here
    // Return a result or throw an error if needed
  }
}
```

4.Create a job and execute:

```javascript
const job = new Job({ originalMessage: 'My job message' });

schedule.execute(job)
  .then((job) => console.log(job))
  .catch((err) => console.error(err.message));
```

## Custom configuration

Customize other aspects of the scheduler, such as the logger and parser, if needed:

```javascript
const options = {
  handler: new MyJobHandler(),
  parser: new MyJobParser(),
  logger: new ConsoleLogger(),
  // Customize other options such as intervalMs, maxIntervalMs, etc.
};
const scheduler = new LinceScheduler(options);
```

## API

## Lince Scheduler

The `LinceScheduler` class represents a scheduler for executing jobs.

Constructor

* `new LinceScheduler(options)`: Creates a new instance of the scheduler. Accepts the following options:

  * `startIntervalMs`: The interval in milliseconds between the first job to execute (default: 1000).
  * `maxIntervalMs`: The maximum interval in milliseconds between jobs to execute (default: 3600).
  * `intervalMs`: The interval in milliseconds between jobs to execute (default: 1000).
  * `maxRetries`: The maximum number of retries (default: 3).
  * `handler`: An instance of a custom handler.
  * `parser`: An instance of a custom parser.
  * `logger`: An instance of a custom logger.

Methods

* `execute(message)`: Executes a job with the provided original message. Returns a promise that resolves with the executed job or rejects with an error. 

## Job

The `Job` class represents a job to be executed.

Constructor

* `new Job(options)`: Creates a new instance of a job. Accepts the following options:
  * `originalMessage`: The original message associated with the job which will be parsed and executed.
  * `maxRetries`: The maximum of retries (default: 3).

Methods

* `getOriginalMessage`: Returns the original message associated with the job.


