import { insertStyle } from './insertStyle';
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
    const rootNode = document.createElement('div');
    rootNode.setAttribute('data-fronts', options.name ?? 'undefined');
    rootNode.setAttribute('data-time', Date.now().toString());
    options.target?.appendChild(rootNode);
    if (options.name) {
      insertStyle(rootNode, options.name);
    }
    const renderNode = document.createElement('div');
    rootNode.appendChild(renderNode);
    // TODO: pass `props`
    return module.default(renderNode);
  });
};
