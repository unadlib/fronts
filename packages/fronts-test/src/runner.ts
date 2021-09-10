/* eslint-disable @typescript-eslint/no-explicit-any */
type PromiseType<T> = T extends Promise<infer R> ? R : T;

type Step = (...args: any) => any;
type Before = (func: (...args: any) => any, args: any[]) => Promise<void>;
type After = (
  func: (...args: any) => any,
  args: any[],
  result: any
) => Promise<void>;

let before: Before | undefined;
let after: After | undefined;

export const onStep = (
  options: {
    before?: Before;
    after?: After;
  } = {}
) => {
  before = options.before;
  after = options.after;
};

export const $ = <T extends Step>(func: T) => {
  const fn = async (
    ...args: Parameters<T>
  ): Promise<PromiseType<ReturnType<T>>> => {
    try {
      await before?.(func, args);
    } catch (e) {
      console.warn(e);
    }
    // eslint-disable-next-line prefer-spread
    const result = await func.apply(null, args);
    try {
      await after?.(func, args, result);
    } catch (e) {
      console.warn(e);
    }
    return result;
  };
  return fn;
};

const Given = <T>(desc: string, props?: T) =>
  new Promise<T | undefined>((resolve) => {
    resolve(props);
  });

const $Given: <T>(desc: string, props?: T) => Promise<T> = $<Step>(Given);

const When = <T>(desc: string, props?: T) =>
  new Promise<T | undefined>((resolve) => {
    resolve(props);
  });

const $When: <T>(desc: string, props?: T) => Promise<T> = $<Step>(When);

const Then = <T>(desc: string, props?: T) =>
  new Promise<T | undefined>((resolve) => {
    resolve(props);
  });

const $Then: <T>(desc: string, props?: T) => Promise<T> = $<Step>(Then);

const And = <T>(desc: string, props?: T) =>
  new Promise<T | undefined>((resolve) => {
    resolve(props);
  });

const $And: <T>(desc: string, props?: T) => Promise<T> = $<Step>(And);

export { $Given as Given, $When as When, $Then as Then, $And as And };
