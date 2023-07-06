const { LinceScheduler, ParsingError, CronTask } = require('./index');
const moment = require('moment');

describe('Test Execution', () => {

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  jest.setTimeout(50000);

  test('test success execution', async () => {
    const handler = {
      handle(job) {
        return 'test';
      }
    };
    const scheduler = new LinceScheduler({
      handler
    });
    expect(scheduler).toBeInstanceOf(LinceScheduler);
  
    const job = await scheduler.execute('test');    expect(job.wasSuccessful()).toBeTruthy();
  });

  test('test error execution', async () => {
    const handler = {
      handle(job) {
        throw new Error('test');
      }
    };
    const scheduler = new LinceScheduler({
      handler
    });
    expect(scheduler).toBeInstanceOf(LinceScheduler);
  
    const job = await scheduler.execute('test');
    expect(job.wasError()).toBeTruthy();
  });

  test('test with parser error', async () => {
    const handler = {
      handle(job) {
        console.log(job);
      }
    };
    const parser = {
      parse(message) {
        throw new Error('test error parsing');
      }
    };
    const scheduler = new LinceScheduler({
      handler, 
      parser
    });
    expect(scheduler).toBeInstanceOf(LinceScheduler);
  
    const job = await scheduler.execute('test');
    expect(job.wasError()).toBeTruthy();
    expect(job.getLastError()).toBeInstanceOf(ParsingError);
    expect(job.getLastError().message).toBe('test error parsing');
  });

  test('test cron task forward', async () => {
    const cronTaskMinute = new CronTask({
      cronExpression: `${moment().add(1, 'minute').minute()} * * * * *`,
    });
    expect(cronTaskMinute.calculateInterval()).toBeGreaterThanOrEqual(60000);

    const cronTaskHour = new CronTask({
      cronExpression: `* ${moment().add(1, 'hour').hour()} * * * *`,
    });
    expect(cronTaskHour.calculateInterval()).toBeGreaterThanOrEqual(360000);

    const cronTaskDay = new CronTask({
      cronExpression: `* * ${moment().add(1, 'day').date()} * * *`,
    });
    expect(cronTaskDay.calculateInterval()).toBeGreaterThanOrEqual(86400000);

    const cronTaskMonth = new CronTask({
      cronExpression: `* * * ${moment().add(1, 'month').month()} *`
    });
    expect(cronTaskMonth.calculateInterval()).toBeGreaterThanOrEqual(2678400000);

    const tomorrow = moment().add(1, 'day');
    const cronTaskDayOfWeek = new CronTask({
      cronExpression: `* * * * ${tomorrow.day()}`
    });
    expect(cronTaskDayOfWeek.calculateInterval()).toBeGreaterThanOrEqual(86400000);
  });

  test('test cron task backward', async () => {
    const cronTaskMinute = new CronTask({
      cronExpression: `${moment().subtract(1, 'minute').minute()} * * * * *`,
    });
    expect(cronTaskMinute.calculateInterval()).toBe(3540000);

    const cronTaskHour = new CronTask({
      cronExpression: `* ${moment().subtract(1, 'hour').hour()} * * * *`,
    });
    expect(cronTaskHour.calculateInterval()).toBe(82800000);

    const cronTaskDay = new CronTask({
      cronExpression: `* * ${moment().subtract(1, 'day').date()} * * *`,
    });
    expect(cronTaskDay.calculateInterval()).toBe(2592000000);

    const cronTaskMonth = new CronTask({
      cronExpression: `* * * ${moment().subtract(1, 'month').month() + 1} *`
    });
    expect(cronTaskMonth.calculateInterval()).toBe(29030400000);
    console.log(cronTaskMonth.calculateInterval());

    const tomorrow = moment().add(1, 'day');
    const cronTaskDayOfWeek = new CronTask({
      cronExpression: `* * * * ${tomorrow.day()}`
    });
    expect(cronTaskDayOfWeek.calculateInterval()).toBeGreaterThanOrEqual(86400000);
  });

  test('test cron task backward', async () => {
    const cronTaskTens = new CronTask({
      cronExpression: `*/10 * * * *`,
    });

    expect(cronTaskTens.calculateInterval()).toBe(10000);
  });

  test.only('test schedule fetcher', async () => {
    const handler = {
      handle(job) {
        throw new Error('test');
      }
    };
    const scheduler = new LinceScheduler({
      handler
    });
    expect(scheduler).toBeInstanceOf(LinceScheduler);

    const task = scheduler.schedule({
      cronExpression: '*/10 * * * *'
    });
    await task.getPromise();

    console.log('finished');
  });

});

