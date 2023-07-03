const { LinceScheduler, ParsingError } = require('./index');

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

});

