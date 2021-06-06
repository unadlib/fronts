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
    before?.(func, args);
    // eslint-disable-next-line prefer-spread
    const result = await func.apply(null, args);
    after?.(func, args, result);
    return result;
  };
};

export const run = createRunner();
