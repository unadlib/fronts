import { run, useContext, createContextHook, createRunner } from '..';

test('base', async () => {
  const func = (num: number) => num + 1;
  const result = await run(func, 1);
  expect(result).toBe(2);
});
