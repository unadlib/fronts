import { run, useContext, createContextHook, createRunner } from '..';

test('run', async () => {
  const func = (num: number) => num + 1;
  const result = await run(func, 1);
  expect(result).toBe(2);
});

test('useContext', async () => {
  interface Context {
    test?: number;
  }
  const foo = (num: number) => {
    const context = useContext<Context>();
    context.test = 100;
    return num + 1;
  };
  const bar = (num: number) => {
    const context = useContext<Context>();
    return context.test! + num + 1;
  };
  const result0 = await run(foo, 1);
  expect(result0).toBe(2);
  const result1 = await run(bar, 10);
  expect(result1).toBe(111);
});

test('createContextHook', async () => {
  const useContext = createContextHook<{ test?: number }>();
  const foo = (num: number) => {
    const context = useContext();
    context.test = 100;
    return num + 1;
  };
  const bar = (num: number) => {
    const context = useContext();
    return context.test! + num + 1;
  };
  const result0 = await run(foo, 1);
  expect(result0).toBe(2);
  const result1 = await run(bar, 10);
  expect(result1).toBe(111);
});

test('createRunner', async () => {
  const mockBefore = jest.fn();
  const mockAfter = jest.fn();
  const run = createRunner({
    before: mockBefore,
    after: mockAfter,
  });
  const useContext = createContextHook<{ test?: number }>();
  const foo = (num: number) => {
    const context = useContext();
    context.test = 100;
    return num + 1;
  };
  const bar = (num: number) => {
    const context = useContext();
    return context.test! + num + 1;
  };
  const result0 = await run(foo, 1);
  expect(result0).toBe(2);
  expect(mockBefore.mock.calls).toEqual([[foo, [1]]]);
  expect(mockAfter.mock.calls).toEqual([[foo, [1], 2]]);
  const result1 = await run(bar, 10);
  expect(result1).toBe(111);
  expect(result1).toBe(111);
  expect(mockBefore.mock.calls).toEqual([
    [foo, [1]],
    [bar, [10]],
  ]);
  expect(mockAfter.mock.calls).toEqual([
    [foo, [1], 2],
    [bar, [10], 111],
  ]);
});
