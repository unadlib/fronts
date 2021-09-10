type Context = Record<string, any>;

let context: Context = {};

export const useContext = <T extends Context = Context>(initialContext?: T) => {
  if (initialContext) {
    context = initialContext;
  }
  return context as T;
};
