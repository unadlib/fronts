import { DynamicImport, NodeElement } from './interface';

export const importApp = (dynamicImport: DynamicImport) => {
  window.__FRONTS__DYNAMIC__IMPORT__ = true;
  return dynamicImport();
};

export const loadApp = (dynamicImport: DynamicImport, target: NodeElement) => {
  return importApp(dynamicImport).then((module) => {
    if (typeof module.default !== 'function') {
      throw new Error(
        `The current App should define default exported rendering functions.`
      );
    }
    return module.default(target);
  });
};
