import { createProgressSync } from '../progressSync';

afterEach(() => {
  jest.useRealTimers();
});

it('debounces frequent positions and skips a repeat of the last successful position', async () => {
  jest.useFakeTimers();
  const send = jest.fn(async (_position: number) => {});
  const sync = createProgressSync(send);
  sync.queue(1);
  sync.queue(2);
  sync.queue(47);
  jest.advanceTimersByTime(1499);
  expect(send).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  await Promise.resolve();
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith(47);
  sync.queue(48);
  sync.queue(47); // Returning to the last synced position cancels the pending 48.
  jest.advanceTimersByTime(1500);
  expect(send).toHaveBeenCalledTimes(1);
});

it('serializes requests so an older progress update cannot finish after a newer one', async () => {
  jest.useFakeTimers();
  let release!: () => void;
  const send = jest.fn()
    .mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }))
    .mockResolvedValue(undefined);
  const sync = createProgressSync(send);
  sync.queue(1);
  jest.advanceTimersByTime(1500);
  sync.queue(2);
  jest.advanceTimersByTime(1500);
  expect(send).toHaveBeenCalledTimes(1);
  release();
  await Promise.resolve();
  jest.advanceTimersByTime(1500);
  expect(send).toHaveBeenNthCalledWith(2, 2);
});

it('flushes the latest position on exit and can cancel without sending', () => {
  jest.useFakeTimers();
  const send = jest.fn(async (_position: number) => {});
  const sync = createProgressSync(send);
  sync.queue(8);
  sync.queue(9);
  sync.flush();
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith(9);
  sync.queue(10);
  const canceled = createProgressSync(send);
  canceled.queue(11);
  canceled.cancel();
  jest.runOnlyPendingTimers();
  expect(send).toHaveBeenCalledTimes(1);
});
