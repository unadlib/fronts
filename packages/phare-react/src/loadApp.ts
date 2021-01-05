import { DynamicImport, NodeElement } from './interface';

export const loadApp = (dynamicImport: DynamicImport, target: NodeElement) => {
  window.__PHARE__DYNAMIC__IMPORT__ = true;
  return dynamicImport().then((module) => {
    return module.default(target);
  });
};
