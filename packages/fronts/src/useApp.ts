import { DynamicImport, NodeElement } from "./interface";
import { loadApp } from "./loadApp";

/**
 * Use app script from remote
 *
 * # Example
 * ```ts
 * useApp(() => import('app1'), targetNode).then((unmount) => {});
 * ```
 */
export const useApp = (dynamicImport: DynamicImport, target: NodeElement) => {
  return loadApp(dynamicImport).then((module) => {
    if (typeof module.default !== 'function') {
      throw new Error(
        `The current App should define default exported rendering functions.`
      );
    }
    return module.default(target);
  });
};
