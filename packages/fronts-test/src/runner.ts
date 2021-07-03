type Step = (...args: any) => any;

const createRunner = ({
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
  const $ = async <T extends (...args: any) => any>(
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

  const Given = (desc: string, ...steps: Step[]) => {
    const Given = async (desc: string, ...steps: Step[]) => {
      for (const step of steps) {
        await $(step);
      }
    };
    Given.args = [desc, ...steps];
    return Given;
  };
  const When = (desc: string, ...steps: Step[]) => {
    const When = async (desc: string, ...steps: Step[]) => {
      for (const step of steps) {
        await $(step);
      }
    };
    When.args = [desc, ...steps];
    return When;
  };
  const Then = (desc: string, ...steps: Step[]) => {
    const Then = async (desc: string, ...steps: Step[]) => {
      for (const step of steps) {
        await $(step);
      }
    };
    Then.args = [desc, ...steps];
    return Then;
  };
  const And = (desc: string, ...steps: Step[]) => {
    const And = async (desc: string, ...steps: Step[]) => {
      for (const step of steps) {
        await $(step);
      }
    };
    And.args = [desc, ...steps];
    return And;
  };
  const run = async (...args: Step[]) => {
    for (const step of args) {
      await $(step, ...(step as any).args);
    }
  };
  return {
    run,
    $,
    Given,
    When,
    Then,
    And,
  };
};

const { run, $, Given, When, Then, And } = createRunner();

export { run, $, Given, When, Then, And, createRunner };
