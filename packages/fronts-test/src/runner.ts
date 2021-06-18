export const createRunner = ({
  before,
  after,
}: {
  before?: (func: (...args: any) => any, args: any[]) => Promise<void>;
  after?: (
    func: (...args: any) => any,
    args: any[],
    result: any
  ) => Promise<void>;
} = {}) => {
  return async <T extends (...args: any) => any>(
    func: T,
    ...args: Parameters<T>
  ): Promise<ReturnType<T>> => {
    try {
      await before?.(func, args);
    } catch (e) {
      console.error(e);
    }
    // eslint-disable-next-line prefer-spread
    const result = await func.apply(null, args);
    try {
      await after?.(func, args, result);
    } catch (e) {
      console.error(e);
    }
    return result;
  };
};

export const run = createRunner();
