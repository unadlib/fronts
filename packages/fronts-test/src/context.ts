export const createContextHook = <T extends Record<string, any>>(
  context?: T
): (() => T) => {
  const internalContext = context ?? ({} as T);
  return () => internalContext!;
};

export const useContext = createContextHook();
