const { TaskRetryExecutor, TaskScheduler, ParsingError, CronTask } = require('./index');
const moment = require('moment');

describe('Test Execution', () => {

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  jest.setTimeout(85000);

  test('test success execution', async () => {
    const executor = new TaskRetryExecutor({
      handler: {
        handle(task) {
          return 'test';
        }
      }
    });
    expect(executor).toBeInstanceOf(TaskRetryExecutor);
  
    const task = await executor.execute('test');
    expect(task.wasSuccessful()).toBeTruthy();
  });

  test('test error execution', async () => {
    const executor = new TaskRetryExecutor({
      handler: {
        handle(task) {
          throw new Error('test');
        }
      }
    });
    expect(executor).toBeInstanceOf(TaskRetryExecutor);
  
    const task = await executor.execute('test');
    expect(task.wasError()).toBeTruthy();
  });

  test('test with parser error', async () => {
    const executor = new TaskRetryExecutor({
      handler: {
        handle(task) {
          console.log(task);
        }
      }, 
      parser: {
        parse(message) {
          throw new Error('test error parsing');
        }
      }
    });
    expect(executor).toBeInstanceOf(TaskRetryExecutor);
  
    const task = await executor.execute('test');
    expect(task.wasError()).toBeTruthy();
    expect(task.getLastError()).toBeInstanceOf(ParsingError);
    expect(task.getLastError().message).toBe('test error parsing');
  });

  test('test cron task forward', async () => {
    const cronTaskMinute = new CronTask(`${moment().add(1, 'minute').minute()} * * * * *`);
    expect(cronTaskMinute.calculateInterval()).toBeGreaterThanOrEqual(60000);

    const cronTaskHour = new CronTask(`* ${moment().add(1, 'hour').hour()} * * * *`);
    expect(cronTaskHour.calculateInterval()).toBeGreaterThanOrEqual(360000);

    const cronTaskDay = new CronTask(`* * ${moment().add(1, 'day').date()} * * *`);
    expect(cronTaskDay.calculateInterval()).toBeGreaterThanOrEqual(86400000);

    const cronTaskMonth = new CronTask(`* * * ${moment().add(1, 'month').month() + 1} *`);
    expect(cronTaskMonth.calculateInterval()).toBeGreaterThanOrEqual(2678400000);

    const tomorrow = moment().add(1, 'day');
    const cronTaskDayOfWeek = new CronTask(`* * * * ${tomorrow.day()}`);
    expect(cronTaskDayOfWeek.calculateInterval()).toBeGreaterThanOrEqual(86400000);
  });

  test('test cron task backward', async () => {
    const cronTaskMinute = new CronTask(`${moment().subtract(1, 'minute').minute()} * * * *`);
    expect(cronTaskMinute.calculateInterval()).toBe(3540000);

    const cronTaskHour = new CronTask(`* ${moment().subtract(1, 'hour').hour()} * * *`);
    expect(cronTaskHour.calculateInterval()).toBe(82800000);

    const cronTaskDay = new CronTask(`* * ${moment().subtract(1, 'day').date()} * *`);
    expect(cronTaskDay.calculateInterval()).toBe(2592000000);

    const cronTaskMonth = new CronTask(`* * * ${moment().subtract(1, 'month').month() + 1} *`);
    expect(cronTaskMonth.calculateInterval()).toBe(29030400000);

    const tomorrow = moment().add(1, 'day');
    const cronTaskDayOfWeek = new CronTask(`* * * * ${tomorrow.day()}`);
    expect(cronTaskDayOfWeek.calculateInterval()).toBeGreaterThanOrEqual(86400000);
  });

  test('test cron task backward', async () => {
    const cronTaskTens = new CronTask(`*/10 * * * *`);

    expect(cronTaskTens.calculateInterval()).toBe(10000);
  });

  test('test schedule fetcher', async () => {
    const executor = new TaskRetryExecutor({
      handler: {
        handle(task) {
          throw new Error('test');
        }
      }
    });
    const scheduler = new TaskScheduler({  
      cronExpression: '*/10 * * * *', 
      maxLoops: 3,
      executor
    });
    scheduler.start();
    await scheduler.getPromise();
  });

  test('test schedule fetcher error', async () => {
    const executor = new TaskRetryExecutor({
      handler: {
        async handle(task, context) {
          console.log(`test ${moment().format('HH:mm:ss')}}`);
          throw new Error('dummy test');
        }
      }
    });
    const scheduler = new TaskScheduler({
      cronExpression: '*/10 * * * *', 
      executor, 
      maxLoops: 3
    });
    expect(scheduler).toBeInstanceOf(TaskScheduler);

    scheduler.start();
    await scheduler.getPromise();
    expect(scheduler.getStats().totalExecuted).toBe(6);
    expect(scheduler.getStats().totalErrors).toBe(6);
    expect(scheduler.getStats().totalPending).toBe(0);
  });


});

