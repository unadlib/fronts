import { DynamicImport } from './interface';

export const loadApp = (dynamicImport: DynamicImport, name: string) => {
  window.__FRONTS__DYNAMIC__IMPORT__ = true;
  return dynamicImport(name);
};
