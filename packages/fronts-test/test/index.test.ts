import {
  $,
  When,
  Given,
  Then,
  And,
  run,
  useContext,
  createContextHook,
  createRunner,
} from '..';

test('run', async () => {
  const func = (num: number) => num + 1;
  const result = await $(func, 1);
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
  const result0 = await $(foo, 1);
  expect(result0).toBe(2);
  const result1 = await $(bar, 10);
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
  const result0 = await $(foo, 1);
  expect(result0).toBe(2);
  const result1 = await $(bar, 10);
  expect(result1).toBe(111);
});

test('createRunner', async () => {
  const mockBefore = jest.fn();
  const mockAfter = jest.fn();
  const { $ } = createRunner({
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
  const result0 = await $(foo, 1);
  expect(result0).toBe(2);
  expect(mockBefore.mock.calls).toEqual([[foo, [1]]]);
  expect(mockAfter.mock.calls).toEqual([[foo, [1], 2]]);
  const result1 = await $(bar, 10);
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

test('base runner', async () => {
  const fn = jest.fn();
  // const { $, When, Given, Then, And, run } = createRunner({
  //   before: mockBefore,
  //   after: mockAfter,
  // });
  const useContext = createContextHook<{ test?: number }>();
  const foo = (num: number) => {
    fn('foo', num);
    const context = useContext();
    context.test = 100;
    return num + 1;
  };
  const bar = () => {
    fn('bar');
    const context = useContext();
    return context.test! + 10;
  };

  const foobar = () => {
    fn('foobar');
    const context = useContext();
    return context.test! * 100;
  };

  await run(
    Given('given foo', () => $(foo, 1)),
    When('when bar', bar),
    Then('then foobar', foobar),
    And('and fn')
  );

  expect(fn.mock.calls).toEqual([['foo', 1], ['bar'], ['foobar']]);
});

test('createRunner', async () => {
  const mockBefore = jest.fn();
  const mockAfter = jest.fn();
  const { $, When, Given, Then, And, run } = createRunner({
    before: mockBefore,
    after: mockAfter,
  });
  const useContext = createContextHook<{ test?: number }>();
  const foo = (num: number) => {
    const context = useContext();
    context.test = 100;
    return num + 1;
  };
  const bar = () => {
    const context = useContext();
    return context.test! + 10;
  };

  const foobar = () => {
    const context = useContext();
    return context.test! * 100;
  };

  await run(
    Given('given foo', () => $(foo, 1)),
    When('when bar', bar),
    Then('then foobar', foobar),
    And('and fn')
  );

  expect(
    mockBefore.mock.calls.map(([{ name }, [first]]) => [name, first])
  ).toEqual([
    ['Given', 'given foo'],
    ['', undefined],
    ['foo', 1],
    ['When', 'when bar'],
    ['bar', undefined],
    ['Then', 'then foobar'],
    ['foobar', undefined],
    ['And', 'and fn'],
  ]);
  expect(
    mockAfter.mock.calls.map((args) => [args[0].name, ...args.slice(-1)])
  ).toEqual([
    ['foo', 2],
    ['', 2],
    ['Given', undefined],
    ['bar', 110],
    ['When', undefined],
    ['foobar', 10000],
    ['Then', undefined],
    ['And', undefined],
  ]);
});
