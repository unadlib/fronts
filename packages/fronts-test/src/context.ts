export const createContextHook = <T extends Record<string, any>>(
  context?: T
): (() => T) => {
  const internalContext = context ?? ({} as T);
  return () => internalContext!;
};

export const useContext: <
  T extends Record<string, any> = Record<string, any>
>() => T = createContextHook();
