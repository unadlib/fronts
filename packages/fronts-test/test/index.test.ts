import { $, onStep, When, Given, Then, And, useContext } from '../src';

test('run', async () => {
  const func = $((num: number) => num + 1);
  const result = await func(1);
  expect(result).toBe(2);
});

test('base useContext', async () => {
  interface Context {
    test?: number;
  }
  const foo = $((num: number) => {
    const context = useContext<Context>();
    context.test = 100;
    return num + 1;
  });
  const bar = $((num: number) => {
    const context = useContext<Context>();
    return context.test! + num + 1;
  });
  const result0 = await foo(1);
  expect(result0).toBe(2);
  const result1 = await bar(10);
  expect(result1).toBe(111);
});

test('useContext with initialContext', async () => {
  const fn = jest.fn();
  const foo = $((num: number) => {
    const context = useContext<{ text: string; test?: number }>({
      text: 'testText',
    });
    context.test = 100;
    return num + 1;
  });
  const bar = $((num: number) => {
    const context = useContext<{ text: string; test?: number }>();
    fn(context);
    return context.test! + num + 1;
  });
  const result0 = await foo(1);
  expect(result0).toBe(2);
  const result1 = await bar(10);
  expect(result1).toBe(111);
  expect(fn.mock.calls[0]).toEqual([{ text: 'testText', test: 100 }]);
});

test('onStep', async () => {
  const mockBefore = jest.fn();
  const mockAfter = jest.fn();
  onStep({
    before: mockBefore,
    after: mockAfter,
  });
  const foo = (num: number) => {
    const context = useContext();
    context.test = 100;
    return num + 1;
  };
  const bar = (num: number) => {
    const context = useContext();
    return context.test! + num + 1;
  };
  const result0 = await $(foo)(1);
  expect(result0).toBe(2);
  expect(mockBefore.mock.calls).toEqual([[foo, [1]]]);
  expect(mockAfter.mock.calls).toEqual([[foo, [1], 2]]);
  const result1 = await $(bar)(10);
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

test('base Builder', async () => {
  const fn = jest.fn();
  const foo = $((num: number) => {
    fn('foo', num);
    const context = useContext<{ test?: number }>();
    context.test = 100;
    return num + 1;
  });
  const bar = $(() => {
    fn('bar');
    const context = useContext();
    return context.test! + 10;
  });

  const foobar = $(() => {
    fn('foobar');
    const context = useContext();
    return context.test! * 100;
  });

  await Given('given foo', 1).then(foo);
  await When('when bar');
  await Then('then foobar').then(bar);
  await And('and fn').then(foobar);

  expect(fn.mock.calls).toEqual([['foo', 1], ['bar'], ['foobar']]);
});

test('Builder with hook', async () => {
  const mockBefore = jest.fn();
  const mockAfter = jest.fn();
  onStep({
    before: mockBefore,
    after: mockAfter,
  });
  const foo = (num: number) => {
    const context = useContext<{ test?: number }>();
    context.test = 100;
    return num + 1;
  };
  const bar = () => {
    const context = useContext<{ test?: number }>();
    return context.test! + 10;
  };

  const foobar = () => {
    const context = useContext<{ test?: number }>();
    return context.test! * 100;
  };

  await Given('given foo').then(() => $(foo)(1));
  await When('when bar').then($(bar));
  await Then('then foobar').then($(foobar));
  await And('and fn');

  expect(
    mockBefore.mock.calls.map(([{ name }, ...args]) => [name, ...args])
  ).toEqual([
    ['Given', ['given foo']],
    ['foo', [1]],
    ['When', ['when bar']],
    ['bar', [undefined]],
    ['Then', ['then foobar']],
    ['foobar', [undefined]],
    ['And', ['and fn']],
  ]);

  expect(
    mockAfter.mock.calls.map(([{ name }, ...args]) => [name, ...args])
  ).toEqual([
    ['Given', ['given foo'], undefined],
    ['foo', [1], 2],
    ['When', ['when bar'], undefined],
    ['bar', [undefined], 110],
    ['Then', ['then foobar'], undefined],
    ['foobar', [undefined], 10000],
    ['And', ['and fn'], undefined],
  ]);
});

test('multiple action in Builder with hook', async () => {
  const mockBefore = jest.fn();
  const mockAfter = jest.fn();
  onStep({
    before: mockBefore,
    after: mockAfter,
  });
  const foo = async (num: number) => {
    const context = useContext<{ test?: number }>();
    context.test = 100;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return num + 1;
  };
  const foo1 = (s: number) => 100 + s;

  const bar = () => {
    const context = useContext<{ test?: number }>();
    return context.test! + 10;
  };

  const foobar = () => {
    const context = useContext<{ test?: number }>();
    return context.test! * 100;
  };

  await Given('given foo', 1).then($(foo)).then($(foo1));
  await When('when bar').then($(bar));
  await Then('then foobar').then($(foobar));
  await And('and fn');

  expect(
    mockBefore.mock.calls.map(([{ name }, ...args]) => [name, ...args])
  ).toEqual([
    ['Given', ['given foo', 1]],
    ['foo', [1]],
    ['foo1', [2]],
    ['When', ['when bar']],
    ['bar', [undefined]],
    ['Then', ['then foobar']],
    ['foobar', [undefined]],
    ['And', ['and fn']],
  ]);

  expect(
    mockAfter.mock.calls.map(([{ name }, ...args]) => [name, ...args])
  ).toEqual([
    ['Given', ['given foo', 1], 1], // resolve(1)
    ['foo', [1], 2],
    ['foo1', [2], 102],
    ['When', ['when bar'], undefined],
    ['bar', [undefined], 110],
    ['Then', ['then foobar'], undefined],
    ['foobar', [undefined], 10000],
    ['And', ['and fn'], undefined],
  ]);
});
