const { LinceScheduler, Handler } = require('./index');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

jest.setTimeout(50000);

test('test', async () => {
  const handler = {
    handle(job) {
      console.log('get job');
      throw new Error('test');
      return 'test';
    }
  };
  const scheduler = new LinceScheduler({
    handler
  });
  expect(scheduler).toBeInstanceOf(LinceScheduler);

  const job = await scheduler.execute('test');
  job.print();
  expect(job.getResult()).toBe('test');
});