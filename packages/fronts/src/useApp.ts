import { UseApp } from './interface';
import { loadApp } from './loadApp';

/**
 * Use app script from remote
 *
 * # Example
 * ```ts
 * useApp(() => import('app1'), { target }).then((unmount) => {});
 * ```
 */
export const useApp: UseApp = (dynamicImport, options) => {
  return loadApp(dynamicImport).then((module) => {
    if (typeof module.default !== 'function') {
      throw new Error(
        `The current App should define default exported rendering functions.`
      );
    }
    // TODO: pass `props`
    return module.default(options.target);
  });
};
