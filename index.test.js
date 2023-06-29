const { LinceScheduler, Handler } = require('./index');

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
  
    const job = await scheduler.execute('test');
    expect(job.wasSuccessful()).toBeTruthy();
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

});

